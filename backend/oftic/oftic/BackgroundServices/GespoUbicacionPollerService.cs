using Comun.Dtos.Tenant;
using Datos.Interfaz;
using Datos.Tenant;
using Microsoft.Extensions.Options;
using Negocio.Interfaz;
using Npgsql;
using Oracle.ManagedDataAccess.Client;
using System.Diagnostics;

namespace Api.BackgroundServices
{
    /// <summary>
    /// Servicio alojado que sincroniza periódicamente la georreferenciación GPS de
    /// patrullas/cuadrantes desde GESPO hacia <c>cad_medios_disponibles</c> de cada
    /// CAD activo — reemplaza (o complementa) el flujo push existente
    /// (<c>POST api/Turnos/gespo/ubicaciones</c>) con un pull programado, para no
    /// depender de que GESPO llame proactivamente a SECAD.
    ///
    /// <para><b>Conexión a Oracle:</b> lectura directa vía
    /// <see cref="IGespoOracleReader"/> (driver Oracle.ManagedDataAccess.Core,
    /// 100% administrado) — no usa Foreign Data Wrapper ni ninguna extensión de
    /// Postgres, precisamente porque esas extensiones no son instalables en todos
    /// los servidores Postgres de los tenants.</para>
    ///
    /// <para><b>Filtrado por tenant:</b> la vista Oracle trae GPS de todo el país,
    /// así que cada tenant consulta Oracle filtrando por
    /// <c>secad_tenants.gespo_sigla_unidad</c> (columna SIGLA_PAPA_UNIDAD en
    /// GESPO) — un tenant nunca recibe (ni carga en memoria) patrullas de otras
    /// ciudades. Un tenant sin ese campo configurado simplemente se salta, sin
    /// error.</para>
    ///
    /// <para><b>Ciclo:</b></para>
    /// <list type="number">
    ///   <item>Carga los tenants activos desde la BD maestra.</item>
    ///   <item>Para cada uno, en paralelo (máx. <see cref="GespoUbicacionPollerOptions.MaxParallelTenants"/>),
    ///         consulta Oracle filtrado por su sigla y, si trae resultados, abre un
    ///         scope de DI, fija el <see cref="TenantContext"/> manualmente (igual
    ///         que <c>TenantMiddleware</c> lo haría por request) y llama a
    ///         <see cref="IDbTurnoService.P_ActualizarUbicacionesGespoAsync"/> — el
    ///         mismo método bulk (UPDATE...unnest) que usa el endpoint de push.</item>
    /// </list>
    ///
    /// <para>Deshabilitado por defecto (<c>GespoUbicacionPoller:Enabled = false</c>).
    /// Además, aunque el poller esté habilitado, no escribe nada mientras
    /// <c>GespoOracle:Enabled = false</c> o falte el ConnectionString — ver
    /// <see cref="Datos.Gestion.GespoOracleOptions"/>.</para>
    /// </summary>
    public sealed class GespoUbicacionPollerService : BackgroundService
    {
        private readonly IServiceScopeFactory                   _scopeFactory;
        private readonly ConnectionPoolManager                  _poolManager;
        private readonly IGespoOracleReader                     _oracleReader;
        private readonly GespoUbicacionPollerOptions             _opts;
        private readonly ILogger<GespoUbicacionPollerService>   _logger;

        public GespoUbicacionPollerService(
            IServiceScopeFactory                     scopeFactory,
            ConnectionPoolManager                    poolManager,
            IGespoOracleReader                        oracleReader,
            IOptions<GespoUbicacionPollerOptions>    opts,
            ILogger<GespoUbicacionPollerService>     logger)
        {
            _scopeFactory = scopeFactory;
            _poolManager  = poolManager;
            _oracleReader = oracleReader;
            _opts         = opts.Value;
            _logger       = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            if (!_opts.Enabled)
            {
                _logger.LogInformation(
                    "[GespoPoller] Servicio deshabilitado (GespoUbicacionPoller:Enabled = false).");
                return;
            }

            _logger.LogInformation(
                "[GespoPoller] Iniciando. Intervalo={Interval}s | ParalelismoMax={Parallel}",
                _opts.IntervalSeconds, _opts.MaxParallelTenants);

            if (_opts.StartupDelaySeconds > 0)
                await Task.Delay(TimeSpan.FromSeconds(_opts.StartupDelaySeconds), stoppingToken)
                    .ConfigureAwait(false);

            while (!stoppingToken.IsCancellationRequested)
            {
                var cycleTimer = Stopwatch.GetTimestamp();

                try
                {
                    await RunSyncCycleAsync(stoppingToken).ConfigureAwait(false);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "[GespoPoller] Error inesperado en el ciclo de sincronización.");
                }

                var elapsed   = Stopwatch.GetElapsedTime(cycleTimer);
                var remaining = TimeSpan.FromSeconds(_opts.IntervalSeconds) - elapsed;

                if (remaining > TimeSpan.Zero)
                    await Task.Delay(remaining, stoppingToken).ConfigureAwait(false);
            }

            _logger.LogInformation("[GespoPoller] Servicio detenido.");
        }

        private async Task RunSyncCycleAsync(CancellationToken ct)
        {
            List<DtoTenant> tenants;
            try
            {
                await using var scope = _scopeFactory.CreateAsyncScope();
                var masterRepo = scope.ServiceProvider.GetRequiredService<IDbMasterRepository>();
                tenants = await masterRepo.GetActiveTenantsForMonitorAsync(ct);
            }
            catch (OperationCanceledException) { return; }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[GespoPoller] Error cargando la lista de tenants activos.");
                return;
            }

            if (tenants.Count == 0) return;

            var maxParallel = Math.Min(tenants.Count, Math.Max(1, _opts.MaxParallelTenants));
            var semaphore    = new SemaphoreSlim(maxParallel);

            var tasks = tenants.Select(t => SyncTenantAsync(t, semaphore, ct));
            await Task.WhenAll(tasks).ConfigureAwait(false);
        }

        private async Task SyncTenantAsync(DtoTenant tenant, SemaphoreSlim semaphore, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(tenant.GespoSiglaUnidad))
                return; // Sin sigla GESPO configurada — nada que sincronizar para este tenant.

            await semaphore.WaitAsync(ct).ConfigureAwait(false);
            try
            {
                // Cada tenant consulta Oracle filtrado por su propia sigla — nunca trae
                // (ni carga en memoria) patrullas de otras ciudades.
                var ubicaciones = await _oracleReader
                    .LeerUbicacionesActualesAsync(tenant.GespoSiglaUnidad, ct)
                    .ConfigureAwait(false);

                if (ubicaciones.Count == 0) return;

                await using var scope = _scopeFactory.CreateAsyncScope();

                // Fijar el TenantContext manualmente — fuera de un request HTTP no hay
                // TenantMiddleware que lo haga por nosotros. Mismo patrón, mismo método
                // público (TenantContext.Set) que usa el middleware.
                var tenantContext = scope.ServiceProvider.GetRequiredService<TenantContext>();
                var dataSource    = _poolManager.GetOrCreate(tenant);
                tenantContext.Set(dataSource, tenant.CodDane, tenant.Nombre, tenant.SitioGraba);

                var turnoService = scope.ServiceProvider.GetRequiredService<IDbTurnoService>();
                var filas = await turnoService.P_ActualizarUbicacionesGespoAsync(ubicaciones, ct).ConfigureAwait(false);

                if (filas > 0)
                    _logger.LogDebug(
                        "[GespoPoller] {CodDane} (sigla={Sigla}) — {Filas} posición(es) GPS actualizada(s).",
                        tenant.CodDane, tenant.GespoSiglaUnidad, filas);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                /* Apagado ordenado */
            }
            catch (OracleException ex)
            {
                // Común si Oracle GESPO está caído/inalcanzable en este ciclo — no debe
                // tumbar el ciclo completo, solo este tenant.
                _logger.LogWarning(ex,
                    "[GespoPoller] {CodDane} — error consultando Oracle GESPO.", tenant.CodDane);
            }
            catch (NpgsqlException ex)
            {
                _logger.LogWarning(
                    "[GespoPoller] {CodDane} — error de BD sincronizando ubicaciones: {Msg}",
                    tenant.CodDane, ex.Message);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "[GespoPoller] Error inesperado sincronizando ubicaciones para {CodDane}.",
                    tenant.CodDane);
            }
            finally
            {
                semaphore.Release();
            }
        }
    }
}

using Comun.Dtos.Tenant;
using Datos.Interfaz;
using Datos.Tenant;
using Microsoft.Extensions.Options;
using Negocio.Interfaz;
using Npgsql;
using System.Diagnostics;

namespace Api.BackgroundServices
{
    /// <summary>
    /// Servicio alojado que sincroniza periódicamente la georreferenciación GPS de
    /// patrullas/cuadrantes desde GESPO (vista Oracle vía FDW, ver
    /// V39__gespo_fdw_ubicacion.sql) hacia <c>cad_medios_disponibles</c> de cada CAD
    /// activo — reemplaza (o complementa) el flujo push existente
    /// (<c>POST api/Turnos/gespo/ubicaciones</c>) con un pull programado, para no
    /// depender de que GESPO llame proactivamente a SECAD.
    ///
    /// <para><b>Ciclo:</b></para>
    /// <list type="number">
    ///   <item>Carga los tenants activos desde la BD maestra.</item>
    ///   <item>Para cada uno, en paralelo (máx. <see cref="GespoUbicacionPollerOptions.MaxParallelTenants"/>),
    ///         abre un scope de DI, fija el <see cref="TenantContext"/> manualmente
    ///         (igual que <c>TenantMiddleware</c> lo haría por request) y llama a
    ///         <see cref="IDbTurnoService.P_SincronizarUbicacionesGespoAsync"/>.</item>
    /// </list>
    ///
    /// El propio SQL de sincronización (<c>UPDATE ... FROM v_ubicacion_gespo</c>) ya
    /// filtra por turnos activos y por <c>fecha_gps</c> más reciente que la última
    /// posición guardada, así que un tenant sin FDW configurado o sin turnos activos
    /// simplemente no actualiza filas — no genera error, solo trabajo de más.
    ///
    /// <para>Deshabilitado por defecto (<c>GespoUbicacionPoller:Enabled = false</c>)
    /// hasta que el DBA confirme el FDW server y el esquema real de la vista Oracle
    /// (ver comentarios en V39).</para>
    /// </summary>
    public sealed class GespoUbicacionPollerService : BackgroundService
    {
        private readonly IServiceScopeFactory                   _scopeFactory;
        private readonly ConnectionPoolManager                  _poolManager;
        private readonly GespoUbicacionPollerOptions             _opts;
        private readonly ILogger<GespoUbicacionPollerService>   _logger;

        public GespoUbicacionPollerService(
            IServiceScopeFactory                     scopeFactory,
            ConnectionPoolManager                    poolManager,
            IOptions<GespoUbicacionPollerOptions>    opts,
            ILogger<GespoUbicacionPollerService>     logger)
        {
            _scopeFactory = scopeFactory;
            _poolManager  = poolManager;
            _opts         = opts.Value;
            _logger       = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            if (!_opts.Enabled)
            {
                _logger.LogInformation(
                    "[GespoPoller] Servicio deshabilitado (GespoUbicacionPoller:Enabled = false). " +
                    "Habilitar solo tras confirmar el FDW hacia GESPO (V39__gespo_fdw_ubicacion.sql).");
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
            await semaphore.WaitAsync(ct).ConfigureAwait(false);
            try
            {
                await using var scope = _scopeFactory.CreateAsyncScope();

                // Fijar el TenantContext manualmente — fuera de un request HTTP no hay
                // TenantMiddleware que lo haga por nosotros. Mismo patrón, mismo método
                // público (TenantContext.Set) que usa el middleware.
                var tenantContext = scope.ServiceProvider.GetRequiredService<TenantContext>();
                var dataSource    = _poolManager.GetOrCreate(tenant);
                tenantContext.Set(dataSource, tenant.CodDane, tenant.Nombre, tenant.SitioGraba);

                var turnoService = scope.ServiceProvider.GetRequiredService<IDbTurnoService>();
                var filas = await turnoService.P_SincronizarUbicacionesGespoAsync(ct).ConfigureAwait(false);

                if (filas > 0)
                    _logger.LogDebug(
                        "[GespoPoller] {CodDane} — {Filas} posición(es) GPS actualizada(s).",
                        tenant.CodDane, filas);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                /* Apagado ordenado */
            }
            catch (NpgsqlException ex)
            {
                // Común mientras el FDW no esté configurado en un tenant (relación
                // v_ubicacion_gespo inexistente) — no debe tumbar el ciclo completo.
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

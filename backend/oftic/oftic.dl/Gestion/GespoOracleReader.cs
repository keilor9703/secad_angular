using System.Globalization;
using Comun.Dtos.Turnos;
using Datos.Interfaz;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Oracle.ManagedDataAccess.Client;

namespace Datos.Gestion
{
    /// <summary>
    /// Lee la georreferenciación GPS actual directamente desde la vista Oracle de
    /// GESPO (VW_CONSULTA_ACTUAL_GPS) usando el driver 100% administrado
    /// Oracle.ManagedDataAccess.Core — sin FDW, sin extensiones ni clientes
    /// nativos que instalar en el servidor de Postgres (enfoque descartado por
    /// no ser instalable en varios de los servidores de los tenants).
    ///
    /// La vista trae GPS de TODO el país; siempre se filtra por
    /// SIGLA_PAPA_UNIDAD (un tenant/CAD = una sigla) para que cada tenant
    /// consulte y reciba solo sus propias patrullas, no las de todo el país.
    ///
    /// La vista trae una fila por policía/celular; varios pueden compartir el
    /// mismo CUADRANTE_ID (=patrulla_codigo). Se colapsa aquí en memoria al fix
    /// más reciente por cuadrante.
    ///
    /// A diferencia de la vista anterior, esta sí trae VELOCIDAD (se asume
    /// km/h — no confirmado con GESPO, ajustar si resulta ser otra unidad).
    /// Sigue sin traer rumbo/dirección, así que RumboGrados queda en null.
    /// </summary>
    public sealed class GespoOracleReader : IGespoOracleReader
    {
        // Colombia es UTC-5 fijo, sin horario de verano — igual que el resto del
        // sistema interpreta los timestamps naive de Oracle (ver DbReporteRepository).
        private static readonly TimeSpan ColombiaOffset = TimeSpan.FromHours(-5);

        private readonly GespoOracleOptions        _opts;
        private readonly ILogger<GespoOracleReader> _logger;

        public GespoOracleReader(IOptions<GespoOracleOptions> opts, ILogger<GespoOracleReader> logger)
        {
            _opts   = opts.Value;
            _logger = logger;
        }

        public async Task<List<DtoGespoUbicacion>> LeerUbicacionesActualesAsync(string siglaUnidad, CancellationToken ct)
        {
            var result = new List<DtoGespoUbicacion>();
            if (!_opts.Enabled || string.IsNullOrWhiteSpace(_opts.ConnectionString) || string.IsNullOrWhiteSpace(siglaUnidad))
                return result;

            using var conn = new OracleConnection(_opts.ConnectionString);
            await conn.OpenAsync(ct);

            using var cmd = conn.CreateCommand();
            cmd.CommandTimeout = _opts.TimeoutSeconds;
            // Nombres de esquema/vista vienen de configuración (no de input de usuario),
            // igual que el resto de sentencias de esquema en el proyecto. El filtro por
            // sigla sí es un bind parameter (viene de secad_tenants, dato de negocio).
            cmd.CommandText = $@"
SELECT cuadrante_id, latitud, longitud, fecha, velocidad
FROM   {_opts.Schema}.{_opts.ViewName}
WHERE  sigla_papa_unidad = :sigla
  AND  cuadrante_id IS NOT NULL
  AND  latitud      IS NOT NULL
  AND  longitud     IS NOT NULL
  AND  fecha        IS NOT NULL";
            cmd.Parameters.Add(new OracleParameter("sigla", siglaUnidad));

            var masRecientePorCuadrante = new Dictionary<string, (double Lat, double Lng, double? Velocidad, DateTime Fecha)>();

            using (var rdr = await cmd.ExecuteReaderAsync(ct))
            {
                while (await rdr.ReadAsync(ct))
                {
                    var cuadranteId = Convert.ToInt64(rdr.GetValue(0)).ToString(CultureInfo.InvariantCulture);
                    var lat         = Convert.ToDouble(rdr.GetValue(1));
                    var lng         = Convert.ToDouble(rdr.GetValue(2));
                    var fecha       = rdr.GetDateTime(3);
                    var velocidad   = rdr.IsDBNull(4) ? (double?)null : Convert.ToDouble(rdr.GetValue(4));

                    if (!masRecientePorCuadrante.TryGetValue(cuadranteId, out var actual) || fecha > actual.Fecha)
                        masRecientePorCuadrante[cuadranteId] = (lat, lng, velocidad, fecha);
                }
            }

            foreach (var (cuadranteId, v) in masRecientePorCuadrante)
            {
                var fechaGps = new DateTimeOffset(DateTime.SpecifyKind(v.Fecha, DateTimeKind.Unspecified), ColombiaOffset);
                result.Add(new DtoGespoUbicacion
                {
                    PatrullaCodigo = cuadranteId,
                    Latitud        = v.Lat,
                    Longitud       = v.Lng,
                    VelocidadKmh   = v.Velocidad,
                    RumboGrados    = null,
                    FechaGps       = fechaGps.ToString("o", CultureInfo.InvariantCulture),
                });
            }

            _logger.LogDebug(
                "[GespoOracleReader] sigla={Sigla} — {Cantidad} cuadrante(s) leído(s) de Oracle.",
                siglaUnidad, result.Count);
            return result;
        }
    }
}

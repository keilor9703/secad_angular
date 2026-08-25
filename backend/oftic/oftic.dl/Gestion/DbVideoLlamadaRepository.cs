using Comun.Dtos.Operacion;
using Comun.Snowflake;
using Datos.Interfaz;
using Datos.Tenant;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace Datos.Gestion
{
    public class DbVideoLlamadaRepository : IDbVideoLlamadaRepository
    {
        private readonly TenantContext _tenant;
        private readonly ILogger<DbVideoLlamadaRepository> _logger;
        private readonly ISnowflakeGenerator _snowflake;

        public DbVideoLlamadaRepository(
            TenantContext tenant, ILogger<DbVideoLlamadaRepository> logger, ISnowflakeGenerator snowflake)
        {
            _tenant    = tenant;
            _logger    = logger;
            _snowflake = snowflake;
        }

        public async Task<long> CrearSesionAsync(
            long pedidoId, int sitioGraba, string usuarioDespachador,
            DateTime fechaExpira, string? numeroTelefono, CancellationToken ct)
        {
            var id = _snowflake.NextId();

            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);
            await using var cmd  = conn.CreateCommand();
            cmd.CommandText = @"
INSERT INTO cad_video_sesiones
    (id, pedido_id, sitio_graba, estado, usuario_despachador, fecha_creacion, fecha_expira, numero_telefono)
VALUES
    (@id, @pedidoId, @sg, 'PENDIENTE', @usuario, NOW(), @fechaExpira, @numeroTelefono)";
            cmd.Parameters.AddWithValue("id",          id);
            cmd.Parameters.AddWithValue("pedidoId",    pedidoId);
            cmd.Parameters.AddWithValue("sg",          sitioGraba);
            cmd.Parameters.AddWithValue("usuario",     usuarioDespachador);
            cmd.Parameters.AddWithValue("fechaExpira", fechaExpira);
            cmd.Parameters.AddWithValue("numeroTelefono", (object?)numeroTelefono ?? DBNull.Value);
            await cmd.ExecuteNonQueryAsync(ct);

            return id;
        }

        public async Task<DtoVideoSesionEstado?> GetPorIdAsync(long sesionId, CancellationToken ct)
        {
            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);
            await using var cmd  = conn.CreateCommand();
            cmd.CommandText = @"
SELECT id, sitio_graba, estado, fecha_creacion, fecha_expira, fecha_conectado, fecha_finalizado,
       ultima_lat, ultima_lng, ultima_precision, ultima_ubicacion_fecha
FROM   cad_video_sesiones
WHERE  id = @id";
            cmd.Parameters.AddWithValue("id", sesionId);

            await using var rdr = await cmd.ExecuteReaderAsync(ct);
            if (!await rdr.ReadAsync(ct)) return null;

            return new DtoVideoSesionEstado
            {
                SesionId             = rdr.GetInt64(0),
                SitioGraba           = rdr.GetInt32(1),
                Estado               = rdr.GetString(2),
                FechaCreacion        = rdr.GetDateTime(3),
                FechaExpira          = rdr.GetDateTime(4),
                FechaConectado       = rdr.IsDBNull(5) ? null : rdr.GetDateTime(5),
                FechaFinalizado      = rdr.IsDBNull(6) ? null : rdr.GetDateTime(6),
                UltimaLat            = rdr.IsDBNull(7) ? null : rdr.GetDouble(7),
                UltimaLng            = rdr.IsDBNull(8) ? null : rdr.GetDouble(8),
                UltimaPrecision      = rdr.IsDBNull(9) ? null : rdr.GetDouble(9),
                UltimaUbicacionFecha = rdr.IsDBNull(10) ? null : rdr.GetDateTime(10)
            };
        }

        public async Task MarcarConectadaAsync(long sesionId, string? ipCiudadano, CancellationToken ct)
        {
            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);
            await using var cmd  = conn.CreateCommand();
            cmd.CommandText = @"
UPDATE cad_video_sesiones
SET    estado          = 'CONECTADA',
       fecha_conectado = COALESCE(fecha_conectado, NOW()),
       ip_ciudadano    = COALESCE(ip_ciudadano, @ip)
WHERE  id     = @id
  AND  estado = 'PENDIENTE'";
            cmd.Parameters.AddWithValue("id", sesionId);
            cmd.Parameters.AddWithValue("ip", (object?)ipCiudadano ?? DBNull.Value);
            await cmd.ExecuteNonQueryAsync(ct);
        }

        public async Task MarcarFinalizadaAsync(long sesionId, CancellationToken ct)
        {
            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);
            await using var cmd  = conn.CreateCommand();
            cmd.CommandText = @"
UPDATE cad_video_sesiones
SET    estado           = 'FINALIZADA',
       fecha_finalizado = NOW()
WHERE  id     = @id
  AND  estado IN ('PENDIENTE','CONECTADA')";
            cmd.Parameters.AddWithValue("id", sesionId);
            await cmd.ExecuteNonQueryAsync(ct);
        }

        public async Task VincularGrabacionAsync(long sesionId, long adjuntoId, CancellationToken ct)
        {
            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);
            await using var cmd  = conn.CreateCommand();
            cmd.CommandText = @"
UPDATE cad_video_sesiones
SET    adjunto_grabacion_id = @adjuntoId
WHERE  id = @id";
            cmd.Parameters.AddWithValue("id", sesionId);
            cmd.Parameters.AddWithValue("adjuntoId", adjuntoId);
            await cmd.ExecuteNonQueryAsync(ct);
        }

        public async Task ActualizarUbicacionAsync(long sesionId, double lat, double lng, double? precision, CancellationToken ct)
        {
            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);
            await using var cmd  = conn.CreateCommand();
            cmd.CommandText = @"
UPDATE cad_video_sesiones
SET    ultima_lat              = @lat,
       ultima_lng              = @lng,
       ultima_precision        = @precision,
       ultima_ubicacion_fecha  = NOW()
WHERE  id = @id";
            cmd.Parameters.AddWithValue("id", sesionId);
            cmd.Parameters.AddWithValue("lat", lat);
            cmd.Parameters.AddWithValue("lng", lng);
            cmd.Parameters.AddWithValue("precision", (object?)precision ?? DBNull.Value);
            await cmd.ExecuteNonQueryAsync(ct);
        }

        public async Task ExpirarVencidasAsync(CancellationToken ct)
        {
            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);
            await using var cmd  = conn.CreateCommand();
            cmd.CommandText = @"
UPDATE cad_video_sesiones
SET    estado = 'EXPIRADA'
WHERE  estado = 'PENDIENTE'
  AND  fecha_expira < NOW()";
            var filas = await cmd.ExecuteNonQueryAsync(ct);
            if (filas > 0)
                _logger.LogInformation("[VideoLlamada] {N} sesión(es) marcadas EXPIRADA", filas);
        }
    }
}

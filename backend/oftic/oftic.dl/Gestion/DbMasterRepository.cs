using Comun.Dtos.Tenant;
using Datos.Interfaz;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace Datos.Gestion
{
    public class DbMasterRepository : IDbMasterRepository
    {
        private readonly NpgsqlDataSource _masterDb;
        private readonly ILogger<DbMasterRepository> _logger;

        public DbMasterRepository(NpgsqlDataSource masterDb, ILogger<DbMasterRepository> logger)
        {
            _masterDb = masterDb;
            _logger = logger;
        }

        public async Task<DtoTenant?> GetTenantByCodDaneAsync(string codDane, CancellationToken ct)
        {
            await using var conn = await _masterDb.OpenConnectionAsync(ct);
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = @"
                                SELECT id, cod_dane, cod_unidad, nombre, departamento, municipio,
                                       db_host, db_port, db_name, db_username, db_password
                                FROM secad_tenants
                                WHERE cod_dane = @codDane AND activo = true
                                LIMIT 1";
            cmd.Parameters.AddWithValue("codDane", codDane);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (await reader.ReadAsync(ct))
                return MapTenant(reader);

            _logger.LogWarning("Tenant no encontrado para cod_dane={CodDane}", codDane);
            return null;
        }

        public async Task<DtoTenant?> GetTenantByCodUnidadAsync(string codUnidad, CancellationToken ct)
        {
            await using var conn = await _masterDb.OpenConnectionAsync(ct);
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = @"
                                SELECT id, cod_dane, cod_unidad, nombre, departamento, municipio,
                                       db_host, db_port, db_name, db_username, db_password
                                FROM secad_tenants
                                WHERE UPPER(cod_unidad) = UPPER(@codUnidad) AND activo = true
                                LIMIT 1";
            cmd.Parameters.AddWithValue("codUnidad", codUnidad);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (await reader.ReadAsync(ct))
                return MapTenant(reader);

            _logger.LogWarning("Tenant no encontrado para cod_unidad={CodUnidad}", codUnidad);
            return null;
        }

        public async Task<(string? codDane, string? passwordHash)> GetFallbackUserAsync(string username, CancellationToken ct)
        {
            await using var conn = await _masterDb.OpenConnectionAsync(ct);
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = @"
                                SELECT cod_dane, password_hash
                                FROM secad_users_fallback
                                WHERE UPPER(username) = UPPER(@username) AND activo = true
                                LIMIT 1";
            cmd.Parameters.AddWithValue("username", username);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (await reader.ReadAsync(ct))
            {
                var codDane = reader.IsDBNull(0) ? null : reader.GetString(0);
                var hash = reader.IsDBNull(1) ? null : reader.GetString(1);
                return (codDane, hash);
            }

            return (null, null);
        }

        public async Task AuditFallbackLoginAsync(string username, string codDane, string? ipOrigen, bool modoFallback, CancellationToken ct)
        {
            try
            {
                await using var conn = await _masterDb.OpenConnectionAsync(ct);
                await using var cmd = conn.CreateCommand();
                cmd.CommandText = @"
                                INSERT INTO secad_audit_fallback (username, cod_dane, ip_origen, modo_fallback)
                                VALUES (@username, @codDane, @ipOrigen, @modoFallback)";
                cmd.Parameters.AddWithValue("username", username);
                cmd.Parameters.AddWithValue("codDane", codDane);
                cmd.Parameters.AddWithValue("ipOrigen", (object?)ipOrigen ?? DBNull.Value);
                cmd.Parameters.AddWithValue("modoFallback", modoFallback);
                await cmd.ExecuteNonQueryAsync(ct);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error registrando auditoría de login para {Username}", username);
            }
        }

        private static DtoTenant MapTenant(NpgsqlDataReader r) => new()
        {
            Id = r.GetInt32(0),
            CodDane = r.GetString(1),
            CodUnidad = r.IsDBNull(2) ? null : r.GetString(2),
            Nombre = r.GetString(3),
            Departamento = r.IsDBNull(4) ? null : r.GetString(4),
            Municipio = r.IsDBNull(5) ? null : r.GetString(5),
            DbHost = r.GetString(6),
            DbPort = r.GetInt32(7),
            DbName = r.GetString(8),
            DbUsername = r.GetString(9),
            DbPassword = r.GetString(10)
        };
    }
}

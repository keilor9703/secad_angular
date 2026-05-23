using Datos.Interfaz;
using Datos.Tenant;
using Microsoft.Extensions.Logging;

namespace Datos.Gestion
{
    public class DbAuthRepository : IDbAuthRepository
    {
        private readonly TenantContext _tenant;
        private readonly ILogger<DbAuthRepository> _logger;

        public DbAuthRepository(TenantContext tenant, ILogger<DbAuthRepository> logger)
        {
            _tenant = tenant;
            _logger = logger;
        }

        public async Task<(long? idUsuario, List<long> roles)> GetUsuarioYRolesAsync(string usuario, CancellationToken ct)
        {
            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);

            _logger.LogInformation("Buscando usuario: {Usuario}", usuario);

            long? idUsuario = null;

            await using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = @"
SELECT id_usuario
FROM ctr_usuarios
WHERE UPPER(username) = UPPER(@pUsuario) AND bloqueado = 0
LIMIT 1";
                cmd.Parameters.AddWithValue("pUsuario", usuario);

                var obj = await cmd.ExecuteScalarAsync(ct);
                if (obj != null && obj != DBNull.Value)
                    idUsuario = Convert.ToInt64(obj);
            }

            if (idUsuario is null)
            {
                _logger.LogWarning("Usuario no encontrado o bloqueado: {Usuario}", usuario);
                return (null, new List<long>());
            }

            _logger.LogInformation("Usuario encontrado con ID: {IdUsuario}", idUsuario);

            var roles = new List<long>();

            await using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = @"
SELECT DISTINCT id_rol
FROM ctr_roles_user
WHERE id_usuario = @pIdUsuario";
                cmd.Parameters.AddWithValue("pIdUsuario", idUsuario.Value);

                await using var reader = await cmd.ExecuteReaderAsync(ct);
                while (await reader.ReadAsync(ct))
                    roles.Add(reader.GetInt64(0));
            }

            _logger.LogInformation("Roles encontrados: {Count}", roles.Count);
            return (idUsuario.Value, roles);
        }
    }
}

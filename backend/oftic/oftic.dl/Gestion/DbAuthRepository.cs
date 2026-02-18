using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Oracle.ManagedDataAccess.Client;
using System.Data;
using Datos.Interfaz;

namespace Datos.Gestion
{
    public class DbAuthRepository : IDbAuthRepository
    {
        private readonly string _cs;
        private readonly ILogger<DbAuthRepository> _logger;

        public DbAuthRepository(IConfiguration cfg, ILogger<DbAuthRepository> logger)
        {
            _cs = cfg.GetConnectionString("DbOracle")!;
            _logger = logger;
        }

        public async Task<(long? idUsuario, List<long> roles)> GetUsuarioYRolesAsync(string usuario, CancellationToken ct)
        {
            await using var conn = new OracleConnection(_cs);
            await conn.OpenAsync(ct);

            _logger.LogInformation("Buscando usuario: {Usuario}", usuario);

            // 1) Buscar id_usuario por username
            long? idUsuario = null;

            await using (var cmd = conn.CreateCommand())
            {
                cmd.CommandType = CommandType.Text;
                cmd.CommandText = @"SELECT id_usuario FROM ctr_usuarios WHERE UPPER(username) = UPPER(:pUsuario) AND bloqueado = 0";
                cmd.Parameters.Add(":pUsuario", OracleDbType.Varchar2).Value = usuario;

                var obj = await cmd.ExecuteScalarAsync(ct);
                _logger.LogInformation("Resultado query usuario: {Obj}", obj);
                
                if (obj != null && obj != DBNull.Value)
                    idUsuario = Convert.ToInt64(obj);
            }

            if (idUsuario is null)
            {
                _logger.LogWarning("Usuario no encontrado o bloqueado: {Usuario}", usuario);
                return (null, new List<long>());
            }

            _logger.LogInformation("Usuario encontrado con ID: {idUsuario}", idUsuario);

            // 2) Roles vigentes
            var roles = new List<long>();

            await using (var cmd = conn.CreateCommand())
            {
                cmd.CommandType = CommandType.Text;
                cmd.CommandText = @"SELECT DISTINCT id_rol FROM ctr_roles_user WHERE id_usuario = :pIdUsuario";
                cmd.Parameters.Add(":pIdUsuario", OracleDbType.Int64).Value = idUsuario.Value;

                await using var reader = await cmd.ExecuteReaderAsync(ct);
                while (await reader.ReadAsync(ct))
                    roles.Add(reader.GetInt64(0));
            }

            _logger.LogInformation("Roles encontrados: {Count}", roles.Count);

            return (idUsuario.Value, roles);
        }
    }
}

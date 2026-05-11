using Comun.Dtos.Home;
using Datos.Interfaz;
using Microsoft.Extensions.Configuration;
using Oracle.ManagedDataAccess.Client;
using System.Data;

namespace Datos.Gestion
{
    public class DbHomeRepository : IDbHomeRepository
    {
        private readonly string _cs;

        public DbHomeRepository(IConfiguration configuration)
        {
            _cs = configuration.GetConnectionString("DbCoest")!;
        }

        public async Task<DtoHomeStats> GetStatsAsync(CancellationToken ct)
        {
            await using var conn = new OracleConnection(_cs);
            await conn.OpenAsync(ct);

            var stats = new DtoHomeStats
            {
                usuariosActivos = await ExecuteCountAsync(conn, @"
SELECT COUNT(1)
  FROM ctr_usuarios
 WHERE NVL(bloqueado, 0) = 0", ct),
                reportesGenerados = await ExecuteCountAsync(conn, @"
SELECT COUNT(1)
  FROM ctr_auditoria
 WHERE fecha_creacion >= TRUNC(SYSDATE, 'MM')", ct),
                alertasSistema = await ExecuteCountAsync(conn, @"
SELECT COUNT(1)
  FROM ctr_roles_user_admin
 WHERE NVL(vigente, 0) = 1
   AND fecha_fin IS NOT NULL
   AND TRUNC(fecha_fin) <= TRUNC(SYSDATE) + 7", ct)
            };

            return stats;
        }

        private static async Task<int> ExecuteCountAsync(OracleConnection conn, string sql, CancellationToken ct)
        {
            await using var cmd = conn.CreateCommand();
            cmd.CommandType = CommandType.Text;
            cmd.CommandText = sql;

            var value = await cmd.ExecuteScalarAsync(ct);
            if (value is null || value == DBNull.Value)
            {
                return 0;
            }

            return Convert.ToInt32(value);
        }
    }
}

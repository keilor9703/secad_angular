using Microsoft.Extensions.Configuration;
using System;
using System.Collections.Generic;
using Oracle.ManagedDataAccess.Client;
using System.Data;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Datos.Interfaz;
using Comun.Dtos.Menu;

namespace Datos.Gestion
{
    public class DbMenuRepository : IDbMenuRepository
    {
        private readonly string _cs;
        public DbMenuRepository(IConfiguration configuration)
        {
            _cs = configuration.GetConnectionString("DbOracle")!;
        }


        public async Task<List<DtoMenuItem>> GetMyMenuAsync(long idUsuario, CancellationToken ct)
        {
            var result = new List<DtoMenuItem>();


            await using var conn = new OracleConnection(_cs);
            await conn.OpenAsync(ct);


            await using var cmd = conn.CreateCommand();
            cmd.CommandText = "PK_ADMINISTRACION.P_GET_MENU_USUARIO";
            cmd.CommandType = CommandType.StoredProcedure;


            cmd.Parameters.Add("P_IdUsuario", OracleDbType.Int64).Value = idUsuario;
            cmd.Parameters.Add("P_Result", OracleDbType.RefCursor).Direction = ParameterDirection.Output;


            await using var reader = await cmd.ExecuteReaderAsync(ct);


            while (await reader.ReadAsync(ct))
            {
                result.Add(new DtoMenuItem
                {
                    IdMenu = reader.GetInt64(0),
                    Descripcion = reader.GetString(1),
                    IdPadre = reader.GetInt64(2),
                    Posicion = reader.GetInt32(3),
                    Tipo = reader.GetString(4),
                    Icono = reader.IsDBNull(5) ? null : reader.GetString(5),
                    Vigente = reader.GetInt32(6),
                    Detalle = reader.IsDBNull(7) ? null : reader.GetString(7)
                });
            }


            return result;
        }
    }
}

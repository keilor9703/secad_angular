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

        public async Task<List<DtoMenuItem>> GetAdminMenuAsync(CancellationToken ct)
        {
            var result = new List<DtoMenuItem>();

            await using var conn = new OracleConnection(_cs);
            await conn.OpenAsync(ct);

            await using var cmd = conn.CreateCommand();
            cmd.CommandType = CommandType.Text;
            cmd.CommandText = @"
SELECT id_menu, descripcion, idpadre, posicion, tipo, icono, vigente, detalle
FROM ctr_menu
ORDER BY idpadre, posicion, id_menu";

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                result.Add(new DtoMenuItem
                {
                    IdMenu = reader.GetInt64(0),
                    Descripcion = reader.IsDBNull(1) ? string.Empty : reader.GetString(1),
                    IdPadre = reader.GetInt64(2),
                    Posicion = reader.GetInt32(3),
                    Tipo = reader.IsDBNull(4) ? string.Empty : reader.GetString(4),
                    Icono = reader.IsDBNull(5) ? null : reader.GetString(5),
                    Vigente = reader.GetInt32(6),
                    Detalle = reader.IsDBNull(7) ? null : reader.GetString(7)
                });
            }

            return result;
        }

        public async Task<DtoMenuResult> SaveMenuAsync(DtoMenuSaveRequest request, long usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        {
            await using var conn = new OracleConnection(_cs);
            await conn.OpenAsync(ct);

            await using var tx = conn.BeginTransaction();
            try
            {
                var isUpdate = request.IdMenu.HasValue && request.IdMenu.Value > 0;
                long idMenu;

                if (isUpdate)
                {
                    idMenu = request.IdMenu!.Value;
                    var idPadre = request.IdPadre <= 0 ? idMenu : request.IdPadre;

                    await using var cmdUpdate = conn.CreateCommand();
                    cmdUpdate.Transaction = tx;
                    cmdUpdate.CommandType = CommandType.Text;
                    cmdUpdate.CommandText = @"
UPDATE ctr_menu
   SET descripcion      = :pDescripcion,
       idpadre          = :pIdPadre,
       posicion         = :pPosicion,
       tipo             = :pTipo,
       icono            = :pIcono,
       vigente          = :pVigente,
       detalle          = :pDetalle,
       usuario_modifica = :pUsuarioModifica,
       fecha_modifica   = SYSDATE,
       maquina_modifica = :pMaquinaModifica
 WHERE id_menu = :pIdMenu";

                    BindSaveParams(cmdUpdate, request, idPadre, usuarioAuditoria, maquinaAuditoria);
                    cmdUpdate.Parameters.Add(":pIdMenu", OracleDbType.Int64).Value = idMenu;
                    var rows = await cmdUpdate.ExecuteNonQueryAsync(ct);
                    if (rows <= 0)
                    {
                        await tx.RollbackAsync(ct);
                        return new DtoMenuResult { Id = 0, Message = "No se encontró el menú a actualizar." };
                    }

                    await tx.CommitAsync(ct);
                    return new DtoMenuResult { Id = idMenu, Message = "Menú actualizado correctamente." };
                }

                await using (var cmdNext = conn.CreateCommand())
                {
                    cmdNext.Transaction = tx;
                    cmdNext.CommandType = CommandType.Text;
                    cmdNext.CommandText = "SELECT NVL(MAX(id_menu),0) + 1 FROM ctr_menu";
                    idMenu = Convert.ToInt64(await cmdNext.ExecuteScalarAsync(ct));
                }

                await using (var cmdInsert = conn.CreateCommand())
                {
                    var idPadre = request.IdPadre <= 0 ? idMenu : request.IdPadre;
                    cmdInsert.Transaction = tx;
                    cmdInsert.CommandType = CommandType.Text;
                    cmdInsert.CommandText = @"
INSERT INTO ctr_menu
  (id_menu, descripcion, idpadre, posicion, tipo, icono, vigente, detalle,
   usuario_creacion, fecha_creacion, maquina_creacion)
VALUES
  (:pIdMenu, :pDescripcion, :pIdPadre, :pPosicion, :pTipo, :pIcono, :pVigente, :pDetalle,
   :pUsuarioCreacion, SYSDATE, :pMaquinaCreacion)";

                    cmdInsert.Parameters.Add(":pIdMenu", OracleDbType.Int64).Value = idMenu;
                    cmdInsert.Parameters.Add(":pDescripcion", OracleDbType.Varchar2).Value = request.Descripcion!.Trim();
                    cmdInsert.Parameters.Add(":pIdPadre", OracleDbType.Int64).Value = idPadre;
                    cmdInsert.Parameters.Add(":pPosicion", OracleDbType.Int32).Value = request.Posicion;
                    cmdInsert.Parameters.Add(":pTipo", OracleDbType.Varchar2).Value = request.Tipo!.Trim();
                    cmdInsert.Parameters.Add(":pIcono", OracleDbType.Varchar2).Value = AsDbValue(request.Icono);
                    cmdInsert.Parameters.Add(":pVigente", OracleDbType.Int32).Value = request.Vigente is 0 ? 0 : 1;
                    cmdInsert.Parameters.Add(":pDetalle", OracleDbType.Varchar2).Value = AsDbValue(request.Detalle);
                    cmdInsert.Parameters.Add(":pUsuarioCreacion", OracleDbType.Int64).Value = usuarioAuditoria;
                    cmdInsert.Parameters.Add(":pMaquinaCreacion", OracleDbType.Varchar2).Value = AsDbValue(maquinaAuditoria);

                    await cmdInsert.ExecuteNonQueryAsync(ct);
                }

                await tx.CommitAsync(ct);
                return new DtoMenuResult { Id = idMenu, Message = "Menú creado correctamente." };
            }
            catch
            {
                await tx.RollbackAsync(ct);
                throw;
            }
        }

        public async Task<DtoMenuResult> SetEstadoMenuAsync(long idMenu, int vigente, long usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        {
            await using var conn = new OracleConnection(_cs);
            await conn.OpenAsync(ct);

            await using var cmd = conn.CreateCommand();
            cmd.CommandType = CommandType.Text;
            cmd.CommandText = @"
UPDATE ctr_menu
   SET vigente          = :pVigente,
       usuario_modifica = :pUsuarioModifica,
       fecha_modifica   = SYSDATE,
       maquina_modifica = :pMaquinaModifica
 WHERE id_menu = :pIdMenu";

            cmd.Parameters.Add(":pVigente", OracleDbType.Int32).Value = vigente is 0 ? 0 : 1;
            cmd.Parameters.Add(":pUsuarioModifica", OracleDbType.Int64).Value = usuarioAuditoria;
            cmd.Parameters.Add(":pMaquinaModifica", OracleDbType.Varchar2).Value = AsDbValue(maquinaAuditoria);
            cmd.Parameters.Add(":pIdMenu", OracleDbType.Int64).Value = idMenu;

            var rows = await cmd.ExecuteNonQueryAsync(ct);
            if (rows <= 0)
            {
                return new DtoMenuResult { Id = 0, Message = "No se encontró el menú." };
            }

            return new DtoMenuResult
            {
                Id = idMenu,
                Message = vigente == 1 ? "Menú activado." : "Menú desactivado."
            };
        }

        private static void BindSaveParams(OracleCommand cmd, DtoMenuSaveRequest request, long idPadre, long usuarioAuditoria, string maquinaAuditoria)
        {
            cmd.Parameters.Add(":pDescripcion", OracleDbType.Varchar2).Value = request.Descripcion!.Trim();
            cmd.Parameters.Add(":pIdPadre", OracleDbType.Int64).Value = idPadre;
            cmd.Parameters.Add(":pPosicion", OracleDbType.Int32).Value = request.Posicion;
            cmd.Parameters.Add(":pTipo", OracleDbType.Varchar2).Value = request.Tipo!.Trim();
            cmd.Parameters.Add(":pIcono", OracleDbType.Varchar2).Value = AsDbValue(request.Icono);
            cmd.Parameters.Add(":pVigente", OracleDbType.Int32).Value = request.Vigente is 0 ? 0 : 1;
            cmd.Parameters.Add(":pDetalle", OracleDbType.Varchar2).Value = AsDbValue(request.Detalle);
            cmd.Parameters.Add(":pUsuarioModifica", OracleDbType.Int64).Value = usuarioAuditoria;
            cmd.Parameters.Add(":pMaquinaModifica", OracleDbType.Varchar2).Value = AsDbValue(maquinaAuditoria);
        }

        private static object AsDbValue(string? value)
        {
            var normalized = (value ?? string.Empty).Trim();
            return string.IsNullOrWhiteSpace(normalized) ? DBNull.Value : normalized;
        }
    }
}

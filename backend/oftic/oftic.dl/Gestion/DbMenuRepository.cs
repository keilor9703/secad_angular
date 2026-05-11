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
using Oracle.ManagedDataAccess.Types;

namespace Datos.Gestion
{
    public class DbMenuRepository : IDbMenuRepository
    {
        private readonly string _cs;
        public DbMenuRepository(IConfiguration configuration)
        {
            _cs = configuration.GetConnectionString("DbCoest")!;
        }


        public async Task<List<DtoMenuItem>> GetMyMenuAsync(long idUsuario, CancellationToken ct)
        {
            var result = new List<DtoMenuItem>();

            await using var conn = new OracleConnection(_cs);
            await conn.OpenAsync(ct);

            const string sqlMenuPorRoles = @"
                WITH roles_vigentes AS (
                    SELECT DISTINCT rua.id_rol
                      FROM ctr_roles_user_admin rua
                     WHERE rua.id_usuario = :pIdUsuario
                       AND NVL(rua.vigente, 0) = 1
                       AND (rua.fecha_fin IS NULL OR TRUNC(rua.fecha_fin) >= TRUNC(SYSDATE))
                ),
                menus_asignados AS (
                    -- Si el usuario tiene rol 1 (super administrador), obtiene todo el menú.
                    SELECT DISTINCT m.id_menu
                      FROM ctr_menu m
                     WHERE EXISTS (SELECT 1 FROM roles_vigentes rv WHERE rv.id_rol = 1)
                    UNION
                    SELECT DISTINCT mr.id_menu
                      FROM ctr_menu_roles mr
                      JOIN roles_vigentes rv ON rv.id_rol = mr.id_rol
                )
                SELECT DISTINCT
                       m.id_menu,
                       m.descripcion,
                       m.idpadre,
                       m.posicion,
                       m.tipo,
                       m.icono,
                       m.vigente,
                       m.detalle
                  FROM ctr_menu m
                 START WITH m.id_menu IN (SELECT ma.id_menu FROM menus_asignados ma)
                CONNECT BY NOCYCLE PRIOR m.idpadre = m.id_menu
                 ORDER BY m.idpadre, m.posicion, m.id_menu";

            try
            {
                await using var cmd = conn.CreateCommand();
                cmd.CommandType = CommandType.Text;
                cmd.CommandText = sqlMenuPorRoles;
                cmd.Parameters.Add(":pIdUsuario", OracleDbType.Int64).Value = idUsuario;

                await using var reader = await cmd.ExecuteReaderAsync(ct);
                while (await reader.ReadAsync(ct))
                {
                    result.Add(MapMenuItem(reader));
                }

                return result;
            }
            catch (OracleException)
            {
                // Fallback temporal: conserva compatibilidad con el SP existente.
                result.Clear();

                await using var cmd = conn.CreateCommand();
                cmd.CommandText = "PK_ADMINISTRACION.P_GET_MENU_USUARIO";
                cmd.CommandType = CommandType.StoredProcedure;
                cmd.Parameters.Add("P_IdUsuario", OracleDbType.Int64).Value = idUsuario;
                cmd.Parameters.Add("P_Result", OracleDbType.RefCursor).Direction = ParameterDirection.Output;

                await using var reader = await cmd.ExecuteReaderAsync(ct);
                while (await reader.ReadAsync(ct))
                {
                    result.Add(MapMenuItem(reader));
                }

                return result;
            }
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

        public async Task<List<DtoMenuRolCatalogItem>> GetRolesCatalogAsync(CancellationToken ct)
        {
            var result = new List<DtoMenuRolCatalogItem>();

            await using var conn = new OracleConnection(_cs);
            await conn.OpenAsync(ct);

            await using var cmd = conn.CreateCommand();
            cmd.CommandType = CommandType.Text;
            cmd.CommandText = @"
SELECT r.id_rol, r.descripcion
  FROM ctr_roles r
 WHERE NVL(r.vigente, 1) = 1
 ORDER BY r.descripcion";

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                result.Add(new DtoMenuRolCatalogItem
                {
                    IdRol = reader.GetInt32(0),
                    Descripcion = reader.IsDBNull(1) ? string.Empty : reader.GetString(1)
                });
            }

            return result;
        }

        public async Task<List<DtoMenuRolItem>> GetRolesByMenuAsync(long idMenu, CancellationToken ct)
        {
            var result = new List<DtoMenuRolItem>();

            await using var conn = new OracleConnection(_cs);
            await conn.OpenAsync(ct);

            await using var cmd = conn.CreateCommand();
            cmd.CommandType = CommandType.Text;
            cmd.CommandText = @"
SELECT mr.id_menurol, mr.id_rol, NVL(r.descripcion, 'Rol ' || mr.id_rol) AS descripcion_rol
  FROM ctr_menu_roles mr
  LEFT JOIN ctr_roles r ON r.id_rol = mr.id_rol
 WHERE mr.id_menu = :pIdMenu
 ORDER BY descripcion_rol, mr.id_menurol";
            cmd.Parameters.Add(":pIdMenu", OracleDbType.Int64).Value = idMenu;

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                result.Add(new DtoMenuRolItem
                {
                    IdMenuRol = reader.GetInt64(0),
                    IdRol = reader.GetInt32(1),
                    DescripcionRol = reader.IsDBNull(2) ? string.Empty : reader.GetString(2)
                });
            }

            return result;
        }

        public async Task<DtoMenuResult> AssignRolToMenuAsync(long idMenu, int idRol, long usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        {
            await using var conn = new OracleConnection(_cs);
            await conn.OpenAsync(ct);

            await using var tx = conn.BeginTransaction();
            try
            {
                // Evitar duplicados.
                await using (var cmdExists = conn.CreateCommand())
                {
                    cmdExists.Transaction = tx;
                    cmdExists.CommandType = CommandType.Text;
                    cmdExists.CommandText = @"
SELECT COUNT(1)
  FROM ctr_menu_roles
 WHERE id_menu = :pIdMenu
   AND id_rol = :pIdRol";
                    cmdExists.Parameters.Add(":pIdMenu", OracleDbType.Int64).Value = idMenu;
                    cmdExists.Parameters.Add(":pIdRol", OracleDbType.Int32).Value = idRol;

                    var count = ToInt32Safe(await cmdExists.ExecuteScalarAsync(ct));
                    if (count > 0)
                    {
                        await tx.RollbackAsync(ct);
                        return new DtoMenuResult { Id = 0, Message = "El rol ya está asignado al menú." };
                    }
                }

                long nextId;
                await using (var cmdNext = conn.CreateCommand())
                {
                    cmdNext.Transaction = tx;
                    cmdNext.CommandType = CommandType.Text;
                    cmdNext.CommandText = "SELECT NVL(MAX(id_menurol), 0) + 1 FROM ctr_menu_roles";
                    nextId = ToInt64Safe(await cmdNext.ExecuteScalarAsync(ct));
                }

                await using (var cmdInsert = conn.CreateCommand())
                {
                    cmdInsert.Transaction = tx;
                    cmdInsert.CommandType = CommandType.Text;
                    cmdInsert.CommandText = @"
INSERT INTO ctr_menu_roles
  (id_menurol, id_rol, id_menu, usuario_creacion, fecha_creacion, maquina_creacion)
VALUES
  (:pIdMenuRol, :pIdRol, :pIdMenu, :pUsuarioCreacion, SYSDATE, :pMaquinaCreacion)";
                    cmdInsert.Parameters.Add(":pIdMenuRol", OracleDbType.Int64).Value = nextId;
                    cmdInsert.Parameters.Add(":pIdRol", OracleDbType.Int32).Value = idRol;
                    cmdInsert.Parameters.Add(":pIdMenu", OracleDbType.Int64).Value = idMenu;
                    cmdInsert.Parameters.Add(":pUsuarioCreacion", OracleDbType.Int64).Value = usuarioAuditoria;
                    cmdInsert.Parameters.Add(":pMaquinaCreacion", OracleDbType.Varchar2).Value = AsDbValue(maquinaAuditoria);

                    var rows = await cmdInsert.ExecuteNonQueryAsync(ct);
                    if (rows <= 0)
                    {
                        await tx.RollbackAsync(ct);
                        return new DtoMenuResult { Id = 0, Message = "No fue posible asignar el rol al menú." };
                    }
                }

                await tx.CommitAsync(ct);
                return new DtoMenuResult { Id = nextId, Message = "Rol asignado al menú correctamente." };
            }
            catch
            {
                await tx.RollbackAsync(ct);
                throw;
            }
        }

        public async Task<DtoMenuResult> RemoveRolFromMenuAsync(long idMenu, int idRol, long usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        {
            await using var conn = new OracleConnection(_cs);
            await conn.OpenAsync(ct);

            await using var tx = conn.BeginTransaction();
            try
            {
                await using var cmdDelete = conn.CreateCommand();
                cmdDelete.Transaction = tx;
                cmdDelete.CommandType = CommandType.Text;
                cmdDelete.CommandText = @"
DELETE FROM ctr_menu_roles
 WHERE id_menu = :pIdMenu
   AND id_rol = :pIdRol";
                cmdDelete.Parameters.Add(":pIdMenu", OracleDbType.Int64).Value = idMenu;
                cmdDelete.Parameters.Add(":pIdRol", OracleDbType.Int32).Value = idRol;

                var rows = await cmdDelete.ExecuteNonQueryAsync(ct);
                if (rows <= 0)
                {
                    await tx.RollbackAsync(ct);
                    return new DtoMenuResult { Id = 0, Message = "No se encontró la asignación menú-rol." };
                }

                await tx.CommitAsync(ct);
                return new DtoMenuResult { Id = idMenu, Message = "Asignación menú-rol eliminada." };
            }
            catch
            {
                await tx.RollbackAsync(ct);
                throw;
            }
        }

        public async Task<List<DtoRoleMenuItem>> GetMenusByRolAsync(int idRol, CancellationToken ct)
        {
            var result = new List<DtoRoleMenuItem>();

            await using var conn = new OracleConnection(_cs);
            await conn.OpenAsync(ct);

            await using var cmd = conn.CreateCommand();
            cmd.CommandType = CommandType.Text;
            cmd.CommandText = @"
SELECT m.id_menu,
       m.descripcion,
       m.idpadre,
       m.posicion,
       m.tipo,
       m.detalle
  FROM ctr_menu_roles mr
  JOIN ctr_menu m ON m.id_menu = mr.id_menu
 WHERE mr.id_rol = :pIdRol
 ORDER BY m.idpadre, m.posicion, m.descripcion";
            cmd.Parameters.Add(":pIdRol", OracleDbType.Int32).Value = idRol;

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                result.Add(new DtoRoleMenuItem
                {
                    IdMenu = reader.GetInt64(0),
                    DescripcionMenu = reader.IsDBNull(1) ? string.Empty : reader.GetString(1),
                    IdPadre = reader.IsDBNull(2) ? 0 : reader.GetInt64(2),
                    Posicion = reader.IsDBNull(3) ? 0 : reader.GetInt32(3),
                    Tipo = reader.IsDBNull(4) ? string.Empty : reader.GetString(4),
                    Detalle = reader.IsDBNull(5) ? null : reader.GetString(5)
                });
            }

            return result;
        }

        public Task<DtoMenuResult> AssignMenuToRolAsync(int idRol, long idMenu, long usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        => AssignRolToMenuAsync(idMenu, idRol, usuarioAuditoria, maquinaAuditoria, ct);

        public Task<DtoMenuResult> RemoveMenuFromRolAsync(int idRol, long idMenu, long usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        => RemoveRolFromMenuAsync(idMenu, idRol, usuarioAuditoria, maquinaAuditoria, ct);

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

        private static int ToInt32Safe(object? value)
        {
            if (value is null || value == DBNull.Value)
            {
                return 0;
            }

            if (value is OracleDecimal od)
            {
                return od.IsNull ? 0 : od.ToInt32();
            }

            if (value is int i)
            {
                return i;
            }

            if (value is long l)
            {
                return (int)l;
            }

            return int.TryParse(value.ToString(), out var parsed) ? parsed : 0;
        }

        private static long ToInt64Safe(object? value)
        {
            if (value is null || value == DBNull.Value)
            {
                return 0L;
            }

            if (value is OracleDecimal od)
            {
                return od.IsNull ? 0L : od.ToInt64();
            }

            if (value is long l)
            {
                return l;
            }

            if (value is int i)
            {
                return i;
            }

            return long.TryParse(value.ToString(), out var parsed) ? parsed : 0L;
        }

        private static DtoMenuItem MapMenuItem(OracleDataReader reader)
        {
            return new DtoMenuItem
            {
                IdMenu = reader.GetInt64(0),
                Descripcion = reader.IsDBNull(1) ? string.Empty : reader.GetString(1),
                IdPadre = reader.GetInt64(2),
                Posicion = reader.GetInt32(3),
                Tipo = reader.IsDBNull(4) ? string.Empty : reader.GetString(4),
                Icono = reader.IsDBNull(5) ? null : reader.GetString(5),
                Vigente = reader.GetInt32(6),
                Detalle = reader.IsDBNull(7) ? null : reader.GetString(7)
            };
        }
    }
}

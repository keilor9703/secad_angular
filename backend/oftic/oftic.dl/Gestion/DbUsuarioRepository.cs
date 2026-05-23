using Comun.Dtos;
using Datos.Interfaz;
using Datos.Tenant;
using Microsoft.Extensions.Logging;
using Npgsql;
using System.Globalization;

namespace Datos.Gestion
{
    public class DbUsuarioRepository : IDbUsuarioRepository
    {
        private readonly TenantContext _tenant;
        private readonly ILogger<DbUsuarioRepository> _logger;

        public DbUsuarioRepository(TenantContext tenant, ILogger<DbUsuarioRepository> logger)
        {
            _tenant = tenant;
            _logger = logger;
        }

        public async Task<long?> GetUsuarioIdByUsernameAsync(string username, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(username)) return null;
            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT id_usuario FROM ctr_usuarios WHERE UPPER(username) = UPPER(@u)";
            cmd.Parameters.AddWithValue("u", username);
            var obj = await cmd.ExecuteScalarAsync(ct);
            return obj is null || obj == DBNull.Value ? null : Convert.ToInt64(obj);
        }

        public async Task<long?> GetUsuarioIdByIdentificacionAsync(string identificacion, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(identificacion)) return null;
            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT id_usuario FROM ctr_usuarios WHERE identificacion = @id";
            cmd.Parameters.AddWithValue("id", identificacion.Trim());
            var obj = await cmd.ExecuteScalarAsync(ct);
            return obj is null || obj == DBNull.Value ? null : Convert.ToInt64(obj);
        }

        public async Task<string?> GetIdentificacionByUsernameAsync(string username, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(username)) return null;
            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT identificacion FROM ctr_usuarios WHERE UPPER(username) = UPPER(@u)";
            cmd.Parameters.AddWithValue("u", username);
            var obj = await cmd.ExecuteScalarAsync(ct);
            return obj is null || obj == DBNull.Value ? null : obj.ToString()?.Trim();
        }

        public async Task<bool?> GetActivoByIdentificacionOrUsernameAsync(string? identificacion, string? username, CancellationToken ct)
        {
            var doc = (identificacion ?? string.Empty).Trim();
            var user = (username ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(doc) && string.IsNullOrWhiteSpace(user)) return null;

            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);

            if (!string.IsNullOrWhiteSpace(doc))
            {
                var r = await GetBloqueadoAsync(conn, "WHERE identificacion = @v LIMIT 1", doc, ct);
                if (r.HasValue) return r.Value == 0;
            }

            if (!string.IsNullOrWhiteSpace(user))
            {
                var r = await GetBloqueadoAsync(conn, "WHERE UPPER(username) = UPPER(@v) LIMIT 1", user, ct);
                if (r.HasValue) return r.Value == 0;
            }

            return null;
        }

        public async Task<long> EnsureUsuarioExistsAsync(DtoFuncionario funcionario, CancellationToken ct)
        {
            var username = (funcionario.usuario ?? funcionario.identificacion ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(username)) return 0;

            var identificacion = (funcionario.identificacion ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(identificacion)) return 0;

            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);
            await using var cmd = conn.CreateCommand();

            // Upsert: insert if not exists, return id
            cmd.CommandText = @"
INSERT INTO ctr_usuarios (username, identificacion, bloqueado)
VALUES (@username, @identificacion, 0)
ON CONFLICT (username) DO NOTHING
RETURNING id_usuario";
            cmd.Parameters.AddWithValue("username", username);
            cmd.Parameters.AddWithValue("identificacion", identificacion);

            var obj = await cmd.ExecuteScalarAsync(ct);
            if (obj != null && obj != DBNull.Value)
            {
                var newId = Convert.ToInt64(obj);
                _logger.LogInformation("Usuario creado. username={Username}, id={Id}", username, newId);
                return newId;
            }

            // Already existed — fetch id
            var existingId = await GetUsuarioIdByUsernameAsync(username, ct);
            return existingId ?? 0;
        }

        public async Task<List<DtoUsuarioListadoItem>> GetUsuariosListadoAsync(string? nombre, CancellationToken ct)
        {
            var result = new List<DtoUsuarioListadoItem>();
            var filtro = (nombre ?? string.Empty).Trim();

            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = @"
WITH roles_agg AS (
    SELECT
        x.id_usuario,
        STRING_AGG(x.rol_desc, ', ' ORDER BY x.rol_desc) AS roles,
        STRING_AGG(x.fecha_fin_txt, ', ' ORDER BY x.fecha_fin_txt) AS fecha_fin_rol
    FROM (
        SELECT DISTINCT
            rua.id_usuario,
            COALESCE(r.descripcion, 'Sin rol') AS rol_desc,
            CASE WHEN rua.fecha_fin IS NOT NULL THEN TO_CHAR(rua.fecha_fin, 'YYYY-MM-DD') END AS fecha_fin_txt
        FROM ctr_roles_user_admin rua
        LEFT JOIN ctr_roles r ON r.id_rol = rua.id_rol
    ) x
    GROUP BY x.id_usuario
)
SELECT
    u.id_usuario,
    u.identificacion,
    u.username,
    TRIM(REGEXP_REPLACE(
        COALESCE(u.grad_alfabetico,'') || ' ' || COALESCE(u.nombres,'') || ' ' || COALESCE(u.apellidos,''),
        '\s+', ' ', 'g'
    )) AS nombre_completo,
    COALESCE(ra.roles, 'Sin rol') AS rol,
    ra.fecha_fin_rol
FROM ctr_usuarios u
LEFT JOIN roles_agg ra ON ra.id_usuario = u.id_usuario
WHERE (@filtro = ''
   OR UPPER(u.username) LIKE '%' || UPPER(@filtro) || '%'
   OR UPPER(COALESCE(u.nombres,'') || ' ' || COALESCE(u.apellidos,'')) LIKE '%' || UPPER(@filtro) || '%')
ORDER BY UPPER(u.username)";
            cmd.Parameters.AddWithValue("filtro", filtro);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
                result.Add(new DtoUsuarioListadoItem
                {
                    idUsuario = reader.IsDBNull(0) ? 0 : Convert.ToInt64(reader.GetValue(0)),
                    identificacion = reader.IsDBNull(1) ? string.Empty : reader.GetString(1),
                    username = reader.IsDBNull(2) ? string.Empty : reader.GetString(2),
                    nombreCompleto = reader.IsDBNull(3) ? string.Empty : reader.GetString(3),
                    rol = reader.IsDBNull(4) ? "Sin rol" : reader.GetString(4),
                    fechaFinRol = reader.IsDBNull(5) ? null : reader.GetString(5)
                });

            return result;
        }

        public async Task<List<DtoRolAsignado>> GetRolesAsignadosAsync(string username, CancellationToken ct)
        {
            var idUsuario = await GetUsuarioIdByUsernameAsync(username, ct);
            if (!idUsuario.HasValue) return new List<DtoRolAsignado>();

            var result = new List<DtoRolAsignado>();
            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = @"
SELECT DISTINCT rua.id_rol, r.descripcion, rua.justificacion, rua.fecha_fin, COALESCE(rua.vigente, 0)
FROM ctr_roles_user_admin rua
LEFT JOIN ctr_roles r ON r.id_rol = rua.id_rol
WHERE rua.id_usuario = @id
ORDER BY r.descripcion, rua.id_rol";
            cmd.Parameters.AddWithValue("id", idUsuario.Value);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                var idRol = Convert.ToInt32(reader.GetValue(0));
                var desc = reader.IsDBNull(1) ? null : reader.GetString(1);
                var just = reader.IsDBNull(2) ? null : reader.GetString(2);
                var fechaFin = reader.IsDBNull(3) ? (DateTime?)null : reader.GetDateTime(3);
                var vigente = Convert.ToInt32(reader.GetValue(4));
                var estado = vigente == 1 && (!fechaFin.HasValue || fechaFin.Value.Date >= DateTime.Today) ? "Vigente" : "Vencido";

                result.Add(new DtoRolAsignado
                {
                    id = idRol,
                    rol = !string.IsNullOrWhiteSpace(desc) ? desc : $"Rol {idRol}",
                    estado = estado,
                    fechaFin = fechaFin?.ToString("yyyy-MM-dd"),
                    justificacion = just
                });
            }

            if (result.Count > 0) return result;

            // Fallback: simple roles table
            await using var cmdFb = conn.CreateCommand();
            cmdFb.CommandText = "SELECT DISTINCT id_rol FROM ctr_roles_user WHERE id_usuario = @id ORDER BY id_rol";
            cmdFb.Parameters.AddWithValue("id", idUsuario.Value);
            await using var readerFb = await cmdFb.ExecuteReaderAsync(ct);
            while (await readerFb.ReadAsync(ct))
            {
                var idRol = Convert.ToInt32(readerFb.GetValue(0));
                result.Add(new DtoRolAsignado { id = idRol, rol = $"Rol {idRol}", estado = "Vigente" });
            }

            return result;
        }

        public async Task<DtoGuardarUsuarioResult> EliminarRolAsync(long idUsuario, int rolId, string usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        {
            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = @"
UPDATE ctr_roles_user_admin
   SET vigente = 0,
       fecha_fin = COALESCE(fecha_fin, CURRENT_DATE)
 WHERE id_usuario = @idUsuario AND id_rol = @idRol AND COALESCE(vigente, 0) = 1";
            cmd.Parameters.AddWithValue("idUsuario", idUsuario);
            cmd.Parameters.AddWithValue("idRol", rolId);

            var affected = await cmd.ExecuteNonQueryAsync(ct);
            return affected > 0
                ? new DtoGuardarUsuarioResult { idUsuario = idUsuario, message = "Rol retirado correctamente." }
                : new DtoGuardarUsuarioResult { idUsuario = 0, message = "No se encontró un rol vigente para retirar." };
        }

        public async Task<List<DtoRol>> GetRolesAsync(CancellationToken ct)
        {
            var result = new List<DtoRol>();
            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT id_rol, descripcion FROM ctr_roles WHERE COALESCE(vigente, 1) = 1 ORDER BY descripcion";

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
                result.Add(new DtoRol { id = Convert.ToInt32(reader.GetValue(0)), nombre = reader.IsDBNull(1) ? null : reader.GetString(1) });

            return result;
        }

        public async Task<DtoGuardarUsuarioResult> SaveUsuarioAsync(DtoUsuarioRequest request, string usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        {
            var username = Trim(request.username ?? request.identificacion);
            if (string.IsNullOrWhiteSpace(username))
                return new DtoGuardarUsuarioResult { idUsuario = 0, message = "Username requerido." };

            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = @"
INSERT INTO ctr_usuarios
    (username, identificacion, grad_alfabetico, apellidos, nombres,
     funcionario, unde_laborando, codigo_cargo, bloqueado,
     usuario_creacion, fecha_creacion, maquina_creacion)
VALUES
    (@username, @identificacion, @grado, @apellidos, @nombres,
     @funcionario, @undeLaborando, @codigoCargo, @bloqueado,
     @usuario, NOW(), @maquina)
ON CONFLICT (username) DO UPDATE SET
    identificacion   = EXCLUDED.identificacion,
    grad_alfabetico  = EXCLUDED.grad_alfabetico,
    apellidos        = EXCLUDED.apellidos,
    nombres          = EXCLUDED.nombres,
    funcionario      = EXCLUDED.funcionario,
    unde_laborando   = EXCLUDED.unde_laborando,
    codigo_cargo     = EXCLUDED.codigo_cargo,
    bloqueado        = EXCLUDED.bloqueado,
    fecha_modifica   = NOW(),
    usuario_modifica = @usuarioModif,
    maquina_modifica = @maquinaModif
RETURNING id_usuario";

            cmd.Parameters.AddWithValue("username", username);
            cmd.Parameters.AddWithValue("identificacion", AsDbVal(request.identificacion));
            cmd.Parameters.AddWithValue("grado", AsDbVal(request.gradAlfabetico, "N/A"));
            cmd.Parameters.AddWithValue("apellidos", AsDbVal(request.apellidos));
            cmd.Parameters.AddWithValue("nombres", AsDbVal(request.nombres));
            cmd.Parameters.AddWithValue("funcionario", AsInt(request.funcionario));
            cmd.Parameters.AddWithValue("undeLaborando", AsInt(request.undeLaborando));
            cmd.Parameters.AddWithValue("codigoCargo", AsInt(request.codigoCargo));
            cmd.Parameters.AddWithValue("bloqueado", request.activo ? 0 : 1);
            cmd.Parameters.AddWithValue("usuario", Truncate(usuarioAuditoria, 30));
            cmd.Parameters.AddWithValue("maquina", Truncate(maquinaAuditoria, 100));
            cmd.Parameters.AddWithValue("usuarioModif", Truncate(usuarioAuditoria, 30));
            cmd.Parameters.AddWithValue("maquinaModif", Truncate(maquinaAuditoria, 100));

            var idUsuario = Convert.ToInt64(await cmd.ExecuteScalarAsync(ct));
            return new DtoGuardarUsuarioResult { idUsuario = idUsuario, message = "Usuario guardado correctamente." };
        }

        public async Task<DtoGuardarUsuarioResult> EliminarUsuarioAsync(long idUsuario, string usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        {
            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);

            try
            {
                await using (var cmd = conn.CreateCommand())
                {
                    cmd.Transaction = tx;
                    cmd.CommandText = "UPDATE ctr_usuarios SET bloqueado = 1 WHERE id_usuario = @id";
                    cmd.Parameters.AddWithValue("id", idUsuario);
                    var rows = await cmd.ExecuteNonQueryAsync(ct);
                    if (rows <= 0)
                    {
                        await tx.RollbackAsync(ct);
                        return new DtoGuardarUsuarioResult { idUsuario = 0, message = "No se encontró el usuario." };
                    }
                }

                await using (var cmd = conn.CreateCommand())
                {
                    cmd.Transaction = tx;
                    cmd.CommandText = @"
UPDATE ctr_roles_user_admin
   SET vigente = 0, fecha_fin = COALESCE(fecha_fin, CURRENT_DATE)
 WHERE id_usuario = @id AND COALESCE(vigente, 0) = 1";
                    cmd.Parameters.AddWithValue("id", idUsuario);
                    await cmd.ExecuteNonQueryAsync(ct);
                }

                await tx.CommitAsync(ct);
                return new DtoGuardarUsuarioResult { idUsuario = idUsuario, message = "Usuario eliminado correctamente." };
            }
            catch
            {
                await tx.RollbackAsync(ct);
                throw;
            }
        }

        public async Task<DtoGuardarUsuarioResult> AsignarRolAsync(long idUsuario, DtoAsignarRolRequest request, string usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        {
            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);
            await using var cmd = conn.CreateCommand();

            DateTime? fechaFin = null;
            if (!string.IsNullOrWhiteSpace(request.fechaFin))
                fechaFin = DateTime.Parse(request.fechaFin);

            cmd.CommandText = @"
INSERT INTO ctr_roles_user_admin
    (id_usuario, id_rol, justificacion, fecha_fin, vigente, usuario_creacion, fecha_creacion, maquina_creacion)
VALUES
    (@idUsuario, @idRol, @just, @fechaFin, @vigente, @usuario, NOW(), @maquina)
ON CONFLICT DO NOTHING
RETURNING id";

            cmd.Parameters.AddWithValue("idUsuario", idUsuario);
            cmd.Parameters.AddWithValue("idRol", request.rolId);
            cmd.Parameters.AddWithValue("just", AsDbVal(request.justificacion, "SIN JUSTIFICACION"));
            cmd.Parameters.AddWithValue("fechaFin", (object?)fechaFin ?? DBNull.Value);
            cmd.Parameters.AddWithValue("vigente", request.vigente is 0 ? 0 : 1);
            cmd.Parameters.AddWithValue("usuario", AsLong(usuarioAuditoria));
            cmd.Parameters.AddWithValue("maquina", Truncate(maquinaAuditoria, 100));

            var obj = await cmd.ExecuteScalarAsync(ct);
            var newId = obj is null || obj == DBNull.Value ? 0L : Convert.ToInt64(obj);
            return new DtoGuardarUsuarioResult { idUsuario = newId, message = newId > 0 ? "Rol asignado correctamente." : "Rol ya asignado." };
        }

        public async Task<List<DtoRolAdmin>> GetRolesAdminAsync(CancellationToken ct)
        {
            var result = new List<DtoRolAdmin>();
            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT id_rol, descripcion, COALESCE(vigente, 1) FROM ctr_roles ORDER BY descripcion";

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
                result.Add(new DtoRolAdmin
                {
                    id = Convert.ToInt32(reader.GetValue(0)),
                    nombre = reader.IsDBNull(1) ? null : reader.GetString(1),
                    vigente = Convert.ToInt32(reader.GetValue(2))
                });

            return result;
        }

        public async Task<DtoSaveRolResult> SaveRolAdminAsync(DtoSaveRolRequest request, string usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        {
            var nombre = (request.nombre ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(nombre))
                return new DtoSaveRolResult { idRol = 0, message = "La descripción del rol es obligatoria." };

            var vigente = request.vigente == 0 ? 0 : 1;
            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);

            try
            {
                if (request.id.GetValueOrDefault() > 0)
                {
                    await using var cmd = conn.CreateCommand();
                    cmd.Transaction = tx;
                    cmd.CommandText = @"
UPDATE ctr_roles SET descripcion=@desc, vigente=@vig, usuario_modifica=@u, fecha_modifica=NOW(), maquina_modifica=@m
WHERE id_rol=@id";
                    cmd.Parameters.AddWithValue("desc", nombre);
                    cmd.Parameters.AddWithValue("vig", vigente);
                    cmd.Parameters.AddWithValue("u", AsLong(usuarioAuditoria));
                    cmd.Parameters.AddWithValue("m", Truncate(maquinaAuditoria, 100));
                    cmd.Parameters.AddWithValue("id", request.id!.Value);
                    var rows = await cmd.ExecuteNonQueryAsync(ct);
                    if (rows <= 0) { await tx.RollbackAsync(ct); return new DtoSaveRolResult { idRol = 0, message = "Rol no encontrado." }; }
                    await tx.CommitAsync(ct);
                    return new DtoSaveRolResult { idRol = request.id.Value, message = "Rol actualizado correctamente." };
                }

                await using (var cmd = conn.CreateCommand())
                {
                    cmd.Transaction = tx;
                    cmd.CommandText = @"
INSERT INTO ctr_roles (descripcion, vigente, usuario_creacion, fecha_creacion, maquina_creacion)
VALUES (@desc, @vig, @u, NOW(), @m)
RETURNING id_rol";
                    cmd.Parameters.AddWithValue("desc", nombre);
                    cmd.Parameters.AddWithValue("vig", vigente);
                    cmd.Parameters.AddWithValue("u", usuarioAuditoria);
                    cmd.Parameters.AddWithValue("m", Truncate(maquinaAuditoria, 100));

                    var newId = Convert.ToInt64(await cmd.ExecuteScalarAsync(ct));
                    await tx.CommitAsync(ct);
                    return new DtoSaveRolResult { idRol = newId, message = "Rol creado correctamente." };
                }
            }
            catch
            {
                await tx.RollbackAsync(ct);
                throw;
            }
        }

        public async Task<DtoSaveRolResult> SetRolEstadoAsync(long idRol, int vigente, string usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        {
            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = @"
UPDATE ctr_roles SET vigente=@vig, usuario_modifica=@u, fecha_modifica=NOW(), maquina_modifica=@m
WHERE id_rol=@id";
            cmd.Parameters.AddWithValue("vig", vigente == 0 ? 0 : 1);
            cmd.Parameters.AddWithValue("u", AsLong(usuarioAuditoria));
            cmd.Parameters.AddWithValue("m", Truncate(maquinaAuditoria, 100));
            cmd.Parameters.AddWithValue("id", idRol);

            var rows = await cmd.ExecuteNonQueryAsync(ct);
            return rows > 0
                ? new DtoSaveRolResult { idRol = idRol, message = vigente == 0 ? "Rol inactivado." : "Rol activado." }
                : new DtoSaveRolResult { idRol = 0, message = "Rol no encontrado." };
        }

        private static async Task<int?> GetBloqueadoAsync(NpgsqlConnection conn, string where, string value, CancellationToken ct)
        {
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = $"SELECT bloqueado FROM ctr_usuarios {where}";
            cmd.Parameters.AddWithValue("v", value);
            var obj = await cmd.ExecuteScalarAsync(ct);
            return obj is null || obj == DBNull.Value ? null : Convert.ToInt32(obj);
        }

        private static string Trim(string? v) => (v ?? string.Empty).Trim();
        private static string Truncate(string? v, int max) { var s = Trim(v); return s.Length > max ? s[..max] : s; }
        private static object AsDbVal(string? v, string? fallback = null) { var s = Trim(v); return string.IsNullOrWhiteSpace(s) ? (fallback is null ? DBNull.Value : (object)fallback) : s; }
        private static int AsInt(string? v) => int.TryParse(Trim(v), NumberStyles.Integer, CultureInfo.InvariantCulture, out var i) ? i : 0;
        private static long AsLong(string? v) => long.TryParse(Trim(v), NumberStyles.Integer, CultureInfo.InvariantCulture, out var l) ? l : 0L;
    }
}

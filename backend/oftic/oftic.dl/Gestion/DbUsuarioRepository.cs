using Comun.Dtos;
using Datos.Interfaz;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Oracle.ManagedDataAccess.Client;
using Oracle.ManagedDataAccess.Types;
using System.Data;
using System.Globalization;

namespace Datos.Gestion
{
    public class DbUsuarioRepository : IDbUsuarioRepository
    {
        private readonly string _cs;
        private readonly ILogger<DbUsuarioRepository> _logger;

        public DbUsuarioRepository(IConfiguration cfg, ILogger<DbUsuarioRepository> logger)
        {
            _cs = cfg.GetConnectionString("DbOracle")!;
            _logger = logger;
        }

        public async Task<long?> GetUsuarioIdByUsernameAsync(string username, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(username))
            {
                return null;
            }

            await using var conn = new OracleConnection(_cs);
            await conn.OpenAsync(ct);

            await using var cmd = conn.CreateCommand();
            cmd.CommandType = CommandType.Text;
            cmd.CommandText = @"SELECT id_usuario FROM ctr_usuarios WHERE UPPER(username) = UPPER(:pUsuario)";
            cmd.Parameters.Add(":pUsuario", OracleDbType.Varchar2).Value = username;

            var obj = await cmd.ExecuteScalarAsync(ct);
            if (obj is null || obj == DBNull.Value)
            {
                return null;
            }

            return Convert.ToInt64(obj);
        }

        public async Task<long?> GetUsuarioIdByIdentificacionAsync(string identificacion, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(identificacion))
            {
                return null;
            }

            await using var conn = new OracleConnection(_cs);
            await conn.OpenAsync(ct);

            await using var cmd = conn.CreateCommand();
            cmd.CommandType = CommandType.Text;
            cmd.CommandText = @"SELECT id_usuario FROM ctr_usuarios WHERE identificacion = :pIdentificacion";
            cmd.Parameters.Add(":pIdentificacion", OracleDbType.Varchar2).Value = identificacion.Trim();

            var obj = await cmd.ExecuteScalarAsync(ct);
            if (obj is null || obj == DBNull.Value)
            {
                return null;
            }

            return Convert.ToInt64(obj);
        }

        public async Task<string?> GetIdentificacionByUsernameAsync(string username, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(username))
            {
                return null;
            }

            await using var conn = new OracleConnection(_cs);
            await conn.OpenAsync(ct);

            await using var cmd = conn.CreateCommand();
            cmd.CommandType = CommandType.Text;
            cmd.CommandText = @"SELECT identificacion FROM ctr_usuarios WHERE UPPER(username) = UPPER(:pUsuario)";
            cmd.Parameters.Add(":pUsuario", OracleDbType.Varchar2).Value = username;

            var obj = await cmd.ExecuteScalarAsync(ct);
            if (obj is null || obj == DBNull.Value)
            {
                return null;
            }

            return obj.ToString()?.Trim();
        }

        public async Task<bool?> GetActivoByIdentificacionOrUsernameAsync(string? identificacion, string? username, CancellationToken ct)
        {
            var doc = (identificacion ?? string.Empty).Trim();
            var user = (username ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(doc) && string.IsNullOrWhiteSpace(user))
            {
                return null;
            }

            await using var conn = new OracleConnection(_cs);
            await conn.OpenAsync(ct);

            // Prioridad 1: identificación exacta.
            var byDoc = await GetBloqueadoByIdentificacionAsync(conn, doc, ct);
            if (byDoc.HasValue)
            {
                return byDoc.Value == 0;
            }

            // Prioridad 2: username.
            var byUser = await GetBloqueadoByUsernameAsync(conn, user, ct);
            if (byUser.HasValue)
            {
                return byUser.Value == 0;
            }

            return null;
        }

        public async Task<long> EnsureUsuarioExistsAsync(DtoFuncionario funcionario, CancellationToken ct)
        {
            var username = (funcionario.usuario ?? funcionario.identificacion ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(username))
            {
                _logger.LogWarning("No fue posible resolver username para crear usuario local.");
                return 0;
            }

            var identificacion = (funcionario.identificacion ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(identificacion))
            {
                _logger.LogWarning("Se omite creación local: identificación vacía para username={Username}", username);
                return 0;
            }

            var existingId = await GetUsuarioIdByUsernameAsync(username, ct);
            if (existingId.HasValue)
            {
                return existingId.Value;
            }

            await using var conn = new OracleConnection(_cs);
            await conn.OpenAsync(ct);

            await using var tx = conn.BeginTransaction();
            try
            {
                long nextId;
                await using (var cmdNext = conn.CreateCommand())
                {
                    cmdNext.Transaction = tx;
                    cmdNext.CommandType = CommandType.Text;
                    cmdNext.CommandText = "SELECT NVL(MAX(id_usuario), 0) + 1 FROM ctr_usuarios";
                    nextId = Convert.ToInt64(await cmdNext.ExecuteScalarAsync(ct));
                }

                await using (var cmdInsert = conn.CreateCommand())
                {
                    cmdInsert.Transaction = tx;
                    cmdInsert.CommandType = CommandType.Text;
                    cmdInsert.CommandText = @"
INSERT INTO ctr_usuarios (id_usuario, username, identificacion, bloqueado)
VALUES (:pIdUsuario, :pUsername, :pIdentificacion, 0)";
                    cmdInsert.Parameters.Add(":pIdUsuario", OracleDbType.Int64).Value = nextId;
                    cmdInsert.Parameters.Add(":pUsername", OracleDbType.Varchar2).Value = username;
                    cmdInsert.Parameters.Add(":pIdentificacion", OracleDbType.Varchar2).Value = identificacion;
                    await cmdInsert.ExecuteNonQueryAsync(ct);
                }

                await tx.CommitAsync(ct);
                _logger.LogInformation("Usuario creado en CTR_USUARIOS. username={Username}, id_usuario={IdUsuario}", username, nextId);
                return nextId;
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync(ct);
                _logger.LogError(ex, "Error creando usuario en CTR_USUARIOS para username={Username}", username);
                throw;
            }
        }

        public async Task<List<DtoRolAsignado>> GetRolesAsignadosAsync(string username, CancellationToken ct)
        {
            var idUsuario = await GetUsuarioIdByUsernameAsync(username, ct);
            if (!idUsuario.HasValue)
            {
                return new List<DtoRolAsignado>();
            }

            var result = new List<DtoRolAsignado>();

            await using var conn = new OracleConnection(_cs);
            await conn.OpenAsync(ct);

            await using var cmd = conn.CreateCommand();
            cmd.CommandType = CommandType.Text;
            cmd.CommandText = @"
SELECT DISTINCT id_rol, justificacion
FROM ctr_roles_user_admin
WHERE id_usuario = :pIdUsuario
ORDER BY id_rol";
            cmd.Parameters.Add(":pIdUsuario", OracleDbType.Int64).Value = idUsuario.Value;

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                var idRol = Convert.ToInt32(reader.GetInt64(0));
                result.Add(new DtoRolAsignado
                {
                    id = idRol,
                    rol = $"Rol {idRol}",
                    estado = "Vigente",
                    fechaInicio = null,
                    fechaFin = null,
                    justificacion = reader.IsDBNull(1) ? null : reader.GetString(1)
                });
            }

            if (result.Count > 0)
            {
                return result;
            }

            // Fallback para usuarios con datos solo en la tabla legacy.
            await using var cmdFallback = conn.CreateCommand();
            cmdFallback.CommandType = CommandType.Text;
            cmdFallback.CommandText = @"
SELECT DISTINCT id_rol
FROM ctr_roles_user
WHERE id_usuario = :pIdUsuario
ORDER BY id_rol";
            cmdFallback.Parameters.Add(":pIdUsuario", OracleDbType.Int64).Value = idUsuario.Value;

            await using var readerFallback = await cmdFallback.ExecuteReaderAsync(ct);
            while (await readerFallback.ReadAsync(ct))
            {
                var idRol = Convert.ToInt32(readerFallback.GetInt64(0));
                result.Add(new DtoRolAsignado
                {
                    id = idRol,
                    rol = $"Rol {idRol}",
                    estado = "Vigente",
                    fechaInicio = null,
                    fechaFin = null,
                    justificacion = null
                });
            }

            return result;
        }

        public async Task<List<DtoRol>> GetRolesAsync(CancellationToken ct)
        {
            var result = new List<DtoRol>();

            await using var conn = new OracleConnection(_cs);
            await conn.OpenAsync(ct);

            await using var cmd = conn.CreateCommand();
            cmd.CommandType = CommandType.Text;
            cmd.CommandText = @"
SELECT id_rol, descripcion
FROM ctr_roles
WHERE NVL(vigente, 1) = 1
ORDER BY descripcion";

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                result.Add(new DtoRol
                {
                    id = Convert.ToInt32(reader.GetInt64(0)),
                    nombre = reader.IsDBNull(1) ? null : reader.GetString(1)
                });
            }

            return result;
        }

        public async Task<DtoGuardarUsuarioResult> SaveUsuarioAsync(
            DtoUsuarioRequest request,
            string usuarioAuditoria,
            string maquinaAuditoria,
            CancellationToken ct)
        {
            try
            {
                await using var conn = new OracleConnection(_cs);
                await conn.OpenAsync(ct);

                await using var cmd = conn.CreateCommand();
                cmd.BindByName = true;
                cmd.CommandType = CommandType.StoredProcedure;
                cmd.CommandText = "PK_ADMINISTRACION.P_INS_UPD_USUARIOS";

                cmd.Parameters.Add("P_Username", OracleDbType.Varchar2).Value =
                    AsDbValue(request.username ?? request.identificacion);
                cmd.Parameters.Add("P_Identificacion", OracleDbType.Varchar2).Value =
                    AsDbValue(request.identificacion);
                cmd.Parameters.Add("P_Email", OracleDbType.Varchar2).Value =
                    AsDbValue(request.email);
                cmd.Parameters.Add("P_GradAlfabetico", OracleDbType.Varchar2).Value =
                    AsRequiredDbValue(request.gradAlfabetico, "N/A");
                cmd.Parameters.Add("P_Apellidos", OracleDbType.Varchar2).Value =
                    AsDbValue(request.apellidos);
                cmd.Parameters.Add("P_Nombres", OracleDbType.Varchar2).Value =
                    AsDbValue(request.nombres);
                cmd.Parameters.Add("P_Funcionario", OracleDbType.Int32).Value =
                    AsIntOrZero(request.funcionario);
                cmd.Parameters.Add("P_UndeLaborando", OracleDbType.Int32).Value =
                    AsIntOrZero(request.undeLaborando);
                cmd.Parameters.Add("P_CodigoCargo", OracleDbType.Int32).Value =
                    AsIntOrZero(request.codigoCargo);
                cmd.Parameters.Add("P_Bloqueado", OracleDbType.Int32).Value = request.activo ? 0 : 1;
                cmd.Parameters.Add("P_Usuario", OracleDbType.Varchar2).Value = AsDbValue(usuarioAuditoria, 30);
                cmd.Parameters.Add("P_Maquina", OracleDbType.Varchar2).Value = AsDbValue(maquinaAuditoria, 100);

                var pMessage = new OracleParameter("SRV_Message", OracleDbType.Varchar2, 4000)
                {
                    Direction = ParameterDirection.Output
                };
                var pResultado = new OracleParameter("P_Resultado", OracleDbType.Int64)
                {
                    Direction = ParameterDirection.Output
                };

                cmd.Parameters.Add(pMessage);
                cmd.Parameters.Add(pResultado);

                await cmd.ExecuteNonQueryAsync(ct);

                var message = (pMessage.Value?.ToString() ?? string.Empty).Trim();
                var idUsuario = 0L;

                if (pResultado.Value != null && pResultado.Value != DBNull.Value)
                {
                    idUsuario = ToInt64Safe(pResultado.Value);
                }

                return new DtoGuardarUsuarioResult
                {
                    idUsuario = idUsuario,
                    message = message
                };
            }
            catch (OracleException ex)
            {
                _logger.LogError(ex, "Error Oracle ejecutando PK_ADMINISTRACION.P_INS_UPD_USUARIOS");
                throw new InvalidOperationException($"Oracle: {ex.Message}", ex);
            }
        }

        public async Task<DtoGuardarUsuarioResult> AsignarRolAsync(
            long idUsuario,
            DtoAsignarRolRequest request,
            string usuarioAuditoria,
            string maquinaAuditoria,
            CancellationToken ct)
        {
            try
            {
                await using var conn = new OracleConnection(_cs);
                await conn.OpenAsync(ct);

                await using var cmd = conn.CreateCommand();
                cmd.BindByName = true;
                cmd.CommandType = CommandType.StoredProcedure;
                cmd.CommandText = "PK_ADMINISTRACION.P_INS_ROL_USER";

                cmd.Parameters.Add("P_IdUsuario", OracleDbType.Int64).Value = idUsuario;
                cmd.Parameters.Add("P_IdRol", OracleDbType.Int32).Value = request.rolId;
                cmd.Parameters.Add("P_Justificacion", OracleDbType.Varchar2).Value =
                    AsRequiredDbValue(request.justificacion, "SIN JUSTIFICACION", 1000);
                cmd.Parameters.Add("P_FechaFin", OracleDbType.Date).Value = DateTime.Parse(request.fechaFin!);
                cmd.Parameters.Add("P_Vigente", OracleDbType.Int32).Value = request.vigente is 0 ? 0 : 1;
                cmd.Parameters.Add("P_Usuario", OracleDbType.Int64).Value = AsLongOrZero(usuarioAuditoria);
                cmd.Parameters.Add("P_Maquina", OracleDbType.Varchar2).Value = AsDbValue(maquinaAuditoria, 100);

                var pMessage = new OracleParameter("SRV_Message", OracleDbType.Varchar2, 4000)
                {
                    Direction = ParameterDirection.Output
                };
                var pResultado = new OracleParameter("P_Resultado", OracleDbType.Int64)
                {
                    Direction = ParameterDirection.Output
                };

                cmd.Parameters.Add(pMessage);
                cmd.Parameters.Add(pResultado);

                await cmd.ExecuteNonQueryAsync(ct);

                var message = (pMessage.Value?.ToString() ?? string.Empty).Trim();
                var idRolUserAdmin = 0L;
                if (pResultado.Value != null && pResultado.Value != DBNull.Value)
                {
                    idRolUserAdmin = ToInt64Safe(pResultado.Value);
                }

                return new DtoGuardarUsuarioResult
                {
                    idUsuario = idRolUserAdmin,
                    message = message
                };
            }
            catch (OracleException ex)
            {
                _logger.LogError(ex, "Error Oracle ejecutando PK_ADMINISTRACION.P_INS_ROL_USER");
                throw new InvalidOperationException($"Oracle: {ex.Message}", ex);
            }
        }

        public async Task<List<DtoRolAdmin>> GetRolesAdminAsync(CancellationToken ct)
        {
            var result = new List<DtoRolAdmin>();

            await using var conn = new OracleConnection(_cs);
            await conn.OpenAsync(ct);

            await using var cmd = conn.CreateCommand();
            cmd.CommandType = CommandType.Text;
            cmd.CommandText = @"
SELECT id_rol, descripcion, NVL(vigente, 1) AS vigente
FROM ctr_roles
ORDER BY descripcion";

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                result.Add(new DtoRolAdmin
                {
                    id = Convert.ToInt32(reader.GetInt64(0)),
                    nombre = reader.IsDBNull(1) ? null : reader.GetString(1),
                    vigente = reader.IsDBNull(2) ? 1 : Convert.ToInt32(reader.GetDecimal(2))
                });
            }

            return result;
        }

        public async Task<DtoSaveRolResult> SaveRolAdminAsync(
            DtoSaveRolRequest request,
            string usuarioAuditoria,
            string maquinaAuditoria,
            CancellationToken ct)
        {
            var nombre = (request.nombre ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(nombre))
            {
                return new DtoSaveRolResult { idRol = 0, message = "La descripción del rol es obligatoria." };
            }

            var vigente = request.vigente == 0 ? 0 : 1;

            await using var conn = new OracleConnection(_cs);
            await conn.OpenAsync(ct);
            await using var tx = conn.BeginTransaction();

            try
            {
                var idRol = request.id.GetValueOrDefault();
                if (idRol > 0)
                {
                    await using var cmdUpdate = conn.CreateCommand();
                    cmdUpdate.Transaction = tx;
                    cmdUpdate.BindByName = true;
                    cmdUpdate.CommandType = CommandType.Text;
                    cmdUpdate.CommandText = @"
UPDATE ctr_roles
   SET descripcion = :pDescripcion,
       vigente = :pVigente,
       usuario_modifica = :pUsuario,
       fecha_modifica = SYSDATE,
       maquina_modifica = :pMaquina
 WHERE id_rol = :pIdRol";

                    cmdUpdate.Parameters.Add(":pDescripcion", OracleDbType.Varchar2).Value = nombre;
                    cmdUpdate.Parameters.Add(":pVigente", OracleDbType.Int32).Value = vigente;
                    cmdUpdate.Parameters.Add(":pUsuario", OracleDbType.Int64).Value = AsLongOrZero(usuarioAuditoria);
                    cmdUpdate.Parameters.Add(":pMaquina", OracleDbType.Varchar2).Value = AsDbValue(maquinaAuditoria, 100);
                    cmdUpdate.Parameters.Add(":pIdRol", OracleDbType.Int64).Value = idRol;

                    var affected = await cmdUpdate.ExecuteNonQueryAsync(ct);
                    if (affected <= 0)
                    {
                        await tx.RollbackAsync(ct);
                        return new DtoSaveRolResult { idRol = 0, message = "No se encontró el rol para actualizar." };
                    }

                    await tx.CommitAsync(ct);
                    return new DtoSaveRolResult { idRol = idRol, message = "Rol actualizado correctamente." };
                }

                long nextId;
                await using (var cmdNext = conn.CreateCommand())
                {
                    cmdNext.Transaction = tx;
                    cmdNext.CommandType = CommandType.Text;
                    cmdNext.CommandText = "SELECT NVL(MAX(id_rol), 0) + 1 FROM ctr_roles";
                    nextId = Convert.ToInt64(await cmdNext.ExecuteScalarAsync(ct));
                }

                await using (var cmdInsert = conn.CreateCommand())
                {
                    cmdInsert.Transaction = tx;
                    cmdInsert.BindByName = true;
                    cmdInsert.CommandType = CommandType.Text;
                    cmdInsert.CommandText = @"
INSERT INTO ctr_roles
    (id_rol, descripcion, vigente, usuario_creacion, fecha_creacion, maquina_creacion)
VALUES
    (:pIdRol, :pDescripcion, :pVigente, :pUsuario, SYSDATE, :pMaquina)";

                    cmdInsert.Parameters.Add(":pIdRol", OracleDbType.Int64).Value = nextId;
                    cmdInsert.Parameters.Add(":pDescripcion", OracleDbType.Varchar2).Value = nombre;
                    cmdInsert.Parameters.Add(":pVigente", OracleDbType.Int32).Value = vigente;
                    cmdInsert.Parameters.Add(":pUsuario", OracleDbType.Int64).Value = AsLongOrZero(usuarioAuditoria);
                    cmdInsert.Parameters.Add(":pMaquina", OracleDbType.Varchar2).Value = AsDbValue(maquinaAuditoria, 100);

                    var inserted = await cmdInsert.ExecuteNonQueryAsync(ct);
                    if (inserted <= 0)
                    {
                        await tx.RollbackAsync(ct);
                        return new DtoSaveRolResult { idRol = 0, message = "No fue posible crear el rol." };
                    }
                }

                await tx.CommitAsync(ct);
                return new DtoSaveRolResult { idRol = nextId, message = "Rol creado correctamente." };
            }
            catch (OracleException ex)
            {
                await tx.RollbackAsync(ct);
                _logger.LogError(ex, "Error Oracle guardando rol en CTR_ROLES");
                throw new InvalidOperationException($"Oracle: {ex.Message}", ex);
            }
        }

        public async Task<DtoSaveRolResult> SetRolEstadoAsync(
            long idRol,
            int vigente,
            string usuarioAuditoria,
            string maquinaAuditoria,
            CancellationToken ct)
        {
            await using var conn = new OracleConnection(_cs);
            await conn.OpenAsync(ct);

            await using var cmd = conn.CreateCommand();
            cmd.BindByName = true;
            cmd.CommandType = CommandType.Text;
            cmd.CommandText = @"
UPDATE ctr_roles
   SET vigente = :pVigente,
       usuario_modifica = :pUsuario,
       fecha_modifica = SYSDATE,
       maquina_modifica = :pMaquina
 WHERE id_rol = :pIdRol";

            cmd.Parameters.Add(":pVigente", OracleDbType.Int32).Value = vigente == 0 ? 0 : 1;
            cmd.Parameters.Add(":pUsuario", OracleDbType.Int64).Value = AsLongOrZero(usuarioAuditoria);
            cmd.Parameters.Add(":pMaquina", OracleDbType.Varchar2).Value = AsDbValue(maquinaAuditoria, 100);
            cmd.Parameters.Add(":pIdRol", OracleDbType.Int64).Value = idRol;

            var affected = await cmd.ExecuteNonQueryAsync(ct);
            if (affected <= 0)
            {
                return new DtoSaveRolResult { idRol = 0, message = "No se encontró el rol." };
            }

            return new DtoSaveRolResult
            {
                idRol = idRol,
                message = vigente == 0 ? "Rol inactivado correctamente." : "Rol activado correctamente."
            };
        }

        private static object AsDbValue(string? value, int? maxLen = null)
        {
            var normalized = (value ?? string.Empty).Trim();
            if (maxLen.HasValue && normalized.Length > maxLen.Value)
            {
                normalized = normalized[..maxLen.Value];
            }
            return string.IsNullOrWhiteSpace(normalized) ? DBNull.Value : normalized;
        }

        private static object AsRequiredDbValue(string? value, string fallback, int? maxLen = null)
        {
            var normalized = (value ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(normalized))
            {
                normalized = fallback;
            }

            if (maxLen.HasValue && normalized.Length > maxLen.Value)
            {
                normalized = normalized[..maxLen.Value];
            }

            return normalized;
        }

        private static object AsNullableInt(string? value)
        {
            var normalized = (value ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(normalized))
            {
                return DBNull.Value;
            }

            return int.TryParse(normalized, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed)
                ? parsed
                : DBNull.Value;
        }

        private static int AsIntOrZero(string? value)
        {
            var normalized = (value ?? string.Empty).Trim();
            if (int.TryParse(normalized, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed))
            {
                return parsed;
            }

            return 0;
        }

        private static long ToInt64Safe(object value)
        {
            if (value is OracleDecimal oracleDecimal)
            {
                return oracleDecimal.IsNull ? 0L : oracleDecimal.ToInt64();
            }

            if (value is decimal dec)
            {
                return (long)dec;
            }

            if (value is long l)
            {
                return l;
            }

            if (value is int i)
            {
                return i;
            }

            if (long.TryParse(value.ToString(), out var parsed))
            {
                return parsed;
            }

            return 0L;
        }

        private static long AsLongOrZero(string? value)
        {
            var normalized = (value ?? string.Empty).Trim();
            if (long.TryParse(normalized, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed))
            {
                return parsed;
            }

            return 0L;
        }

        private static async Task<int?> GetBloqueadoByIdentificacionAsync(
            OracleConnection conn,
            string identificacion,
            CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(identificacion))
            {
                return null;
            }

            await using var cmd = conn.CreateCommand();
            cmd.CommandType = CommandType.Text;
            cmd.CommandText = @"
SELECT bloqueado
FROM ctr_usuarios
WHERE identificacion = :pIdentificacion
  AND rownum = 1";
            cmd.Parameters.Add(":pIdentificacion", OracleDbType.Varchar2).Value = identificacion;

            var obj = await cmd.ExecuteScalarAsync(ct);
            if (obj is null || obj == DBNull.Value)
            {
                return null;
            }

            return Convert.ToInt32(obj);
        }

        private static async Task<int?> GetBloqueadoByUsernameAsync(
            OracleConnection conn,
            string username,
            CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(username))
            {
                return null;
            }

            await using var cmd = conn.CreateCommand();
            cmd.CommandType = CommandType.Text;
            cmd.CommandText = @"
SELECT bloqueado
FROM ctr_usuarios
WHERE UPPER(username) = UPPER(:pUsername)
  AND rownum = 1";
            cmd.Parameters.Add(":pUsername", OracleDbType.Varchar2).Value = username;

            var obj = await cmd.ExecuteScalarAsync(ct);
            if (obj is null || obj == DBNull.Value)
            {
                return null;
            }

            return Convert.ToInt32(obj);
        }
    }
}

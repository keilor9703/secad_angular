using Comun.Dtos.Videos;
using Datos.Interfaz;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Oracle.ManagedDataAccess.Client;
using System.Data;

namespace Datos.Gestion
{
    public class DbVideoRepository : IDbVideoRepository
    {
        private readonly string _cs;
        private readonly ILogger<DbVideoRepository> _logger;

        public DbVideoRepository(IConfiguration configuration, ILogger<DbVideoRepository> logger)
        {
            _cs = configuration.GetConnectionString("DbCoest")!;
            _logger = logger;
        }

        public async Task<List<DtoVideo>> GetAllAsync(CancellationToken ct)
        {
            var result = new List<DtoVideo>();

            await using var conn = new OracleConnection(_cs);
            await conn.OpenAsync(ct);

            await using var cmd = conn.CreateCommand();
            cmd.CommandTimeout = 30;
            cmd.BindByName = true;
            cmd.CommandType = CommandType.StoredProcedure;
            cmd.CommandText = "PK_ADMINISTRACION.FN_CONSULTAR_VIDEO";
            cmd.Parameters.Add("in_id_video", OracleDbType.Int64).Value = DBNull.Value;

            var cursorParam = cmd.Parameters.Add("cur_datos", OracleDbType.RefCursor);
            cursorParam.Direction = ParameterDirection.ReturnValue;

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            
            while (await reader.ReadAsync(ct))
            {
                result.Add(MapVideo(reader));
            }

            return result;
        }

        public async Task<DtoVideo?> GetByIdAsync(long id, CancellationToken ct)
        {
            await using var conn = new OracleConnection(_cs);
            await conn.OpenAsync(ct);

            await using var cmd = conn.CreateCommand();
            cmd.CommandTimeout = 30;
            cmd.BindByName = true;
            cmd.CommandType = CommandType.StoredProcedure;
            cmd.CommandText = "PK_ADMINISTRACION.FN_CONSULTAR_VIDEO";
            cmd.Parameters.Add("in_id_video", OracleDbType.Int64).Value = id;

            var cursorParam = cmd.Parameters.Add("cur_datos", OracleDbType.RefCursor);
            cursorParam.Direction = ParameterDirection.ReturnValue;

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            
            if (await reader.ReadAsync(ct))
            {
                return MapVideo(reader);
            }

            return null;
        }

        public async Task<DtoVideoResult> CreateAsync(DtoVideoRequest request, string usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        {
            var result = new DtoVideoResult();

            await using var conn = new OracleConnection(_cs);
            await conn.OpenAsync(ct);

            try
            {
                await using var cmd = conn.CreateCommand();
                cmd.CommandTimeout = 30;
                cmd.BindByName = true;
                cmd.CommandType = CommandType.StoredProcedure;
                cmd.CommandText = "PK_ADMINISTRACION.PR_INSERTAR_VIDEO";

                cmd.Parameters.Add("iv_descripcion", OracleDbType.Varchar2, 255).Value = request.Descripcion ?? string.Empty;
                cmd.Parameters.Add("iv_observaciones", OracleDbType.Varchar2, 500).Value = (object?)request.Observaciones ?? DBNull.Value;
                cmd.Parameters.Add("iv_usuario_creacion", OracleDbType.Varchar2, 50).Value = usuarioAuditoria;
                cmd.Parameters.Add("iv_ruta_video", OracleDbType.Varchar2, 500).Value = (object?)request.RutaVideo ?? DBNull.Value;

                var outIdParam = cmd.Parameters.Add("on_id_video", OracleDbType.Int64);
                outIdParam.Direction = ParameterDirection.Output;

                var outMsgParam = cmd.Parameters.Add("ov_mensaje", OracleDbType.Varchar2, 4000);
                outMsgParam.Direction = ParameterDirection.Output;

                await cmd.ExecuteNonQueryAsync(ct);

                result.Success = true;
                result.Message = outMsgParam.Value?.ToString() ?? "Video creado exitosamente";
            }
            catch (OracleException ex)
            {
                result.Success = false;
                result.Message = $"Error de base de datos: {ex.Message}";
                _logger.LogError(ex, "Error Oracle en CreateAsync Video");
            }
            catch (Exception ex)
            {
                result.Success = false;
                result.Message = $"Error: {ex.Message}";
                _logger.LogError(ex, "Error general en CreateAsync Video");
            }

            return result;
        }

        public async Task<DtoVideoResult> UpdateAsync(long id, DtoVideoRequest request, string usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        {
            var result = new DtoVideoResult();

            await using var conn = new OracleConnection(_cs);
            await conn.OpenAsync(ct);

            try
            {
                await using var cmd = conn.CreateCommand();
                cmd.CommandTimeout = 30;
                cmd.BindByName = true;
                cmd.CommandType = CommandType.StoredProcedure;
                cmd.CommandText = "PK_ADMINISTRACION.PR_ACTUALIZAR_VIDEO";

                cmd.Parameters.Add("in_id_video", OracleDbType.Int64).Value = id;
                cmd.Parameters.Add("iv_descripcion", OracleDbType.Varchar2, 255).Value = request.Descripcion ?? string.Empty;
                cmd.Parameters.Add("iv_observaciones", OracleDbType.Varchar2, 500).Value = (object?)request.Observaciones ?? DBNull.Value;
                cmd.Parameters.Add("iv_usuario_modifica", OracleDbType.Varchar2, 50).Value = usuarioAuditoria;
                cmd.Parameters.Add("iv_maquina_modifica", OracleDbType.Varchar2, 100).Value = maquinaAuditoria ?? "N/A";
                cmd.Parameters.Add("iv_ruta_video", OracleDbType.Varchar2, 500).Value = (object?)request.RutaVideo ?? DBNull.Value;
                cmd.Parameters.Add("in_vigente", OracleDbType.Int32).Value = request.Vigente;

                var outMsgParam = cmd.Parameters.Add("ov_mensaje", OracleDbType.Varchar2, 4000);
                outMsgParam.Direction = ParameterDirection.Output;

                await cmd.ExecuteNonQueryAsync(ct);

                result.Success = outMsgParam.Value?.ToString()?.Contains("exitosa") ?? false;
                result.Message = outMsgParam.Value?.ToString() ?? "Video actualizado";
            }
            catch (OracleException ex)
            {
                result.Success = false;
                result.Message = $"Error de base de datos: {ex.Message}";
                _logger.LogError(ex, "Error Oracle en UpdateAsync Video");
            }
            catch (Exception ex)
            {
                result.Success = false;
                result.Message = $"Error: {ex.Message}";
                _logger.LogError(ex, "Error general en UpdateAsync Video");
            }

            return result;
        }

        public async Task<DtoVideoResult> DeleteAsync(long id, string usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        {
            var result = new DtoVideoResult();

            await using var conn = new OracleConnection(_cs);
            await conn.OpenAsync(ct);

            try
            {
                await using var cmd = conn.CreateCommand();
                cmd.CommandTimeout = 30;
                cmd.BindByName = true;
                cmd.CommandType = CommandType.StoredProcedure;
                cmd.CommandText = "PK_ADMINISTRACION.PR_ELIMINAR_VIDEO";

                cmd.Parameters.Add("in_id_video", OracleDbType.Int64).Value = id;
                cmd.Parameters.Add("iv_usuario_modifica", OracleDbType.Varchar2, 50).Value = usuarioAuditoria;

                var outMsgParam = cmd.Parameters.Add("ov_mensaje", OracleDbType.Varchar2, 4000);
                outMsgParam.Direction = ParameterDirection.Output;

                await cmd.ExecuteNonQueryAsync(ct);

                result.Success = outMsgParam.Value?.ToString()?.Contains("exitosa") ?? false;
                result.Message = outMsgParam.Value?.ToString() ?? "Video eliminado";
            }
            catch (OracleException ex)
            {
                result.Success = false;
                result.Message = $"Error de base de datos: {ex.Message}";
                _logger.LogError(ex, "Error Oracle en DeleteAsync Video");
            }
            catch (Exception ex)
            {
                result.Success = false;
                result.Message = $"Error: {ex.Message}";
                _logger.LogError(ex, "Error general en DeleteAsync Video");
            }

            return result;
        }

        private static DtoVideo MapVideo(OracleDataReader reader)
        {
            return new DtoVideo
            {
                IdVideo = reader.GetInt64(reader.GetOrdinal("ID_VIDEO")),
                Descripcion = reader.GetString(reader.GetOrdinal("DESCRIPCION")),
                Observaciones = reader.IsDBNull(reader.GetOrdinal("OBSERVACIONES")) ? null : reader.GetString(reader.GetOrdinal("OBSERVACIONES")),
                RutaVideo = reader.IsDBNull(reader.GetOrdinal("RUTA_VIDEO")) ? null : reader.GetString(reader.GetOrdinal("RUTA_VIDEO")),
                FechaCreacion = reader.GetDateTime(reader.GetOrdinal("FECHA_CREACION")),
                UsuarioCreacion = reader.GetString(reader.GetOrdinal("USUARIO_CREACION")),
                Vigente = reader.GetInt64(reader.GetOrdinal("VIGENTE")),
                FechaModifica = reader.IsDBNull(reader.GetOrdinal("FECHA_MODIFICA")) ? null : reader.GetDateTime(reader.GetOrdinal("FECHA_MODIFICA")),
                UsuarioModifica = reader.IsDBNull(reader.GetOrdinal("USUARIO_MODIFICA")) ? null : reader.GetString(reader.GetOrdinal("USUARIO_MODIFICA")),
                MaquinaModifica = reader.IsDBNull(reader.GetOrdinal("MAQUINA_MODIFICA")) ? null : reader.GetString(reader.GetOrdinal("MAQUINA_MODIFICA"))
            };
        }
    }
}
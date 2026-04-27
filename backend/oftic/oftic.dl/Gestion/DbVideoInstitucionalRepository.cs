using Comun.Dtos.Videos;
using Datos.Interfaz;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Oracle.ManagedDataAccess.Client;
using System.Data;
using System.Text.RegularExpressions;

namespace Datos.Gestion
{
    public class DbVideoInstitucionalRepository : IDbVideoInstitucionalRepository
    {
        private readonly string _cs;
        private readonly ILogger<DbVideoInstitucionalRepository> _logger;

        public DbVideoInstitucionalRepository(IConfiguration configuration, ILogger<DbVideoInstitucionalRepository> logger)
        {
            _cs = configuration.GetConnectionString("DbCoest")!;
            _logger = logger;
        }

        public async Task<DtoVideoInstitucional?> GetActiveAsync(CancellationToken ct)
        {
            await using var conn = new OracleConnection(_cs);
            await conn.OpenAsync(ct);

            await using var cmd = conn.CreateCommand();
            cmd.CommandTimeout = 30;
            cmd.CommandType = CommandType.Text;
            cmd.CommandText = "BEGIN :cursor := PK_ADMINISTRACION.FN_CONSULTAR_VIDEO_INST(:in_id_video_inst); END;";
            cmd.Parameters.Add("cursor", OracleDbType.RefCursor).Direction = ParameterDirection.Output;
            cmd.Parameters.Add("in_id_video_inst", OracleDbType.Int64).Value = DBNull.Value;

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (!await reader.ReadAsync(ct))
                return null;

            return MapVideoInstitucional(reader);
        }
        
        public async Task<List<DtoVideoInstitucional>> GetAllAsync(CancellationToken ct)
        {
            var result = new List<DtoVideoInstitucional>();

            await using var conn = new OracleConnection(_cs);
            await conn.OpenAsync(ct);

            await using var cmd = conn.CreateCommand();
            cmd.CommandTimeout = 30;
            cmd.CommandType = CommandType.Text;
            cmd.CommandText = @"
SELECT
    ID_VIDEO_INST,
    TITULO,
    DESCRIPCION,
    URL_YOUTUBE,
    NVL(VIGENTE, 0) AS VIGENTE,
    USUARIO_CREACION,
    FECHA_CREACION,
    USUARIO_MODIFICA,
    MAQUINA_MODIFICA,
    FECHA_MODIFICA
FROM CTR_VIDEO_INSTITUCIONAL
ORDER BY FECHA_CREACION DESC";

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                result.Add(MapVideoInstitucional(reader));
            }

            return result;
        }

        public async Task<DtoVideoInstitucionalResult> CreateAsync(DtoVideoInstitucionalRequest request, string usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        {
            var result = new DtoVideoInstitucionalResult();
            OracleTransaction? tx = null;

            try
            {
                await using var conn = new OracleConnection(_cs);
                await conn.OpenAsync(ct);
                tx = conn.BeginTransaction();

                await using (var cmdDeactivate = conn.CreateCommand())
                {
                    cmdDeactivate.Transaction = tx;
                    cmdDeactivate.CommandTimeout = 30;
                    cmdDeactivate.BindByName = true;
                    cmdDeactivate.CommandType = CommandType.Text;
                    cmdDeactivate.CommandText = @"
UPDATE CTR_VIDEO_INSTITUCIONAL
   SET VIGENTE = 0,
       USUARIO_MODIFICA = :iv_usuario_modifica,
       MAQUINA_MODIFICA = :iv_maquina_modifica,
       FECHA_MODIFICA = SYSDATE
 WHERE NVL(VIGENTE, 0) = 1";
                    cmdDeactivate.Parameters.Add("iv_usuario_modifica", OracleDbType.Varchar2, 50).Value = usuarioAuditoria;
                    cmdDeactivate.Parameters.Add("iv_maquina_modifica", OracleDbType.Varchar2, 100).Value = maquinaAuditoria;
                    await cmdDeactivate.ExecuteNonQueryAsync(ct);
                }

                await using var cmd = conn.CreateCommand();
                cmd.Transaction = tx;
                cmd.CommandTimeout = 30;
                cmd.BindByName = true;
                cmd.CommandType = CommandType.StoredProcedure;
                cmd.CommandText = "PK_ADMINISTRACION.PR_INSERTAR_VIDEO_INST";

                cmd.Parameters.Add("iv_titulo", OracleDbType.Varchar2, 150).Value = request.Titulo;
                cmd.Parameters.Add("iv_descripcion", OracleDbType.Varchar2, 500).Value = (object?)request.Descripcion ?? DBNull.Value;
                cmd.Parameters.Add("iv_url_youtube", OracleDbType.Varchar2, 500).Value = request.UrlYoutube;
                cmd.Parameters.Add("iv_usuario_creacion", OracleDbType.Varchar2, 50).Value = usuarioAuditoria;

                var pId = cmd.Parameters.Add("on_id_video_inst", OracleDbType.Int64);
                pId.Direction = ParameterDirection.Output;

                var pMsg = cmd.Parameters.Add("ov_mensaje", OracleDbType.Varchar2, 4000);
                pMsg.Direction = ParameterDirection.Output;

                await cmd.ExecuteNonQueryAsync(ct);
                await tx.CommitAsync(ct);

                result.Message = pMsg.Value?.ToString() ?? string.Empty;
                result.Success = result.Message.Contains("exitosa");
                if (result.Success && pId.Value is Oracle.ManagedDataAccess.Types.OracleDecimal od && !od.IsNull)
                    result.Id = od.ToInt64();
            }
            catch (OracleException ex)
            {
                try
                {
                    if (tx is not null)
                    {
                        await tx.RollbackAsync(ct);
                    }
                }
                catch { }
                result.Success = false;
                result.Message = $"Error de base de datos: {ex.Message}";
                _logger.LogError(ex, "Error Oracle en CreateAsync VideoInstitucional");
            }

            return result;
        }

        public async Task<DtoVideoInstitucionalResult> UpdateAsync(long id, DtoVideoInstitucionalRequest request, string usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        {
            var result = new DtoVideoInstitucionalResult();

            try
            {
                await using var conn = new OracleConnection(_cs);
                await conn.OpenAsync(ct);

                await using var cmd = conn.CreateCommand();
                cmd.CommandTimeout = 30;
                cmd.BindByName = true;
                cmd.CommandType = CommandType.StoredProcedure;
                cmd.CommandText = "PK_ADMINISTRACION.PR_ACTUALIZAR_VIDEO_INST";

                cmd.Parameters.Add("in_id_video_inst", OracleDbType.Int64).Value = id;
                cmd.Parameters.Add("iv_titulo", OracleDbType.Varchar2, 150).Value = request.Titulo;
                cmd.Parameters.Add("iv_descripcion", OracleDbType.Varchar2, 500).Value = (object?)request.Descripcion ?? DBNull.Value;
                cmd.Parameters.Add("iv_url_youtube", OracleDbType.Varchar2, 500).Value = request.UrlYoutube;
                cmd.Parameters.Add("iv_usuario_modifica", OracleDbType.Varchar2, 50).Value = usuarioAuditoria;
                cmd.Parameters.Add("iv_maquina_modifica", OracleDbType.Varchar2, 100).Value = maquinaAuditoria;
                cmd.Parameters.Add("in_vigente", OracleDbType.Int32).Value = 1;

                var pMsg = cmd.Parameters.Add("ov_mensaje", OracleDbType.Varchar2, 4000);
                pMsg.Direction = ParameterDirection.Output;

                await cmd.ExecuteNonQueryAsync(ct);

                result.Message = pMsg.Value?.ToString() ?? string.Empty;
                result.Success = result.Message.Contains("exitosa");
                result.Id = id;
            }
            catch (OracleException ex)
            {
                result.Success = false;
                result.Message = $"Error de base de datos: {ex.Message}";
                _logger.LogError(ex, "Error Oracle en UpdateAsync VideoInstitucional");
            }

            return result;
        }

        public async Task<DtoVideoInstitucionalResult> DeleteAsync(long id, string usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        {
            var result = new DtoVideoInstitucionalResult();

            try
            {
                await using var conn = new OracleConnection(_cs);
                await conn.OpenAsync(ct);

                await using var cmd = conn.CreateCommand();
                cmd.CommandTimeout = 30;
                cmd.BindByName = true;
                cmd.CommandType = CommandType.StoredProcedure;
                cmd.CommandText = "PK_ADMINISTRACION.PR_ELIMINAR_VIDEO_INST";

                cmd.Parameters.Add("in_id_video_inst", OracleDbType.Int64).Value = id;
                cmd.Parameters.Add("iv_usuario_modifica", OracleDbType.Varchar2, 50).Value = usuarioAuditoria;
                cmd.Parameters.Add("iv_maquina_modifica", OracleDbType.Varchar2, 100).Value = maquinaAuditoria;

                var pMsg = cmd.Parameters.Add("ov_mensaje", OracleDbType.Varchar2, 4000);
                pMsg.Direction = ParameterDirection.Output;

                await cmd.ExecuteNonQueryAsync(ct);

                result.Message = pMsg.Value?.ToString() ?? string.Empty;
                result.Success = result.Message.Contains("exitosa");
                result.Id = id;
            }
            catch (OracleException ex)
            {
                result.Success = false;
                result.Message = $"Error de base de datos: {ex.Message}";
                _logger.LogError(ex, "Error Oracle en DeleteAsync VideoInstitucional");
            }

            return result;
        }

        private static DtoVideoInstitucional MapVideoInstitucional(OracleDataReader reader)
        {
            var urlYoutube = reader.IsDBNull(reader.GetOrdinal("URL_YOUTUBE"))
                ? string.Empty
                : reader.GetString(reader.GetOrdinal("URL_YOUTUBE"));

            return new DtoVideoInstitucional
            {
                IdVideoInst     = reader.GetInt64(reader.GetOrdinal("ID_VIDEO_INST")),
                Titulo          = reader.GetString(reader.GetOrdinal("TITULO")),
                Descripcion     = reader.IsDBNull(reader.GetOrdinal("DESCRIPCION")) ? null : reader.GetString(reader.GetOrdinal("DESCRIPCION")),
                UrlYoutube      = urlYoutube,
                EmbedUrl        = BuildEmbedUrl(urlYoutube),
                Vigente         = Convert.ToInt32(reader.GetValue(reader.GetOrdinal("VIGENTE"))),
                UsuarioCreacion = reader.GetString(reader.GetOrdinal("USUARIO_CREACION")),
                FechaCreacion   = reader.GetDateTime(reader.GetOrdinal("FECHA_CREACION")),
                UsuarioModifica = reader.IsDBNull(reader.GetOrdinal("USUARIO_MODIFICA")) ? null : reader.GetString(reader.GetOrdinal("USUARIO_MODIFICA")),
                MaquinaModifica = reader.IsDBNull(reader.GetOrdinal("MAQUINA_MODIFICA")) ? null : reader.GetString(reader.GetOrdinal("MAQUINA_MODIFICA")),
                FechaModifica   = reader.IsDBNull(reader.GetOrdinal("FECHA_MODIFICA"))   ? null : reader.GetDateTime(reader.GetOrdinal("FECHA_MODIFICA"))
            };
        }

        // Extrae el ID de YouTube y construye la URL de embed
        // Soporta: watch?v=, youtu.be/, /shorts/, /embed/
        public static string BuildEmbedUrl(string url)
        {
            if (string.IsNullOrWhiteSpace(url)) return string.Empty;

            var match = Regex.Match(url,
                @"(?:youtube\.com/(?:watch\?v=|shorts/|embed/)|youtu\.be/)([A-Za-z0-9_\-]{11})",
                RegexOptions.IgnoreCase);

            return match.Success
                ? $"https://www.youtube.com/embed/{match.Groups[1].Value}"
                : string.Empty;
        }
    }
}

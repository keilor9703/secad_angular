using Comun.Dtos.Noticias;
using Datos.Interfaz;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Oracle.ManagedDataAccess.Client;
using System.Data;

namespace Datos.Gestion
{
    public class DbNoticiaRepository : IDbNoticiaRepository
    {
        private readonly string _cs;
        private readonly ILogger<DbNoticiaRepository> _logger;

        public DbNoticiaRepository(IConfiguration configuration, ILogger<DbNoticiaRepository> logger)
        {
            _cs = configuration.GetConnectionString("DbOracle")!;
            _logger = logger;
        }

        public async Task<List<DtoNoticia>> GetAllAsync(CancellationToken ct)
        {
            var noticias = new List<DtoNoticia>();

            try
            {
                await using var conn = new OracleConnection(_cs);
                await conn.OpenAsync(ct);

                const string sql = @"SELECT 
                    ID_NOTICIA, UNIDAD, TITULO, SECCION, CIUDAD,
                    IMAGEN_NOTICIA, SUBTITULO, CONTENIDO, VIGENTE,
                    FECHA_CREACION, USUARIO_CREACION, MAQUINA_CREACION,
                    FECHA_MODIFICA, USUARIO_MODIFICA, MAQUINA_MODIFICA, MEGUSTA
                    FROM CTR_NOTICIAS
                    ORDER BY FECHA_CREACION DESC";

                await using var cmd = new OracleCommand(sql, conn);
                cmd.CommandType = CommandType.Text;

                await using var reader = await cmd.ExecuteReaderAsync(ct);
                while (await reader.ReadAsync(ct))
                {
                    noticias.Add(MapNoticia(reader));
                }
                
                _logger.LogInformation("GetAllAsync devolvio {Count} noticias", noticias.Count);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error general en GetAllAsync Noticias");
            }

            return noticias;
        }

        public async Task<DtoNoticia?> GetByIdAsync(long id, CancellationToken ct)
        {
            try
            {
                await using var conn = new OracleConnection(_cs);
                await conn.OpenAsync(ct);

                const string sql = @"SELECT 
                    ID_NOTICIA, UNIDAD, TITULO, SECCION, CIUDAD,
                    IMAGEN_NOTICIA, SUBTITULO, CONTENIDO, VIGENTE,
                    FECHA_CREACION, USUARIO_CREACION, MAQUINA_CREACION,
                    FECHA_MODIFICA, USUARIO_MODIFICA, MAQUINA_MODIFICA, MEGUSTA
                    FROM CTR_NOTICIAS
                    WHERE ID_NOTICIA = :id";

                await using var cmd = new OracleCommand(sql, conn);
                cmd.CommandType = CommandType.Text;
                cmd.Parameters.Add(new OracleParameter("id", id));

                await using var reader = await cmd.ExecuteReaderAsync(ct);
                if (await reader.ReadAsync(ct))
                {
                    return MapNoticia(reader);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error en GetByIdAsync Noticia {Id}", id);
            }

            return null;
        }

        public async Task<List<DtoNoticia>> GetActivasAsync(CancellationToken ct)
        {
            var noticias = new List<DtoNoticia>();

            try
            {
                await using var conn = new OracleConnection(_cs);
                await conn.OpenAsync(ct);

                // Usar consulta directa para pruebas
                const string sql = @"SELECT 
                    ID_NOTICIA, UNIDAD, TITULO, SECCION, CIUDAD,
                    IMAGEN_NOTICIA, SUBTITULO, CONTENIDO, VIGENTE,
                    FECHA_CREACION, USUARIO_CREACION, MEGUSTA
                    FROM CTR_NOTICIAS
                    WHERE VIGENTE = 1
                    ORDER BY FECHA_CREACION DESC";

                await using var cmd = new OracleCommand(sql, conn);
                cmd.CommandType = CommandType.Text;

                await using var reader = await cmd.ExecuteReaderAsync(ct);
                while (await reader.ReadAsync(ct))
                {
                    noticias.Add(MapNoticiaActiva(reader));
                }
                
                _logger.LogInformation("Consulta directa devolvio {Count} noticias", noticias.Count);
            }
            catch (OracleException ex)
            {
                _logger.LogError(ex, "Error Oracle en GetActivasAsync Noticias");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error general en GetActivasAsync Noticias");
            }

            return noticias;
        }

        public async Task<DtoNoticiaResult> CreateAsync(DtoNoticiaRequest request, string usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        {
            var result = new DtoNoticiaResult();

            try
            {
                await using var conn = new OracleConnection(_cs);
                await conn.OpenAsync(ct);

                await using var cmd = conn.CreateCommand();
                cmd.CommandTimeout = 30;
                cmd.BindByName = true;
                cmd.CommandType = CommandType.StoredProcedure;
                cmd.CommandText = "PK_ADMINISTRACION.SP_CREAR_NOTICIA";

                cmd.Parameters.Add("P_UNIDAD", OracleDbType.Varchar2, 100).Value = request.Unidad;
                cmd.Parameters.Add("P_TITULO", OracleDbType.Varchar2, 300).Value = request.Titulo;
                cmd.Parameters.Add("P_SECCION", OracleDbType.Varchar2, 50).Value = request.Seccion;
                cmd.Parameters.Add("P_CIUDAD", OracleDbType.Varchar2, 100).Value = request.Ciudad;
                cmd.Parameters.Add("P_IMAGEN_NOTICIA", OracleDbType.Varchar2, 500).Value = (object?)request.ImagenNoticia ?? DBNull.Value;
                cmd.Parameters.Add("P_SUBTITULO", OracleDbType.Varchar2, 500).Value = (object?)request.Subtitulo ?? DBNull.Value;
                cmd.Parameters.Add("P_CONTENIDO", OracleDbType.Clob).Value = (object?)request.Contenido ?? DBNull.Value;
                cmd.Parameters.Add("P_USUARIO_CREACION", OracleDbType.Varchar2, 100).Value = usuarioAuditoria;
                cmd.Parameters.Add("P_MAQUINA_CREACION", OracleDbType.Varchar2, 100).Value = maquinaAuditoria;

                var pResultado = cmd.Parameters.Add("P_RESULTADO", OracleDbType.Int64);
                pResultado.Direction = ParameterDirection.Output;

                var pMensaje = cmd.Parameters.Add("P_MENSAJE", OracleDbType.Varchar2, 4000);
                pMensaje.Direction = ParameterDirection.Output;

                await cmd.ExecuteNonQueryAsync(ct);

                result.Message = pMensaje.Value?.ToString() ?? string.Empty;
                result.Success = pResultado.Value is Oracle.ManagedDataAccess.Types.OracleDecimal od && od.ToInt64() == 0;
            }
            catch (OracleException ex)
            {
                result.Success = false;
                result.Message = $"Error de base de datos: {ex.Message}";
                _logger.LogError(ex, "Error Oracle en CreateAsync Noticia");
            }

            return result;
        }

        public async Task<DtoNoticiaResult> UpdateAsync(long id, DtoNoticiaRequest request, string usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        {
            var result = new DtoNoticiaResult();

            try
            {
                await using var conn = new OracleConnection(_cs);
                await conn.OpenAsync(ct);

                await using var cmd = conn.CreateCommand();
                cmd.CommandTimeout = 30;
                cmd.BindByName = true;
                cmd.CommandType = CommandType.StoredProcedure;
                cmd.CommandText = "PK_ADMINISTRACION.SP_ACTUALIZAR_NOTICIA";

                cmd.Parameters.Add("P_ID_NOTICIA", OracleDbType.Int64).Value = id;
                cmd.Parameters.Add("P_UNIDAD", OracleDbType.Varchar2, 100).Value = request.Unidad;
                cmd.Parameters.Add("P_TITULO", OracleDbType.Varchar2, 300).Value = request.Titulo;
                cmd.Parameters.Add("P_SECCION", OracleDbType.Varchar2, 50).Value = request.Seccion;
                cmd.Parameters.Add("P_CIUDAD", OracleDbType.Varchar2, 100).Value = request.Ciudad;
                cmd.Parameters.Add("P_IMAGEN_NOTICIA", OracleDbType.Varchar2, 500).Value = (object?)request.ImagenNoticia ?? DBNull.Value;
                cmd.Parameters.Add("P_SUBTITULO", OracleDbType.Varchar2, 500).Value = (object?)request.Subtitulo ?? DBNull.Value;
                cmd.Parameters.Add("P_CONTENIDO", OracleDbType.Clob).Value = (object?)request.Contenido ?? DBNull.Value;
                cmd.Parameters.Add("P_USUARIO_MODIFICA", OracleDbType.Varchar2, 100).Value = usuarioAuditoria;
                cmd.Parameters.Add("P_MAQUINA_MODIFICA", OracleDbType.Varchar2, 100).Value = maquinaAuditoria;

                var pResultado = cmd.Parameters.Add("P_RESULTADO", OracleDbType.Int64);
                pResultado.Direction = ParameterDirection.Output;

                var pMensaje = cmd.Parameters.Add("P_MENSAJE", OracleDbType.Varchar2, 4000);
                pMensaje.Direction = ParameterDirection.Output;

                await cmd.ExecuteNonQueryAsync(ct);

                result.Message = pMensaje.Value?.ToString() ?? string.Empty;
                result.Success = pResultado.Value is Oracle.ManagedDataAccess.Types.OracleDecimal od2 && od2.ToInt64() == 0;
                result.Id = id;
            }
            catch (OracleException ex)
            {
                result.Success = false;
                result.Message = $"Error de base de datos: {ex.Message}";
                _logger.LogError(ex, "Error Oracle en UpdateAsync Noticia {Id}", id);
            }

            return result;
        }

        public async Task<DtoNoticiaResult> DeleteAsync(long id, string usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        {
            var result = new DtoNoticiaResult();

            try
            {
                await using var conn = new OracleConnection(_cs);
                await conn.OpenAsync(ct);

                await using var cmd = conn.CreateCommand();
                cmd.CommandTimeout = 30;
                cmd.BindByName = true;
                cmd.CommandType = CommandType.StoredProcedure;
                cmd.CommandText = "PK_ADMINISTRACION.SP_ELIMINAR_NOTICIA";

                cmd.Parameters.Add("P_ID_NOTICIA", OracleDbType.Int64).Value = id;
                cmd.Parameters.Add("P_USUARIO_MODIFICA", OracleDbType.Varchar2, 100).Value = usuarioAuditoria;
                cmd.Parameters.Add("P_MAQUINA_MODIFICA", OracleDbType.Varchar2, 100).Value = maquinaAuditoria;

                var pResultado = cmd.Parameters.Add("P_RESULTADO", OracleDbType.Int64);
                pResultado.Direction = ParameterDirection.Output;

                var pMensaje = cmd.Parameters.Add("P_MENSAJE", OracleDbType.Varchar2, 4000);
                pMensaje.Direction = ParameterDirection.Output;

                await cmd.ExecuteNonQueryAsync(ct);

                result.Message = pMensaje.Value?.ToString() ?? string.Empty;
                result.Success = pResultado.Value is Oracle.ManagedDataAccess.Types.OracleDecimal od3 && od3.ToInt64() == 0;
                result.Id = id;
            }
            catch (OracleException ex)
            {
                result.Success = false;
                result.Message = $"Error de base de datos: {ex.Message}";
                _logger.LogError(ex, "Error Oracle en DeleteAsync Noticia {Id}", id);
            }

            return result;
        }

        public async Task<DtoNoticiaResult> DarLikeAsync(long id, CancellationToken ct)
        {
            var result = new DtoNoticiaResult();

            try
            {
                await using var conn = new OracleConnection(_cs);
                await conn.OpenAsync(ct);

                await using var cmd = conn.CreateCommand();
                cmd.CommandTimeout = 30;
                cmd.BindByName = true;
                cmd.CommandType = CommandType.StoredProcedure;
                cmd.CommandText = "PK_ADMINISTRACION.SP_LIKE_NOTICIA";

                cmd.Parameters.Add("P_ID_NOTICIA", OracleDbType.Int64).Value = id;

                var pResultado = cmd.Parameters.Add("P_RESULTADO", OracleDbType.Int64);
                pResultado.Direction = ParameterDirection.Output;

                var pMensaje = cmd.Parameters.Add("P_MENSAJE", OracleDbType.Varchar2, 4000);
                pMensaje.Direction = ParameterDirection.Output;

                await cmd.ExecuteNonQueryAsync(ct);

                result.Message = pMensaje.Value?.ToString() ?? string.Empty;
                result.Success = pResultado.Value is Oracle.ManagedDataAccess.Types.OracleDecimal od && od.ToInt64() == 0;
                result.Id = id;
            }
            catch (OracleException ex)
            {
                result.Success = false;
                result.Message = $"Error de base de datos: {ex.Message}";
                _logger.LogError(ex, "Error Oracle en DarLikeAsync Noticia {Id}", id);
            }

            return result;
        }

        private static DtoNoticia MapNoticia(OracleDataReader reader)
        {
            return new DtoNoticia
            {
                IdNoticia       = reader.GetInt64(reader.GetOrdinal("ID_NOTICIA")),
                Unidad          = reader.GetString(reader.GetOrdinal("UNIDAD")),
                Titulo          = reader.GetString(reader.GetOrdinal("TITULO")),
                Seccion         = reader.GetString(reader.GetOrdinal("SECCION")),
                Ciudad          = reader.GetString(reader.GetOrdinal("CIUDAD")),
                ImagenNoticia   = reader.IsDBNull(reader.GetOrdinal("IMAGEN_NOTICIA")) ? null : reader.GetString(reader.GetOrdinal("IMAGEN_NOTICIA")),
                Subtitulo       = reader.IsDBNull(reader.GetOrdinal("SUBTITULO")) ? null : reader.GetString(reader.GetOrdinal("SUBTITULO")),
                Contenido       = reader.IsDBNull(reader.GetOrdinal("CONTENIDO")) ? null : reader.GetString(reader.GetOrdinal("CONTENIDO")),
                Vigente         = reader.GetInt32(reader.GetOrdinal("VIGENTE")),
                FechaCreacion   = reader.GetDateTime(reader.GetOrdinal("FECHA_CREACION")),
                UsuarioCreacion = reader.GetString(reader.GetOrdinal("USUARIO_CREACION")),
                MaquinaCreacion = reader.IsDBNull(reader.GetOrdinal("MAQUINA_CREACION")) ? null : reader.GetString(reader.GetOrdinal("MAQUINA_CREACION")),
                FechaModifica   = reader.IsDBNull(reader.GetOrdinal("FECHA_MODIFICA")) ? null : reader.GetDateTime(reader.GetOrdinal("FECHA_MODIFICA")),
                UsuarioModifica = reader.IsDBNull(reader.GetOrdinal("USUARIO_MODIFICA")) ? null : reader.GetString(reader.GetOrdinal("USUARIO_MODIFICA")),
                MaquinaModifica = reader.IsDBNull(reader.GetOrdinal("MAQUINA_MODIFICA")) ? null : reader.GetString(reader.GetOrdinal("MAQUINA_MODIFICA")),
                Megusta         = reader.IsDBNull(reader.GetOrdinal("MEGUSTA")) ? 0 : reader.GetInt64(reader.GetOrdinal("MEGUSTA"))
            };
        }

        private static DtoNoticia MapNoticiaActiva(OracleDataReader reader)
        {
            return new DtoNoticia
            {
                IdNoticia       = reader.GetInt64(reader.GetOrdinal("ID_NOTICIA")),
                Unidad          = reader.GetString(reader.GetOrdinal("UNIDAD")),
                Titulo          = reader.GetString(reader.GetOrdinal("TITULO")),
                Seccion         = reader.GetString(reader.GetOrdinal("SECCION")),
                Ciudad          = reader.GetString(reader.GetOrdinal("CIUDAD")),
                ImagenNoticia   = reader.IsDBNull(reader.GetOrdinal("IMAGEN_NOTICIA")) ? null : reader.GetString(reader.GetOrdinal("IMAGEN_NOTICIA")),
                Subtitulo       = reader.IsDBNull(reader.GetOrdinal("SUBTITULO")) ? null : reader.GetString(reader.GetOrdinal("SUBTITULO")),
                Contenido       = reader.IsDBNull(reader.GetOrdinal("CONTENIDO")) ? null : reader.GetString(reader.GetOrdinal("CONTENIDO")),
                Vigente         = reader.GetInt32(reader.GetOrdinal("VIGENTE")),
                FechaCreacion   = reader.GetDateTime(reader.GetOrdinal("FECHA_CREACION")),
                UsuarioCreacion = reader.GetString(reader.GetOrdinal("USUARIO_CREACION")),
                Megusta         = reader.IsDBNull(reader.GetOrdinal("MEGUSTA")) ? 0 : reader.GetInt64(reader.GetOrdinal("MEGUSTA"))
            };
        }
    }
}
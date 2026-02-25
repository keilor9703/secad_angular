using Comun.Dtos.Sliders;
using Datos.Interfaz;
using Microsoft.Extensions.Configuration;
using Oracle.ManagedDataAccess.Client;
using Oracle.ManagedDataAccess.Types;
using System.Data;
using System.Linq;

namespace Datos.Gestion
{
    public class DbSliders : IDbSliders
    {
        private readonly string _cs;

        public DbSliders(IConfiguration configuration)
        {
            _cs = configuration.GetConnectionString("DbOracle")!;
        }

        public async Task<List<DtoSliders>> GetPublicosAsync(CancellationToken ct)
        {
            var result = await GetByProcedureAsync("PK_ADMINISTRACION.P_GET_SLIDERS_PUBLICOS", includeAdminColumns: false, ct);
            if (result.Count > 0)
            {
                // Si el SP público no trae URL_IMAGEN/URL_DESTINO, completamos desde admin por id.
                if (result.Any(x => string.IsNullOrWhiteSpace(x.urlImagen) || string.IsNullOrWhiteSpace(x.urlDestino)))
                {
                    var adminData = await GetByProcedureAsync("PK_ADMINISTRACION.P_GET_SLIDERS_ADMIN", includeAdminColumns: true, ct);
                    var byId = adminData
                        .Where(x => x.idSlider > 0)
                        .GroupBy(x => x.idSlider)
                        .ToDictionary(g => g.Key, g => g.First());

                    foreach (var item in result)
                    {
                        if (item.idSlider > 0 && byId.TryGetValue(item.idSlider, out var source))
                        {
                            if (string.IsNullOrWhiteSpace(item.urlImagen))
                            {
                                item.urlImagen = source.urlImagen;
                            }
                            if (string.IsNullOrWhiteSpace(item.urlDestino))
                            {
                                item.urlDestino = source.urlDestino;
                            }
                            if (string.IsNullOrWhiteSpace(item.titulo))
                            {
                                item.titulo = source.titulo;
                            }
                            if (string.IsNullOrWhiteSpace(item.subtitulo))
                            {
                                item.subtitulo = source.subtitulo;
                            }
                        }
                    }
                }

                return result.OrderBy(x => x.orden).ToList();
            }

            // Fallback: si el SP de públicos no devuelve filas, usamos admin y filtramos en backend.
            var admin = await GetByProcedureAsync("PK_ADMINISTRACION.P_GET_SLIDERS_ADMIN", includeAdminColumns: true, ct);
            var today = DateTime.Today;

            return admin
                .Where(x =>
                    x.vigente == 1 &&
                    (!x.fechaInicio.HasValue || x.fechaInicio.Value.Date <= today) &&
                    (!x.fechaFin.HasValue || x.fechaFin.Value.Date >= today))
                .OrderBy(x => x.orden)
                .ToList();
        }

        public async Task<List<DtoSliders>> GetAdminAsync(CancellationToken ct)
        {
            var result = new List<DtoSliders>();

            await using var conn = new OracleConnection(_cs);
            await conn.OpenAsync(ct);

            await using var cmd = conn.CreateCommand();
            cmd.CommandType = CommandType.StoredProcedure;
            cmd.CommandText = "PK_ADMINISTRACION.P_GET_SLIDERS_ADMIN";
            cmd.Parameters.Add("P_CURSOR", OracleDbType.RefCursor).Direction = ParameterDirection.Output;

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                result.Add(new DtoSliders
                {
                    idSlider = reader.GetInt64(0),
                    titulo = reader.IsDBNull(1) ? null : reader.GetString(1),
                    subtitulo = reader.IsDBNull(2) ? null : reader.GetString(2),
                    urlImagen = reader.IsDBNull(3) ? null : reader.GetString(3),
                    urlDestino = reader.IsDBNull(4) ? null : reader.GetString(4),
                    orden = reader.IsDBNull(5) ? 0 : reader.GetInt32(5),
                    vigente = reader.IsDBNull(6) ? 0 : reader.GetInt32(6),
                    fechaInicio = reader.IsDBNull(7) ? null : reader.GetDateTime(7),
                    fechaFin = reader.IsDBNull(8) ? null : reader.GetDateTime(8)
                });
            }

            return result;
        }

        public async Task<DtoSliderResult> SaveAsync(
            DtoSaveSliderRequest request,
            long usuarioAuditoria,
            string maquinaAuditoria,
            CancellationToken ct)
        {
            await using var conn = new OracleConnection(_cs);
            await conn.OpenAsync(ct);

            await using var cmd = conn.CreateCommand();
            cmd.BindByName = true;
            cmd.CommandType = CommandType.StoredProcedure;
            cmd.CommandText = "PK_ADMINISTRACION.P_INS_UPD_SLIDER";

            cmd.Parameters.Add("P_IdSlider", OracleDbType.Int64).Value = request.idSlider.HasValue
                ? request.idSlider.Value
                : DBNull.Value;
            cmd.Parameters.Add("P_Titulo", OracleDbType.Varchar2).Value = AsDbValue(request.titulo);
            cmd.Parameters.Add("P_Subtitulo", OracleDbType.Varchar2).Value = AsDbValue(request.subtitulo);
            cmd.Parameters.Add("P_UrlImagen", OracleDbType.Varchar2).Value = AsDbValue(request.urlImagen);
            cmd.Parameters.Add("P_UrlDestino", OracleDbType.Varchar2).Value = AsDbValue(request.urlDestino);
            cmd.Parameters.Add("P_Orden", OracleDbType.Int32).Value = request.orden;
            cmd.Parameters.Add("P_Vigente", OracleDbType.Int32).Value = request.vigente is 0 ? 0 : 1;
            cmd.Parameters.Add("P_FechaInicio", OracleDbType.Date).Value = request.fechaInicio.HasValue
                ? request.fechaInicio.Value
                : DBNull.Value;
            cmd.Parameters.Add("P_FechaFin", OracleDbType.Date).Value = request.fechaFin.HasValue
                ? request.fechaFin.Value
                : DBNull.Value;
            cmd.Parameters.Add("P_Usuario", OracleDbType.Int64).Value = usuarioAuditoria;
            cmd.Parameters.Add("P_Maquina", OracleDbType.Varchar2).Value = AsDbValue(maquinaAuditoria);

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

            return new DtoSliderResult
            {
                id = pResultado.Value == DBNull.Value ? 0 : ToInt64Safe(pResultado.Value),
                message = (pMessage.Value?.ToString() ?? string.Empty).Trim()
            };
        }

        public async Task<DtoSliderResult> SetEstadoAsync(
            long idSlider,
            int vigente,
            long usuarioAuditoria,
            string maquinaAuditoria,
            CancellationToken ct)
        {
            await using var conn = new OracleConnection(_cs);
            await conn.OpenAsync(ct);

            await using var cmd = conn.CreateCommand();
            cmd.BindByName = true;
            cmd.CommandType = CommandType.StoredProcedure;
            cmd.CommandText = "PK_ADMINISTRACION.P_SET_ESTADO_SLIDER";

            cmd.Parameters.Add("P_IdSlider", OracleDbType.Int64).Value = idSlider;
            cmd.Parameters.Add("P_Vigente", OracleDbType.Int32).Value = vigente is 0 ? 0 : 1;
            cmd.Parameters.Add("P_Usuario", OracleDbType.Int64).Value = usuarioAuditoria;
            cmd.Parameters.Add("P_Maquina", OracleDbType.Varchar2).Value = AsDbValue(maquinaAuditoria);

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

            return new DtoSliderResult
            {
                id = pResultado.Value == DBNull.Value ? 0 : ToInt64Safe(pResultado.Value),
                message = (pMessage.Value?.ToString() ?? string.Empty).Trim()
            };
        }

        private static object AsDbValue(string? value)
        {
            var normalized = (value ?? string.Empty).Trim();
            return string.IsNullOrWhiteSpace(normalized) ? DBNull.Value : normalized;
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

        private async Task<List<DtoSliders>> GetByProcedureAsync(string procedureName, bool includeAdminColumns, CancellationToken ct)
        {
            var result = new List<DtoSliders>();

            await using var conn = new OracleConnection(_cs);
            await conn.OpenAsync(ct);

            await using var cmd = conn.CreateCommand();
            cmd.CommandType = CommandType.StoredProcedure;
            cmd.CommandText = procedureName;
            cmd.Parameters.Add("P_CURSOR", OracleDbType.RefCursor).Direction = ParameterDirection.Output;

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                var fieldCount = reader.FieldCount;
                var idxIdSlider = GetOrdinal(reader, fieldCount, 0, "id_slider", "idslider", "id");
                var idxTitulo = GetOrdinal(reader, fieldCount, 1, "titulo", "descripcion");
                var idxSubtitulo = GetOrdinal(reader, fieldCount, 2, "subtitulo", "sub_titulo");
                var idxUrlImagen = GetOrdinal(reader, fieldCount, -1, "url_imagen", "urlimagen", "imagen", "ruta_imagen", "archivo");
                var idxUrlDestino = GetOrdinal(reader, fieldCount, -1, "url_destino", "urldestino", "detalle", "link", "enlace");
                var idxOrden = GetOrdinal(reader, fieldCount, 5, "orden", "posicion");
                var idxVigente = GetOrdinal(reader, fieldCount, 6, "vigente", "estado");
                var idxFechaInicio = GetOrdinal(reader, fieldCount, 7, "fecha_inicio", "fechainicio", "inicio");
                var idxFechaFin = GetOrdinal(reader, fieldCount, 8, "fecha_fin", "fechafin", "fin");

                result.Add(new DtoSliders
                {
                    idSlider = GetInt64OrDefault(reader, fieldCount, idxIdSlider, 0),
                    titulo = GetStringOrNull(reader, fieldCount, idxTitulo),
                    subtitulo = GetStringOrNull(reader, fieldCount, idxSubtitulo),
                    urlImagen = GetStringOrNull(reader, fieldCount, idxUrlImagen),
                    urlDestino = GetStringOrNull(reader, fieldCount, idxUrlDestino),
                    orden = GetInt32OrDefault(reader, fieldCount, idxOrden, 0),
                    vigente = includeAdminColumns
                        ? GetInt32OrDefault(reader, fieldCount, idxVigente, 0)
                        : 1,
                    fechaInicio = includeAdminColumns
                        ? GetDateOrNull(reader, fieldCount, idxFechaInicio)
                        : null,
                    fechaFin = includeAdminColumns
                        ? GetDateOrNull(reader, fieldCount, idxFechaFin)
                        : null
                });
            }

            return result;
        }

        private static int GetOrdinal(OracleDataReader reader, int fieldCount, int fallback, params string[] candidates)
        {
            var normalizedNames = new string[fieldCount];
            for (var i = 0; i < fieldCount; i++)
            {
                normalizedNames[i] = NormalizeColumnName(reader.GetName(i));
            }

            foreach (var c in candidates)
            {
                var candidate = NormalizeColumnName(c);
                for (var i = 0; i < fieldCount; i++)
                {
                    if (normalizedNames[i] == candidate || normalizedNames[i].Contains(candidate, StringComparison.Ordinal))
                    {
                        return i;
                    }
                }
            }
            return fallback < fieldCount ? fallback : -1;
        }

        private static string NormalizeColumnName(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return string.Empty;
            }

            return value
                .Trim()
                .Replace("_", string.Empty)
                .Replace(" ", string.Empty)
                .ToLowerInvariant();
        }

        private static string? GetStringOrNull(OracleDataReader reader, int fieldCount, int index)
        {
            if (index < 0 || index >= fieldCount || reader.IsDBNull(index))
            {
                return null;
            }
            return reader.GetValue(index)?.ToString();
        }

        private static int GetInt32OrDefault(OracleDataReader reader, int fieldCount, int index, int @default)
        {
            if (index < 0 || index >= fieldCount || reader.IsDBNull(index))
            {
                return @default;
            }

            var value = reader.GetValue(index);
            if (value is OracleDecimal od)
            {
                return od.IsNull ? @default : od.ToInt32();
            }
            if (value is int i)
            {
                return i;
            }
            if (value is long l)
            {
                return (int)l;
            }
            return int.TryParse(value?.ToString(), out var parsed) ? parsed : @default;
        }

        private static long GetInt64OrDefault(OracleDataReader reader, int fieldCount, int index, long @default)
        {
            if (index < 0 || index >= fieldCount || reader.IsDBNull(index))
            {
                return @default;
            }

            var value = reader.GetValue(index);
            if (value is OracleDecimal od)
            {
                return od.IsNull ? @default : od.ToInt64();
            }
            if (value is long l)
            {
                return l;
            }
            if (value is int i)
            {
                return i;
            }
            return long.TryParse(value?.ToString(), out var parsed) ? parsed : @default;
        }

        private static DateTime? GetDateOrNull(OracleDataReader reader, int fieldCount, int index)
        {
            if (index < 0 || index >= fieldCount || reader.IsDBNull(index))
            {
                return null;
            }

            var value = reader.GetValue(index);
            if (value is DateTime dt)
            {
                return dt;
            }
            return DateTime.TryParse(value?.ToString(), out var parsed) ? parsed : null;
        }
    }
}

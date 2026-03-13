using Comun.Dtos.Radio;
using Datos.Interfaz;
using Microsoft.Extensions.Configuration;
using Oracle.ManagedDataAccess.Client;
using Oracle.ManagedDataAccess.Types;
using System.Data;

namespace Datos.Gestion
{
    public class DbRadioRepository : IDbRadioRepository
    {
        private readonly string _cs;

        public DbRadioRepository(IConfiguration configuration)
        {
            _cs = configuration.GetConnectionString("DbOracle")!;
        }

        public async Task<List<DtoRadioEmisora>> GetAllAsync(int? soloActivos, CancellationToken ct)
        {
            var result = new List<DtoRadioEmisora>();

            await using var conn = new OracleConnection(_cs);
            await conn.OpenAsync(ct);

            await using var cmd = conn.CreateCommand();
            cmd.BindByName = true;
            cmd.CommandType = CommandType.StoredProcedure;
            cmd.CommandText = "PKG_RADIO_EMISORAS.P_GET_ALL";
            cmd.Parameters.Add("p_solo_activos", OracleDbType.Int32).Value = soloActivos.HasValue ? soloActivos.Value : DBNull.Value;
            cmd.Parameters.Add("p_cursor", OracleDbType.RefCursor).Direction = ParameterDirection.Output;

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                result.Add(new DtoRadioEmisora
                {
                    idEmisora = GetInt64(reader, "ID_EMISORA"),
                    nombre = GetString(reader, "NOMBRE"),
                    streamUrl = GetString(reader, "STREAM_URL"),
                    logoUrl = reader.IsDBNull(reader.GetOrdinal("LOGO_URL")) ? null : reader.GetString(reader.GetOrdinal("LOGO_URL")),
                    orden = GetInt32(reader, "ORDEN"),
                    activo = GetInt32(reader, "ACTIVO")
                });
            }

            return result;
        }

        public async Task<DtoRadioEmisora?> GetByIdAsync(long idEmisora, CancellationToken ct)
        {
            await using var conn = new OracleConnection(_cs);
            await conn.OpenAsync(ct);

            await using var cmd = conn.CreateCommand();
            cmd.BindByName = true;
            cmd.CommandType = CommandType.StoredProcedure;
            cmd.CommandText = "PKG_RADIO_EMISORAS.P_GET_BY_ID";
            cmd.Parameters.Add("p_id_emisora", OracleDbType.Int64).Value = idEmisora;
            cmd.Parameters.Add("p_cursor", OracleDbType.RefCursor).Direction = ParameterDirection.Output;

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (!await reader.ReadAsync(ct))
            {
                return null;
            }

            return new DtoRadioEmisora
            {
                idEmisora = GetInt64(reader, "ID_EMISORA"),
                nombre = GetString(reader, "NOMBRE"),
                streamUrl = GetString(reader, "STREAM_URL"),
                logoUrl = reader.IsDBNull(reader.GetOrdinal("LOGO_URL")) ? null : reader.GetString(reader.GetOrdinal("LOGO_URL")),
                orden = GetInt32(reader, "ORDEN"),
                activo = GetInt32(reader, "ACTIVO")
            };
        }

        public async Task<DtoRadioResult> CreateAsync(DtoRadioEmisoraRequest request, string usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        {
            try
            {
                await using var conn = new OracleConnection(_cs);
                await conn.OpenAsync(ct);

                await using var cmd = conn.CreateCommand();
                cmd.BindByName = true;
                cmd.CommandType = CommandType.StoredProcedure;
                cmd.CommandText = "PKG_RADIO_EMISORAS.P_CREATE";

                cmd.Parameters.Add("p_nombre", OracleDbType.Varchar2).Value = ToDbValue(request.nombre);
                cmd.Parameters.Add("p_stream_url", OracleDbType.Varchar2).Value = ToDbValue(request.streamUrl);
                cmd.Parameters.Add("p_logo_url", OracleDbType.Varchar2).Value = ToDbValue(request.logoUrl);
                cmd.Parameters.Add("p_orden", OracleDbType.Int32).Value = request.orden;
                cmd.Parameters.Add("p_usuario_creacion", OracleDbType.Varchar2).Value = ToDbValue(usuarioAuditoria);
                cmd.Parameters.Add("p_maquina_creacion", OracleDbType.Varchar2).Value = ToDbValue(maquinaAuditoria);

                var pId = new OracleParameter("p_id", OracleDbType.Int64) { Direction = ParameterDirection.Output };
                var pSuccess = new OracleParameter("p_success", OracleDbType.Int32) { Direction = ParameterDirection.Output };
                var pMessage = new OracleParameter("p_message", OracleDbType.Varchar2, 4000) { Direction = ParameterDirection.Output };
                cmd.Parameters.Add(pId);
                cmd.Parameters.Add(pSuccess);
                cmd.Parameters.Add(pMessage);

                await cmd.ExecuteNonQueryAsync(ct);

                return new DtoRadioResult
                {
                    id = ToLong(pId.Value),
                    success = ToInt(pSuccess.Value) == 1,
                    message = (pMessage.Value?.ToString() ?? string.Empty).Trim()
                };
            }
            catch (OracleException ex)
            {
                return new DtoRadioResult
                {
                    id = 0,
                    success = false,
                    message = $"Oracle: {ex.Message}"
                };
            }
        }

        public async Task<DtoRadioResult> UpdateAsync(long idEmisora, DtoRadioEmisoraRequest request, string usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        {
            try
            {
                await using var conn = new OracleConnection(_cs);
                await conn.OpenAsync(ct);

                await using var cmd = conn.CreateCommand();
                cmd.BindByName = true;
                cmd.CommandType = CommandType.StoredProcedure;
                cmd.CommandText = "PKG_RADIO_EMISORAS.P_UPDATE";

                cmd.Parameters.Add("p_id_emisora", OracleDbType.Int64).Value = idEmisora;
                cmd.Parameters.Add("p_nombre", OracleDbType.Varchar2).Value = ToDbValue(request.nombre);
                cmd.Parameters.Add("p_stream_url", OracleDbType.Varchar2).Value = ToDbValue(request.streamUrl);
                cmd.Parameters.Add("p_logo_url", OracleDbType.Varchar2).Value = ToDbValue(request.logoUrl);
                cmd.Parameters.Add("p_orden", OracleDbType.Int32).Value = request.orden;
                cmd.Parameters.Add("p_activo", OracleDbType.Int32).Value = request.activo.HasValue ? request.activo.Value : 1;
                cmd.Parameters.Add("p_usuario_modificacion", OracleDbType.Varchar2).Value = ToDbValue(usuarioAuditoria);
                cmd.Parameters.Add("p_maquina_modificacion", OracleDbType.Varchar2).Value = ToDbValue(maquinaAuditoria);

                var pSuccess = new OracleParameter("p_success", OracleDbType.Int32) { Direction = ParameterDirection.Output };
                var pMessage = new OracleParameter("p_message", OracleDbType.Varchar2, 4000) { Direction = ParameterDirection.Output };
                cmd.Parameters.Add(pSuccess);
                cmd.Parameters.Add(pMessage);

                await cmd.ExecuteNonQueryAsync(ct);

                return new DtoRadioResult
                {
                    id = idEmisora,
                    success = ToInt(pSuccess.Value) == 1,
                    message = (pMessage.Value?.ToString() ?? string.Empty).Trim()
                };
            }
            catch (OracleException ex)
            {
                return new DtoRadioResult
                {
                    id = idEmisora,
                    success = false,
                    message = $"Oracle: {ex.Message}"
                };
            }
        }

        public async Task<DtoRadioResult> DeleteAsync(long idEmisora, string usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        {
            try
            {
                await using var conn = new OracleConnection(_cs);
                await conn.OpenAsync(ct);

                await using var cmd = conn.CreateCommand();
                cmd.BindByName = true;
                cmd.CommandType = CommandType.StoredProcedure;
                cmd.CommandText = "PKG_RADIO_EMISORAS.P_DELETE";

                cmd.Parameters.Add("p_id_emisora", OracleDbType.Int64).Value = idEmisora;
                cmd.Parameters.Add("p_usuario_modificacion", OracleDbType.Varchar2).Value = ToDbValue(usuarioAuditoria);
                cmd.Parameters.Add("p_maquina_modificacion", OracleDbType.Varchar2).Value = ToDbValue(maquinaAuditoria);

                var pSuccess = new OracleParameter("p_success", OracleDbType.Int32) { Direction = ParameterDirection.Output };
                var pMessage = new OracleParameter("p_message", OracleDbType.Varchar2, 4000) { Direction = ParameterDirection.Output };
                cmd.Parameters.Add(pSuccess);
                cmd.Parameters.Add(pMessage);

                await cmd.ExecuteNonQueryAsync(ct);

                return new DtoRadioResult
                {
                    id = idEmisora,
                    success = ToInt(pSuccess.Value) == 1,
                    message = (pMessage.Value?.ToString() ?? string.Empty).Trim()
                };
            }
            catch (OracleException ex)
            {
                return new DtoRadioResult
                {
                    id = idEmisora,
                    success = false,
                    message = $"Oracle: {ex.Message}"
                };
            }
        }

        public async Task<DtoRadioResult> SetActivoAsync(long idEmisora, int activo, string usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        {
            try
            {
                await using var conn = new OracleConnection(_cs);
                await conn.OpenAsync(ct);

                await using var cmd = conn.CreateCommand();
                cmd.BindByName = true;
                cmd.CommandType = CommandType.StoredProcedure;
                cmd.CommandText = "PKG_RADIO_EMISORAS.P_SET_ACTIVO";

                cmd.Parameters.Add("p_id_emisora", OracleDbType.Int64).Value = idEmisora;
                cmd.Parameters.Add("p_activo", OracleDbType.Int32).Value = activo;
                cmd.Parameters.Add("p_usuario_modificacion", OracleDbType.Varchar2).Value = ToDbValue(usuarioAuditoria);
                cmd.Parameters.Add("p_maquina_modificacion", OracleDbType.Varchar2).Value = ToDbValue(maquinaAuditoria);

                var pSuccess = new OracleParameter("p_success", OracleDbType.Int32) { Direction = ParameterDirection.Output };
                var pMessage = new OracleParameter("p_message", OracleDbType.Varchar2, 4000) { Direction = ParameterDirection.Output };
                cmd.Parameters.Add(pSuccess);
                cmd.Parameters.Add(pMessage);

                await cmd.ExecuteNonQueryAsync(ct);

                return new DtoRadioResult
                {
                    id = idEmisora,
                    success = ToInt(pSuccess.Value) == 1,
                    message = (pMessage.Value?.ToString() ?? string.Empty).Trim()
                };
            }
            catch (OracleException ex)
            {
                return new DtoRadioResult
                {
                    id = idEmisora,
                    success = false,
                    message = $"Oracle: {ex.Message}"
                };
            }
        }

        private static object ToDbValue(string? value)
        {
            var normalized = (value ?? string.Empty).Trim();
            return string.IsNullOrWhiteSpace(normalized) ? DBNull.Value : normalized;
        }

        private static string GetString(OracleDataReader reader, string column)
        {
            var idx = reader.GetOrdinal(column);
            return reader.IsDBNull(idx) ? string.Empty : reader.GetString(idx);
        }

        private static int GetInt32(OracleDataReader reader, string column)
        {
            var idx = reader.GetOrdinal(column);
            if (reader.IsDBNull(idx))
            {
                return 0;
            }

            var value = reader.GetValue(idx);
            if (value is OracleDecimal od)
            {
                return od.IsNull ? 0 : od.ToInt32();
            }

            return Convert.ToInt32(value);
        }

        private static long GetInt64(OracleDataReader reader, string column)
        {
            var idx = reader.GetOrdinal(column);
            if (reader.IsDBNull(idx))
            {
                return 0;
            }

            var value = reader.GetValue(idx);
            if (value is OracleDecimal od)
            {
                return od.IsNull ? 0 : od.ToInt64();
            }

            return Convert.ToInt64(value);
        }

        private static int ToInt(object? value)
        {
            if (value == null || value == DBNull.Value)
            {
                return 0;
            }

            if (value is OracleDecimal od)
            {
                return od.IsNull ? 0 : od.ToInt32();
            }

            return int.TryParse(value.ToString(), out var parsed) ? parsed : 0;
        }

        private static long ToLong(object? value)
        {
            if (value == null || value == DBNull.Value)
            {
                return 0;
            }

            if (value is OracleDecimal od)
            {
                return od.IsNull ? 0 : od.ToInt64();
            }

            return long.TryParse(value.ToString(), out var parsed) ? parsed : 0;
        }
    }
}

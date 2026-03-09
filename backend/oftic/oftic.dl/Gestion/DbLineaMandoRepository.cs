using Comun.Dtos.LineasMando;
using Datos.Interfaz;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Oracle.ManagedDataAccess.Client;
using System;
using System.Collections.Generic;
using System.Data;
using System.Threading;
using System.Threading.Tasks;

namespace Datos.Gestion
{
    public class DbLineaMandoRepository : IDbLineaMandoRepository
    {
        private readonly string _cs;
        private readonly ILogger<DbLineaMandoRepository> _logger;

        public DbLineaMandoRepository(IConfiguration configuration, ILogger<DbLineaMandoRepository> logger)
        {
            _cs = configuration.GetConnectionString("DbOracle")!;
            _logger = logger;
        }

        public async Task<List<DtoLineaMando>> GetAllAsync(CancellationToken ct)
        {
            var result = new List<DtoLineaMando>();

            await using var conn = new OracleConnection(_cs);
            await conn.OpenAsync(ct);

            await using var cmd = conn.CreateCommand();
            cmd.BindByName = true;
            cmd.CommandType = CommandType.StoredProcedure;
            cmd.CommandText = "PKG_LINEA_MANDO.P_GET_ALL";
            cmd.Parameters.Add("p_cursor", OracleDbType.RefCursor).Direction = ParameterDirection.Output;

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                result.Add(MapLineaMando(reader));
            }

            return result;
        }

        public async Task<DtoLineaMando?> GetByIdAsync(long id, CancellationToken ct)
        {
            await using var conn = new OracleConnection(_cs);
            await conn.OpenAsync(ct);

            await using var cmd = conn.CreateCommand();
            cmd.BindByName = true;
            cmd.CommandType = CommandType.StoredProcedure;
            cmd.CommandText = "PKG_LINEA_MANDO.P_GET_BY_ID";
            cmd.Parameters.Add("p_id_linea_mando", OracleDbType.Int64).Value = id;
            cmd.Parameters.Add("p_cursor", OracleDbType.RefCursor).Direction = ParameterDirection.Output;

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (await reader.ReadAsync(ct))
            {
                return MapLineaMando(reader);
            }

            return null;
        }

        public async Task<DtoLineaMando?> GetByIdentificacionAsync(string identificacion, CancellationToken ct)
        {
            await using var conn = new OracleConnection(_cs);
            await conn.OpenAsync(ct);

            await using var cmd = conn.CreateCommand();
            cmd.BindByName = true;
            cmd.CommandType = CommandType.StoredProcedure;
            cmd.CommandText = "PKG_LINEA_MANDO.P_GET_BY_IDENTIFICACION";
            cmd.Parameters.Add("p_identificacion", OracleDbType.Varchar2).Value = identificacion;
            cmd.Parameters.Add("p_cursor", OracleDbType.RefCursor).Direction = ParameterDirection.Output;

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (await reader.ReadAsync(ct))
            {
                return MapLineaMando(reader);
            }

            return null;
        }

        public async Task<DtoLineaMandoResult> CreateAsync(DtoLineaMandoRequest request, long usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        {
            var result = new DtoLineaMandoResult();

            await using var conn = new OracleConnection(_cs);
            await conn.OpenAsync(ct);

            await using var transaction = await conn.BeginTransactionAsync(ct);
            try
            {
                _logger.LogInformation("Ejecutando PKG_LINEA_MANDO.P_CREATE con datos: Identificacion={Ident}, Nombre={Nombre}, Cargo={Cargo}", 
                    request.Identificacion, request.Nombre, request.Cargo);
                
                await using var cmd = conn.CreateCommand();
                cmd.Transaction = (OracleTransaction)transaction;
                cmd.BindByName = true;
                cmd.CommandType = CommandType.StoredProcedure;
                cmd.CommandText = "PKG_LINEA_MANDO.P_CREATE";

                cmd.Parameters.Add("p_identificacion", OracleDbType.Varchar2, 20).Value = (request.Identificacion ?? string.Empty).Length > 20 ? (request.Identificacion ?? string.Empty).Substring(0, 20) : (request.Identificacion ?? string.Empty);
                cmd.Parameters.Add("p_nombre", OracleDbType.Varchar2, 100).Value = (request.Nombre ?? string.Empty).Length > 100 ? (request.Nombre ?? string.Empty).Substring(0, 100) : (request.Nombre ?? string.Empty);
                cmd.Parameters.Add("p_apellidos", OracleDbType.Varchar2, 100).Value = (request.Apellidos ?? string.Empty).Length > 100 ? (request.Apellidos ?? string.Empty).Substring(0, 100) : (request.Apellidos ?? string.Empty);
                cmd.Parameters.Add("p_grado", OracleDbType.Varchar2, 50).Value = (request.Grado ?? string.Empty).Length > 50 ? (request.Grado ?? string.Empty).Substring(0, 50) : (request.Grado ?? string.Empty);
                cmd.Parameters.Add("p_cargo", OracleDbType.Varchar2, 100).Value = (request.Cargo ?? string.Empty).Length > 100 ? (request.Cargo ?? string.Empty).Substring(0, 100) : (request.Cargo ?? string.Empty);
                cmd.Parameters.Add("p_peso", OracleDbType.Varchar2, 10).Value = (request.Peso ?? string.Empty).Length > 10 ? (request.Peso ?? string.Empty).Substring(0, 10) : (request.Peso ?? string.Empty);
                cmd.Parameters.Add("p_unidad", OracleDbType.Varchar2, 200).Value = (request.Unidad ?? string.Empty).Length > 200 ? (request.Unidad ?? string.Empty).Substring(0, 200) : (request.Unidad ?? string.Empty);

                var fotoNormalizada = NormalizeBase64(request.FotoBase64);
                if (!string.IsNullOrEmpty(fotoNormalizada))
                {
                    var clobParam = new OracleParameter("p_foto_base64", OracleDbType.Clob);
                    clobParam.Value = fotoNormalizada;
                    cmd.Parameters.Add(clobParam);
                }
                else
                {
                    var clobParam = new OracleParameter("p_foto_base64", OracleDbType.Clob);
                    clobParam.Value = DBNull.Value;
                    cmd.Parameters.Add(clobParam);
                }

                cmd.Parameters.Add("p_orden", OracleDbType.Int32).Value = request.Orden;
                
                var usuarioStr = usuarioAuditoria.ToString();
                var maquinaStr = maquinaAuditoria ?? "N/A";
                
                cmd.Parameters.Add("p_usuario_auditoria", OracleDbType.Varchar2, 50).Value = usuarioStr.Length > 50 ? usuarioStr.Substring(0, 50) : usuarioStr;
                cmd.Parameters.Add("p_maquina_auditoria", OracleDbType.Varchar2, 100).Value = maquinaStr.Length > 100 ? maquinaStr.Substring(0, 100) : maquinaStr;

                //cmd.Parameters.Add("p_id", OracleDbType.Int64, ParameterDirection.Output);
                //cmd.Parameters.Add("p_success", OracleDbType.Int32, ParameterDirection.Output);
                //cmd.Parameters.Add("p_message", OracleDbType.Varchar2, 4000, ParameterDirection.Output);
                // Parámetros OUTPUT en el mismo orden que el stored procedure
                OracleParameter pId = new OracleParameter("p_id", OracleDbType.Int64);
                pId.Direction = ParameterDirection.Output;
                cmd.Parameters.Add(pId);

                OracleParameter pSuccess = new OracleParameter("p_success", OracleDbType.Int32);
                pSuccess.Direction = ParameterDirection.Output;
                cmd.Parameters.Add(pSuccess);

                OracleParameter pMessage = new OracleParameter("p_message", OracleDbType.Varchar2);
                pMessage.Direction = ParameterDirection.Output;
                pMessage.Size = 4000;
                cmd.Parameters.Add(pMessage);

                await cmd.ExecuteNonQueryAsync(ct);

                //result.Id = cmd.Parameters["p_id"].Value != null ? Convert.ToInt64(cmd.Parameters["p_id"].Value) : 0;
                //result.Success = cmd.Parameters["p_success"].Value != null && Convert.ToInt32(cmd.Parameters["p_success"].Value) == 1;
                //result.Message = cmd.Parameters["p_message"].Value?.ToString() ?? string.Empty;
                // DESPUÉS - cast correcto para OracleDecimal
                var pIdVal = (Oracle.ManagedDataAccess.Types.OracleDecimal)cmd.Parameters["p_id"].Value;
                result.Id = pIdVal.IsNull ? 0 : (long)pIdVal;

                var pSuccessVal = (Oracle.ManagedDataAccess.Types.OracleDecimal)cmd.Parameters["p_success"].Value;
                result.Success = !pSuccessVal.IsNull && (int)pSuccessVal == 1;

                result.Message = cmd.Parameters["p_message"].Value?.ToString() ?? string.Empty;

                if (result.Success)
                {
                    await transaction.CommitAsync(ct);
                    _logger.LogInformation("Línea de mando creada exitosamente");
                }
                else
                {
                    await transaction.RollbackAsync(ct);
                    _logger.LogWarning("Error al crear línea de mando: {Message}", result.Message);
                }
            }
            catch (OracleException ex)
            {
                await transaction.RollbackAsync(ct);
                result.Success = false;
                result.Message = $"Error Oracle: {ex.Message}";
                _logger.LogError(ex, "Error Oracle al crear línea de mando - Code: {Code}, Message: {Message}", ex.Number, ex.Message);
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(ct);
                result.Success = false;
                result.Message = $"Error: {ex.Message}";
                _logger.LogError(ex, "Error general al crear línea de mando: {Message}", ex.Message);
            }

            return result;
        }

        public async Task<DtoLineaMandoResult> UpdateAsync(long id, DtoLineaMandoRequest request, long usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        {
            var result = new DtoLineaMandoResult();

            await using var conn = new OracleConnection(_cs);
            await conn.OpenAsync(ct);

            await using var transaction = await conn.BeginTransactionAsync(ct);
            try
            {
                await using var cmd = conn.CreateCommand();
                cmd.Transaction = (OracleTransaction)transaction;
                cmd.BindByName = true;
                cmd.CommandType = CommandType.StoredProcedure;
                cmd.CommandText = "PKG_LINEA_MANDO.P_UPDATE";

                cmd.Parameters.Add("p_id_linea_mando", OracleDbType.Int64).Value = id;
                cmd.Parameters.Add("p_identificacion", OracleDbType.Varchar2, 20).Value = (request.Identificacion ?? string.Empty).Length > 20 ? (request.Identificacion ?? string.Empty).Substring(0, 20) : (request.Identificacion ?? string.Empty);
                cmd.Parameters.Add("p_nombre", OracleDbType.Varchar2, 100).Value = (request.Nombre ?? string.Empty).Length > 100 ? (request.Nombre ?? string.Empty).Substring(0, 100) : (request.Nombre ?? string.Empty);
                cmd.Parameters.Add("p_apellidos", OracleDbType.Varchar2, 100).Value = (request.Apellidos ?? string.Empty).Length > 100 ? (request.Apellidos ?? string.Empty).Substring(0, 100) : (request.Apellidos ?? string.Empty);
                cmd.Parameters.Add("p_grado", OracleDbType.Varchar2, 50).Value = (request.Grado ?? string.Empty).Length > 50 ? (request.Grado ?? string.Empty).Substring(0, 50) : (request.Grado ?? string.Empty);
                cmd.Parameters.Add("p_cargo", OracleDbType.Varchar2, 100).Value = (request.Cargo ?? string.Empty).Length > 100 ? (request.Cargo ?? string.Empty).Substring(0, 100) : (request.Cargo ?? string.Empty);
                cmd.Parameters.Add("p_peso", OracleDbType.Varchar2, 100).Value = (request.Peso ?? string.Empty).Length > 10 ? (request.Peso ?? string.Empty).Substring(0, 10) : (request.Peso ?? string.Empty);
                cmd.Parameters.Add("p_unidad", OracleDbType.Varchar2, 200).Value = (request.Unidad ?? string.Empty).Length > 200 ? (request.Unidad ?? string.Empty).Substring(0, 200) : (request.Unidad ?? string.Empty);
                
                var fotoNormalizada = NormalizeBase64(request.FotoBase64);
                if (!string.IsNullOrEmpty(fotoNormalizada))
                {
                    cmd.Parameters.Add("p_foto_base64", OracleDbType.Clob).Value = fotoNormalizada;
                }
                else
                {
                    cmd.Parameters.Add("p_foto_base64", OracleDbType.Clob).Value = DBNull.Value;
                }
                
                cmd.Parameters.Add("p_orden", OracleDbType.Int32).Value = request.Orden;
                
                var usuarioStrU = usuarioAuditoria.ToString();
                var maquinaStrU = maquinaAuditoria ?? "N/A";
                
                cmd.Parameters.Add("p_usuario_auditoria", OracleDbType.Varchar2, 50).Value = usuarioStrU.Length > 50 ? usuarioStrU.Substring(0, 50) : usuarioStrU;
                cmd.Parameters.Add("p_maquina_auditoria", OracleDbType.Varchar2, 100).Value = maquinaStrU.Length > 100 ? maquinaStrU.Substring(0, 100) : maquinaStrU;

                // Reemplaza los OUTPUT así:
                OracleParameter pSuccess = new OracleParameter("p_success", OracleDbType.Int32);
                pSuccess.Direction = ParameterDirection.Output;
                cmd.Parameters.Add(pSuccess);

                OracleParameter pMessage = new OracleParameter("p_message", OracleDbType.Varchar2);
                pMessage.Direction = ParameterDirection.Output;
                pMessage.Size = 4000;
                cmd.Parameters.Add(pMessage);

                await cmd.ExecuteNonQueryAsync(ct);

                // Lectura correcta con OracleDecimal
                var pSuccessVal = (Oracle.ManagedDataAccess.Types.OracleDecimal)cmd.Parameters["p_success"].Value;
                result.Success = !pSuccessVal.IsNull && (int)pSuccessVal == 1;
                result.Message = cmd.Parameters["p_message"].Value?.ToString() ?? string.Empty;

                if (result.Success)
                {
                    await transaction.CommitAsync(ct);
                }
                else
                {
                    await transaction.RollbackAsync(ct);
                }
            }
            catch (OracleException ex)
            {
                await transaction.RollbackAsync(ct);
                result.Success = false;
                result.Message = $"Error de base de datos: {ex.Message}";
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(ct);
                result.Success = false;
                result.Message = $"Error: {ex.Message}";
            }

            return result;
        }

        public async Task<DtoLineaMandoResult> DeleteAsync(long id, long usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        {
            var result = new DtoLineaMandoResult();

            await using var conn = new OracleConnection(_cs);
            await conn.OpenAsync(ct);

            await using var transaction = await conn.BeginTransactionAsync(ct);
            try
            {
                await using var cmd = conn.CreateCommand();
                cmd.Transaction = (OracleTransaction)transaction;
                cmd.BindByName = true;
                cmd.CommandType = CommandType.StoredProcedure;
                cmd.CommandText = "PKG_LINEA_MANDO.P_DELETE";

                cmd.Parameters.Add("p_id_linea_mando", OracleDbType.Int64).Value = id;
                
                var usuarioStrD = usuarioAuditoria.ToString();
                var maquinaStrD = maquinaAuditoria ?? "N/A";
                
                cmd.Parameters.Add("p_usuario_auditoria", OracleDbType.Varchar2, 50).Value = usuarioStrD.Length > 50 ? usuarioStrD.Substring(0, 50) : usuarioStrD;
                cmd.Parameters.Add("p_maquina_auditoria", OracleDbType.Varchar2, 100).Value = maquinaStrD.Length > 100 ? maquinaStrD.Substring(0, 100) : maquinaStrD;

                OracleParameter pSuccess = new OracleParameter("p_success", OracleDbType.Int32);
                pSuccess.Direction = ParameterDirection.Output;
                cmd.Parameters.Add(pSuccess);

                OracleParameter pMessage = new OracleParameter("p_message", OracleDbType.Varchar2);
                pMessage.Direction = ParameterDirection.Output;
                pMessage.Size = 4000;
                cmd.Parameters.Add(pMessage);

                await cmd.ExecuteNonQueryAsync(ct);

                // Reemplaza la lectura:
                var pSuccessVal = (Oracle.ManagedDataAccess.Types.OracleDecimal)cmd.Parameters["p_success"].Value;
                result.Success = !pSuccessVal.IsNull && (int)pSuccessVal == 1;
                result.Message = cmd.Parameters["p_message"].Value?.ToString() ?? string.Empty;

                if (result.Success)
                {
                    await transaction.CommitAsync(ct);
                }
                else
                {
                    await transaction.RollbackAsync(ct);
                }
            }
            catch (OracleException ex)
            {
                await transaction.RollbackAsync(ct);
                result.Success = false;
                result.Message = $"Error de base de datos: {ex.Message}";
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(ct);
                result.Success = false;
                result.Message = $"Error: {ex.Message}";
            }

            return result;
        }

        private static DtoLineaMando MapLineaMando(OracleDataReader reader)
        {
            return new DtoLineaMando
            {
                IdLineaMando = reader.GetInt64(reader.GetOrdinal("ID_LINEA_MANDO")),
                Identificacion = reader.IsDBNull(reader.GetOrdinal("IDENTIFICACION")) ? string.Empty : reader.GetString(reader.GetOrdinal("IDENTIFICACION")),
                Nombre = reader.IsDBNull(reader.GetOrdinal("NOMBRE")) ? string.Empty : reader.GetString(reader.GetOrdinal("NOMBRE")),
                Apellidos = reader.IsDBNull(reader.GetOrdinal("APELLIDOS")) ? string.Empty : reader.GetString(reader.GetOrdinal("APELLIDOS")),
                Grado = reader.IsDBNull(reader.GetOrdinal("GRADO")) ? string.Empty : reader.GetString(reader.GetOrdinal("GRADO")),
                Cargo = reader.IsDBNull(reader.GetOrdinal("CARGO")) ? string.Empty : reader.GetString(reader.GetOrdinal("CARGO")),
                Peso = reader.IsDBNull(reader.GetOrdinal("PESO")) ? string.Empty : reader.GetString(reader.GetOrdinal("PESO")),
                Unidad = reader.IsDBNull(reader.GetOrdinal("UNIDAD")) ? string.Empty : reader.GetString(reader.GetOrdinal("UNIDAD")),
                FotoBase64 = reader.IsDBNull(reader.GetOrdinal("FOTO_BASE64")) ? null : reader.GetString(reader.GetOrdinal("FOTO_BASE64")),
                Orden = reader.IsDBNull(reader.GetOrdinal("ORDEN")) ? 1 : reader.GetInt32(reader.GetOrdinal("ORDEN")),
                Vigente = reader.IsDBNull(reader.GetOrdinal("VIGENTE")) ? 1 : reader.GetInt32(reader.GetOrdinal("VIGENTE"))
            };
        }

        private static string? NormalizeBase64(string? raw)
        {
            if (string.IsNullOrWhiteSpace(raw))
            {
                return null;
            }

            var value = raw.Trim();
            var commaIdx = value.IndexOf(',');
            if (value.StartsWith("data:", StringComparison.OrdinalIgnoreCase) && commaIdx > -1)
            {
                value = value[(commaIdx + 1)..];
            }

            return value;
        }
    }
}

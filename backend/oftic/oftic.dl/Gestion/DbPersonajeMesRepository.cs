using Comun.Dtos.PersonajeMes;
using Datos.Interfaz;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Oracle.ManagedDataAccess.Client;
using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Datos.Gestion
{
    public class DbPersonajeMesRepository : IDbPersonajeMesRepository
    {
        private readonly string _cs;
        private readonly ILogger<DbPersonajeMesRepository> _logger;

        public DbPersonajeMesRepository(IConfiguration configuration, ILogger<DbPersonajeMesRepository> logger)
        {
            _cs = configuration.GetConnectionString("DbOracle")!;
            _logger = logger;
        }

        public async Task<List<DtoPersonajeMes>> GetAllAsync(CancellationToken ct)
        {
            var result = new List<DtoPersonajeMes>();

            await using var conn = new OracleConnection(_cs);
            await conn.OpenAsync(ct);

            await using var cmd = conn.CreateCommand();
            cmd.BindByName = true;
            cmd.CommandType = CommandType.StoredProcedure;
            cmd.CommandText = "PKG_PERSONAJE_MES.P_GET_ALL";
            cmd.Parameters.Add("p_cursor", OracleDbType.RefCursor).Direction = ParameterDirection.Output;

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                result.Add(MapPersonajeMes(reader));
            }

            return result;
        }
        public async Task<DtoPersonajeMesResult> CreateAsync(DtoPersonajeMesRequest request, long usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        {
            var result = new DtoPersonajeMesResult();

            await using var conn = new OracleConnection(_cs);
            await conn.OpenAsync(ct);

            await using var transaction = await conn.BeginTransactionAsync(ct);
            try
            {
                _logger.LogInformation("Ejecutando PKG_PERSONAJE_MES.P_CREATE con datos: Identificacion={Ident}, Nombre={Nombre}, Cargo={Cargo}",
                    request.Identificacion, request.Nombres, request.Cargo);

                await using var cmd = conn.CreateCommand();
                cmd.Transaction = (OracleTransaction)transaction;
                cmd.BindByName = true;
                cmd.CommandType = CommandType.StoredProcedure;
                cmd.CommandText = "PKG_PERSONAJE_MES.P_CREATE";

                cmd.Parameters.Add("p_identificacion", OracleDbType.Varchar2, 20).Value = (request.Identificacion ?? string.Empty).Length > 20 ? (request.Identificacion ?? string.Empty).Substring(0, 20) : (request.Identificacion ?? string.Empty);
                cmd.Parameters.Add("p_nombres", OracleDbType.Varchar2, 100).Value = (request.Nombres ?? string.Empty).Length > 100 ? (request.Nombres ?? string.Empty).Substring(0, 100) : (request.Nombres ?? string.Empty);
                cmd.Parameters.Add("p_apellidos", OracleDbType.Varchar2, 100).Value = (request.Apellidos ?? string.Empty).Length > 100 ? (request.Apellidos ?? string.Empty).Substring(0, 100) : (request.Apellidos ?? string.Empty);
                cmd.Parameters.Add("p_grado", OracleDbType.Varchar2, 50).Value = (request.Grado ?? string.Empty).Length > 50 ? (request.Grado ?? string.Empty).Substring(0, 50) : (request.Grado ?? string.Empty);
                cmd.Parameters.Add("p_cargo", OracleDbType.Varchar2, 100).Value = (request.Cargo ?? string.Empty).Length > 100 ? (request.Cargo ?? string.Empty).Substring(0, 100) : (request.Cargo ?? string.Empty);
                cmd.Parameters.Add("p_unidad", OracleDbType.Varchar2, 200).Value = (request.Unidad ?? string.Empty).Length > 200 ? (request.Unidad ?? string.Empty).Substring(0, 200) : (request.Unidad ?? string.Empty);
               
                var fotoNormalizada = NormalizeBase64(request.FotoBase64);
                var clobParam = new OracleParameter("p_foto_base64", OracleDbType.Clob);
                clobParam.Value = !string.IsNullOrEmpty(fotoNormalizada) ? (object)fotoNormalizada : DBNull.Value;
                cmd.Parameters.Add(clobParam);

                cmd.Parameters.Add("p_idcategoria", OracleDbType.Int32).Value = request.IdCategoria;
                cmd.Parameters.Add("p_numeroacta", OracleDbType.Varchar2, 50).Value = (request.NumeroActa ?? string.Empty).Length > 50 ? (request.NumeroActa ?? string.Empty).Substring(0, 50) : (request.NumeroActa ?? string.Empty);

                var usuarioStr = usuarioAuditoria.ToString();
                var maquinaStr = maquinaAuditoria ?? "N/A";

                cmd.Parameters.Add("p_usuario_auditoria", OracleDbType.Varchar2, 50).Value = usuarioStr.Length > 50 ? usuarioStr.Substring(0, 50) : usuarioStr;
                cmd.Parameters.Add("p_maquina_auditoria", OracleDbType.Varchar2, 100).Value = maquinaStr.Length > 100 ? maquinaStr.Substring(0, 100) : maquinaStr;

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

                var pIdVal = (Oracle.ManagedDataAccess.Types.OracleDecimal)cmd.Parameters["p_id"].Value;
                result.Id = pIdVal.IsNull ? 0 : (long)pIdVal;

                var pSuccessVal = (Oracle.ManagedDataAccess.Types.OracleDecimal)cmd.Parameters["p_success"].Value;
                result.Success = !pSuccessVal.IsNull && (int)pSuccessVal == 1;
                result.Message = cmd.Parameters["p_message"].Value?.ToString() ?? string.Empty;

                if (result.Success)
                {
                    await transaction.CommitAsync(ct);
                    _logger.LogInformation("Personje del mes creado exitosamente con ID: {Id}", result.Id);
                }
                else
                {
                    await transaction.RollbackAsync(ct);
                    _logger.LogWarning("Error al crear personaje del mes: {Message}", result.Message);
                }
            }
            catch (OracleException ex)
            {
                await transaction.RollbackAsync(ct);
                result.Id = 0;
                result.Success = false;
                result.Message = $"Error Oracle: {ex.Message}";
                _logger.LogError(ex, "Error Oracle al crear personaje del mes - Code: {Code}, Message: {Message}", ex.Number, ex.Message);
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(ct);
                result.Id = 0;
                result.Success = false;
                result.Message = $"Error: {ex.Message}";
                _logger.LogError(ex, "Error general al crear personaje del mes: {Message}", ex.Message);
            }

            return result;
        }
        public async Task<DtoPersonajeMesResult> UpdateAsync(long id, DtoPersonajeMesRequest request, long usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        {
            _logger.LogInformation("UpdateAsync llamado - ID: {Id}, FotoBase64 length: {Length}", id, request.FotoBase64?.Length ?? 0);

            var result = new DtoPersonajeMesResult();

            await using var conn = new OracleConnection(_cs);
            await conn.OpenAsync(ct);

            await using var transaction = await conn.BeginTransactionAsync(ct);
            try
            {
                await using var cmd = conn.CreateCommand();
                cmd.CommandTimeout = 60;
                cmd.Transaction = (OracleTransaction)transaction;
                cmd.BindByName = true;
                cmd.CommandType = CommandType.StoredProcedure;
                cmd.CommandText = "PKG_LINEA_MANDO.P_UPDATE";

                cmd.Parameters.Add("p_id_personaje_mes", OracleDbType.Int64).Value = id;
                cmd.Parameters.Add("p_identificacion", OracleDbType.Varchar2, 20).Value = (request.Identificacion ?? string.Empty).Length > 20 ? (request.Identificacion ?? string.Empty).Substring(0, 20) : (request.Identificacion ?? string.Empty);
                cmd.Parameters.Add("p_nombres", OracleDbType.Varchar2, 100).Value = (request.Nombres ?? string.Empty).Length > 100 ? (request.Nombres ?? string.Empty).Substring(0, 100) : (request.Nombres ?? string.Empty);
                cmd.Parameters.Add("p_apellidos", OracleDbType.Varchar2, 100).Value = (request.Apellidos ?? string.Empty).Length > 100 ? (request.Apellidos ?? string.Empty).Substring(0, 100) : (request.Apellidos ?? string.Empty);
                cmd.Parameters.Add("p_grado", OracleDbType.Varchar2, 50).Value = (request.Grado ?? string.Empty).Length > 50 ? (request.Grado ?? string.Empty).Substring(0, 50) : (request.Grado ?? string.Empty);
                cmd.Parameters.Add("p_cargo", OracleDbType.Varchar2, 100).Value = (request.Cargo ?? string.Empty).Length > 100 ? (request.Cargo ?? string.Empty).Substring(0, 100) : (request.Cargo ?? string.Empty);
                cmd.Parameters.Add("p_unidad", OracleDbType.Varchar2, 200).Value = (request.Unidad ?? string.Empty).Length > 200 ? (request.Unidad ?? string.Empty).Substring(0, 200) : (request.Unidad ?? string.Empty);

                var fotoNormalizada = NormalizeBase64(request.FotoBase64);
                var clobParam = new OracleParameter("p_foto_base64", OracleDbType.Clob)
                {
                    Direction = ParameterDirection.Input,
                    Value = string.IsNullOrEmpty(fotoNormalizada) ? DBNull.Value : fotoNormalizada
                };
                cmd.Parameters.Add(clobParam);

                cmd.Parameters.Add("p_idcategoria", OracleDbType.Int32).Value = request.IdCategoria;
                cmd.Parameters.Add("p_numeroacta", OracleDbType.Varchar2, 50).Value = (request.NumeroActa ?? string.Empty).Length > 50 ? (request.NumeroActa ?? string.Empty).Substring(0, 50) : (request.NumeroActa ?? string.Empty);


                var usuarioStrU = usuarioAuditoria.ToString();
                var maquinaStrU = maquinaAuditoria ?? "N/A";

                cmd.Parameters.Add("p_usuario_auditoria", OracleDbType.Varchar2, 50).Value = usuarioStrU.Length > 50 ? usuarioStrU.Substring(0, 50) : usuarioStrU;
                cmd.Parameters.Add("p_maquina_auditoria", OracleDbType.Varchar2, 100).Value = maquinaStrU.Length > 100 ? maquinaStrU.Substring(0, 100) : maquinaStrU;

                OracleParameter pSuccess = new OracleParameter("p_success", OracleDbType.Int32);
                pSuccess.Direction = ParameterDirection.Output;
                cmd.Parameters.Add(pSuccess);

                OracleParameter pMessage = new OracleParameter("p_message", OracleDbType.Varchar2);
                pMessage.Direction = ParameterDirection.Output;
                pMessage.Size = 4000;
                cmd.Parameters.Add(pMessage);

                await cmd.ExecuteNonQueryAsync(ct);

                var pSuccessVal = (Oracle.ManagedDataAccess.Types.OracleDecimal)cmd.Parameters["p_success"].Value;
                result.Success = !pSuccessVal.IsNull && (int)pSuccessVal == 1;
                result.Message = cmd.Parameters["p_message"].Value?.ToString() ?? string.Empty;

                if (result.Success)
                {
                    await transaction.CommitAsync(ct);
                    _logger.LogInformation("Personaje del mes actualizada exitosamente - ID: {Id}", id);
                }
                else
                {
                    await transaction.RollbackAsync(ct);
                    _logger.LogWarning("Error al actualizar personaje del mes: {Message}", result.Message);
                }
            }
            catch (OracleException ex)
            {
                await transaction.RollbackAsync(ct);
                result.Success = false;
                result.Message = $"Error de base de datos: {ex.Message}";
                _logger.LogError(ex, "Oracle error - Code: {Code}", ex.Number);
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(ct);
                result.Success = false;
                result.Message = $"Error: {ex.Message}";
                _logger.LogError(ex, "Error: {Message}", ex.Message);
            }

            _logger.LogInformation("UpdateAsync result - Success: {Success}, Message: {Message}", result.Success, result.Message);
            return result;
        }
        public async Task<DtoPersonajeMesResult> DeleteAsync(long id, long usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        {
            var result = new DtoPersonajeMesResult();

            await using var conn = new OracleConnection(_cs);
            await conn.OpenAsync(ct);

            await using var transaction = await conn.BeginTransactionAsync(ct);
            try
            {
                await using var cmd = conn.CreateCommand();
                cmd.Transaction = (OracleTransaction)transaction;
                cmd.BindByName = true;
                cmd.CommandType = CommandType.StoredProcedure;
                cmd.CommandText = "PKG_PERSONAJE_MES.P_DELETE";

                cmd.Parameters.Add("p_id_personaje_mes", OracleDbType.Int64).Value = id;

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
        public async Task<DtoPersonajeMesResult> SetVigenteAsync(long id, int vigente, long usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        {
            var result = new DtoPersonajeMesResult();

            await using var conn = new OracleConnection(_cs);
            await conn.OpenAsync(ct);

            await using var transaction = await conn.BeginTransactionAsync(ct);
            try
            {
                await using var cmd = conn.CreateCommand();
                cmd.Transaction = (OracleTransaction)transaction;
                cmd.BindByName = true;
                cmd.CommandType = CommandType.StoredProcedure;
                cmd.CommandText = "PKG_PERSONAJE_MES.P_SET_VIGENTE";

                cmd.Parameters.Add("p_id_personaje_mes", OracleDbType.Int64).Value = id;
                cmd.Parameters.Add("p_vigente", OracleDbType.Int32).Value = vigente;

                var usuarioStrV = usuarioAuditoria.ToString();
                var maquinaStrV = maquinaAuditoria ?? "N/A";

                cmd.Parameters.Add("p_usuario_auditoria", OracleDbType.Varchar2, 50).Value = usuarioStrV.Length > 50 ? usuarioStrV.Substring(0, 50) : usuarioStrV;
                cmd.Parameters.Add("p_maquina_auditoria", OracleDbType.Varchar2, 100).Value = maquinaStrV.Length > 100 ? maquinaStrV.Substring(0, 100) : maquinaStrV;

                OracleParameter pSuccess = new OracleParameter("p_success", OracleDbType.Int32);
                pSuccess.Direction = ParameterDirection.Output;
                cmd.Parameters.Add(pSuccess);

                OracleParameter pMessage = new OracleParameter("p_message", OracleDbType.Varchar2);
                pMessage.Direction = ParameterDirection.Output;
                pMessage.Size = 4000;
                cmd.Parameters.Add(pMessage);

                await cmd.ExecuteNonQueryAsync(ct);

                var pSuccessVal = (Oracle.ManagedDataAccess.Types.OracleDecimal)pSuccess.Value;
                result.Success = !pSuccessVal.IsNull && (int)pSuccessVal == 1;
                result.Message = pMessage.Value?.ToString() ?? string.Empty;

                if (result.Success)
                {
                    await transaction.CommitAsync(ct);
                    _logger.LogInformation("Vigente actualizado para personaje del mes {Id}", id);
                }
                else
                {
                    await transaction.RollbackAsync(ct);
                    _logger.LogWarning("Error al actualizar vigente: {Message}", result.Message);
                }
            }
            catch (OracleException ex)
            {
                await transaction.RollbackAsync(ct);
                result.Success = false;
                result.Message = $"Error Oracle: {ex.Message}";
                _logger.LogError(ex, "Error Oracle al actualizar vigente - Code: {Code}, Message: {Message}", ex.Number, ex.Message);
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(ct);
                result.Success = false;
                result.Message = $"Error: {ex.Message}";
                _logger.LogError(ex, "Error general al actualizar vigente: {Message}", ex.Message);
            }

            return result;
        }


        private static DtoPersonajeMes MapPersonajeMes(OracleDataReader reader)
        {
            return new DtoPersonajeMes
            {
                IdPersonajeMes = reader.GetInt32(reader.GetOrdinal("ID_PERSONAJE_MES")),
                Identificacion = reader.IsDBNull(reader.GetOrdinal("IDENTIFICACION")) ? string.Empty : reader.GetString(reader.GetOrdinal("IDENTIFICACION")),
                Nombres = reader.IsDBNull(reader.GetOrdinal("NOMBRES")) ? string.Empty : reader.GetString(reader.GetOrdinal("NOMBRES")),
                Apellidos = reader.IsDBNull(reader.GetOrdinal("APELLIDOS")) ? string.Empty : reader.GetString(reader.GetOrdinal("APELLIDOS")),
                Grado = reader.IsDBNull(reader.GetOrdinal("GRADO")) ? string.Empty : reader.GetString(reader.GetOrdinal("GRADO")),
                Cargo = reader.IsDBNull(reader.GetOrdinal("CARGO")) ? string.Empty : reader.GetString(reader.GetOrdinal("CARGO")),                
                Unidad = reader.IsDBNull(reader.GetOrdinal("UNIDAD")) ? string.Empty : reader.GetString(reader.GetOrdinal("UNIDAD")),
                FotoBase64 = reader.IsDBNull(reader.GetOrdinal("FOTO_BASE64")) ? null : reader.GetString(reader.GetOrdinal("FOTO_BASE64")),
                IdCategoria = reader.GetInt64(reader.GetOrdinal("ID_CATEGORIA")),
                NumeroActa = reader.IsDBNull(reader.GetOrdinal("NUMERO_ACTA")) ? string.Empty : reader.GetString(reader.GetOrdinal("NUMERO_ACTA")),
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

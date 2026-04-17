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

            var columnasDisponibles = Enumerable.Range(0, reader.FieldCount)
                .Select(reader.GetName)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            var columnasEsperadas = new[]
            {
                "ID_PERSONAJE_MES", "IDENTIFICACION", "NOMBRES", "APELLIDOS", "GRADO",
                "CARGO", "UNIDAD", "FOTO_MODIFICADA", "ID_CATEGORIA", "NUMERO_ACTA",
                "VIGENTE", "MES", "ANIO"
            };

            var columnasFaltantes = columnasEsperadas
                .Where(col => !columnasDisponibles.Contains(col))
                .ToArray();

            if (columnasFaltantes.Length > 0)
            {
                _logger.LogWarning(
                    "PKG_PERSONAJE_MES.P_GET_ALL no devolvió todas las columnas esperadas. Faltantes: {Faltantes}. Disponibles: {Disponibles}",
                    string.Join(", ", columnasFaltantes),
                    string.Join(", ", columnasDisponibles.OrderBy(c => c)));
            }

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

                // ORDEN CORRECTO según la firma del procedimiento Oracle
                cmd.Parameters.Add("p_identificacion", OracleDbType.Varchar2, 20).Value = (request.Identificacion ?? string.Empty).Length > 20 ? (request.Identificacion ?? string.Empty).Substring(0, 20) : (request.Identificacion ?? string.Empty);
                cmd.Parameters.Add("p_nombres", OracleDbType.Varchar2, 100).Value = (request.Nombres ?? string.Empty).Length > 100 ? (request.Nombres ?? string.Empty).Substring(0, 100) : (request.Nombres ?? string.Empty);
                cmd.Parameters.Add("p_apellidos", OracleDbType.Varchar2, 100).Value = (request.Apellidos ?? string.Empty).Length > 100 ? (request.Apellidos ?? string.Empty).Substring(0, 100) : (request.Apellidos ?? string.Empty);
                cmd.Parameters.Add("p_grado", OracleDbType.Varchar2, 50).Value = (request.Grado ?? string.Empty).Length > 50 ? (request.Grado ?? string.Empty).Substring(0, 50) : (request.Grado ?? string.Empty);
                cmd.Parameters.Add("p_cargo", OracleDbType.Varchar2, 100).Value = (request.Cargo ?? string.Empty).Length > 100 ? (request.Cargo ?? string.Empty).Substring(0, 100) : (request.Cargo ?? string.Empty);
                cmd.Parameters.Add("p_unidad", OracleDbType.Varchar2, 200).Value = (request.Unidad ?? string.Empty).Length > 200 ? (request.Unidad ?? string.Empty).Substring(0, 200) : (request.Unidad ?? string.Empty);
                
                // Nota: p_idcategoria es NUMBER en Oracle (Int64)
                cmd.Parameters.Add("p_idcategoria", OracleDbType.Int64).Value = (long)request.IdCategoria;
                cmd.Parameters.Add("p_numero_acta", OracleDbType.Varchar2, 50).Value = (request.NumeroActa ?? string.Empty).Length > 50 ? (request.NumeroActa ?? string.Empty).Substring(0, 50) : (request.NumeroActa ?? string.Empty);

                var usuarioStr = usuarioAuditoria.ToString();
                var maquinaStr = maquinaAuditoria ?? "N/A";

                cmd.Parameters.Add("p_usuario_auditoria", OracleDbType.Varchar2, 50).Value = usuarioStr.Length > 50 ? usuarioStr.Substring(0, 50) : usuarioStr;
                cmd.Parameters.Add("p_maquina_auditoria", OracleDbType.Varchar2, 100).Value = maquinaStr.Length > 100 ? maquinaStr.Substring(0, 100) : maquinaStr;
                
                // p_foto_modificada va DESPUÉS de los parámetros de auditoría
                cmd.Parameters.Add("p_foto_modificada", OracleDbType.Varchar2, 200).Value = (request.FotoModificada ?? string.Empty).Length > 200 ? (request.FotoModificada ?? string.Empty).Substring(0, 200) : (request.FotoModificada ?? string.Empty);

                cmd.Parameters.Add("p_mes", OracleDbType.Int32).Value = (long)request.Mes;
                cmd.Parameters.Add("p_anio", OracleDbType.Int32).Value = (long)request.Anio;

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
            _logger.LogInformation("UpdateAsync llamado - ID: {Id}, FotoModificada length: {Length}", id, request.FotoModificada?.Length ?? 0);

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
                cmd.CommandText = "PKG_PERSONAJE_MES.P_UPDATE";

                cmd.Parameters.Add("p_id_personaje_mes", OracleDbType.Int64).Value = id;
                cmd.Parameters.Add("p_identificacion", OracleDbType.Varchar2, 20).Value = (request.Identificacion ?? string.Empty).Length > 20 ? (request.Identificacion ?? string.Empty).Substring(0, 20) : (request.Identificacion ?? string.Empty);
                cmd.Parameters.Add("p_nombres", OracleDbType.Varchar2, 100).Value = (request.Nombres ?? string.Empty).Length > 100 ? (request.Nombres ?? string.Empty).Substring(0, 100) : (request.Nombres ?? string.Empty);
                cmd.Parameters.Add("p_apellidos", OracleDbType.Varchar2, 100).Value = (request.Apellidos ?? string.Empty).Length > 100 ? (request.Apellidos ?? string.Empty).Substring(0, 100) : (request.Apellidos ?? string.Empty);
                cmd.Parameters.Add("p_grado", OracleDbType.Varchar2, 50).Value = (request.Grado ?? string.Empty).Length > 50 ? (request.Grado ?? string.Empty).Substring(0, 50) : (request.Grado ?? string.Empty);
                cmd.Parameters.Add("p_cargo", OracleDbType.Varchar2, 100).Value = (request.Cargo ?? string.Empty).Length > 100 ? (request.Cargo ?? string.Empty).Substring(0, 100) : (request.Cargo ?? string.Empty);
                cmd.Parameters.Add("p_unidad", OracleDbType.Varchar2, 200).Value = (request.Unidad ?? string.Empty).Length > 200 ? (request.Unidad ?? string.Empty).Substring(0, 200) : (request.Unidad ?? string.Empty);
                              
                cmd.Parameters.Add("p_idcategoria", OracleDbType.Int64).Value = (long)request.IdCategoria;
                cmd.Parameters.Add("p_numero_acta", OracleDbType.Varchar2, 50).Value = (request.NumeroActa ?? string.Empty).Length > 50 ? (request.NumeroActa ?? string.Empty).Substring(0, 50) : (request.NumeroActa ?? string.Empty);


                var usuarioStrU = usuarioAuditoria.ToString();
                var maquinaStrU = maquinaAuditoria ?? "N/A";

                cmd.Parameters.Add("p_usuario_auditoria", OracleDbType.Varchar2, 50).Value = usuarioStrU.Length > 50 ? usuarioStrU.Substring(0, 50) : usuarioStrU;
                cmd.Parameters.Add("p_maquina_auditoria", OracleDbType.Varchar2, 100).Value = maquinaStrU.Length > 100 ? maquinaStrU.Substring(0, 100) : maquinaStrU;
                cmd.Parameters.Add("p_foto_modificada", OracleDbType.Varchar2, 200).Value = (request.FotoModificada ?? string.Empty).Length > 200 ? (request.FotoModificada ?? string.Empty).Substring(0, 200) : (request.FotoModificada ?? string.Empty);
                cmd.Parameters.Add("p_mes", OracleDbType.Int32).Value = (long)request.Mes;
                cmd.Parameters.Add("p_anio", OracleDbType.Int32).Value = (long)request.Anio;
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
                IdPersonajeMes = GetInt64OrDefault(reader, "ID_PERSONAJE_MES"),
                Identificacion = GetStringOrDefault(reader, "IDENTIFICACION"),
                Nombres = GetStringOrDefault(reader, "NOMBRES"),
                Apellidos = GetStringOrDefault(reader, "APELLIDOS"),
                Grado = GetStringOrDefault(reader, "GRADO"),
                Cargo = GetStringOrDefault(reader, "CARGO"),
                Unidad = GetStringOrDefault(reader, "UNIDAD"),
                FotoModificada = GetNullableStringOrDefault(reader, "FOTO_MODIFICADA"),
                IdCategoria = GetInt32OrDefault(reader, "ID_CATEGORIA"),
                NumeroActa = GetStringOrDefault(reader, "NUMERO_ACTA"),
                Vigente = GetInt32OrDefault(reader, "VIGENTE", 1),
                Mes = GetInt32OrDefault(reader, "MES"),
                Anio = GetInt32OrDefault(reader, "ANIO")
            };
        }

        private static bool HasColumn(OracleDataReader reader, string columnName)
        {
            for (var i = 0; i < reader.FieldCount; i++)
            {
                if (string.Equals(reader.GetName(i), columnName, StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }

            return false;
        }

        private static string GetStringOrDefault(OracleDataReader reader, string columnName, string defaultValue = "")
        {
            if (!HasColumn(reader, columnName))
            {
                return defaultValue;
            }

            var ordinal = reader.GetOrdinal(columnName);
            return reader.IsDBNull(ordinal) ? defaultValue : reader.GetValue(ordinal)?.ToString() ?? defaultValue;
        }

        private static string? GetNullableStringOrDefault(OracleDataReader reader, string columnName)
        {
            if (!HasColumn(reader, columnName))
            {
                return null;
            }

            var ordinal = reader.GetOrdinal(columnName);
            return reader.IsDBNull(ordinal) ? null : reader.GetValue(ordinal)?.ToString();
        }

        private static int GetInt32OrDefault(OracleDataReader reader, string columnName, int defaultValue = 0)
        {
            if (!HasColumn(reader, columnName))
            {
                return defaultValue;
            }

            var ordinal = reader.GetOrdinal(columnName);
            return reader.IsDBNull(ordinal) ? defaultValue : Convert.ToInt32(reader.GetValue(ordinal));
        }

        private static long GetInt64OrDefault(OracleDataReader reader, string columnName, long defaultValue = 0)
        {
            if (!HasColumn(reader, columnName))
            {
                return defaultValue;
            }

            var ordinal = reader.GetOrdinal(columnName);
            return reader.IsDBNull(ordinal) ? defaultValue : Convert.ToInt64(reader.GetValue(ordinal));
        }
    }
}

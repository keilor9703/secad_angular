using Comun.Dtos.Dominio;
using Comun.Dtos.LineasMando;
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
    public class DbDominioRepository: IDbDominioRepository
    {
        private readonly string _cs;
        private readonly ILogger<DbDominioRepository> _logger;

        public DbDominioRepository(IConfiguration configuration, ILogger<DbDominioRepository> logger)
        {
            _cs = configuration.GetConnectionString("DbOracle")!;
            _logger = logger;
        }

        public async Task<List<DtoDominio>> GetAllAsync(CancellationToken ct)
        {
            var result = new List<DtoDominio>();

            await using var conn = new OracleConnection(_cs);
            await conn.OpenAsync(ct);

            await using var cmd = conn.CreateCommand();
            cmd.CommandTimeout = 30;
            cmd.BindByName = true;
            cmd.CommandType = CommandType.StoredProcedure;
            cmd.CommandText = "PK_ADMINISTRACION.P_GET_ALL_DOMINIO";
            cmd.Parameters.Add("p_cursor", OracleDbType.RefCursor).Direction = ParameterDirection.Output;

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            
            while (await reader.ReadAsync(ct))
            {
                result.Add(MapDominio(reader));
            }

            return result;
        }

       public async Task<DtoDominioResult> CreateAsync(DtoDominioRequest request, long usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        {
            var result = new DtoDominioResult();

            await using var conn = new OracleConnection(_cs);
            await conn.OpenAsync(ct);

            await using var transaction = await conn.BeginTransactionAsync(ct);
            try
            {
                _logger.LogInformation("Ejecutando PK_ADMINISTRACION.P_CREATE_DOMINIO con datos: Descripcion={Desc}, IdPadre={IdPadre}, Abreviatura={Abrev}",
                    request.Descripcion, request.IdPadre, request.Abreviatura);

                await using var cmd = conn.CreateCommand();
                cmd.CommandTimeout = 30;
                cmd.Transaction = (OracleTransaction)transaction;
                cmd.BindByName = true;
                cmd.CommandType = CommandType.StoredProcedure;
                cmd.CommandText = "PK_ADMINISTRACION.P_CREATE_DOMINIO";

                cmd.Parameters.Add("P_Descripcion", OracleDbType.Varchar2, 100).Value = (request.Descripcion ?? string.Empty).Length > 100 ? (request.Descripcion ?? string.Empty).Substring(0, 100) : (request.Descripcion ?? string.Empty);
                cmd.Parameters.Add("P_IdPadre", OracleDbType.Int32).Value = request.IdPadre;
                cmd.Parameters.Add("P_Abreviatura", OracleDbType.Varchar2, 100).Value = (request.Abreviatura ?? string.Empty).Length > 100 ? (request.Abreviatura ?? string.Empty).Substring(0, 100) : (request.Abreviatura ?? string.Empty);
                cmd.Parameters.Add("P_Observacion", OracleDbType.Varchar2, 100).Value = (request.Observacion ?? string.Empty).Length > 100 ? (request.Observacion ?? string.Empty).Substring(0, 100) : (request.Observacion ?? string.Empty);
                              
                
                var usuarioStr = usuarioAuditoria.ToString();
                var maquinaStr = maquinaAuditoria ?? "N/A";

                cmd.Parameters.Add("p_usuario_auditoria", OracleDbType.Varchar2, 50).Value = usuarioStr.Length > 50 ? usuarioStr.Substring(0, 50) : usuarioStr;
                cmd.Parameters.Add("p_maquina_auditoria", OracleDbType.Varchar2, 100).Value = maquinaStr.Length > 100 ? maquinaStr.Substring(0, 100) : maquinaStr;

           
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

               
                // DESPUÉS - cast correcto para OracleDecimal
                var pIdVal = (Oracle.ManagedDataAccess.Types.OracleDecimal)cmd.Parameters["p_id"].Value;
                result.Id = pIdVal.IsNull ? 0 : (long)pIdVal;

                var pSuccessVal = (Oracle.ManagedDataAccess.Types.OracleDecimal)cmd.Parameters["p_success"].Value;
                result.Success = !pSuccessVal.IsNull && (int)pSuccessVal == 1;

                result.Message = cmd.Parameters["p_message"].Value?.ToString() ?? string.Empty;

                if (result.Success)
                {
                    await transaction.CommitAsync(ct);
                    _logger.LogInformation(" creado exitosamente");
                    _logger.LogInformation("Dominio creado exitosamente");
                }
                else
                {
                    await transaction.RollbackAsync(ct);
                    _logger.LogWarning("Error al crear el dominio: {Message}", result.Message);
                }
            }
            catch (OracleException ex)
            {
                await transaction.RollbackAsync(ct);
                result.Success = false;
                result.Message = $"Error Oracle: {ex.Message}";
                _logger.LogError(ex, "Error Oracle al crear el dominio - Code: {Code}, Message: {Message}", ex.Number, ex.Message);
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(ct);
                result.Success = false;
                result.Message = $"Error: {ex.Message}";
                _logger.LogError(ex, "Error general al crear el dominio: {Message}", ex.Message);
            }

            return result;
        }

        public async Task<DtoDominioResult> UpdateAsync(long id, DtoDominioRequest request, long usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        {
            var result = new DtoDominioResult();

            OracleConnection? conn = null;
            OracleTransaction? transaction = null;

            try
            {
                conn = new OracleConnection(_cs);
                await conn.OpenAsync(ct);
                transaction = (OracleTransaction)(await conn.BeginTransactionAsync(ct));

                _logger.LogInformation("Ejecutando UPDATE DOMINIO ID={Id}, Descripcion={Desc}, IdPadre={IdPadre}, Vigente={Vigente}",
                    id, request.Descripcion, request.IdPadre, request.Vigente);

                await using var cmd = conn.CreateCommand();
                cmd.CommandTimeout = 30;
                cmd.Transaction = (OracleTransaction)transaction;
                cmd.BindByName = true;
                cmd.CommandType = CommandType.StoredProcedure;
                cmd.CommandText = "PK_ADMINISTRACION.P_UPDATE_DOMINIO";

                cmd.Parameters.Add("P_IdDominio", OracleDbType.Int32).Value = id;
                cmd.Parameters.Add("P_Descripcion", OracleDbType.Varchar2, 100).Value = (request.Descripcion ?? string.Empty).Length > 100 ? (request.Descripcion ?? string.Empty).Substring(0, 100) : (request.Descripcion ?? string.Empty);
                cmd.Parameters.Add("P_IdPadre", OracleDbType.Int32).Value = request.IdPadre;
                cmd.Parameters.Add("P_Vigente", OracleDbType.Int32).Value = request.Vigente;
                cmd.Parameters.Add("P_Abreviatura", OracleDbType.Varchar2, 100).Value = (request.Abreviatura ?? string.Empty).Length > 100 ? (request.Abreviatura ?? string.Empty).Substring(0, 100) : (request.Abreviatura ?? string.Empty);
                cmd.Parameters.Add("P_Observacion", OracleDbType.Varchar2, 100).Value = (request.Observacion ?? string.Empty).Length > 100 ? (request.Observacion ?? string.Empty).Substring(0, 100) : (request.Observacion ?? string.Empty);
                
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
                    _logger.LogInformation("UPDATE Dominio ID={Id} exitoso", id);
                }
                else
                {
                    await transaction.RollbackAsync(ct);
                    _logger.LogWarning("UPDATE Dominio ID={Id} fallido: {Message}", id, result.Message);
                }
            }
            catch (OracleException ex)
            {
                if (transaction != null)
                    await transaction.RollbackAsync(ct);
                result.Success = false;
                result.Message = $"Error de base de datos: {ex.Message}";
                _logger.LogError(ex, "Error Oracle en UPDATE Dominio - Code: {Code}", ex.Number);
            }
            catch (System.IO.IOException ex)
            {
                if (transaction != null)
                    await transaction.RollbackAsync(ct);
                result.Success = false;
                result.Message = $"Error de conexión: {ex.Message}";
                _logger.LogError(ex, "Error de E/S en UPDATE Dominio");
            }
            catch (Exception ex)
            {
                if (transaction != null)
                    await transaction.RollbackAsync(ct);
                result.Success = false;
                result.Message = $"Error: {ex.Message}";
                _logger.LogError(ex, "Error general en UPDATE Dominio");
            }
            finally
            {
                if (conn != null)
                {
                    await conn.CloseAsync();
                    conn.Dispose();
                }
            }

            return result;
        }

        public async Task<DtoDominioResult> DeletelogicalAsync(long id, long usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        {
            var result = new DtoDominioResult();

            await using var conn = new OracleConnection(_cs);
            await conn.OpenAsync(ct);

            await using var transaction = await conn.BeginTransactionAsync(ct);
            try
            {
                await using var cmd = conn.CreateCommand();
                cmd.CommandTimeout = 30;
                cmd.Transaction = (OracleTransaction)transaction;
                cmd.BindByName = true;
                cmd.CommandType = CommandType.StoredProcedure;
                cmd.CommandText = "PK_ADMINISTRACION.P_DELETE_LOGICAL_DOMINIO";

                cmd.Parameters.Add("P_IdDominio", OracleDbType.Int64).Value = id;

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


        private static DtoDominio MapDominio(OracleDataReader reader)
        {
            return new DtoDominio
            {

                IdDominio = reader.IsDBNull(reader.GetOrdinal("ID_DOMINIO"))? 0 : reader.GetInt64(reader.GetOrdinal("ID_DOMINIO")),
                Descripcion = reader.IsDBNull(reader.GetOrdinal("DESCRIPCION")) ? string.Empty : reader.GetString(reader.GetOrdinal("DESCRIPCION")),
                IdPadre = reader.GetInt64(reader.GetOrdinal("ID_PADRE")),
                Abreviatura = reader.IsDBNull(reader.GetOrdinal("ABREVIATURA")) ? string.Empty : reader.GetString(reader.GetOrdinal("ABREVIATURA")),
                Observacion = reader.IsDBNull(reader.GetOrdinal("OBSERVACION")) ? string.Empty : reader.GetString(reader.GetOrdinal("OBSERVACION")),
                Vigente = reader.IsDBNull(reader.GetOrdinal("VIGENTE")) ? 1 : reader.GetInt32(reader.GetOrdinal("VIGENTE"))
            };
        }
        
    }
}

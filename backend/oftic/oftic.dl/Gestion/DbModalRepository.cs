using Comun.Dtos.Modal;
using Datos.Interfaz;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Oracle.ManagedDataAccess.Client;
using System.Data;

namespace Datos.Gestion
{
    public class DbModalRepository : IDbModalRepository
    {
        private readonly string _cs;
        private readonly ILogger<DbModalRepository> _logger;

        public DbModalRepository(IConfiguration configuration, ILogger<DbModalRepository> logger)
        {
            _cs = configuration.GetConnectionString("DbCoest")!;
            _logger = logger;
        }

        public async Task<List<DtoModal>> GetAllAsync(CancellationToken ct)
        {
            var result = new List<DtoModal>();

            await using var conn = new OracleConnection(_cs);
            await conn.OpenAsync(ct);

            await using var cmd = conn.CreateCommand();
            cmd.CommandTimeout = 30;
            cmd.BindByName = true;
            cmd.CommandType = CommandType.StoredProcedure;
            cmd.CommandText = "PK_ADMINISTRACION.P_GET_ALL_MODAL";
            cmd.Parameters.Add("p_cursor", OracleDbType.RefCursor).Direction = ParameterDirection.Output;

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
                result.Add(MapModal(reader));

            return result;
        }

        public async Task<DtoModal?> GetByIdAsync(long id, CancellationToken ct)
        {
            await using var conn = new OracleConnection(_cs);
            await conn.OpenAsync(ct);

            await using var cmd = conn.CreateCommand();
            cmd.CommandTimeout = 30;
            cmd.BindByName = true;
            cmd.CommandType = CommandType.StoredProcedure;
            cmd.CommandText = "PK_ADMINISTRACION.P_GET_BY_ID_MODAL";
            cmd.Parameters.Add("p_id_modal", OracleDbType.Int64).Value = id;
            cmd.Parameters.Add("p_cursor", OracleDbType.RefCursor).Direction = ParameterDirection.Output;

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (await reader.ReadAsync(ct))
                return MapModal(reader);

            return null;
        }

        public async Task<List<DtoModalActivo>> GetActivosAsync(CancellationToken ct)
        {
            var result = new List<DtoModalActivo>();

            await using var conn = new OracleConnection(_cs);
            await conn.OpenAsync(ct);

            await using var cmd = conn.CreateCommand();
            cmd.CommandTimeout = 30;
            cmd.BindByName = true;
            cmd.CommandType = CommandType.StoredProcedure;
            cmd.CommandText = "PK_ADMINISTRACION.P_GET_MODALES_ACTIVOS";
            cmd.Parameters.Add("p_cursor", OracleDbType.RefCursor).Direction = ParameterDirection.Output;

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
                result.Add(MapModalActivo(reader));

            return result;
        }

        public async Task<DtoModalResult> CreateAsync(DtoModalRequest request, string usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        {
            var result = new DtoModalResult();

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
                cmd.CommandText = "PK_ADMINISTRACION.P_CREATE_MODAL";

                cmd.Parameters.Add("p_titulo",            OracleDbType.Varchar2, 300).Value  = Truncate(request.Titulo, 300);
                cmd.Parameters.Add("p_descripcion",       OracleDbType.Varchar2, 1000).Value = Truncate(request.Descripcion, 1000);
                cmd.Parameters.Add("p_tipo_recurso",      OracleDbType.Varchar2, 10).Value   = Truncate(request.TipoRecurso, 10);
                cmd.Parameters.Add("p_ruta_recurso",      OracleDbType.Varchar2, 500).Value  = Truncate(request.RutaRecurso, 500);
                cmd.Parameters.Add("p_tipo_accion",       OracleDbType.Varchar2, 20).Value   = Truncate(request.TipoAccion, 20);
                cmd.Parameters.Add("p_fecha_inicio",      OracleDbType.Date).Value            = request.FechaInicio;
                cmd.Parameters.Add("p_fecha_fin",         OracleDbType.Date).Value            = request.FechaFin;
                cmd.Parameters.Add("p_unidad",            OracleDbType.Varchar2, 100).Value  = Truncate(request.Unidad, 100);
                cmd.Parameters.Add("p_orden",             OracleDbType.Int32).Value           = request.Orden;
                cmd.Parameters.Add("p_usuario_creacion",  OracleDbType.Varchar2, 100).Value  = Truncate(usuarioAuditoria, 100);
                cmd.Parameters.Add("p_maquina_creacion",  OracleDbType.Varchar2, 100).Value  = Truncate(maquinaAuditoria, 100);

                var pSuccess = new OracleParameter("p_success", OracleDbType.Int32) { Direction = ParameterDirection.Output };
                var pMessage = new OracleParameter("p_message", OracleDbType.Varchar2) { Direction = ParameterDirection.Output, Size = 4000 };
                cmd.Parameters.Add(pSuccess);
                cmd.Parameters.Add(pMessage);

                await cmd.ExecuteNonQueryAsync(ct);

                var successVal = (Oracle.ManagedDataAccess.Types.OracleDecimal)pSuccess.Value;
                result.Success = !successVal.IsNull && (int)successVal == 1;
                result.Message = pMessage.Value?.ToString() ?? string.Empty;

                if (result.Success)
                    await transaction.CommitAsync(ct);
                else
                    await transaction.RollbackAsync(ct);
            }
            catch (OracleException ex)
            {
                await transaction.RollbackAsync(ct);
                result.Success = false;
                result.Message = $"Error Oracle: {ex.Message}";
                _logger.LogError(ex, "Error Oracle al crear modal - Code: {Code}", ex.Number);
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(ct);
                result.Success = false;
                result.Message = $"Error: {ex.Message}";
                _logger.LogError(ex, "Error al crear modal");
            }

            return result;
        }

        public async Task<DtoModalResult> UpdateAsync(long id, DtoModalRequest request, string usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        {
            var result = new DtoModalResult();

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
                cmd.CommandText = "PK_ADMINISTRACION.P_UPDATE_MODAL";

                cmd.Parameters.Add("p_id_modal",          OracleDbType.Int64).Value           = id;
                cmd.Parameters.Add("p_titulo",            OracleDbType.Varchar2, 300).Value   = Truncate(request.Titulo, 300);
                cmd.Parameters.Add("p_descripcion",       OracleDbType.Varchar2, 1000).Value  = Truncate(request.Descripcion, 1000);
                cmd.Parameters.Add("p_tipo_recurso",      OracleDbType.Varchar2, 10).Value    = Truncate(request.TipoRecurso, 10);
                cmd.Parameters.Add("p_ruta_recurso",      OracleDbType.Varchar2, 500).Value   = Truncate(request.RutaRecurso, 500);
                cmd.Parameters.Add("p_tipo_accion",       OracleDbType.Varchar2, 20).Value    = Truncate(request.TipoAccion, 20);
                cmd.Parameters.Add("p_fecha_inicio",      OracleDbType.Date).Value             = request.FechaInicio;
                cmd.Parameters.Add("p_fecha_fin",         OracleDbType.Date).Value             = request.FechaFin;
                cmd.Parameters.Add("p_unidad",            OracleDbType.Varchar2, 100).Value   = Truncate(request.Unidad, 100);
                cmd.Parameters.Add("p_orden",             OracleDbType.Int32).Value            = request.Orden;
                cmd.Parameters.Add("p_vigente",           OracleDbType.Int32).Value            = request.Vigente;
                cmd.Parameters.Add("p_usuario_modifica",  OracleDbType.Varchar2, 100).Value   = Truncate(usuarioAuditoria, 100);
                cmd.Parameters.Add("p_maquina_modifica",  OracleDbType.Varchar2, 100).Value   = Truncate(maquinaAuditoria, 100);

                var pSuccess = new OracleParameter("p_success", OracleDbType.Int32) { Direction = ParameterDirection.Output };
                var pMessage = new OracleParameter("p_message", OracleDbType.Varchar2) { Direction = ParameterDirection.Output, Size = 4000 };
                cmd.Parameters.Add(pSuccess);
                cmd.Parameters.Add(pMessage);

                await cmd.ExecuteNonQueryAsync(ct);

                var successVal = (Oracle.ManagedDataAccess.Types.OracleDecimal)pSuccess.Value;
                result.Success = !successVal.IsNull && (int)successVal == 1;
                result.Message = pMessage.Value?.ToString() ?? string.Empty;

                if (result.Success)
                    await transaction.CommitAsync(ct);
                else
                    await transaction.RollbackAsync(ct);
            }
            catch (OracleException ex)
            {
                await transaction.RollbackAsync(ct);
                result.Success = false;
                result.Message = $"Error Oracle: {ex.Message}";
                _logger.LogError(ex, "Error Oracle al actualizar modal ID={Id} - Code: {Code}", id, ex.Number);
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(ct);
                result.Success = false;
                result.Message = $"Error: {ex.Message}";
                _logger.LogError(ex, "Error al actualizar modal ID={Id}", id);
            }

            return result;
        }

        public async Task<DtoModalResult> DeleteLogicalAsync(long id, string usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        {
            var result = new DtoModalResult();

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
                cmd.CommandText = "PK_ADMINISTRACION.P_DELETE_LOGICAL_MODAL";

                cmd.Parameters.Add("p_id_modal",         OracleDbType.Int64).Value          = id;
                cmd.Parameters.Add("p_usuario_modifica", OracleDbType.Varchar2, 100).Value  = Truncate(usuarioAuditoria, 100);
                cmd.Parameters.Add("p_maquina_modifica", OracleDbType.Varchar2, 100).Value  = Truncate(maquinaAuditoria, 100);

                var pSuccess = new OracleParameter("p_success", OracleDbType.Int32) { Direction = ParameterDirection.Output };
                var pMessage = new OracleParameter("p_message", OracleDbType.Varchar2) { Direction = ParameterDirection.Output, Size = 4000 };
                cmd.Parameters.Add(pSuccess);
                cmd.Parameters.Add(pMessage);

                await cmd.ExecuteNonQueryAsync(ct);

                var successVal = (Oracle.ManagedDataAccess.Types.OracleDecimal)pSuccess.Value;
                result.Success = !successVal.IsNull && (int)successVal == 1;
                result.Message = pMessage.Value?.ToString() ?? string.Empty;

                if (result.Success)
                    await transaction.CommitAsync(ct);
                else
                    await transaction.RollbackAsync(ct);
            }
            catch (OracleException ex)
            {
                await transaction.RollbackAsync(ct);
                result.Success = false;
                result.Message = $"Error Oracle: {ex.Message}";
                _logger.LogError(ex, "Error Oracle al inactivar modal ID={Id}", id);
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(ct);
                result.Success = false;
                result.Message = $"Error: {ex.Message}";
                _logger.LogError(ex, "Error al inactivar modal ID={Id}", id);
            }

            return result;
        }

        public async Task<DtoModalResult> ToggleVigenteAsync(long id, int vigente, string usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        {
            var result = new DtoModalResult();

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
                cmd.CommandText = "PK_ADMINISTRACION.P_TOGGLE_VIGENTE_MODAL";

                cmd.Parameters.Add("p_id_modal",         OracleDbType.Int64).Value          = id;
                cmd.Parameters.Add("p_vigente",          OracleDbType.Int32).Value           = vigente;
                cmd.Parameters.Add("p_usuario_modifica", OracleDbType.Varchar2, 100).Value  = Truncate(usuarioAuditoria, 100);
                cmd.Parameters.Add("p_maquina_modifica", OracleDbType.Varchar2, 100).Value  = Truncate(maquinaAuditoria, 100);

                var pSuccess = new OracleParameter("p_success", OracleDbType.Int32) { Direction = ParameterDirection.Output };
                var pMessage = new OracleParameter("p_message", OracleDbType.Varchar2) { Direction = ParameterDirection.Output, Size = 4000 };
                cmd.Parameters.Add(pSuccess);
                cmd.Parameters.Add(pMessage);

                await cmd.ExecuteNonQueryAsync(ct);

                var successVal = (Oracle.ManagedDataAccess.Types.OracleDecimal)pSuccess.Value;
                result.Success = !successVal.IsNull && (int)successVal == 1;
                result.Message = pMessage.Value?.ToString() ?? string.Empty;

                if (result.Success)
                    await transaction.CommitAsync(ct);
                else
                    await transaction.RollbackAsync(ct);
            }
            catch (OracleException ex)
            {
                await transaction.RollbackAsync(ct);
                result.Success = false;
                result.Message = $"Error Oracle: {ex.Message}";
                _logger.LogError(ex, "Error Oracle al cambiar vigente modal ID={Id}", id);
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(ct);
                result.Success = false;
                result.Message = $"Error: {ex.Message}";
                _logger.LogError(ex, "Error al cambiar vigente modal ID={Id}", id);
            }

            return result;
        }

        public async Task<DtoModalResult> RegistrarInteraccionAsync(long idModal, string tipoAccion, string usuario, string maquina, CancellationToken ct)
        {
            var result = new DtoModalResult();

            await using var conn = new OracleConnection(_cs);
            await conn.OpenAsync(ct);

            try
            {
                await using var cmd = conn.CreateCommand();
                cmd.CommandTimeout = 30;
                cmd.BindByName = true;
                cmd.CommandType = CommandType.StoredProcedure;
                cmd.CommandText = "PK_ADMINISTRACION.P_REGISTRAR_INTERACCION";

                cmd.Parameters.Add("p_id_modal",    OracleDbType.Int64).Value          = idModal;
                cmd.Parameters.Add("p_tipo_accion", OracleDbType.Varchar2, 20).Value   = Truncate(tipoAccion, 20);
                cmd.Parameters.Add("p_usuario",     OracleDbType.Varchar2, 100).Value  = Truncate(usuario, 100);
                cmd.Parameters.Add("p_maquina",     OracleDbType.Varchar2, 100).Value  = Truncate(maquina, 100);

                var pSuccess = new OracleParameter("p_success", OracleDbType.Int32) { Direction = ParameterDirection.Output };
                var pMessage = new OracleParameter("p_message", OracleDbType.Varchar2) { Direction = ParameterDirection.Output, Size = 4000 };
                cmd.Parameters.Add(pSuccess);
                cmd.Parameters.Add(pMessage);

                await cmd.ExecuteNonQueryAsync(ct);

                var successVal = (Oracle.ManagedDataAccess.Types.OracleDecimal)pSuccess.Value;
                result.Success = !successVal.IsNull && (int)successVal == 1;
                result.Message = pMessage.Value?.ToString() ?? string.Empty;
            }
            catch (OracleException ex)
            {
                result.Success = false;
                result.Message = $"Error Oracle: {ex.Message}";
                _logger.LogError(ex, "Error Oracle al registrar interacción modal ID={Id}", idModal);
            }
            catch (Exception ex)
            {
                result.Success = false;
                result.Message = $"Error: {ex.Message}";
                _logger.LogError(ex, "Error al registrar interacción modal ID={Id}", idModal);
            }

            return result;
        }

        public async Task<List<DtoModalInteraccion>> GetInteraccionesAsync(long idModal, CancellationToken ct)
        {
            var result = new List<DtoModalInteraccion>();

            await using var conn = new OracleConnection(_cs);
            await conn.OpenAsync(ct);

            await using var cmd = conn.CreateCommand();
            cmd.CommandTimeout = 30;
            cmd.BindByName = true;
            cmd.CommandType = CommandType.StoredProcedure;
            cmd.CommandText = "PK_ADMINISTRACION.P_GET_INTERACCIONES_MODAL";
            cmd.Parameters.Add("p_id_modal", OracleDbType.Int64).Value = idModal;
            cmd.Parameters.Add("p_cursor", OracleDbType.RefCursor).Direction = ParameterDirection.Output;

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
                result.Add(MapInteraccion(reader));

            return result;
        }

        // -------------------------------------------------------
        // Mappers
        // -------------------------------------------------------

        private static DtoModal MapModal(OracleDataReader r)
        {
            return new DtoModal
            {
                IdModal          = GetLong(r, "ID_MODAL"),
                Titulo           = GetString(r, "TITULO"),
                Descripcion      = GetString(r, "DESCRIPCION"),
                TipoRecurso      = GetString(r, "TIPO_RECURSO"),
                RutaRecurso      = GetString(r, "RUTA_RECURSO"),
                TipoAccion       = GetString(r, "TIPO_ACCION"),
                FechaInicio      = GetDate(r, "FECHA_INICIO"),
                FechaFin         = GetDate(r, "FECHA_FIN"),
                Unidad           = GetString(r, "UNIDAD"),
                Orden            = GetInt(r, "ORDEN"),
                ConteoVistas     = GetLong(r, "CONTEO_VISTAS"),
                ConteoAceptados  = GetLong(r, "CONTEO_ACEPTADOS"),
                ConteoCerrados   = GetLong(r, "CONTEO_CERRADOS"),
                Vigente          = GetInt(r, "VIGENTE"),
                FechaCreacion    = GetDate(r, "FECHA_CREACION"),
                UsuarioCreacion  = GetString(r, "USUARIO_CREACION"),
                MaquinaCreacion  = GetString(r, "MAQUINA_CREACION"),
                FechaModifica    = GetDateNullable(r, "FECHA_MODIFICA"),
                UsuarioModifica  = GetString(r, "USUARIO_MODIFICA"),
                MaquinaModifica  = GetString(r, "MAQUINA_MODIFICA")
            };
        }

        private static DtoModalActivo MapModalActivo(OracleDataReader r)
        {
            return new DtoModalActivo
            {
                IdModal     = GetLong(r, "ID_MODAL"),
                Titulo      = GetString(r, "TITULO"),
                Descripcion = GetString(r, "DESCRIPCION"),
                TipoRecurso = GetString(r, "TIPO_RECURSO"),
                RutaRecurso = GetString(r, "RUTA_RECURSO"),
                TipoAccion  = GetString(r, "TIPO_ACCION"),
                FechaInicio = GetDate(r, "FECHA_INICIO"),
                FechaFin    = GetDate(r, "FECHA_FIN"),
                Unidad      = GetString(r, "UNIDAD"),
                Orden       = GetInt(r, "ORDEN")
            };
        }

        private static DtoModalInteraccion MapInteraccion(OracleDataReader r)
        {
            return new DtoModalInteraccion
            {
                IdInteraccion    = GetLong(r, "ID_INTERACCION"),
                IdModal          = GetLong(r, "ID_MODAL"),
                TipoAccion       = GetString(r, "TIPO_ACCION"),
                Usuario          = GetString(r, "USUARIO"),
                Maquina          = GetString(r, "MAQUINA"),
                FechaInteraccion = GetDate(r, "FECHA_INTERACCION")
            };
        }

        // -------------------------------------------------------
        // Helpers
        // -------------------------------------------------------

        private static string GetString(OracleDataReader r, string col)
        {
            var ord = r.GetOrdinal(col);
            return r.IsDBNull(ord) ? string.Empty : r.GetString(ord);
        }

        private static long GetLong(OracleDataReader r, string col)
        {
            var ord = r.GetOrdinal(col);
            return r.IsDBNull(ord) ? 0 : r.GetInt64(ord);
        }

        private static int GetInt(OracleDataReader r, string col)
        {
            var ord = r.GetOrdinal(col);
            return r.IsDBNull(ord) ? 0 : r.GetInt32(ord);
        }

        private static DateTime GetDate(OracleDataReader r, string col)
        {
            var ord = r.GetOrdinal(col);
            return r.IsDBNull(ord) ? DateTime.MinValue : r.GetDateTime(ord);
        }

        private static DateTime? GetDateNullable(OracleDataReader r, string col)
        {
            var ord = r.GetOrdinal(col);
            return r.IsDBNull(ord) ? null : r.GetDateTime(ord);
        }

        private static string Truncate(string? value, int maxLength)
        {
            if (string.IsNullOrEmpty(value)) return string.Empty;
            return value.Length > maxLength ? value[..maxLength] : value;
        }
    }
}

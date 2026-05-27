using Comun.Dtos.GestionDocumental;
using Datos.Interfaz.GestionDocumental;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Oracle.ManagedDataAccess.Client;
using Oracle.ManagedDataAccess.Types;
using System.Data;

namespace Datos.Gestion.GestionDocumental
{
    public class DbGestionCorreosRepository : IDbGestionCorreosRepository
    {
        private readonly string _cs;
        private readonly ILogger<DbGestionCorreosRepository> _logger;

        public DbGestionCorreosRepository(IConfiguration config, ILogger<DbGestionCorreosRepository> logger)
        {
            _cs = config.GetConnectionString("DbCoest") ?? "";
            _logger = logger;
        }

        public bool RegistrarEnvio(DtoEnvioCorreoRequest request, string radicado, string usuario, string maquina)
        {
            try
            {
                using (var connection = new OracleConnection(_cs))
                {
                    connection.Open();
                    using (var command = new OracleCommand("USR_COEST.PK_ADMINISTRACION.P_REGISTRAR_ENVIO_CORREO", connection))
                    {
                        command.CommandType = CommandType.StoredProcedure;
                        command.Parameters.Add("p_id_cuenta_email", OracleDbType.Int32).Value = request.IdCuentaEmail;
                        command.Parameters.Add("p_radicado", OracleDbType.Varchar2).Value = radicado;

                        // Combinar Para + CCO en un solo campo de destinatarios para el historial
                        var partes = new List<string>();
                        if (!string.IsNullOrWhiteSpace(request.Para)) partes.Add(request.Para.Trim());
                        if (!string.IsNullOrWhiteSpace(request.Cc))
                            partes.Add(request.Cc.Trim());
                        var destinatario = partes.Count > 0 ? string.Join("; ", partes) : "(sin destinatario)";

                        command.Parameters.Add("p_para", OracleDbType.Varchar2).Value = destinatario;
                        command.Parameters.Add("p_asunto", OracleDbType.Varchar2).Value = request.Asunto;
                        command.Parameters.Add("p_cuerpo", OracleDbType.Clob).Value = request.Cuerpo;
                        command.Parameters.Add("p_id_clasificacion", OracleDbType.Int32).Value = request.IdClasificacion;
                        command.Parameters.Add("p_usuario", OracleDbType.Varchar2).Value = usuario;
                        command.Parameters.Add("p_maquina", OracleDbType.Varchar2).Value = maquina;
                        command.Parameters.Add("p_resultado", OracleDbType.Int32).Direction = ParameterDirection.Output;

                        command.ExecuteNonQuery();
                        
                        var res = GetOutputInt(command.Parameters["p_resultado"]);
                        return res >= 0;
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al registrar envío de correo en DB");
                return false;
            }
        }

        public List<DtoHistoricoCorreo> ConsultarHistorico()
        {
            var lista = new List<DtoHistoricoCorreo>();
            try
            {
                using (var connection = new OracleConnection(_cs))
                {
                    connection.Open();
                    using (var command = new OracleCommand("USR_COEST.PK_ADMINISTRACION.P_CONSULTAR_CORREOS_ENVIADOS", connection))
                    {
                        command.CommandType = CommandType.StoredProcedure;
                        command.Parameters.Add("p_cursor", OracleDbType.RefCursor).Direction = ParameterDirection.Output;

                        using (var reader = command.ExecuteReader())
                        {
                            while (reader.Read())
                            {
                                lista.Add(new DtoHistoricoCorreo
                                {
                                    IdEnvio = reader["ID_ENVIO"] != DBNull.Value ? Convert.ToInt64(reader["ID_ENVIO"]) : 0,
                                    Radicado = reader["RADICADO"]?.ToString() ?? "",
                                    Destinatario = reader["DESTINATARIO"]?.ToString() ?? "",
                                    Asunto = reader["ASUNTO"]?.ToString() ?? "",
                                    Cuerpo = reader["CUERPO"] != DBNull.Value ? reader["CUERPO"].ToString() ?? "" : "",
                                    Fecha = reader["FECHA"] != DBNull.Value ? Convert.ToDateTime(reader["FECHA"]) : DateTime.Now,
                                    DeEmail = reader["DE_EMAIL"]?.ToString() ?? "",
                                    NombreCuenta = reader["NOMBRE_CUENTA"]?.ToString() ?? "",
                                    Clasificacion = reader["CLASIFICACION"]?.ToString() ?? "",
                                    Username = reader["USERNAME"]?.ToString() ?? "",
                                    NombreCompleto = reader["NOMBRE_COMPLETO"]?.ToString() ?? ""
                                });
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al consultar histórico de correos");
            }
            return lista;
        }

        private int GetOutputInt(OracleParameter param)
        {
            if (param.Value == null || param.Value == DBNull.Value) return 0;
            if (param.Value is OracleDecimal od)
                return od.IsNull ? 0 : (int)od.Value;
            return Convert.ToInt32(param.Value);
        }
    }
}

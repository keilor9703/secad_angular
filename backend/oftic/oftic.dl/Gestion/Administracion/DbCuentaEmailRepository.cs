using Comun.Dtos.Administracion;
using Datos.Interfaz;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Oracle.ManagedDataAccess.Client;
using Oracle.ManagedDataAccess.Types;
using System.Data;

namespace Datos.Gestion
{
    public class DbCuentaEmailRepository : IDbCuentaEmailRepository
    {
        private readonly string _cs;
        private readonly ILogger<DbCuentaEmailRepository> _logger;

        public DbCuentaEmailRepository(IConfiguration configuration, ILogger<DbCuentaEmailRepository> logger)
        {
            _cs = configuration.GetConnectionString("DbCoest")!;
            _logger = logger;
        }

        public List<DtoCuentaEmail> ConsultarCuentas(int idCuenta)
        {
            var lista = new List<DtoCuentaEmail>();
            try
            {
                using (var connection = new OracleConnection(_cs))
                {
                    connection.Open();
                    using (var command = new OracleCommand("USR_COEST.PK_ADMINISTRACION.PR_CONSULTAR_CUENTAS_EMAIL", connection))
                    {
                        command.CommandType = CommandType.StoredProcedure;
                        command.Parameters.Add("P_ID_CUENTA", OracleDbType.Int32).Value = idCuenta;
                        command.Parameters.Add("P_RESULTADO", OracleDbType.RefCursor).Direction = ParameterDirection.Output;

                        using (var reader = command.ExecuteReader())
                        {
                            while (reader.Read())
                            {
                                lista.Add(new DtoCuentaEmail
                                {
                                    IdCuenta = GetInt(reader, "ID_CUENTA"),
                                    IdDominioGrupo = GetInt(reader, "ID_DOMINIO_GRUPO"),
                                    NombreCuenta = GetString(reader, "NOMBRE_CUENTA"),
                                    Email = GetString(reader, "EMAIL"),
                                    ServidorSmtp = GetString(reader, "SERVIDOR_SMTP"),
                                    Puerto = GetInt(reader, "PUERTO"),
                                    UsuarioSmtp = GetString(reader, "USUARIO_SMTP"),
                                    ClaveSmtp = GetString(reader, "CLAVE_SMTP"),
                                    UsarSsl = GetInt(reader, "USAR_SSL"),
                                    Vigente = GetInt(reader, "VIGENTE"),
                                    NombreGrupo = GetString(reader, "NOMBRE_GRUPO"),
                                    FirmaHtml = GetString(reader, "FIRMA_HTML"),
                                    ImagenEncabezado = GetString(reader, "IMAGEN_ENCABEZADO")
                                });
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al consultar cuentas de email");
                throw;
            }
            return lista;
        }

        public bool GestionarCuenta(DtoCuentaEmailRequest request)
        {
            try
            {
                using (var connection = new OracleConnection(_cs))
                {
                    connection.Open();
                    using (var command = new OracleCommand("USR_COEST.PK_ADMINISTRACION.PR_GESTIONAR_CUENTA_EMAIL", connection))
                    {
                        command.CommandType = CommandType.StoredProcedure;
                        command.BindByName = true;

                        command.Parameters.Add("P_ID_CUENTA", OracleDbType.Int32).Value = request.IdCuenta;
                        command.Parameters.Add("P_ID_DOMINIO_GRUPO", OracleDbType.Int32).Value = request.IdDominioGrupo;
                        command.Parameters.Add("P_NOMBRE_CUENTA", OracleDbType.Varchar2).Value = request.NombreCuenta;
                        command.Parameters.Add("P_EMAIL", OracleDbType.Varchar2).Value = request.Email;
                        command.Parameters.Add("P_SERVIDOR_SMTP", OracleDbType.Varchar2).Value = request.ServidorSmtp;
                        command.Parameters.Add("P_PUERTO", OracleDbType.Int32).Value = request.Puerto;
                        command.Parameters.Add("P_USUARIO_SMTP", OracleDbType.Varchar2).Value = request.UsuarioSmtp;
                        command.Parameters.Add("P_CLAVE_SMTP", OracleDbType.Varchar2).Value = request.ClaveSmtp;
                        command.Parameters.Add("P_USAR_SSL", OracleDbType.Int32).Value = request.UsarSsl;
                        command.Parameters.Add("P_VIGENTE", OracleDbType.Int32).Value = request.Vigente;
                        command.Parameters.Add("P_USUARIO_AUD", OracleDbType.Varchar2).Value = request.UsuarioAuditoria;
                        command.Parameters.Add("P_IP_AUD", OracleDbType.Varchar2).Value = request.IpAuditoria;
                        command.Parameters.Add("P_FIRMA_HTML", OracleDbType.Clob).Value = request.FirmaHtml;
                        command.Parameters.Add("P_IMAGEN_ENCABEZADO", OracleDbType.Varchar2).Value = (object?)request.ImagenEncabezado ?? DBNull.Value;
                        command.Parameters.Add("P_ID_OUT", OracleDbType.Int32).Direction = ParameterDirection.Output;

                        command.ExecuteNonQuery();
                        return true;
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al gestionar cuenta de email");
                throw;
            }
        }

        public bool EliminarCuenta(int idCuenta)
        {
            try
            {
                using (var connection = new OracleConnection(_cs))
                {
                    connection.Open();
                    using (var command = new OracleCommand("USR_COEST.PK_ADMINISTRACION.PR_ELIMINAR_CUENTA_EMAIL", connection))
                    {
                        command.CommandType = CommandType.StoredProcedure;
                        command.Parameters.Add("P_ID_CUENTA", OracleDbType.Int32).Value = idCuenta;

                        command.ExecuteNonQuery();
                        return true;
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al eliminar cuenta de email");
                throw;
            }
        }

        public List<DtoCuentaEmail> ConsultarCuentasPorUsuario(int idUsuario)
        {
            var lista = new List<DtoCuentaEmail>();
            try
            {
                using var connection = new OracleConnection(_cs);
                connection.Open();
                using var command = new OracleCommand("USR_COEST.PK_ADMINISTRACION_CORREOS.PA_CE_CUENTAS_X_USUARIO", connection);
                command.CommandType = CommandType.StoredProcedure;
                command.Parameters.Add("P_ID_USUARIO", OracleDbType.Int32).Value = idUsuario;
                command.Parameters.Add("P_CURSOR", OracleDbType.RefCursor).Direction = ParameterDirection.Output;

                using var reader = command.ExecuteReader();
                while (reader.Read())
                {
                    lista.Add(new DtoCuentaEmail
                    {
                        IdCuenta = GetInt(reader, "ID_CUENTA"),
                        NombreCuenta = GetString(reader, "NOMBRE_CUENTA"),
                        Email = GetString(reader, "EMAIL"),
                        Vigente = 1
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al consultar cuentas autorizadas por usuario {IdUsuario}", idUsuario);
                throw;
            }

            return lista;
        }

        public List<DtoCuentaEmailUsuario> ConsultarAutorizaciones(int? idCuenta, int? idUsuario, int? vigente)
        {
            var lista = new List<DtoCuentaEmailUsuario>();
            try
            {
                using var connection = new OracleConnection(_cs);
                connection.Open();
                using var command = new OracleCommand("USR_COEST.PK_ADMINISTRACION_CORREOS.PA_CE_USUARIO_CONSULTAR", connection);
                command.CommandType = CommandType.StoredProcedure;
                command.BindByName = true;
                command.Parameters.Add("P_ID_CUENTA", OracleDbType.Int32).Value = (object?)idCuenta ?? DBNull.Value;
                command.Parameters.Add("P_ID_USUARIO", OracleDbType.Int32).Value = (object?)idUsuario ?? DBNull.Value;
                command.Parameters.Add("P_VIGENTE", OracleDbType.Int32).Value = (object?)vigente ?? DBNull.Value;
                command.Parameters.Add("P_CURSOR", OracleDbType.RefCursor).Direction = ParameterDirection.Output;

                using var reader = command.ExecuteReader();
                while (reader.Read())
                {
                    lista.Add(new DtoCuentaEmailUsuario
                    {
                        IdCuentaUsuario = GetInt(reader, "ID_CUENTA_USUARIO"),
                        IdCuenta = GetInt(reader, "ID_CUENTA"),
                        NombreCuenta = GetString(reader, "NOMBRE_CUENTA"),
                        Email = GetString(reader, "EMAIL"),
                        IdUsuario = GetInt(reader, "ID_USUARIO"),
                        UsuarioLogin = GetString(reader, "USUARIO_LOGIN"),
                        NombreCompleto = GetString(reader, "NOMBRE_COMPLETO"),
                        Identificacion = GetString(reader, "IDENTIFICACION"),
                        Vigente = GetInt(reader, "VIGENTE"),
                        UsuarioCrea = GetString(reader, "USUARIO_CREA"),
                        FechaCrea = GetDateTime(reader, "FECHA_CREA"),
                        UsuarioModifica = GetString(reader, "USUARIO_MODIFICA"),
                        FechaModifica = GetDateTime(reader, "FECHA_MODIFICA"),
                        IpRegistro = GetString(reader, "IP_REGISTRO")
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al consultar autorizaciones de cuenta-email por usuario");
                throw;
            }

            return lista;
        }

        public bool GuardarAutorizacion(DtoCuentaEmailUsuarioRequest request)
        {
            try
            {
                using var connection = new OracleConnection(_cs);
                connection.Open();
                using var command = new OracleCommand("USR_COEST.PK_ADMINISTRACION_CORREOS.PA_CE_USUARIO_GUARDAR", connection);
                command.CommandType = CommandType.StoredProcedure;
                command.BindByName = true;

                command.Parameters.Add("P_ID_CUENTA", OracleDbType.Int32).Value = request.IdCuenta;
                command.Parameters.Add("P_ID_USUARIO", OracleDbType.Int32).Value = request.IdUsuario;
                command.Parameters.Add("P_USUARIO_CREA", OracleDbType.Varchar2).Value = request.UsuarioAuditoria ?? "SISTEMA";
                command.Parameters.Add("P_IP_REGISTRO", OracleDbType.Varchar2).Value = request.IpAuditoria ?? "127.0.0.1";
                var output = command.Parameters.Add("P_RESULTADO", OracleDbType.Int32);
                output.Direction = ParameterDirection.Output;

                command.ExecuteNonQuery();
                return GetOutputInt(output) > 0;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al guardar autorización de cuenta-email por usuario");
                throw;
            }
        }

        public bool ActualizarAutorizacion(DtoCuentaEmailUsuarioEstadoRequest request)
        {
            try
            {
                using var connection = new OracleConnection(_cs);
                connection.Open();
                using var command = new OracleCommand("USR_COEST.PK_ADMINISTRACION_CORREOS.PA_CE_USUARIO_ACTUALIZAR", connection);
                command.CommandType = CommandType.StoredProcedure;
                command.BindByName = true;

                command.Parameters.Add("P_ID_CUENTA_USUARIO", OracleDbType.Int32).Value = request.IdCuentaUsuario;
                command.Parameters.Add("P_VIGENTE", OracleDbType.Int32).Value = request.Vigente;
                command.Parameters.Add("P_USUARIO_MODIFICA", OracleDbType.Varchar2).Value = request.UsuarioAuditoria ?? "SISTEMA";
                command.Parameters.Add("P_IP_REGISTRO", OracleDbType.Varchar2).Value = request.IpAuditoria ?? "127.0.0.1";
                var output = command.Parameters.Add("P_RESULTADO", OracleDbType.Int32);
                output.Direction = ParameterDirection.Output;

                command.ExecuteNonQuery();
                return GetOutputInt(output) > 0;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al actualizar autorización de cuenta-email por usuario");
                throw;
            }
        }

        public bool EliminarAutorizacion(DtoCuentaEmailUsuarioEstadoRequest request)
        {
            try
            {
                using var connection = new OracleConnection(_cs);
                connection.Open();
                using var command = new OracleCommand("USR_COEST.PK_ADMINISTRACION_CORREOS.PA_CE_USUARIO_ELIMINAR", connection);
                command.CommandType = CommandType.StoredProcedure;
                command.BindByName = true;

                command.Parameters.Add("P_ID_CUENTA_USUARIO", OracleDbType.Int32).Value = request.IdCuentaUsuario;
                command.Parameters.Add("P_USUARIO_MODIFICA", OracleDbType.Varchar2).Value = request.UsuarioAuditoria ?? "SISTEMA";
                command.Parameters.Add("P_IP_REGISTRO", OracleDbType.Varchar2).Value = request.IpAuditoria ?? "127.0.0.1";
                var output = command.Parameters.Add("P_RESULTADO", OracleDbType.Int32);
                output.Direction = ParameterDirection.Output;

                command.ExecuteNonQuery();
                return GetOutputInt(output) > 0;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al eliminar autorización de cuenta-email por usuario");
                throw;
            }
        }

        public bool ValidarAutorizacionEnvio(int idCuenta, int idUsuario)
        {
            try
            {
                using var connection = new OracleConnection(_cs);
                connection.Open();
                using var command = new OracleCommand("USR_COEST.PK_ADMINISTRACION_CORREOS.PA_CE_USUARIO_VALIDAR_ENVIO", connection);
                command.CommandType = CommandType.StoredProcedure;
                command.BindByName = true;

                command.Parameters.Add("P_ID_CUENTA", OracleDbType.Int32).Value = idCuenta;
                command.Parameters.Add("P_ID_USUARIO", OracleDbType.Int32).Value = idUsuario;
                var output = command.Parameters.Add("P_AUTORIZADO", OracleDbType.Int32);
                output.Direction = ParameterDirection.Output;

                command.ExecuteNonQuery();
                return GetOutputInt(output) == 1;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error validando autorización de envío para cuenta {IdCuenta}, usuario {IdUsuario}", idCuenta, idUsuario);
                throw;
            }
        }

        public string GetNextRadicado(int idCuentaEmail)
        {
            try
            {
                using (var connection = new OracleConnection(_cs))
                {
                    connection.Open();
                    using (var command = new OracleCommand("USR_COEST.PK_ADMINISTRACION.P_GENERAR_RADICADO_CORREO", connection))
                    {
                        command.CommandType = CommandType.StoredProcedure;
                        command.Parameters.Add("p_id_cuenta_email", OracleDbType.Int32).Value = idCuentaEmail;
                        command.Parameters.Add("p_radicado", OracleDbType.Varchar2, 200).Direction = ParameterDirection.Output;

                        command.ExecuteNonQuery();
                        return command.Parameters["p_radicado"].Value.ToString() ?? string.Empty;
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al generar radicado para cuenta {Id}", idCuentaEmail);
                throw;
            }
        }

        public string GetSiglaSistema()
        {
            try
            {
                using (var connection = new OracleConnection(_cs))
                {
                    connection.Open();
                    using (var command = new OracleCommand("SELECT SIGLA FROM CTR_BRANDING WHERE ROWNUM = 1", connection))
                    {
                        var result = command.ExecuteScalar();
                        return result?.ToString() ?? "SICOE";
                    }
                }
            }
            catch
            {
                return "SICOE";
            }
        }

        // Métodos de Ayuda (Helper Methods)
        private static string GetString(OracleDataReader reader, string column)
        {
            var index = GetOrdinalSafe(reader, column);
            if (index < 0 || reader.IsDBNull(index)) return string.Empty;
            
            return reader.GetValue(index).ToString() ?? string.Empty;
        }

        private static int GetInt(OracleDataReader reader, string column, int defaultValue = 0)
        {
            var index = GetOrdinalSafe(reader, column);
            if (index < 0 || reader.IsDBNull(index)) return defaultValue;
            var value = reader.GetValue(index);
            return value switch
            {
                int i => i,
                long l => Convert.ToInt32(l),
                decimal d => Convert.ToInt32(d),
                OracleDecimal od when !od.IsNull => od.ToInt32(),
                _ => int.TryParse(value.ToString(), out var parsed) ? parsed : defaultValue
            };
        }

        private static int GetOrdinalSafe(OracleDataReader reader, string column)
        {
            try { return reader.GetOrdinal(column); }
            catch { return -1; }
        }

        private static DateTime? GetDateTime(OracleDataReader reader, string column)
        {
            var index = GetOrdinalSafe(reader, column);
            if (index < 0 || reader.IsDBNull(index)) return null;
            var value = reader.GetValue(index);
            return value switch
            {
                DateTime dt => dt,
                OracleDate od when !od.IsNull => od.Value,
                _ => DateTime.TryParse(value.ToString(), out var parsed) ? parsed : null
            };
        }

        private static int GetOutputInt(OracleParameter param)
        {
            if (param.Value == null || param.Value == DBNull.Value) return 0;
            
            string? sVal = param.Value.ToString();
            if (int.TryParse(sVal, out int result))
            {
                return result;
            }

            try 
            {
                return Convert.ToInt32(param.Value);
            }
            catch 
            {
                return 0;
            }
        }
    }
}

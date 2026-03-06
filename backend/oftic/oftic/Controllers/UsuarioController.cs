using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Comun.Dtos;
using Datos.Interfaz;
using Servicios.ApiInterfaz;
using System.Security.Claims;

namespace ofic.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class UsuarioController : ControllerBase
    {
        private readonly IApiWebToken _apiWebToken;
        private readonly IDbUsuarioRepository _dbUsuarioRepository;
        private readonly ILogger<UsuarioController> _logger;
        private readonly IConfiguration _configuration;

        public UsuarioController(
            IApiWebToken apiWebToken,
            IDbUsuarioRepository dbUsuarioRepository,
            ILogger<UsuarioController> logger,
            IConfiguration configuration)
        {
            _apiWebToken = apiWebToken;
            _dbUsuarioRepository = dbUsuarioRepository;
            _logger = logger;
            _configuration = configuration;
        }

        private async Task<string> GetTechnicalTokenAsync(CancellationToken ct)
        {
            try
            {
                var tokenResp = await _apiWebToken.ObtenerTokenPipAsync(ct);
                if (tokenResp is not null && tokenResp.Estado && !string.IsNullOrWhiteSpace(tokenResp.Respuesta))
                {
                    return tokenResp.Respuesta!;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Falló ObtenerTokenPipAsync; se intentará fallback con PostPipToken.");
            }

            // Fallback robusto: usa credenciales técnicas de appsettings contra PostPipToken.
            var usuarioPip = _configuration["ApiSettings:UsuarioPip"] ?? string.Empty;
            var clavePip = _configuration["ApiSettings:ClavePip"] ?? string.Empty;
            if (string.IsNullOrWhiteSpace(usuarioPip) || string.IsNullOrWhiteSpace(clavePip))
            {
                _logger.LogWarning("ApiSettings:UsuarioPip/ClavePip no configurados.");
                return string.Empty;
            }

            try
            {
                return await _apiWebToken.GetTokenAsync(usuarioPip, clavePip);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Falló fallback GetTokenAsync con credenciales técnicas.");
            }

            return string.Empty;
        }

        [HttpGet("Funcionario")]
        public async Task<IActionResult> GetFuncionario([FromQuery] string identificacion)
        {
            try
            {
                if (string.IsNullOrEmpty(identificacion))
                {
                    return BadRequest(new { message = "Identificación requerida" });
                }

                // Obtener token técnico de API externa configurado en ApiSettings.
                var tokenPip = await GetTechnicalTokenAsync(HttpContext.RequestAborted);
                
                if (string.IsNullOrEmpty(tokenPip))
                {
                    return Unauthorized(new { message = "No se pudo obtener token de la API" });
                }

                // Consultar empleado
                var empleado = await _apiWebToken.GetFuncionarioAsync(tokenPip, identificacion);

                if (empleado is null)
                {
                    return NotFound(new { message = "No se encontró información del funcionario." });
                }

                // Validar situación laboral
                var situacionLaboral = (empleado.situacionLaboral ?? string.Empty).Trim().ToUpperInvariant();
                if (situacionLaboral != "LABORANDO")
                {
                    return BadRequest(new { 
                        success = false, 
                        message = $"Usuario no está en situación laboral 'Laborando'. Situación actual: '{empleado.situacionLaboral ?? "No reportada"}'" 
                    });
                }

                // Persistir automáticamente en DB local si no existe.
                // No debe romper la consulta principal si falla la persistencia local.
                if (empleado is not null)
                {
                    try
                    {
                        await _dbUsuarioRepository.EnsureUsuarioExistsAsync(empleado, HttpContext.RequestAborted);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(
                            ex,
                            "No se pudo persistir el usuario local para identificacion={Identificacion}, usuario={Usuario}",
                            empleado.identificacion,
                            empleado.usuario);
                    }
                }

                // Si el usuario existe en BD local, reflejar estado real (bloqueado/activo).
                if (empleado is not null)
                {
                    try
                    {
                        var activoDb = await _dbUsuarioRepository.GetActivoByIdentificacionOrUsernameAsync(
                            empleado.identificacion,
                            empleado.usuario,
                            HttpContext.RequestAborted);
                        if (activoDb.HasValue)
                        {
                            empleado.activo = activoDb.Value;
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "No se pudo resolver estado local de usuario. identificacion={Identificacion}, usuario={Usuario}",
                            empleado.identificacion, empleado.usuario);
                    }
                }

                return Ok(empleado);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error consultando empleado");
                return StatusCode(500, new { message = "Error al consultar empleado" });
            }
        }

        [HttpGet("Foto")]
        public async Task<IActionResult> GetFoto([FromQuery] string identificacion)
        {
            try
            {
                if (string.IsNullOrEmpty(identificacion))
                {
                    return BadRequest(new { message = "Identificación requerida" });
                }

                var tokenPip = await GetTechnicalTokenAsync(HttpContext.RequestAborted);
                
                if (string.IsNullOrEmpty(tokenPip))
                {
                    return Unauthorized(new { message = "No se pudo obtener token de la API" });
                }

                var fotoBase64 = await _apiWebToken.GetFotoFuncionarioAsync(tokenPip, identificacion);

                return Ok(fotoBase64);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error consultando foto");
                return StatusCode(500, new { message = "Error al consultar foto" });
            }
        }

        [HttpGet("MiFoto")]
        public async Task<IActionResult> GetMiFoto()
        {
            try
            {
                var username =
                    User?.Identity?.Name
                    ?? User?.FindFirstValue(ClaimTypes.Name)
                    ?? User?.FindFirstValue("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name");

                if (string.IsNullOrWhiteSpace(username))
                {
                    return BadRequest(new { message = "No se pudo resolver el usuario autenticado." });
                }

                var identificacion = await _dbUsuarioRepository.GetIdentificacionByUsernameAsync(
                    username.Trim(),
                    HttpContext.RequestAborted);

                if (string.IsNullOrWhiteSpace(identificacion))
                {
                    return NotFound(new { message = "No se encontró identificación para el usuario autenticado." });
                }

                var tokenPip = await GetTechnicalTokenAsync(HttpContext.RequestAborted);
                if (string.IsNullOrEmpty(tokenPip))
                {
                    return Unauthorized(new { message = "No se pudo obtener token de la API" });
                }

                var fotoBase64 = await _apiWebToken.GetFotoFuncionarioAsync(tokenPip, identificacion.Trim());
                return Ok(fotoBase64);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error consultando foto del usuario autenticado");
                return StatusCode(500, new { message = "Error al consultar foto del usuario autenticado" });
            }
        }

        [HttpGet("MiPerfil")]
        public async Task<IActionResult> GetMiPerfil()
        {
            try
            {
                var username =
                    User?.Identity?.Name
                    ?? User?.FindFirstValue(ClaimTypes.Name)
                    ?? User?.FindFirstValue("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name");

                if (string.IsNullOrWhiteSpace(username))
                {
                    return BadRequest(new { message = "No se pudo resolver el usuario autenticado." });
                }

                var identificacion = await _dbUsuarioRepository.GetIdentificacionByUsernameAsync(
                    username.Trim(),
                    HttpContext.RequestAborted);

                if (string.IsNullOrWhiteSpace(identificacion))
                {
                    return NotFound(new { message = "No se encontró identificación para el usuario autenticado." });
                }

                var tokenPip = await GetTechnicalTokenAsync(HttpContext.RequestAborted);
                if (string.IsNullOrEmpty(tokenPip))
                {
                    return Unauthorized(new { message = "No se pudo obtener token de la API" });
                }

                var empleado = await _apiWebToken.GetFuncionarioAsync(tokenPip, identificacion.Trim());
                if (empleado is null)
                {
                    return NotFound(new { message = "No se encontró información de perfil." });
                }

                var nombreCompleto = $"{(empleado.nombres ?? string.Empty).Trim()} {(empleado.apellidos ?? string.Empty).Trim()}".Trim();

                return Ok(new
                {
                    identificacion = (empleado.identificacion ?? identificacion).Trim(),
                    grado = (empleado.nombreGrado ?? string.Empty).Trim(),
                    nombreCompleto,
                    cargo = (empleado.cargo ?? string.Empty).Trim(),
                    situacionLaboral = (empleado.situacionLaboral ?? string.Empty).Trim(),
                    tiempoServicio = (empleado.tiempoServicio ?? string.Empty).Trim()
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error consultando perfil del usuario autenticado");
                return StatusCode(500, new { message = "Error al consultar perfil del usuario autenticado" });
            }
        }

        [HttpGet("Roles")]
        public async Task<IActionResult> GetRoles()
        {
            try
            {
                var roles = await _dbUsuarioRepository.GetRolesAsync(HttpContext.RequestAborted);
                return Ok(roles);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error consultando catálogo de roles");
                return StatusCode(500, new { message = "Error al consultar roles" });
            }
        }

        [HttpGet("RolesAsignados")]
        public async Task<IActionResult> GetRolesAsignados([FromQuery] string usuario)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(usuario))
                {
                    return BadRequest(new { message = "Usuario requerido" });
                }

                var roles = await _dbUsuarioRepository.GetRolesAsignadosAsync(usuario.Trim(), HttpContext.RequestAborted);
                return Ok(roles);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error consultando roles asignados para usuario {Usuario}", usuario);
                return StatusCode(500, new { message = "Error al consultar roles asignados" });
            }
        }

        [HttpPost]
        public async Task<IActionResult> SaveUsuario([FromBody] DtoUsuarioRequest request)
        {
            try
            {
                if (request is null || string.IsNullOrWhiteSpace(request.identificacion))
                {
                    return BadRequest(new { success = false, message = "Identificación requerida" });
                }

                var usuarioAuditoria = await ResolveUsuarioAuditoriaAsync(
                    User,
                    request.identificacion,
                    HttpContext.RequestAborted);

                var maquinaAuditoria =
                    HttpContext.Connection.RemoteIpAddress?.ToString()
                    ?? Environment.MachineName
                    ?? "N/A";

                var result = await _dbUsuarioRepository.SaveUsuarioAsync(
                    request,
                    usuarioAuditoria,
                    maquinaAuditoria,
                    HttpContext.RequestAborted);

                if (result.idUsuario <= 0)
                {
                    return BadRequest(new
                    {
                        success = false,
                        idUsuario = result.idUsuario,
                        message = string.IsNullOrWhiteSpace(result.message)
                            ? "No fue posible guardar el usuario."
                            : result.message
                    });
                }

                return Ok(new
                {
                    success = true,
                    idUsuario = result.idUsuario,
                    message = string.IsNullOrWhiteSpace(result.message)
                        ? "Usuario guardado correctamente."
                        : result.message
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error guardando usuario");
                return StatusCode(500, new
                {
                    success = false,
                    message = "Error al guardar usuario",
                    detail = ex.Message
                });
            }
        }

        private async Task<string> ResolveUsuarioAuditoriaAsync(
            ClaimsPrincipal? user,
            string? identificacionRequest,
            CancellationToken ct)
        {
            // Requisito funcional: auditar con cédula (no id interno).
            var cedula =
                user?.Claims?.FirstOrDefault(c =>
                    c.Type == "identificacion" ||
                    c.Type == "cedula" ||
                    c.Type == "numeroDocumento" ||
                    c.Type == "documento")?.Value;

            if (!string.IsNullOrWhiteSpace(cedula))
            {
                return cedula.Trim();
            }

            // Si no viene cédula como claim, resolver por username del JWT en CTR_USUARIOS.
            var username =
                user?.Identity?.Name
                ?? user?.Claims?.FirstOrDefault(c =>
                    c.Type == ClaimTypes.Name ||
                    c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name")?.Value;

            if (!string.IsNullOrWhiteSpace(username))
            {
                try
                {
                    var cedulaDb = await _dbUsuarioRepository.GetIdentificacionByUsernameAsync(username.Trim(), ct);
                    if (!string.IsNullOrWhiteSpace(cedulaDb))
                    {
                        return cedulaDb.Trim();
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "No se pudo resolver cédula del usuario logueado desde DB. username={Username}", username);
                }
            }

            // Fallback final: identificación del usuario objetivo.
            if (!string.IsNullOrWhiteSpace(identificacionRequest))
            {
                return identificacionRequest.Trim();
            }

            return "N/A";
        }

        [HttpPost("Roles")]
        public async Task<IActionResult> AsignarRol([FromBody] DtoAsignarRolRequest request)
        {
            try
            {
                if (request is null || request.rolId <= 0)
                {
                    return BadRequest(new { success = false, message = "Rol requerido" });
                }

                if (string.IsNullOrWhiteSpace(request.justificacion))
                {
                    return BadRequest(new { success = false, message = "Justificación requerida" });
                }

                if (string.IsNullOrWhiteSpace(request.fechaFin))
                {
                    return BadRequest(new { success = false, message = "Fecha fin requerida" });
                }

                if (!DateTime.TryParse(request.fechaFin, out var fechaFin))
                {
                    return BadRequest(new { success = false, message = "Fecha fin inválida" });
                }

                request.fechaFin = fechaFin.ToString("yyyy-MM-dd");

                long idUsuario = request.usuarioId;
                if (idUsuario <= 0 && !string.IsNullOrWhiteSpace(request.identificacion))
                {
                    var idByDoc = await _dbUsuarioRepository.GetUsuarioIdByIdentificacionAsync(
                        request.identificacion.Trim(),
                        HttpContext.RequestAborted);
                    if (idByDoc.HasValue)
                    {
                        idUsuario = idByDoc.Value;
                    }
                }

                if (idUsuario <= 0 && !string.IsNullOrWhiteSpace(request.usuario))
                {
                    var idByUser = await _dbUsuarioRepository.GetUsuarioIdByUsernameAsync(
                        request.usuario.Trim(),
                        HttpContext.RequestAborted);
                    if (idByUser.HasValue)
                    {
                        idUsuario = idByUser.Value;
                    }
                }

                if (idUsuario <= 0)
                {
                    return BadRequest(new { success = false, message = "No se encontró el usuario para asignar el rol." });
                }

                var usuarioAuditoria = await ResolveUsuarioAuditoriaAsync(
                    User,
                    request.identificacion,
                    HttpContext.RequestAborted);

                var maquinaAuditoria =
                    HttpContext.Connection.RemoteIpAddress?.ToString()
                    ?? Environment.MachineName
                    ?? "N/A";

                var result = await _dbUsuarioRepository.AsignarRolAsync(
                    idUsuario,
                    request,
                    usuarioAuditoria,
                    maquinaAuditoria,
                    HttpContext.RequestAborted);

                if (result.idUsuario <= 0)
                {
                    return BadRequest(new
                    {
                        success = false,
                        message = string.IsNullOrWhiteSpace(result.message)
                            ? "No fue posible asignar el rol."
                            : result.message
                    });
                }

                return Ok(new
                {
                    success = true,
                    idRolUserAdmin = result.idUsuario,
                    message = string.IsNullOrWhiteSpace(result.message)
                        ? "Rol asignado correctamente."
                        : result.message
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error asignando rol");
                return StatusCode(500, new
                {
                    success = false,
                    message = "Error al asignar rol",
                    detail = ex.Message
                });
            }
        }

        [HttpDelete("Roles/{rolId}")]
        public IActionResult EliminarRol(int rolId)
        {
            try
            {
                // Aquí eliminarías de tu BD
                return Ok(new { success = true, message = "Rol eliminado correctamente" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error eliminando rol");
                return StatusCode(500, new { message = "Error al eliminar rol" });
            }
        }

        [HttpGet("Roles/Admin")]
        public async Task<IActionResult> GetRolesAdmin()
        {
            try
            {
                var roles = await _dbUsuarioRepository.GetRolesAdminAsync(HttpContext.RequestAborted);
                return Ok(roles);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error consultando administración de roles");
                return StatusCode(500, new { success = false, message = "Error al consultar roles." });
            }
        }

        [HttpPost("Roles/Admin")]
        public async Task<IActionResult> SaveRolAdmin([FromBody] DtoSaveRolRequest request)
        {
            try
            {
                if (request is null)
                {
                    return BadRequest(new { success = false, message = "Payload inválido." });
                }

                var usuarioAuditoria = await ResolveUsuarioAuditoriaAsync(
                    User,
                    null,
                    HttpContext.RequestAborted);

                var maquinaAuditoria =
                    HttpContext.Connection.RemoteIpAddress?.ToString()
                    ?? Environment.MachineName
                    ?? "N/A";

                var result = await _dbUsuarioRepository.SaveRolAdminAsync(
                    request,
                    usuarioAuditoria,
                    maquinaAuditoria,
                    HttpContext.RequestAborted);

                if (result.idRol <= 0)
                {
                    return BadRequest(new
                    {
                        success = false,
                        message = string.IsNullOrWhiteSpace(result.message)
                            ? "No fue posible guardar el rol."
                            : result.message
                    });
                }

                return Ok(new
                {
                    success = true,
                    idRol = result.idRol,
                    message = string.IsNullOrWhiteSpace(result.message)
                        ? "Rol guardado correctamente."
                        : result.message
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error guardando rol");
                return StatusCode(500, new
                {
                    success = false,
                    message = "Error al guardar rol",
                    detail = ex.Message
                });
            }
        }

        [HttpPatch("Roles/Admin/{idRol:int}/Estado")]
        public async Task<IActionResult> SetRolEstado(int idRol, [FromBody] DtoSetRolEstadoRequest request)
        {
            try
            {
                if (idRol <= 0)
                {
                    return BadRequest(new { success = false, message = "Id de rol inválido." });
                }

                var usuarioAuditoria = await ResolveUsuarioAuditoriaAsync(
                    User,
                    null,
                    HttpContext.RequestAborted);

                var maquinaAuditoria =
                    HttpContext.Connection.RemoteIpAddress?.ToString()
                    ?? Environment.MachineName
                    ?? "N/A";

                var result = await _dbUsuarioRepository.SetRolEstadoAsync(
                    idRol,
                    request?.vigente ?? 0,
                    usuarioAuditoria,
                    maquinaAuditoria,
                    HttpContext.RequestAborted);

                if (result.idRol <= 0)
                {
                    return BadRequest(new
                    {
                        success = false,
                        message = string.IsNullOrWhiteSpace(result.message)
                            ? "No fue posible actualizar el estado del rol."
                            : result.message
                    });
                }

                return Ok(new
                {
                    success = true,
                    idRol = result.idRol,
                    message = string.IsNullOrWhiteSpace(result.message)
                        ? "Estado del rol actualizado."
                        : result.message
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error actualizando estado del rol. idRol={IdRol}", idRol);
                return StatusCode(500, new
                {
                    success = false,
                    message = "Error al actualizar estado del rol",
                    detail = ex.Message
                });
            }
        }
    }
}

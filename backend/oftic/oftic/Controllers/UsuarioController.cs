using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Comun.Dtos;
using Negocio.Gestion;
using Negocio.Interfaz;
using Servicios.ApiInterfaz;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace ofic.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class UsuarioController : ControllerBase
    {
        private readonly IApiWebToken _apiWebToken;
        private readonly ILogger<UsuarioController> _logger;

        public UsuarioController(
            IApiWebToken apiWebToken,
            ILogger<UsuarioController> logger)
        {
            _apiWebToken = apiWebToken;
            _logger = logger;
        }

        private string? GetUserFromToken()
        {
            var claims = User.Claims;
            var usernameClaim = claims.FirstOrDefault(c => c.Type == ClaimTypes.Name || c.Type == JwtRegisteredClaimNames.Sub);
            return usernameClaim?.Value;
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

                // Obtener el usuario actual del token
                var currentUser = GetUserFromToken();
                if (string.IsNullOrEmpty(currentUser))
                {
                    return Unauthorized(new { message = "Usuario no autorizado" });
                }

                // Obtener token de la API externa
                var tokenPip = await _apiWebToken.GetTokenAsync(currentUser, "");
                
                if (string.IsNullOrEmpty(tokenPip))
                {
                    return Unauthorized(new { message = "No se pudo obtener token de la API" });
                }

                // Consultar empleado
                var empleado = await _apiWebToken.GetFuncionarioAsync(tokenPip, identificacion);

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

                var currentUser = GetUserFromToken();
                if (string.IsNullOrEmpty(currentUser))
                {
                    return Unauthorized(new { message = "Usuario no autorizado" });
                }

                var tokenPip = await _apiWebToken.GetTokenAsync(currentUser, "");
                
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

        [HttpGet("Roles")]
        public IActionResult GetRoles()
        {
            // Aquí implementarías la consulta a tu BD de roles
            var roles = new List<DtoRol>
            {
                new DtoRol { id = 1, nombre = "Administrador" },
                new DtoRol { id = 2, nombre = "Usuario" },
                new DtoRol { id = 3, nombre = "Consultor" },
                new DtoRol { id = 4, nombre = "Editor" }
            };

            return Ok(roles);
        }

        [HttpPost]
        public IActionResult SaveUsuario([FromBody] DtoUsuarioRequest request)
        {
            try
            {
                // Aquí guardarías en tu BD
                return Ok(new { success = true, message = "Usuario guardado correctamente" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error guardando usuario");
                return StatusCode(500, new { message = "Error al guardar usuario" });
            }
        }

        [HttpPost("Roles")]
        public IActionResult AsignarRol([FromBody] DtoAsignarRolRequest request)
        {
            try
            {
                // Aquí guardarías en tu BD
                return Ok(new { success = true, message = "Rol asignado correctamente" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error asignando rol");
                return StatusCode(500, new { message = "Error al asignar rol" });
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
    }
}

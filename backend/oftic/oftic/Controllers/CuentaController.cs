using Microsoft.AspNetCore.Mvc;
using Comun.Dtos;
using Negocio.Gestion;
using Negocio.Interfaz;
using Datos.Interfaz;
using Servicios.ApiInterfaz;

namespace ofic.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CuentaController : ControllerBase
    {
        private readonly IApiWebToken _apiWebToken;
        private readonly IJwtService _jwtService;
        private readonly IDbAuthRepository _dbAuthRepository;
        private readonly ILogger<CuentaController> _logger;
        private readonly IWebHostEnvironment _env;

        public CuentaController(
            IApiWebToken apiWebToken,
            IJwtService jwtService,
            IDbAuthRepository dbAuthRepository,
            ILogger<CuentaController> logger,
            IWebHostEnvironment env)
        {
            _apiWebToken = apiWebToken;
            _jwtService = jwtService;
            _dbAuthRepository = dbAuthRepository;
            _logger = logger;
            _env = env;
        }

        [HttpPost("Token")]
        public async Task<IActionResult> GetToken([FromBody] DtoTokenRequest request)
        {
            try
            {
                _logger.LogInformation("Login attempt for user: {Usuario}", request.Usuario);

                if (string.IsNullOrEmpty(request.Usuario) || string.IsNullOrEmpty(request.Contrasena))
                {
                    return BadRequest(new DtoTokenResponse 
                    { 
                        success = false, 
                        message = "Usuario y contraseña requeridos" 
                    });
                }

                // Validar contra la base de datos Oracle (ctr_usuarios)
                var (idUsuario, roles) = await _dbAuthRepository.GetUsuarioYRolesAsync(request.Usuario, CancellationToken.None);

                _logger.LogInformation("User {Usuario} - idUsuario: {id}, roles: {roles}", request.Usuario, idUsuario, roles?.Count);

                if (idUsuario is null)
                {
                    return Unauthorized(new DtoTokenResponse 
                    { 
                        success = false, 
                        message = "Usuario no encontrado o inactivo" 
                    });
                }

                // En Desarrollo: omitir validación de API externa
                if (_env.IsDevelopment())
                {
                    _logger.LogWarning("MODO DESARROLLO: Saltando validación de API externa");
                }
                else
                {
                    // Llamar a la API externa de la Policía para validar contraseña
                    var tokenPip = await _apiWebToken.GetTokenAsync(request.Usuario, request.Contrasena);

                    if (string.IsNullOrEmpty(tokenPip))
                    {
                        return Unauthorized(new DtoTokenResponse 
                        { 
                            success = false, 
                            message = "Credenciales incorrectas" 
                        });
                    }
                }

                // Generar token JWT local con los roles de la DB
                var jwtToken = _jwtService.CreateToken(idUsuario.Value, request.Usuario, roles);

                return Ok(new DtoTokenResponse
                {
                    token = jwtToken,
                    usuario = request.Usuario,
                    success = true,
                    message = "Login exitoso"
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error en login");
                return StatusCode(500, new DtoTokenResponse 
                { 
                    success = false, 
                    message = "Error al iniciar sesión" 
                });
            }
        }
    }
}

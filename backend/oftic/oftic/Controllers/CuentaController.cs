using Microsoft.AspNetCore.Mvc;
using Comun.Dtos;
using Negocio.Gestion;
using Negocio.Interfaz;
using Datos.Interfaz;
using Servicios.ApiInterfaz;
using Microsoft.Extensions.Configuration;

namespace ofic.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CuentaController : ControllerBase
    {
        private readonly IApiWebOud _apiWebOud;
        private readonly IJwtService _jwtService;
        private readonly IDbAuthRepository _dbAuthRepository;
        private readonly ILogger<CuentaController> _logger;
        private readonly IWebHostEnvironment _env;
        private readonly IConfiguration _configuration;

        public CuentaController(
            IApiWebOud apiWebOud,
            IJwtService jwtService,
            IDbAuthRepository dbAuthRepository,
            ILogger<CuentaController> logger,
            IWebHostEnvironment env,
            IConfiguration configuration)
        {
            _apiWebOud = apiWebOud;
            _jwtService = jwtService;
            _dbAuthRepository = dbAuthRepository;
            _logger = logger;
            _env = env;
            _configuration = configuration;
        }

        [HttpPost("Token")]
        public async Task<IActionResult> GetToken([FromBody] DtoTokenRequest request)
        {
            try
            {
                _logger.LogInformation("Login attempt for user: {Usuario}", request.Usuario);

                if (string.IsNullOrWhiteSpace(request.Usuario) || string.IsNullOrWhiteSpace(request.Contrasena))
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

                var validateOudInDevelopment = _configuration.GetValue<bool>("Auth:ValidateOudInDevelopment");
                var shouldValidateExternal = !_env.IsDevelopment() || validateOudInDevelopment;

                // Validación de credenciales contra API externa (OUD/PIP)
                if (shouldValidateExternal)
                {
                    // Flujo SISGE: token técnico (AuthHeaderHandler) + validación OUD con usuario/contraseña.
                    var externalOk = await _apiWebOud.ValidarCredencialesAsync(
                        request.Usuario,
                        request.Contrasena,
                        CancellationToken.None);

                    if (!externalOk)
                    {
                        return Unauthorized(new DtoTokenResponse
                        {
                            success = false,
                            message = "Credenciales incorrectas"
                        });
                    }

                }
                else
                {
                    _logger.LogWarning("MODO DESARROLLO: Validación OUD deshabilitada por configuración");
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

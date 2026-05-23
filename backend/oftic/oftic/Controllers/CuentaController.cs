using Microsoft.AspNetCore.Mvc;
using Comun.Dtos;
using Negocio.Interfaz;
using Datos.Interfaz;
using Datos.Tenant;
using Servicios.ApiInterfaz;
using Microsoft.Extensions.Configuration;

namespace Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CuentaController : ControllerBase
    {
        private readonly IApiWebOud _apiWebOud;
        private readonly IJwtService _jwtService;
        private readonly IDbAuthRepository _dbAuthRepository;
        private readonly IDbMasterRepository _masterRepository;
        private readonly ConnectionPoolManager _poolManager;
        private readonly TenantContext _tenantContext;
        private readonly ILogger<CuentaController> _logger;
        private readonly IWebHostEnvironment _env;
        private readonly IConfiguration _configuration;

        public CuentaController(
            IApiWebOud apiWebOud,
            IJwtService jwtService,
            IDbAuthRepository dbAuthRepository,
            IDbMasterRepository masterRepository,
            ConnectionPoolManager poolManager,
            TenantContext tenantContext,
            ILogger<CuentaController> logger,
            IWebHostEnvironment env,
            IConfiguration configuration)
        {
            _apiWebOud = apiWebOud;
            _jwtService = jwtService;
            _dbAuthRepository = dbAuthRepository;
            _masterRepository = masterRepository;
            _poolManager = poolManager;
            _tenantContext = tenantContext;
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
                    return BadRequest(new DtoTokenResponse { success = false, message = "Usuario y contraseña requeridos" });
                }

                var validateOudInDev = _configuration.GetValue<bool>("Auth:ValidateOudInDevelopment");
                var shouldValidateOud = !_env.IsDevelopment() || validateOudInDev;

                string? codDane = null;
                string? nombreCad = null;

                if (shouldValidateOud)
                {
                    // OUD: validate credentials and extract unit code
                    var oudResult = await _apiWebOud.ValidarYObtenerDatosAsync(
                        request.Usuario, request.Contrasena, CancellationToken.None);

                    if (!oudResult.Success)
                    {
                        return Unauthorized(new DtoTokenResponse
                        {
                            success = false,
                            message = "Credenciales incorrectas"
                        });
                    }

                    // Resolve tenant from OUD attributes
                    var tenant = await ResolveTenantAsync(oudResult.UndeLaborandoCodigo, oudResult.SiglaLaborando);

                    if (tenant is null)
                    {
                        _logger.LogWarning("Tenant no resuelto. UndeLaborandoCodigo={Cod}, SiglaLaborando={Sigla}",
                            oudResult.UndeLaborandoCodigo, oudResult.SiglaLaborando);
                        return Unauthorized(new DtoTokenResponse
                        {
                            success = false,
                            message = "No se pudo determinar el CAD asignado al funcionario."
                        });
                    }

                    codDane = tenant.CodDane;
                    nombreCad = tenant.Nombre;
                    _tenantContext.Set(_poolManager.GetOrCreate(tenant), codDane, nombreCad);

                    await _masterRepository.AuditFallbackLoginAsync(
                        request.Usuario, codDane,
                        HttpContext.Connection.RemoteIpAddress?.ToString(),
                        modoFallback: false,
                        CancellationToken.None);
                }
                else
                {
                    // Development: use configured default tenant
                    _logger.LogWarning("MODO DESARROLLO: Validación OUD deshabilitada.");
                    var devCodDane = _configuration["Auth:DevTenantCodDane"] ?? "11001";// aqui debe utilizar el codgo de la unidad devuelto por la PIP
                    var devTenant = await _masterRepository.GetTenantByCodDaneAsync(devCodDane, CancellationToken.None); 

                    if (devTenant is null)
                    {
                        return StatusCode(503, new DtoTokenResponse
                        {
                            success = false,
                            message = $"Tenant de desarrollo '{devCodDane}' no encontrado en la base de datos maestra."
                        });
                    }

                    codDane = devTenant.CodDane;
                    nombreCad = devTenant.Nombre;
                    _tenantContext.Set(_poolManager.GetOrCreate(devTenant), codDane, nombreCad);
                }

                // Query user and roles from tenant DB
                var (idUsuario, roles, sitioGraba, acd, fuerzaId) = await _dbAuthRepository.GetUsuarioYRolesAsync(
                    request.Usuario, CancellationToken.None);

                _logger.LogInformation("User {Usuario} — idUsuario: {Id}, roles: {Count}, tenant: {Tenant}, sitio: {Sitio}, acd: {Acd}",
                    request.Usuario, idUsuario, roles?.Count, codDane, sitioGraba, acd);

                if (idUsuario is null)
                {
                    return Unauthorized(new DtoTokenResponse
                    {
                        success = false,
                        message = "Usuario no encontrado o inactivo en el sistema"
                    });
                }

                var jwtToken = _jwtService.CreateToken(
                    idUsuario.Value, request.Usuario, roles, codDane!, nombreCad,
                    sitioGraba, acd, fuerzaId);

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
                _logger.LogError(ex, "Error en login para {Usuario}", request.Usuario);
                return StatusCode(500, new DtoTokenResponse { success = false, message = "Error al iniciar sesión" });
            }
        }

        private async Task<Comun.Dtos.Tenant.DtoTenant?> ResolveTenantAsync(string? undeLaborandoCodigo, string? siglaLaborando)
        {
            if (!string.IsNullOrWhiteSpace(undeLaborandoCodigo))
            {
                var t = await _masterRepository.GetTenantByCodDaneAsync(undeLaborandoCodigo, CancellationToken.None);
                if (t is not null) return t;
            }

            if (!string.IsNullOrWhiteSpace(siglaLaborando))
            {
                var t = await _masterRepository.GetTenantByCodUnidadAsync(siglaLaborando, CancellationToken.None);
                if (t is not null) return t;
            }

            return null;
        }
    }
}

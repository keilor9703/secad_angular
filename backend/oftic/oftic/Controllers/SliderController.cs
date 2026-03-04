using Comun.Dtos.Sliders;
using Datos.Interfaz;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using System.Security.Claims;

namespace ofic.Controllers
{
    public class DtoSliderUploadRequest
    {
        public IFormFile? File { get; set; }
    }

    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
public class SliderController : ControllerBase
{
    private readonly IDbSliders _dbSliders;
    private readonly IDbUsuarioRepository _dbUsuarioRepository;
    private readonly ILogger<SliderController> _logger;
    private readonly string _bannerRootPath;

    public SliderController(
        IDbSliders dbSliders,
        IDbUsuarioRepository dbUsuarioRepository,
        IConfiguration configuration,
        IHostEnvironment environment,
        ILogger<SliderController> logger)
    {
        _dbSliders = dbSliders;
        _dbUsuarioRepository = dbUsuarioRepository;
        _logger = logger;
        _bannerRootPath = ResolveStoragePath(
            configuration,
            "Storage:SliderPath",
            Path.Combine(environment.ContentRootPath, "uploads", "sliders"));
    }

        [HttpGet("Publicos")]
        [AllowAnonymous]
        public async Task<IActionResult> GetPublicos()
        {
            try
            {
                var data = await _dbSliders.GetPublicosAsync(HttpContext.RequestAborted);
                return Ok(data);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error consultando sliders públicos");
                return StatusCode(500, new { message = "Error al consultar sliders públicos" });
            }
        }

        [HttpGet]
        public async Task<IActionResult> GetAdmin()
        {
            try
            {
                var data = await _dbSliders.GetAdminAsync(HttpContext.RequestAborted);
                return Ok(data);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error consultando sliders de administración");
                return StatusCode(500, new { message = "Error al consultar sliders" });
            }
        }

        [HttpPost]
        public async Task<IActionResult> Save([FromBody] DtoSaveSliderRequest request)
        {
            try
            {
                if (request is null)
                {
                    return BadRequest(new { success = false, message = "Payload requerido" });
                }

                if (string.IsNullOrWhiteSpace(request.titulo))
                {
                    return BadRequest(new { success = false, message = "Título requerido" });
                }

                if (string.IsNullOrWhiteSpace(request.urlImagen))
                {
                    return BadRequest(new { success = false, message = "URL de imagen requerida" });
                }

                if (request.orden <= 0)
                {
                    return BadRequest(new { success = false, message = "Orden debe ser mayor a 0" });
                }

                var usuarioAuditoria = await ResolveUsuarioAuditoriaAsync(HttpContext.RequestAborted);
                if (usuarioAuditoria <= 0)
                {
                    return Unauthorized(new { success = false, message = "No se pudo resolver cédula del usuario autenticado." });
                }
                var maquinaAuditoria = ResolveMaquinaAuditoria();

                var result = await _dbSliders.SaveAsync(
                    request,
                    usuarioAuditoria,
                    maquinaAuditoria,
                    HttpContext.RequestAborted);

                if (result.id <= 0)
                {
                    return BadRequest(new
                    {
                        success = false,
                        id = result.id,
                        message = string.IsNullOrWhiteSpace(result.message)
                            ? "No fue posible guardar el slider."
                            : result.message
                    });
                }

                return Ok(new
                {
                    success = true,
                    id = result.id,
                    message = string.IsNullOrWhiteSpace(result.message)
                        ? "Slider guardado correctamente."
                        : result.message
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error guardando slider");
                return StatusCode(500, new
                {
                    success = false,
                    message = "Error al guardar slider",
                    detail = ex.Message
                });
            }
        }

        [HttpPost("Upload")]
        [Consumes("multipart/form-data")]
        [RequestSizeLimit(5 * 1024 * 1024)]
        public async Task<IActionResult> Upload([FromForm] DtoSliderUploadRequest request)
        {
            try
            {
                var file = request?.File;
                if (file is null || file.Length <= 0)
                {
                    return BadRequest(new { success = false, message = "Archivo requerido." });
                }

                if (file.Length > 5 * 1024 * 1024)
                {
                    return BadRequest(new { success = false, message = "El archivo excede 5MB." });
                }

                var extension = Path.GetExtension(file.FileName)?.ToLowerInvariant() ?? string.Empty;
                var allowed = new HashSet<string> { ".jpg", ".jpeg", ".png", ".webp" };
                if (!allowed.Contains(extension))
                {
                    return BadRequest(new { success = false, message = "Formato inválido. Use JPG, PNG o WEBP." });
                }

                var uploadsDir = _bannerRootPath;
                Directory.CreateDirectory(uploadsDir);

                var safeName = $"{Guid.NewGuid():N}{extension}";
                var fullPath = Path.Combine(uploadsDir, safeName);

                await using (var stream = new FileStream(fullPath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                var publicUrl = $"/api/Slider/Image/{safeName}";
                return Ok(new
                {
                    success = true,
                    url = publicUrl,
                    fileName = safeName,
                    message = "Imagen cargada correctamente."
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error subiendo imagen de slider");
                return StatusCode(500, new
                {
                    success = false,
                    message = "Error cargando imagen",
                    detail = ex.Message
                });
            }
        }

        [HttpGet("Image/{fileName}")]
        [AllowAnonymous]
        public IActionResult GetImage([FromRoute] string fileName)
        {
            try
            {
                var normalized = Path.GetFileName(fileName ?? string.Empty);
                if (string.IsNullOrWhiteSpace(normalized))
                {
                    return BadRequest(new { message = "Nombre de archivo inválido." });
                }

                var fullPath = Path.Combine(_bannerRootPath, normalized);
                if (!System.IO.File.Exists(fullPath))
                {
                    return NotFound();
                }

                var provider = new FileExtensionContentTypeProvider();
                if (!provider.TryGetContentType(normalized, out var contentType))
                {
                    contentType = "application/octet-stream";
                }

                return PhysicalFile(fullPath, contentType);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error devolviendo imagen de slider: {FileName}", fileName);
                return StatusCode(500, new { message = "Error cargando imagen." });
            }
        }

        [HttpPatch("Estado")]
        public async Task<IActionResult> SetEstado([FromBody] DtoSetEstadoSliderRequest request)
        {
            try
            {
                if (request is null || request.idSlider <= 0)
                {
                    return BadRequest(new { success = false, message = "Id de slider requerido" });
                }

                if (request.vigente is not 0 and not 1)
                {
                    return BadRequest(new { success = false, message = "Vigente debe ser 0 o 1" });
                }

                var usuarioAuditoria = await ResolveUsuarioAuditoriaAsync(HttpContext.RequestAborted);
                if (usuarioAuditoria <= 0)
                {
                    return Unauthorized(new { success = false, message = "No se pudo resolver cédula del usuario autenticado." });
                }
                var maquinaAuditoria = ResolveMaquinaAuditoria();

                var result = await _dbSliders.SetEstadoAsync(
                    request.idSlider,
                    request.vigente,
                    usuarioAuditoria,
                    maquinaAuditoria,
                    HttpContext.RequestAborted);

                if (result.id <= 0)
                {
                    return BadRequest(new
                    {
                        success = false,
                        id = result.id,
                        message = string.IsNullOrWhiteSpace(result.message)
                            ? "No fue posible actualizar el estado del slider."
                            : result.message
                    });
                }

                return Ok(new
                {
                    success = true,
                    id = result.id,
                    message = string.IsNullOrWhiteSpace(result.message)
                        ? "Estado de slider actualizado."
                        : result.message
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error actualizando estado de slider");
                return StatusCode(500, new
                {
                    success = false,
                    message = "Error al actualizar estado del slider",
                    detail = ex.Message
                });
            }
        }

        private async Task<long> ResolveUsuarioAuditoriaAsync(CancellationToken ct)
        {
            var rawCedula = User.FindFirstValue("identificacion")
                ?? User.FindFirstValue("cedula")
                ?? User.FindFirstValue("numeroDocumento")
                ?? User.FindFirstValue("documento");
            if (long.TryParse(rawCedula, out var cedulaClaim) && cedulaClaim > 0)
            {
                return cedulaClaim;
            }

            var username =
                User?.Identity?.Name
                ?? User?.FindFirstValue(ClaimTypes.Name)
                ?? User?.FindFirstValue("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name");

            if (!string.IsNullOrWhiteSpace(username))
            {
                var cedulaDb = await _dbUsuarioRepository.GetIdentificacionByUsernameAsync(username.Trim(), ct);
                if (long.TryParse(cedulaDb, out var cedula) && cedula > 0)
                {
                    return cedula;
                }
            }

            return 0;
        }

        private string ResolveMaquinaAuditoria()
        {
            return HttpContext.Connection.RemoteIpAddress?.ToString()
                ?? Environment.MachineName
                ?? "N/A";
        }

        private static string ResolveStoragePath(IConfiguration configuration, string key, string fallback)
        {
            var configured = configuration[key];
            var path = string.IsNullOrWhiteSpace(configured) ? fallback : configured.Trim();
            return Path.GetFullPath(path);
        }
    }
}

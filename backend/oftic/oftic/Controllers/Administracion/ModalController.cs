using Comun.Dtos.Modal;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.StaticFiles;
using Negocio.Interfaz;
using ofic.Security;
using System.Security.Claims;

namespace Api.Controllers.Administracion
{
    public class DtoModalUploadRequest
    {
        public IFormFile? File { get; set; }
    }

    [ApiController]
    [Route("api/[controller]")]
    [EnableCors("PublicCors")]
    public class ModalController : ControllerBase
    {
        private readonly IDbModalService _service;
        private readonly ILogger<ModalController> _logger;
        private readonly string _uploadsPath;

        public ModalController(
            IDbModalService service,
            ILogger<ModalController> logger,
            IConfiguration configuration,
            IHostEnvironment environment)
        {
            _service = service;
            _logger = logger;
            var configured = configuration["Storage:ModalPath"];
            _uploadsPath = string.IsNullOrWhiteSpace(configured)
                ? Path.Combine(environment.ContentRootPath, "uploads", "modales")
                : Path.GetFullPath(configured.Trim());
        }

        // -------------------------------------------------------
        // Admin endpoints (requieren autenticación)
        // -------------------------------------------------------

        [HttpGet]
        [Authorize]
        public async Task<ActionResult> GetAll()
        {
            var result = await _service.GetAllAsync(CancellationToken.None);
            return Ok(result);
        }

        [HttpGet("{id:long}")]
        [Authorize]
        public async Task<ActionResult> GetById(long id)
        {
            var result = await _service.GetByIdAsync(id, CancellationToken.None);
            if (result == null)
                return NotFound(new { success = false, message = "Modal no encontrado" });

            return Ok(result);
        }

        [HttpPost]
        [Authorize]
        public async Task<ActionResult> Create([FromBody] DtoModalRequest request)
        {
            try
            {
                var (usuario, maquina) = ObtenerAuditoria();
                var result = await _service.CreateAsync(request, usuario, maquina, CancellationToken.None);

                if (!result.Success)
                    return BadRequest(new { success = false, message = result.Message });

                return Ok(new { success = true, id = result.Id, message = result.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al crear modal");
                return StatusCode(500, new { success = false, message = $"Error: {ex.Message}" });
            }
        }

        [HttpPut("{id:long}")]
        [Authorize]
        public async Task<ActionResult> Update(long id, [FromBody] DtoModalRequest request)
        {
            try
            {
                var (usuario, maquina) = ObtenerAuditoria();
                var result = await _service.UpdateAsync(id, request, usuario, maquina, CancellationToken.None);

                if (!result.Success)
                    return BadRequest(new { success = false, message = result.Message });

                return Ok(new { success = true, message = result.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al actualizar modal ID={Id}", id);
                return StatusCode(500, new { success = false, message = $"Error: {ex.Message}" });
            }
        }

        [HttpDelete("{id:long}")]
        [Authorize]
        public async Task<ActionResult> Delete(long id)
        {
            try
            {
                var (usuario, maquina) = ObtenerAuditoria();
                var result = await _service.DeleteLogicalAsync(id, usuario, maquina, CancellationToken.None);

                if (!result.Success)
                    return BadRequest(new { success = false, message = result.Message });

                return Ok(new { success = true, message = result.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al eliminar modal ID={Id}", id);
                return StatusCode(500, new { success = false, message = $"Error: {ex.Message}" });
            }
        }

        [HttpPatch("{id:long}/vigente")]
        [Authorize]
        public async Task<ActionResult> ToggleVigente(long id, [FromBody] DtoModalToggleRequest request)
        {
            try
            {
                var (usuario, maquina) = ObtenerAuditoria();
                var result = await _service.ToggleVigenteAsync(id, request.Vigente, usuario, maquina, CancellationToken.None);

                if (!result.Success)
                    return BadRequest(new { success = false, message = result.Message });

                return Ok(new { success = true, message = result.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al cambiar estado de modal ID={Id}", id);
                return StatusCode(500, new { success = false, message = $"Error: {ex.Message}" });
            }
        }

        [HttpGet("{id:long}/interacciones")]
        [Authorize]
        public async Task<ActionResult> GetInteracciones(long id)
        {
            var result = await _service.GetInteraccionesAsync(id, CancellationToken.None);
            return Ok(result);
        }

        // -------------------------------------------------------
        // Endpoints públicos (no requieren autenticación)
        // -------------------------------------------------------

        [HttpGet("activos")]
        [AllowAnonymous]
        public async Task<ActionResult> GetActivos()
        {
            var result = await _service.GetActivosAsync(CancellationToken.None);
            return Ok(result);
        }

        [HttpPost("interaccion")]
        [AllowAnonymous]
        public async Task<ActionResult> RegistrarInteraccion([FromBody] DtoInteraccionRequest request)
        {
            try
            {
                var usuario = User.Identity?.IsAuthenticated == true
                    ? (User.FindFirstValue("id_usuario") ?? User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "anonimo")
                    : "anonimo";

                var maquina = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "N/A";

                var result = await _service.RegistrarInteraccionAsync(request.IdModal, request.TipoAccion, usuario, maquina, CancellationToken.None);

                if (!result.Success)
                    return BadRequest(new { success = false, message = result.Message });

                return Ok(new { success = true, message = result.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al registrar interacción modal ID={Id}", request?.IdModal);
                return StatusCode(500, new { success = false, message = $"Error: {ex.Message}" });
            }
        }

        // -------------------------------------------------------
        // Upload de recurso (imagen o video)
        // -------------------------------------------------------

        [HttpPost("upload")]
        [Authorize]
        [Consumes("multipart/form-data")]
        [RequestSizeLimit(150 * 1024 * 1024)]
        [RequestFormLimits(MultipartBodyLengthLimit = 150 * 1024 * 1024)]
        public async Task<ActionResult> Upload([FromForm] DtoModalUploadRequest request)
        {
            try
            {
                var file = request?.File;
                if (file is null || file.Length <= 0)
                    return BadRequest(new { success = false, message = "Archivo requerido." });

                var extension = Path.GetExtension(file.FileName)?.ToLowerInvariant() ?? string.Empty;

                var allowedImages = new HashSet<string> { ".jpg", ".jpeg", ".png", ".webp" };
                var allowedVideos = new HashSet<string> { ".mp4", ".webm", ".mov" };

                bool esImagen = allowedImages.Contains(extension);
                bool esVideo  = allowedVideos.Contains(extension);

                if (!esImagen && !esVideo)
                    return BadRequest(new { success = false, message = "Formato no permitido. Use JPG, PNG, WEBP, MP4, WEBM o MOV." });

                if (esImagen && file.Length > 5 * 1024 * 1024)
                    return BadRequest(new { success = false, message = "La imagen no puede exceder 5MB." });

                if (esVideo && file.Length > 150 * 1024 * 1024)
                    return BadRequest(new { success = false, message = "El video no puede exceder 150MB." });

                if (esImagen && !SecurityGuards.HasValidImageSignature(file, extension))
                    return BadRequest(new { success = false, message = "Firma de archivo inválida para imagen." });

                if (esVideo && !SecurityGuards.HasValidVideoSignature(file, extension))
                    return BadRequest(new { success = false, message = "Firma de archivo inválida para video." });

                Directory.CreateDirectory(_uploadsPath);

                var safeName  = $"{Guid.NewGuid():N}{extension}";
                var fullPath  = Path.Combine(_uploadsPath, safeName);

                await using (var stream = new FileStream(fullPath, FileMode.Create))
                    await file.CopyToAsync(stream);

                var publicUrl = $"/api/Modal/recurso/{safeName}";
                return Ok(new { success = true, url = publicUrl, fileName = safeName, message = "Archivo cargado correctamente." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al subir recurso de modal");
                return StatusCode(500, new { success = false, message = "Error al cargar el archivo." });
            }
        }

        [HttpGet("recurso/{fileName}")]
        [AllowAnonymous]
        public IActionResult GetRecurso([FromRoute] string fileName)
        {
            var normalized = Path.GetFileName(fileName ?? string.Empty);
            if (string.IsNullOrWhiteSpace(normalized))
                return BadRequest(new { message = "Nombre de archivo inválido." });

            var fullPath = Path.Combine(_uploadsPath, normalized);
            if (!System.IO.File.Exists(fullPath))
                return NotFound();

            var provider = new FileExtensionContentTypeProvider();
            if (!provider.TryGetContentType(normalized, out var contentType))
                contentType = "application/octet-stream";

            return PhysicalFile(fullPath, contentType);
        }

        // -------------------------------------------------------
        // Helpers
        // -------------------------------------------------------

        private (string usuario, string maquina) ObtenerAuditoria()
        {
            var usuario = User.FindFirstValue(ClaimTypes.Name)
                ?? User.FindFirstValue("id_usuario")
                ?? User.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? "sistema";

            var maquina = HttpContext.Connection.RemoteIpAddress?.ToString()
                ?? Environment.MachineName
                ?? "N/A";

            return (usuario, maquina);
        }
    }
}

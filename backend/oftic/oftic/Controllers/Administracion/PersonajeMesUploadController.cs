using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using ofic.Security;

namespace Api.Controllers.Administracion
{
    public class DtoPersonajeMesUploadRequest
    {
        public IFormFile? File { get; set; }
    }

    [ApiController]
    [Route("api/[controller]")]
    [EnableCors("PublicCors")]
    public class PersonajeMesUploadController : ControllerBase
    {
        private readonly ILogger<PersonajeMesUploadController> _logger;
        private readonly string _uploadsPath;

        private const long MaxImageBytes = 2 * 1024 * 1024; // 2MB
        private static readonly HashSet<string> AllowedImageExtensions = new(StringComparer.OrdinalIgnoreCase)
        {
            ".jpg", ".jpeg", ".png", ".webp"
        };

        public PersonajeMesUploadController(IConfiguration configuration, ILogger<PersonajeMesUploadController> logger)
        {
            _logger = logger;
            _uploadsPath = Path.Combine(
                configuration["AppSettings:UploadsPath"] ?? Path.Combine(AppContext.BaseDirectory, "..", "..", "uploads"),
                "personaje-mes");
        }

        [HttpPost("imagen")]
        [Consumes("multipart/form-data")]
        [RequestSizeLimit(5 * 1024 * 1024)]
        public async Task<IActionResult> UploadImagen([FromForm] DtoPersonajeMesUploadRequest request)
        {
            try
            {
                var file = request?.File;
                if (file is null || file.Length <= 0)
                {
                    return BadRequest(new { success = false, message = "Archivo requerido." });
                }

                if (file.Length > MaxImageBytes)
                {
                    return BadRequest(new { success = false, message = "El archivo excede 2MB." });
                }

                var extension = Path.GetExtension(file.FileName)?.ToLowerInvariant() ?? string.Empty;
                if (!AllowedImageExtensions.Contains(extension))
                {
                    return BadRequest(new { success = false, message = "Formato inválido. Use JPG, JPEG, PNG o WEBP." });
                }

                if (!SecurityGuards.HasValidImageSignature(file, extension))
                {
                    return BadRequest(new { success = false, message = "Firma de archivo inválida para imagen." });
                }

                Directory.CreateDirectory(_uploadsPath);

                var safeName = $"{Guid.NewGuid():N}{extension}";
                var fullPath = Path.Combine(_uploadsPath, safeName);

                await using (var stream = new FileStream(fullPath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                var publicUrl = $"/api/PersonajeMesUpload/Imagen/{safeName}";
                return Ok(new
                {
                    success = true,
                    url = publicUrl,
                    fileName = $"personaje-mes/{safeName}",
                    message = "Imagen cargada correctamente."
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error subiendo imagen de personaje del mes");
                return StatusCode(500, new
                {
                    success = false,
                    message = "Error cargando imagen"
                });
            }
        }

        [HttpGet("Imagen/{fileName}")]
        [EnableCors("PublicCors")]
        public IActionResult GetImagen(string fileName)
        {
            var safeFileName = Path.GetFileName(fileName);
            var fullPath = Path.Combine(_uploadsPath, safeFileName);

            if (!System.IO.File.Exists(fullPath))
            {
                return NotFound(new { success = false, message = "Imagen no encontrada." });
            }

            var extension = Path.GetExtension(fullPath).ToLowerInvariant();
            var contentType = extension switch
            {
                ".jpg" or ".jpeg" => "image/jpeg",
                ".png" => "image/png",
                ".webp" => "image/webp",
                _ => "application/octet-stream"
            };

            return PhysicalFile(fullPath, contentType);
        }
    }
}

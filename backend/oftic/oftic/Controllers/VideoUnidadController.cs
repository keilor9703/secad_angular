using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using ofic.Security;

namespace ofic.Controllers
{
    public class DtoVideoUnidadUploadRequest
    {
        public IFormFile? File { get; set; }
    }

    [ApiController]
    [Route("api/[controller]")]
    public class VideoUnidadController : ControllerBase
    {
        private const long MaxVideoBytes = 100 * 1024 * 1024; // 100MB
        private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
        {
            ".mp4", ".webm", ".ogg", ".mov"
        };

        private readonly ILogger<VideoUnidadController> _logger;
        private readonly string _videoRootPath;

        public VideoUnidadController(
            ILogger<VideoUnidadController> logger,
            IConfiguration configuration,
            IHostEnvironment environment)
        {
            _logger = logger;
            _videoRootPath = ResolveStoragePath(
                configuration,
                "Storage:VideoPath",
                Path.Combine(environment.ContentRootPath, "uploads", "videos"));
        }

        [HttpGet("current")]
        [Authorize]
        public IActionResult GetCurrent()
        {
            try
            {
                Directory.CreateDirectory(_videoRootPath);
                var file = GetLatestVideoFile();
                if (file is null)
                {
                    return Ok(new
                    {
                        hasVideo = false,
                        url = string.Empty,
                        fileName = string.Empty,
                        sizeBytes = 0L,
                        lastModifiedUtc = (DateTime?)null
                    });
                }

                return Ok(new
                {
                    hasVideo = true,
                    url = $"/api/VideoUnidad/stream?v={file.LastWriteTimeUtc.Ticks}",
                    fileName = file.Name,
                    sizeBytes = file.Length,
                    lastModifiedUtc = file.LastWriteTimeUtc
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error consultando video actual de unidad");
                return StatusCode(500, new { message = "Error consultando video actual." });
            }
        }

        [HttpGet("stream")]
        [AllowAnonymous]
        public IActionResult StreamCurrentVideo()
        {
            try
            {
                Directory.CreateDirectory(_videoRootPath);
                var file = GetLatestVideoFile();
                if (file is null || !file.Exists)
                {
                    return NotFound();
                }

                var provider = new FileExtensionContentTypeProvider();
                if (!provider.TryGetContentType(file.Name, out var contentType))
                {
                    contentType = "application/octet-stream";
                }

                return PhysicalFile(file.FullName, contentType, enableRangeProcessing: true);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error transmitiendo video actual de unidad");
                return StatusCode(500, new { message = "Error transmitiendo video." });
            }
        }

        [HttpPost("upload")]
        [Authorize]
        [Consumes("multipart/form-data")]
        [RequestSizeLimit(MaxVideoBytes)]
        [RequestFormLimits(MultipartBodyLengthLimit = MaxVideoBytes)]
        public async Task<IActionResult> Upload([FromForm] DtoVideoUnidadUploadRequest request)
        {
            try
            {
                var file = request?.File;
                if (file is null || file.Length <= 0)
                {
                    return BadRequest(new { success = false, message = "Archivo de video requerido." });
                }

                if (file.Length > MaxVideoBytes)
                {
                    return BadRequest(new { success = false, message = "El video excede 100MB." });
                }

                var extension = Path.GetExtension(file.FileName)?.ToLowerInvariant() ?? string.Empty;
                if (!AllowedExtensions.Contains(extension))
                {
                    return BadRequest(new { success = false, message = "Formato inválido. Use MP4, WEBM, OGG o MOV." });
                }
                if (!SecurityGuards.HasValidVideoSignature(file, extension))
                {
                    return BadRequest(new { success = false, message = "Firma de archivo inválida para video." });
                }

                Directory.CreateDirectory(_videoRootPath);

                // Eliminar videos previos para mantener solo un video activo.
                foreach (var existing in Directory.GetFiles(_videoRootPath))
                {
                    System.IO.File.Delete(existing);
                }

                var safeName = $"video-unidad-{DateTime.UtcNow:yyyyMMddHHmmss}{extension}";
                var fullPath = Path.Combine(_videoRootPath, safeName);

                await using (var stream = new FileStream(fullPath, FileMode.Create, FileAccess.Write, FileShare.None))
                {
                    await file.CopyToAsync(stream);
                }

                return Ok(new
                {
                    success = true,
                    url = $"/api/VideoUnidad/stream?v={DateTime.UtcNow.Ticks}",
                    fileName = safeName,
                    sizeBytes = file.Length,
                    message = "Video cargado correctamente."
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error cargando video de unidad");
                return StatusCode(500, new { success = false, message = "Error cargando video." });
            }
        }

        private FileInfo? GetLatestVideoFile()
        {
            var files = Directory.GetFiles(_videoRootPath)
                .Select(path => new FileInfo(path))
                .Where(f => AllowedExtensions.Contains(f.Extension))
                .OrderByDescending(f => f.LastWriteTimeUtc)
                .ToList();

            return files.Count > 0 ? files[0] : null;
        }

        private static string ResolveStoragePath(IConfiguration configuration, string key, string fallback)
        {
            var configured = configuration[key];
            var path = string.IsNullOrWhiteSpace(configured) ? fallback : configured.Trim();
            return Path.GetFullPath(path);
        }
    }
}

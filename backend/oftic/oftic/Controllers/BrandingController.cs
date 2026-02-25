using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.StaticFiles;
using System.Text.Json;

namespace ofic.Controllers
{
    public class BrandingConfig
    {
        public string systemName { get; set; } = "SISGE";
        public string? logoFileName { get; set; } = null;
    }

    public class BrandingSaveRequest
    {
        public string? systemName { get; set; }
        public string? logoFileName { get; set; }
    }

    public class BrandingUploadRequest
    {
        public IFormFile? File { get; set; }
    }

    [ApiController]
    [Route("api/[controller]")]
    public class BrandingController : ControllerBase
    {
        private const string RootPath = @"C:\SISGE\branding";
        private const string ConfigName = "config.json";
        private const long MaxLogoBytes = 5 * 1024 * 1024;
        private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
        {
            ".jpg", ".jpeg", ".png", ".webp", ".svg"
        };

        private static readonly JsonSerializerOptions JsonOptions = new()
        {
            PropertyNamingPolicy = null,
            WriteIndented = true
        };

        private readonly ILogger<BrandingController> _logger;

        public BrandingController(ILogger<BrandingController> logger)
        {
            _logger = logger;
        }

        [HttpGet("config")]
        [AllowAnonymous]
        public IActionResult GetPublicConfig()
        {
            try
            {
                EnsureStorage();
                var cfg = ReadConfig();
                return Ok(new
                {
                    systemName = string.IsNullOrWhiteSpace(cfg.systemName) ? "SISGE" : cfg.systemName.Trim(),
                    logoUrl = BuildLogoUrl(cfg.logoFileName)
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error consultando configuración branding");
                return StatusCode(500, new { message = "Error consultando configuración branding." });
            }
        }

        [HttpGet("admin-config")]
        [Authorize]
        public IActionResult GetAdminConfig()
        {
            try
            {
                EnsureStorage();
                var cfg = ReadConfig();
                return Ok(new
                {
                    systemName = string.IsNullOrWhiteSpace(cfg.systemName) ? "SISGE" : cfg.systemName.Trim(),
                    logoFileName = cfg.logoFileName,
                    logoUrl = BuildLogoUrl(cfg.logoFileName)
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error consultando configuración admin branding");
                return StatusCode(500, new { message = "Error consultando configuración admin branding." });
            }
        }

        [HttpGet("logo/{fileName}")]
        [AllowAnonymous]
        public IActionResult GetLogo([FromRoute] string fileName)
        {
            try
            {
                EnsureStorage();
                var safe = Path.GetFileName(fileName ?? string.Empty);
                if (string.IsNullOrWhiteSpace(safe))
                {
                    return BadRequest(new { message = "Nombre de archivo inválido." });
                }

                var extension = Path.GetExtension(safe);
                if (!AllowedExtensions.Contains(extension))
                {
                    return BadRequest(new { message = "Formato de logo inválido." });
                }

                var fullPath = Path.Combine(RootPath, safe);
                if (!System.IO.File.Exists(fullPath))
                {
                    return NotFound();
                }

                var provider = new FileExtensionContentTypeProvider();
                if (!provider.TryGetContentType(safe, out var contentType))
                {
                    contentType = "application/octet-stream";
                }

                return PhysicalFile(fullPath, contentType, enableRangeProcessing: true);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error devolviendo logo branding");
                return StatusCode(500, new { message = "Error devolviendo logo." });
            }
        }

        [HttpPost("upload-logo")]
        [Authorize]
        [Consumes("multipart/form-data")]
        [RequestSizeLimit(MaxLogoBytes)]
        [RequestFormLimits(MultipartBodyLengthLimit = MaxLogoBytes)]
        public async Task<IActionResult> UploadLogo([FromForm] BrandingUploadRequest request)
        {
            try
            {
                var file = request?.File;
                if (file is null || file.Length <= 0)
                {
                    return BadRequest(new { success = false, message = "Archivo requerido." });
                }

                if (file.Length > MaxLogoBytes)
                {
                    return BadRequest(new { success = false, message = "El logo excede 5MB." });
                }

                var extension = Path.GetExtension(file.FileName)?.ToLowerInvariant() ?? string.Empty;
                if (!AllowedExtensions.Contains(extension))
                {
                    return BadRequest(new { success = false, message = "Formato inválido. Use JPG, PNG, WEBP o SVG." });
                }

                EnsureStorage();
                var cfg = ReadConfig();

                var fileName = $"logo-{Guid.NewGuid():N}{extension}";
                var fullPath = Path.Combine(RootPath, fileName);
                await using (var stream = new FileStream(fullPath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                // Si el logo anterior existe, se elimina para conservar solo uno.
                if (!string.IsNullOrWhiteSpace(cfg.logoFileName))
                {
                    TryDeleteLogo(cfg.logoFileName);
                }

                cfg.logoFileName = fileName;
                WriteConfig(cfg);

                return Ok(new
                {
                    success = true,
                    fileName,
                    logoUrl = BuildLogoUrl(fileName),
                    message = "Logo cargado correctamente."
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error cargando logo branding");
                return StatusCode(500, new { success = false, message = "Error cargando logo.", detail = ex.Message });
            }
        }

        [HttpPost("save-config")]
        [Authorize]
        public IActionResult SaveConfig([FromBody] BrandingSaveRequest request)
        {
            try
            {
                if (request is null)
                {
                    return BadRequest(new { success = false, message = "Payload requerido." });
                }

                EnsureStorage();
                var cfg = ReadConfig();

                var systemName = (request.systemName ?? cfg.systemName ?? "SISGE").Trim();
                if (string.IsNullOrWhiteSpace(systemName))
                {
                    return BadRequest(new { success = false, message = "El nombre del sistema es obligatorio." });
                }

                cfg.systemName = systemName;

                if (!string.IsNullOrWhiteSpace(request.logoFileName))
                {
                    var safeLogo = Path.GetFileName(request.logoFileName.Trim());
                    var exists = System.IO.File.Exists(Path.Combine(RootPath, safeLogo));
                    if (!exists)
                    {
                        return BadRequest(new { success = false, message = "El logo indicado no existe." });
                    }
                    cfg.logoFileName = safeLogo;
                }

                WriteConfig(cfg);
                return Ok(new { success = true, message = "Configuración de marca guardada correctamente." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error guardando configuración branding");
                return StatusCode(500, new { success = false, message = "Error guardando configuración branding.", detail = ex.Message });
            }
        }

        private static void EnsureStorage()
        {
            Directory.CreateDirectory(RootPath);
        }

        private static string ConfigPath => Path.Combine(RootPath, ConfigName);

        private static BrandingConfig ReadConfig()
        {
            if (System.IO.File.Exists(ConfigPath))
            {
                var json = System.IO.File.ReadAllText(ConfigPath);
                var cfg = JsonSerializer.Deserialize<BrandingConfig>(json, JsonOptions);
                if (cfg is not null)
                {
                    cfg.systemName = string.IsNullOrWhiteSpace(cfg.systemName) ? "SISGE" : cfg.systemName.Trim();
                    cfg.logoFileName = string.IsNullOrWhiteSpace(cfg.logoFileName) ? null : Path.GetFileName(cfg.logoFileName);
                    return cfg;
                }
            }

            return new BrandingConfig();
        }

        private static void WriteConfig(BrandingConfig config)
        {
            var safe = new BrandingConfig
            {
                systemName = string.IsNullOrWhiteSpace(config.systemName) ? "SISGE" : config.systemName.Trim(),
                logoFileName = string.IsNullOrWhiteSpace(config.logoFileName) ? null : Path.GetFileName(config.logoFileName)
            };

            var json = JsonSerializer.Serialize(safe, JsonOptions);
            System.IO.File.WriteAllText(ConfigPath, json);
        }

        private static string? BuildLogoUrl(string? fileName)
        {
            if (string.IsNullOrWhiteSpace(fileName))
            {
                return null;
            }

            var safe = Path.GetFileName(fileName);
            return $"/api/Branding/logo/{Uri.EscapeDataString(safe)}";
        }

        private static void TryDeleteLogo(string? fileName)
        {
            if (string.IsNullOrWhiteSpace(fileName))
            {
                return;
            }

            var safe = Path.GetFileName(fileName);
            var fullPath = Path.Combine(RootPath, safe);
            if (System.IO.File.Exists(fullPath))
            {
                System.IO.File.Delete(fullPath);
            }
        }
    }
}

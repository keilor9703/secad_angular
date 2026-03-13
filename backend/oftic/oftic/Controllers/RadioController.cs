using Comun.Dtos.Radio;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Negocio.Interfaz;
using System.Security.Claims;
using System.Text;

namespace ofic.Controllers
{
    public class DtoRadioLogoUploadRequest
    {
        public IFormFile? File { get; set; }
    }

    [ApiController]
    [Route("api/[controller]")]
    public class RadioController : ControllerBase
    {
        private const string RadioStreamUrl = "https://radio.policia.gov.co:8080/inhouse";
        private readonly IDbRadioService _radioService;
        private readonly ILogger<RadioController> _logger;
        private readonly string _radioLogoRootPath;

        public RadioController(
            IDbRadioService radioService,
            ILogger<RadioController> logger,
            IConfiguration configuration,
            IHostEnvironment environment)
        {
            _radioService = radioService;
            _logger = logger;
            _radioLogoRootPath = ResolveStoragePath(
                configuration,
                "Storage:RadioLogoPath",
                Path.Combine(environment.ContentRootPath, "uploads", "radios-logo"));
        }

        [HttpGet]
        [AllowAnonymous]
        public async Task<IActionResult> GetPublicas()
        {
            var data = await _radioService.GetPublicasAsync(HttpContext.RequestAborted);
            return Ok(data);
        }

        [HttpGet("admin")]
        [Authorize]
        public async Task<IActionResult> GetAdmin()
        {
            var data = await _radioService.GetAdminAsync(HttpContext.RequestAborted);
            return Ok(data);
        }

        [HttpGet("{id:long}")]
        [Authorize]
        public async Task<IActionResult> GetById(long id)
        {
            var item = await _radioService.GetByIdAsync(id, HttpContext.RequestAborted);
            if (item is null)
            {
                return NotFound(new { success = false, message = "Emisora no encontrada." });
            }

            return Ok(item);
        }

        [HttpPost]
        [Authorize]
        public async Task<IActionResult> Create([FromBody] DtoRadioEmisoraRequest request)
        {
            try
            {
                var (usuario, maquina) = GetAuditoria();
                var result = await _radioService.CreateAsync(request, usuario, maquina, HttpContext.RequestAborted);
                if (!result.success)
                {
                    return BadRequest(result);
                }

                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creando emisora");
                return StatusCode(500, new { success = false, message = "Error interno al crear emisora." });
            }
        }

        [HttpPut("{id:long}")]
        [Authorize]
        public async Task<IActionResult> Update(long id, [FromBody] DtoRadioEmisoraRequest request)
        {
            try
            {
                var (usuario, maquina) = GetAuditoria();
                var result = await _radioService.UpdateAsync(id, request, usuario, maquina, HttpContext.RequestAborted);
                if (!result.success)
                {
                    return BadRequest(result);
                }

                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error actualizando emisora {Id}", id);
                return StatusCode(500, new { success = false, message = "Error interno al actualizar emisora." });
            }
        }

        [HttpDelete("{id:long}")]
        [Authorize]
        public async Task<IActionResult> Delete(long id)
        {
            try
            {
                var (usuario, maquina) = GetAuditoria();
                var result = await _radioService.DeleteAsync(id, usuario, maquina, HttpContext.RequestAborted);
                if (!result.success)
                {
                    return BadRequest(result);
                }

                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error eliminando emisora {Id}", id);
                return StatusCode(500, new { success = false, message = "Error interno al eliminar emisora." });
            }
        }

        [HttpPut("{id:long}/activo")]
        [Authorize]
        public async Task<IActionResult> SetActivo(long id, [FromBody] DtoRadioEstadoRequest request)
        {
            try
            {
                var (usuario, maquina) = GetAuditoria();
                var result = await _radioService.SetActivoAsync(id, request.activo, usuario, maquina, HttpContext.RequestAborted);
                if (!result.success)
                {
                    return BadRequest(result);
                }

                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error actualizando estado de emisora {Id}", id);
                return StatusCode(500, new { success = false, message = "Error interno al actualizar estado." });
            }
        }

        [HttpPost("upload-logo")]
        [Authorize]
        [Consumes("multipart/form-data")]
        [RequestSizeLimit(300 * 1024)]
        [RequestFormLimits(MultipartBodyLengthLimit = 300 * 1024)]
        public async Task<IActionResult> UploadLogo([FromForm] DtoRadioLogoUploadRequest request)
        {
            try
            {
                var file = request?.File;
                if (file is null || file.Length <= 0)
                {
                    return BadRequest(new { success = false, message = "Archivo requerido." });
                }

                if (file.Length > 200 * 1024)
                {
                    return BadRequest(new { success = false, message = "El archivo supera 200KB." });
                }

                var extension = Path.GetExtension(file.FileName)?.ToLowerInvariant() ?? string.Empty;
                if (extension is not ".png" and not ".svg")
                {
                    return BadRequest(new { success = false, message = "Formato invalido. Solo PNG o SVG." });
                }

                if (!await IsValidLogoFileAsync(file, extension, HttpContext.RequestAborted))
                {
                    return BadRequest(new { success = false, message = "El contenido del archivo no coincide con PNG o SVG valido." });
                }

                Directory.CreateDirectory(_radioLogoRootPath);
                var safeName = $"{Guid.NewGuid():N}{extension}";
                var fullPath = Path.Combine(_radioLogoRootPath, safeName);

                await using (var stream = new FileStream(fullPath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                var publicUrl = $"/api/Radio/logo/{safeName}";
                return Ok(new
                {
                    success = true,
                    fileName = safeName,
                    url = publicUrl,
                    message = "Logo cargado correctamente."
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error cargando logo de radio");
                return StatusCode(500, new { success = false, message = "Error cargando logo." });
            }
        }

        [HttpGet("logo/{fileName}")]
        [AllowAnonymous]
        public IActionResult GetLogo([FromRoute] string fileName)
        {
            try
            {
                var normalized = Path.GetFileName(fileName ?? string.Empty);
                if (string.IsNullOrWhiteSpace(normalized))
                {
                    return BadRequest(new { message = "Nombre de archivo invalido." });
                }

                var fullPath = Path.Combine(_radioLogoRootPath, normalized);
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
                _logger.LogError(ex, "Error devolviendo logo de radio: {FileName}", fileName);
                return StatusCode(500, new { message = "Error cargando logo." });
            }
        }

        [HttpGet("stream")]
        [Produces("audio/mpeg")]
        [DisableRequestSizeLimit]
        [EnableCors]
        [AllowAnonymous]
        public async Task Stream()
        {
            try
            {
                Response.Headers.Append("Access-Control-Allow-Origin", "*");
                Response.Headers.Append("Access-Control-Expose-Headers", "*");
                Response.Headers.Append("Accept-Ranges", "bytes");

                using var httpClient = new HttpClient();
                httpClient.Timeout = TimeSpan.FromMinutes(30);
                httpClient.DefaultRequestHeaders.UserAgent.ParseAdd(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

                var request = new HttpRequestMessage(HttpMethod.Get, RadioStreamUrl);
                request.Headers.Add("Accept", "audio/mpeg, audio/*, */*");

                var response = await httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead);
                response.EnsureSuccessStatusCode();

                var contentType = response.Content.Headers.ContentType?.ToString() ?? "audio/mpeg";
                Response.ContentType = contentType;

                using var stream = await response.Content.ReadAsStreamAsync();

                var buffer = new byte[81920];
                while (!Response.HttpContext.RequestAborted.IsCancellationRequested)
                {
                    var bytesRead = await stream.ReadAsync(buffer);
                    if (bytesRead == 0)
                    {
                        break;
                    }

                    await Response.Body.WriteAsync(buffer.AsMemory(0, bytesRead));
                    await Response.Body.FlushAsync();
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Radio stream error");
                Response.StatusCode = 502;
                await Response.WriteAsync("Error connecting to radio stream");
            }
        }

        [HttpGet("status")]
        [AllowAnonymous]
        public IActionResult GetStatus()
        {
            return Ok(new
            {
                name = "Radio Policia Nacional",
                url = RadioStreamUrl,
                status = "online",
                message = "Transmision en vivo"
            });
        }

        [HttpGet("validar-stream")]
        [Authorize]
        public async Task<IActionResult> ValidarStream([FromQuery] string url)
        {
            if (string.IsNullOrWhiteSpace(url))
            {
                return BadRequest(new { success = false, active = false, message = "URL requerida." });
            }

            if (!Uri.TryCreate(url.Trim(), UriKind.Absolute, out var uri) ||
                (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
            {
                return BadRequest(new { success = false, active = false, message = "URL inválida." });
            }

            try
            {
                using var httpClient = new HttpClient
                {
                    Timeout = TimeSpan.FromSeconds(10)
                };
                httpClient.DefaultRequestHeaders.UserAgent.ParseAdd(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

                using var request = new HttpRequestMessage(HttpMethod.Get, uri);
                request.Headers.TryAddWithoutValidation("Accept", "audio/mpeg, audio/*, */*");

                using var response = await httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, HttpContext.RequestAborted);
                if (!response.IsSuccessStatusCode)
                {
                    return Ok(new
                    {
                        success = false,
                        active = false,
                        message = $"Sin señal válida. HTTP {(int)response.StatusCode} ({response.StatusCode})."
                    });
                }

                await using var stream = await response.Content.ReadAsStreamAsync(HttpContext.RequestAborted);
                var buffer = new byte[64];
                var bytesRead = await stream.ReadAsync(buffer.AsMemory(0, buffer.Length), HttpContext.RequestAborted);
                var active = bytesRead > 0;

                if (active)
                {
                    return Ok(new { success = true, active = true, message = "Se detectó señal de audio." });
                }

                return Ok(new { success = false, active = false, message = "Sin señal de audio en la respuesta." });
            }
            catch (TaskCanceledException)
            {
                return Ok(new { success = false, active = false, message = "Tiempo de espera agotado al validar stream." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error validando stream: {Url}", url);
                return Ok(new { success = false, active = false, message = "No fue posible validar la emisora." });
            }
        }

        private (string usuario, string maquina) GetAuditoria()
        {
            var usuario =
                User.FindFirstValue("id_usuario")
                ?? User.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? User.Identity?.Name
                ?? "SYSTEM";

            var maquina = HttpContext.Connection.RemoteIpAddress?.ToString()
                ?? Environment.MachineName
                ?? "N/A";

            return (usuario, maquina);
        }

        private static string ResolveStoragePath(IConfiguration configuration, string key, string fallback)
        {
            var configured = configuration[key];
            var path = string.IsNullOrWhiteSpace(configured) ? fallback : configured.Trim();
            return Path.GetFullPath(path);
        }

        private static async Task<bool> IsValidLogoFileAsync(IFormFile file, string extension, CancellationToken ct)
        {
            await using var stream = file.OpenReadStream();
            var header = new byte[Math.Min((int)file.Length, 512)];
            var bytesRead = await stream.ReadAsync(header.AsMemory(0, header.Length), ct);
            if (bytesRead <= 0)
            {
                return false;
            }

            if (extension == ".png")
            {
                return IsPng(header, bytesRead);
            }

            if (extension == ".svg")
            {
                return IsLikelySvg(header, bytesRead);
            }

            return false;
        }

        private static bool IsPng(byte[] bytes, int length)
        {
            if (length < 8)
            {
                return false;
            }

            return bytes[0] == 0x89 &&
                   bytes[1] == 0x50 &&
                   bytes[2] == 0x4E &&
                   bytes[3] == 0x47 &&
                   bytes[4] == 0x0D &&
                   bytes[5] == 0x0A &&
                   bytes[6] == 0x1A &&
                   bytes[7] == 0x0A;
        }

        private static bool IsLikelySvg(byte[] bytes, int length)
        {
            var text = Encoding.UTF8.GetString(bytes, 0, length).TrimStart('\uFEFF', ' ', '\t', '\r', '\n');
            var normalized = text.ToLowerInvariant();
            return normalized.StartsWith("<svg") || normalized.StartsWith("<?xml");
        }
    }
}

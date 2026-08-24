using Comun.Dtos.Recepcion;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Negocio.Interfaz;
using ofic.Security;
using System.Security.Claims;

namespace Api.Controllers.Operacion
{
    /// <summary>
    /// Gestión de fotos (y grabaciones de videollamada) adjuntas a pedidos de recepción.
    /// El archivo se guarda en disco en este controlador; el servicio sólo maneja la BD.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class AdjuntoController : ControllerBase
    {
        private readonly IDbAdjuntoService          _svc;
        private readonly IDbVideoLlamadaService      _videoSvc;
        private readonly ILogger<AdjuntoController> _logger;
        private readonly string                     _uploadsPath;

        private const long MaxFotoBytes  = 8 * 1024 * 1024;    // 8 MB
        private const long MaxVideoBytes = 100 * 1024 * 1024;  // 100 MB — deja margen bajo el límite global de Kestrel (150 MB)

        private static readonly HashSet<string> AllowedExtensions =
            new(StringComparer.OrdinalIgnoreCase) { ".jpg", ".jpeg", ".png", ".webp" };

        private static readonly HashSet<string> AllowedVideoExtensions =
            new(StringComparer.OrdinalIgnoreCase) { ".webm", ".mp4" };

        private string UsuarioClaim => User.FindFirstValue(ClaimTypes.Name)
                                    ?? User.FindFirstValue("unique_name") ?? "sistema";
        private int SitioGraba     => int.TryParse(User.FindFirstValue("sitio_graba"), out var v) ? v : 0;

        public AdjuntoController(
            IDbAdjuntoService          svc,
            IDbVideoLlamadaService     videoSvc,
            IConfiguration             configuration,
            IWebHostEnvironment        environment,
            ILogger<AdjuntoController> logger)
        {
            _svc      = svc;
            _videoSvc = videoSvc;
            _logger   = logger;

            var configured = configuration["AppSettings:UploadsPath"];
            var root = string.IsNullOrWhiteSpace(configured)
                ? Path.Combine(environment.ContentRootPath, "uploads")
                : configured;

            if (!Path.IsPathRooted(root))
                root = Path.GetFullPath(Path.Combine(environment.ContentRootPath, root));

            _uploadsPath = Path.GetFullPath(Path.Combine(root, "adjuntos"));
        }

        // ── POST api/Adjunto/subir ───────────────────────────────────────────────
        [HttpPost("subir")]
        [Consumes("multipart/form-data")]
        [RequestSizeLimit(9 * 1024 * 1024)]
        public async Task<IActionResult> SubirAdjunto(
            [FromForm] DtoUploadAdjuntoRequest req,
            CancellationToken ct)
        {
            var file = req?.File;
            if (file is null || file.Length == 0)
                return BadRequest(new { success = false, message = "Archivo requerido." });

            if (req!.PedidoId <= 0)
                return BadRequest(new { success = false, message = "PedidoId requerido." });

            if (file.Length > MaxFotoBytes)
                return BadRequest(new { success = false, message = $"La foto excede {MaxFotoBytes / 1024 / 1024} MB." });

            var ext = Path.GetExtension(file.FileName)?.ToLowerInvariant() ?? "";
            if (!AllowedExtensions.Contains(ext))
                return BadRequest(new { success = false, message = "Formato inválido. Use JPG, PNG o WEBP." });

            if (!SecurityGuards.HasValidImageSignature(file, ext))
                return BadRequest(new { success = false, message = "Firma de archivo inválida." });

            var sitio    = req.SitioGraba > 0 ? req.SitioGraba : SitioGraba;
            var subDir   = Path.Combine(_uploadsPath, sitio.ToString(), req.PedidoId.ToString());
            Directory.CreateDirectory(subDir);

            var safeName = $"{Guid.NewGuid():N}{ext}";
            var fullPath = Path.Combine(subDir, safeName);

            try
            {
                await using (var stream = new FileStream(fullPath, FileMode.Create))
                    await file.CopyToAsync(stream, ct);

                var rutaRelativa = string.Join("/", "uploads", "adjuntos",
                    sitio.ToString(), req.PedidoId.ToString(), safeName);

                var adjunto = new DtoAdjunto
                {
                    PedidoId       = req.PedidoId,
                    SitioGraba     = sitio,
                    TipoAdjunto    = "FOTO",
                    NombreOriginal = Path.GetFileName(file.FileName),
                    NombreGuardado = safeName,
                    RutaRelativa   = rutaRelativa,
                    MimeType       = file.ContentType,
                    TamanioBytes   = file.Length,
                    Descripcion    = req.Descripcion,
                    CanalOrigen    = req.CanalOrigen,
                    SubidoPor      = UsuarioClaim,
                    UrlPublica     = "/" + rutaRelativa
                };

                adjunto.Id = await _svc.RegistrarAdjuntoAsync(adjunto, ct);

                return Ok(new { success = true, data = adjunto, message = "Foto subida correctamente." });
            }
            catch (Exception ex)
            {
                // Si la BD falló, limpiar el archivo del disco
                if (System.IO.File.Exists(fullPath))
                    try { System.IO.File.Delete(fullPath); } catch { /* ignorar */ }

                _logger.LogError(ex, "SubirAdjunto error pedidoId={Id}", req.PedidoId);
                return StatusCode(500, new { success = false, message = "Error interno al subir la foto." });
            }
        }

        // ── POST api/Adjunto/subir-video ─────────────────────────────────────────
        // Grabación de una videollamada (MediaRecorder del navegador del
        // despachador) — mismo patrón que SubirAdjunto, con límites propios de video.
        [HttpPost("subir-video")]
        [Consumes("multipart/form-data")]
        [RequestSizeLimit(101 * 1024 * 1024)]
        public async Task<IActionResult> SubirVideo(
            [FromForm] DtoUploadAdjuntoRequest req,
            [FromForm] long sesionId,
            CancellationToken ct)
        {
            var file = req?.File;
            if (file is null || file.Length == 0)
                return BadRequest(new { success = false, message = "Archivo requerido." });

            if (req!.PedidoId <= 0)
                return BadRequest(new { success = false, message = "PedidoId requerido." });

            if (file.Length > MaxVideoBytes)
                return BadRequest(new { success = false, message = $"El video excede {MaxVideoBytes / 1024 / 1024} MB." });

            var ext = Path.GetExtension(file.FileName)?.ToLowerInvariant() ?? "";
            if (!AllowedVideoExtensions.Contains(ext))
                return BadRequest(new { success = false, message = "Formato inválido. Use WEBM o MP4." });

            if (!SecurityGuards.HasValidVideoSignature(file, ext))
                return BadRequest(new { success = false, message = "Firma de archivo inválida." });

            var sitio    = req.SitioGraba > 0 ? req.SitioGraba : SitioGraba;
            var subDir   = Path.Combine(_uploadsPath, sitio.ToString(), req.PedidoId.ToString());
            Directory.CreateDirectory(subDir);

            var safeName = $"{Guid.NewGuid():N}{ext}";
            var fullPath = Path.Combine(subDir, safeName);

            try
            {
                await using (var stream = new FileStream(fullPath, FileMode.Create))
                    await file.CopyToAsync(stream, ct);

                var rutaRelativa = string.Join("/", "uploads", "adjuntos",
                    sitio.ToString(), req.PedidoId.ToString(), safeName);

                var adjunto = new DtoAdjunto
                {
                    PedidoId       = req.PedidoId,
                    SitioGraba     = sitio,
                    TipoAdjunto    = "VIDEO",
                    NombreOriginal = Path.GetFileName(file.FileName),
                    NombreGuardado = safeName,
                    RutaRelativa   = rutaRelativa,
                    MimeType       = file.ContentType,
                    TamanioBytes   = file.Length,
                    Descripcion    = req.Descripcion,
                    CanalOrigen    = "VIDEOLLAMADA",
                    SubidoPor      = UsuarioClaim,
                    UrlPublica     = "/" + rutaRelativa
                };

                adjunto.Id = await _svc.RegistrarAdjuntoAsync(adjunto, ct);

                if (sesionId > 0)
                    await _videoSvc.VincularGrabacionAsync(sesionId, adjunto.Id, ct);

                return Ok(new { success = true, data = adjunto, message = "Grabación subida correctamente." });
            }
            catch (Exception ex)
            {
                if (System.IO.File.Exists(fullPath))
                    try { System.IO.File.Delete(fullPath); } catch { /* ignorar */ }

                _logger.LogError(ex, "SubirVideo error pedidoId={Id} sesionId={Sesion}", req.PedidoId, sesionId);
                return StatusCode(500, new { success = false, message = "Error interno al subir la grabación." });
            }
        }

        // ── GET api/Adjunto/{pedidoId} ───────────────────────────────────────────
        [HttpGet("{pedidoId:long}")]
        public async Task<IActionResult> GetAdjuntos(long pedidoId, CancellationToken ct)
        {
            try
            {
                var data = await _svc.GetAdjuntosAsync(pedidoId, ct);
                return Ok(new { success = true, data });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GetAdjuntos error pedidoId={Id}", pedidoId);
                return StatusCode(500, new { success = false, data = new List<object>(), message = ex.Message });
            }
        }

        // ── DELETE api/Adjunto/{id} ──────────────────────────────────────────────
        [HttpDelete("{id:long}")]
        public async Task<IActionResult> EliminarAdjunto(long id, CancellationToken ct)
        {
            try
            {
                var (found, ruta) = await _svc.EliminarRegistroAsync(id, ct);
                if (!found)
                    return NotFound(new { success = false, message = "Adjunto no encontrado." });

                // Borrar el archivo del disco (no crítico — el registro ya fue eliminado)
                if (!string.IsNullOrEmpty(ruta))
                {
                    var fullPath = Path.GetFullPath(
                        Path.Combine(_uploadsPath, "..", "..",
                            ruta.Replace('/', Path.DirectorySeparatorChar)));
                    if (System.IO.File.Exists(fullPath))
                        try { System.IO.File.Delete(fullPath); }
                        catch (Exception ex) { _logger.LogWarning(ex, "No se pudo borrar archivo {P}", fullPath); }
                }

                return Ok(new { success = true, message = "Adjunto eliminado." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "EliminarAdjunto error id={Id}", id);
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }
    }
}

using Comun.Dtos.Recepcion;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Negocio.Interfaz;
using System.Security.Claims;

namespace Api.Controllers.Operacion
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class RecepcionController : ControllerBase
    {
        private readonly IDbRecepcionService _svc;
        private readonly ILogger<RecepcionController> _logger;

        public RecepcionController(IDbRecepcionService svc, ILogger<RecepcionController> logger)
        {
            _svc    = svc;
            _logger = logger;
        }

        // ── Helper: extract claims ────────────────────────────────────────────────

        private int    SitioGraba  => int.TryParse(User.FindFirstValue("sitio_graba"),   out var v) ? v : 0;
        private int    AcdClaim    => int.TryParse(User.FindFirstValue("acd"),            out var v) ? v : 0;
        private int    FuerzaId    => int.TryParse(User.FindFirstValue("fuerza_id"),     out var v) ? v : 0;
        private string UsuarioClaim => User.FindFirstValue(ClaimTypes.Name) ?? User.FindFirstValue("unique_name") ?? "";
        private long   EmpleadoId  => long.TryParse(User.FindFirstValue("id_usuario"),   out var v) ? v : 0;

        // ──────────────────────────────────────────────────────────────────────────
        // GET api/Recepcion/llamada
        // Poll CTI for an incoming call on the operator's site/ACD.
        // ──────────────────────────────────────────────────────────────────────────
        [HttpGet("llamada")]
        public async Task<IActionResult> GetLlamada(CancellationToken ct)
        {
            try
            {
                var data = await _svc.F_GetLlamadasAsync(SitioGraba, AcdClaim, ct);
                if (data is null)
                    return Ok(new { success = false, data = (object?)null, message = "Sin llamadas entrantes" });
                return Ok(new { success = true, data, message = "Llamada encontrada" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GetLlamada error");
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }

        // ──────────────────────────────────────────────────────────────────────────
        // POST api/Recepcion/consecutivo
        // ──────────────────────────────────────────────────────────────────────────
        [HttpPost("consecutivo")]
        public async Task<IActionResult> GetConsecutivo(CancellationToken ct)
        {
            try
            {
                var seq = await _svc.F_ConsultarSeqPedidoAsync(ct);
                return Ok(new { success = true, data = seq, message = "" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GetConsecutivo error");
                return StatusCode(500, new { success = false, data = 0, message = ex.Message });
            }
        }

        // ──────────────────────────────────────────────────────────────────────────
        // GET api/Recepcion/canales?sitioGraba={x}
        // ──────────────────────────────────────────────────────────────────────────
        [HttpGet("canales")]
        public async Task<IActionResult> GetCanales([FromQuery] int? sitioGraba, CancellationToken ct)
        {
            try
            {
                var sg   = sitioGraba ?? SitioGraba;
                var data = await _svc.F_GetCanalesAsync(sg, ct);
                return Ok(data);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GetCanales error");
                return StatusCode(500, new List<object>());
            }
        }

        // ──────────────────────────────────────────────────────────────────────────
        // GET api/Recepcion/referencias?nombre={TIPO_PEDIDO|CALI_PEDIDO|…}
        // ──────────────────────────────────────────────────────────────────────────
        [HttpGet("referencias")]
        public async Task<IActionResult> GetReferencias([FromQuery] string nombre, CancellationToken ct)
        {
            try
            {
                var data = await _svc.F_GetReferenciasAsync(nombre, ct);
                return Ok(data);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GetReferencias error");
                return StatusCode(500, new List<object>());
            }
        }

        // ──────────────────────────────────────────────────────────────────────────
        // POST api/Recepcion/casos-intel   body: { busqueda }
        // ──────────────────────────────────────────────────────────────────────────
        [HttpPost("casos-intel")]
        public async Task<IActionResult> BuscarCasos([FromBody] BusquedaCasoRequest req, CancellationToken ct)
        {
            try
            {
                var data = await _svc.F_GetCasosIntelAsync(req.Busqueda ?? "", ct);
                return Ok(new { success = true, data, message = "" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "BuscarCasos error");
                return StatusCode(500, new { success = false, data = new List<object>(), message = ex.Message });
            }
        }

        // ──────────────────────────────────────────────────────────────────────────
        // POST api/Recepcion/caso-por-codigo   body: { codigo }
        // ──────────────────────────────────────────────────────────────────────────
        [HttpPost("caso-por-codigo")]
        public async Task<IActionResult> GetCasoPorCodigo([FromBody] CodigoCasoRequest req, CancellationToken ct)
        {
            try
            {
                var data = await _svc.F_GetCasoPorCodigoAsync(req.Codigo ?? "", ct);
                if (data is null)
                    return Ok(new { success = false, data = (object?)null, message = "Código no encontrado" });
                return Ok(new { success = true, data, message = "" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GetCasoPorCodigo error");
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }

        // ──────────────────────────────────────────────────────────────────────────
        // POST api/Recepcion/buscar-asociar   body: DtoBusquedaAsociarLlamada
        // ──────────────────────────────────────────────────────────────────────────
        [HttpPost("buscar-asociar")]
        public async Task<IActionResult> BuscarLlamadasAsociar(
            [FromBody] DtoBusquedaAsociarLlamada dto, CancellationToken ct)
        {
            if (dto is null)
                return BadRequest(new { success = false, data = new List<object>(), message = "Datos requeridos" });
            try
            {
                var data = await _svc.F_BuscarLlamadasAsociarAsync(dto.SitioGraba, dto.HoraCaso, dto.NumeLlamada, ct);
                return Ok(new { success = true, data, message = "" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "BuscarLlamadasAsociar error");
                return StatusCode(500, new { success = false, data = new List<object>(), message = ex.Message });
            }
        }

        // ──────────────────────────────────────────────────────────────────────────
        // POST api/Recepcion/guardar   body: DtoRecepcion
        // ──────────────────────────────────────────────────────────────────────────
        [HttpPost("guardar")]
        public async Task<IActionResult> GuardarLlamada([FromBody] DtoRecepcion datos, CancellationToken ct)
        {
            if (datos is null)
                return BadRequest(new { success = false, message = "Datos requeridos" });
            try
            {
                var result = await _svc.P_GuardarLlamadaAsync(datos, FuerzaId, UsuarioClaim, EmpleadoId, ct);
                return Ok(new { success = result.Success, message = result.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GuardarLlamada error");
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }

        // ──────────────────────────────────────────────────────────────────────────
        // POST api/Recepcion/cerrar-rapido   body: DtoRecepcion
        // ──────────────────────────────────────────────────────────────────────────
        [HttpPost("cerrar-rapido")]
        public async Task<IActionResult> CerrarRapido([FromBody] DtoRecepcion datos, CancellationToken ct)
        {
            if (datos is null)
                return BadRequest(new { success = false, message = "Datos requeridos" });
            try
            {
                var result = await _svc.P_CerrarLlamadaRapidaAsync(datos, UsuarioClaim, ct);
                return Ok(new { success = result.Success, message = result.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "CerrarRapido error");
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }
    }

    // ── Lightweight request bodies ────────────────────────────────────────────────
    public record BusquedaCasoRequest(string? Busqueda);
    public record CodigoCasoRequest(string? Codigo);
}

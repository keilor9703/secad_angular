using Comun.Dtos.Eventos;
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
        private readonly IDbRecepcionService            _svc;
        private readonly ILogger<RecepcionController>   _logger;

        public RecepcionController(IDbRecepcionService svc, ILogger<RecepcionController> logger)
        {
            _svc    = svc;
            _logger = logger;
        }

        // ── Claims helpers ───────────────────────────────────────────────────────
        private int    SitioGraba   => int.TryParse(User.FindFirstValue("sitio_graba"),  out var v) ? v : 0;
        private int    AcdClaim     => int.TryParse(User.FindFirstValue("acd"),           out var v) ? v : 0;
        private int    FuerzaId     => int.TryParse(User.FindFirstValue("fuerza_id"),    out var v) ? v : 0;
        private string UsuarioClaim => User.FindFirstValue(ClaimTypes.Name)
                                    ?? User.FindFirstValue("unique_name") ?? "";
        private long   EmpleadoId   => long.TryParse(User.FindFirstValue("id_usuario"), out var v) ? v : 0;

        // ════════════════════════════════════════════════════════════════════════
        // CTI / INCOMING CALL
        // GET api/Recepcion/llamada
        // ════════════════════════════════════════════════════════════════════════
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

        // ════════════════════════════════════════════════════════════════════════
        // SNOWFLAKE ID (antes era nextval de secuencia)
        // POST api/Recepcion/consecutivo
        // ════════════════════════════════════════════════════════════════════════
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
                return StatusCode(500, new { success = false, data = 0L, message = ex.Message });
            }
        }

        // ════════════════════════════════════════════════════════════════════════
        // CATALOG
        // GET api/Recepcion/canales
        // GET api/Recepcion/referencias?nombre=TIPO_PEDIDO
        // POST api/Recepcion/casos-intel        body: { busqueda }
        // POST api/Recepcion/caso-por-codigo    body: { codigo }
        // POST api/Recepcion/buscar-asociar     body: DtoBusquedaAsociarLlamada
        // ════════════════════════════════════════════════════════════════════════

        [HttpGet("canales")]
        public async Task<IActionResult> GetCanales([FromQuery] int? sitioGraba, CancellationToken ct)
        {
            try   { return Ok(await _svc.F_GetCanalesAsync(sitioGraba ?? SitioGraba, ct)); }
            catch { return StatusCode(500, new List<object>()); }
        }

        [HttpGet("referencias")]
        public async Task<IActionResult> GetReferencias([FromQuery] string nombre, CancellationToken ct)
        {
            try   { return Ok(await _svc.F_GetReferenciasAsync(nombre, ct)); }
            catch { return StatusCode(500, new List<object>()); }
        }

        [HttpPost("casos-intel")]
        public async Task<IActionResult> BuscarCasos(
            [FromBody] BusquedaCasoRequest req, CancellationToken ct)
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

        [HttpPost("caso-por-codigo")]
        public async Task<IActionResult> GetCasoPorCodigo(
            [FromBody] CodigoCasoRequest req, CancellationToken ct)
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

        [HttpPost("buscar-asociar")]
        public async Task<IActionResult> BuscarLlamadasAsociar(
            [FromBody] DtoBusquedaAsociarLlamada dto, CancellationToken ct)
        {
            if (dto is null)
                return BadRequest(new { success = false, data = new List<object>(), message = "Datos requeridos" });
            try
            {
                var data = await _svc.F_BuscarLlamadasAsociarAsync(
                    dto.SitioGraba, dto.HoraCaso, dto.NumeLlamada, ct);
                return Ok(new { success = true, data, message = "" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "BuscarLlamadasAsociar error");
                return StatusCode(500, new { success = false, data = new List<object>(), message = ex.Message });
            }
        }

        // ════════════════════════════════════════════════════════════════════════
        // SAVE / QUICK-CLOSE
        // POST api/Recepcion/guardar        body: DtoRecepcion
        // POST api/Recepcion/cerrar-rapido  body: DtoRecepcion
        // ════════════════════════════════════════════════════════════════════════

        [HttpPost("guardar")]
        public async Task<IActionResult> GuardarLlamada(
            [FromBody] DtoRecepcion datos, CancellationToken ct)
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

        [HttpPost("cerrar-rapido")]
        public async Task<IActionResult> CerrarRapido(
            [FromBody] DtoRecepcion datos, CancellationToken ct)
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

        // ════════════════════════════════════════════════════════════════════════
        // EVENT LIFECYCLE  (usados desde el módulo de Eventos — despachador)
        // GET  api/Recepcion/evento/{id}
        // GET  api/Recepcion/evento/pedido/{pedidoId}
        // PUT  api/Recepcion/evento/{id}/estado       body: { estado }
        // POST api/Recepcion/evento/cerrar            body: DtoCierreEventoRequest
        // ════════════════════════════════════════════════════════════════════════

        /// <summary>
        /// Detalle completo de un evento, incluyendo todos sus códigos de cierre.
        /// </summary>
        [HttpGet("evento/{id:long}")]
        public async Task<IActionResult> GetEvento(long id, CancellationToken ct)
        {
            try
            {
                var data = await _svc.G_GetEventoAsync(id, ct);
                if (data is null)
                    return NotFound(new { success = false, message = $"Evento {id} no encontrado." });
                return Ok(new { success = true, data });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GetEvento error id={Id}", id);
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }

        /// <summary>
        /// Eventos asociados a un pedido (llamada). Útil para mostrar el historial
        /// de despacho en el detalle del pedido.
        /// </summary>
        [HttpGet("evento/pedido/{pedidoId:long}")]
        public async Task<IActionResult> GetEventosPorPedido(long pedidoId, CancellationToken ct)
        {
            try
            {
                var data = await _svc.G_GetEventosPorPedidoAsync(pedidoId, ct);
                return Ok(new { success = true, data });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GetEventosPorPedido error pedidoId={Id}", pedidoId);
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }

        /// <summary>
        /// Marca un evento como Despachado (D) o Atendido (A).
        /// Registra el timestamp de despacho o llegada según corresponda.
        /// </summary>
        [HttpPut("evento/{id:long}/estado")]
        public async Task<IActionResult> ActualizarEstadoEvento(
            long id, [FromBody] ActualizarEstadoRequest req, CancellationToken ct)
        {
            if (req is null || string.IsNullOrWhiteSpace(req.Estado))
                return BadRequest(new { success = false, message = "Estado requerido." });
            try
            {
                var result = await _svc.P_ActualizarEstadoEventoAsync(id, req.Estado, UsuarioClaim, ct);
                return Ok(new { success = result.Success, message = result.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "ActualizarEstadoEvento error id={Id}", id);
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }

        /// <summary>
        /// Cierra un evento con uno o más códigos de cierre.
        /// El primer código de la lista se usa como código primario.
        /// </summary>
        [HttpPost("evento/cerrar")]
        public async Task<IActionResult> CerrarEvento(
            [FromBody] DtoCierreEventoRequest req, CancellationToken ct)
        {
            if (req is null || req.EventoId <= 0)
                return BadRequest(new { success = false, message = "EventoId requerido." });
            if (req.CodigosCierre is null || req.CodigosCierre.Count == 0)
                return BadRequest(new { success = false, message = "Debe proporcionar al menos un código de cierre." });
            try
            {
                var result = await _svc.P_CerrarEventoAsync(req, UsuarioClaim, ct);
                return Ok(new { success = result.Success, message = result.Message, eventoId = result.EventoId });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "CerrarEvento error eventoId={Id}", req.EventoId);
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }

        // ════════════════════════════════════════════════════════════════════════
        // EXTERNAL INTEGRATION
        // POST api/Recepcion/integracion/evento
        // Usado por apps móviles, sistemas externos, SIEDCO, etc.
        // ════════════════════════════════════════════════════════════════════════

        /// <summary>
        /// Crea un evento directamente desde un sistema externo (app móvil, API).
        /// El evento queda en estado Pendiente para que el despachador lo atienda.
        /// </summary>
        [HttpPost("integracion/evento")]
        public async Task<IActionResult> CrearEventoIntegracion(
            [FromBody] DtoEventoIntegracionRequest req, CancellationToken ct)
        {
            if (req is null)
                return BadRequest(new { success = false, message = "Datos requeridos." });
            try
            {
                var result = await _svc.P_CrearEventoIntegracionAsync(req, UsuarioClaim, ct);
                if (!result.Success)
                    return BadRequest(new { success = false, message = result.Message });
                return Ok(new
                {
                    success  = true,
                    message  = result.Message,
                    eventoId = result.EventoId,
                    pedidoId = result.PedidoId
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "CrearEventoIntegracion error");
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }
    }

    // ── Lightweight request bodies ────────────────────────────────────────────
    public record BusquedaCasoRequest(string? Busqueda);
    public record CodigoCasoRequest(string? Codigo);
    public record ActualizarEstadoRequest(string? Estado);
}

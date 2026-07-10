using Comun.Dtos.Incidentes;
using Ev = Comun.Dtos.Eventos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Negocio.Interfaz;
using System.Security.Claims;

namespace Api.Controllers.Operacion
{
    /// <summary>
    /// Dispatcher queue module (Módulo de Eventos).
    /// Events are incidents that have been validated and sent from Recepción
    /// (enviar='S'). The dispatcher sees only those assigned to their canal.
    /// This controller does NOT expose Create/Update — those are created via
    /// RecepcionController (P_GuardarLlamadaAsync) and, separately, via
    /// PedidoController (api/Pedido), which also has its own Create/Update/
    /// SetEstado over the same cad_pedidos table for the Jefe de Turno dashboard.
    /// Both write paths must be considered when auditing cad_pedidos writers.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [EnableCors("PublicCors")]
    [Authorize]
    public class EventoController : ControllerBase
    {
        private readonly IDbPedidoService _service;
        private readonly ILogger<EventoController> _logger;

        public EventoController(IDbPedidoService service, ILogger<EventoController> logger)
        {
            _service = service;
            _logger = logger;
        }

        /// <summary>
        /// Returns the events (dispatched incidents) for the given canal.
        /// canalId and fuerzaId default to the values embedded in the dispatcher's JWT.
        /// The frontend may pass explicit values to allow canal selection UI.
        /// </summary>
        [HttpGet]
        public async Task<ActionResult> GetEventos(
            [FromQuery] int?    canalId,
            [FromQuery] int?    fuerzaId,
            [FromQuery] string? estado,
            CancellationToken ct)
        {
            // Resolve canal from query-param, then JWT claim
            var resolvedCanal  = canalId  ?? GetIntClaim("canal_id");
            var resolvedFuerza = fuerzaId ?? GetIntClaim("fuerza_id");

            if (resolvedCanal <= 0)
            {
                // Canal not configured — return empty list with a hint
                return Ok(new
                {
                    items   = Array.Empty<object>(),
                    warning = "Canal no configurado para este usuario. Seleccione un canal."
                });
            }

            try
            {
                var result = await _service.GetEventosByCanalAsync(resolvedCanal, resolvedFuerza, estado, ct);
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al listar eventos canal={Canal} fuerza={Fuerza}", resolvedCanal, resolvedFuerza);
                return StatusCode(500, new { success = false, message = $"Error: {ex.Message}" });
            }
        }

        /// <summary>
        /// Returns the full detail of a specific event (incident), including annotations.
        /// Logs the access for audit compliance (Ley 1581/2012) and marks primer acceso for SLA.
        /// </summary>
        [HttpGet("{id:long}")]
        public async Task<ActionResult> GetById(long id, CancellationToken ct)
        {
            try
            {
                var result = await _service.GetByIdAsync(id, ct);
                if (result == null)
                    return NotFound(new { success = false, message = "Evento no encontrado." });

                // ── Épica 1 & 5: Auditoría + primer acceso + promoción a "En proceso" ──
                // Se espera (no fire-and-forget) porque puede cambiar result.Estado y la
                // respuesta debe reflejarlo de inmediato, sin esperar el próximo poll.
                var (usuario, username, ip) = ObtenerAuditoria();
                var estadoPromovido = await _service.RegistrarAccesoAsync(id, usuario, username, ip, "VIEW", ct);
                if (estadoPromovido is not null)
                    result.Estado = estadoPromovido;

                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener evento id={Id}", id);
                return StatusCode(500, new { success = false, message = $"Error: {ex.Message}" });
            }
        }

        /// <summary>
        /// Returns per-state event counts for the dispatcher's filter badges.
        /// Closed events only count those within the current shift.
        /// This endpoint is lightweight (single COUNT aggregate query).
        /// </summary>
        [HttpGet("conteos")]
        public async Task<ActionResult> GetConteos(
            [FromQuery] int? canalId,
            [FromQuery] int? fuerzaId,
            CancellationToken ct)
        {
            var resolvedCanal  = canalId  ?? GetIntClaim("canal_id");
            var resolvedFuerza = fuerzaId ?? GetIntClaim("fuerza_id");

            if (resolvedCanal <= 0)
                return Ok(new DtoEventoConteos());

            try
            {
                var result = await _service.GetConteosByCanalAsync(resolvedCanal, resolvedFuerza, ct);
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener conteos canal={Canal} fuerza={Fuerza}", resolvedCanal, resolvedFuerza);
                return StatusCode(500, new { success = false, message = $"Error: {ex.Message}" });
            }
        }

        /// <summary>
        /// Returns active SLA thresholds from cad_config_sla.
        /// The frontend uses these to color-code events in the dispatcher queue.
        /// Thresholds are configurable from the admin panel — never hardcoded.
        /// </summary>
        [HttpGet("sla-config")]
        public async Task<ActionResult> GetSlaConfig(CancellationToken ct)
        {
            try
            {
                var result = await _service.GetSlaConfigAsync(ct);
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener configuración SLA");
                return StatusCode(500, new { success = false, message = $"Error: {ex.Message}" });
            }
        }

        private static readonly HashSet<string> EstadosValidos = new(StringComparer.Ordinal)
            { "A", "P", "E", "T", "R", "C" };

        /// <summary>
        /// Changes the management state of an event.
        /// Valid states: A=Activo, P=Pendiente, E=En proceso, T=Seguimiento, R=Revisión, C=Cerrado
        /// </summary>
        [HttpPut("{id:long}/estado")]
        public async Task<ActionResult> SetEstado(long id, [FromBody] DtoEstadoPedidoRequest request, CancellationToken ct)
        {
            if (!EstadosValidos.Contains(request.Estado))
                return BadRequest(new { success = false, message = $"Estado inválido: '{request.Estado}'. Valores permitidos: A, P, E, T, R, C." });

            try
            {
                var (usuario, _, maquina) = ObtenerAuditoria();
                var result = await _service.SetEstadoAsync(id, request.Estado, usuario, maquina, ct);
                if (!result.Success)
                    return BadRequest(new { success = false, message = result.Message });
                return Ok(new { success = true, message = result.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al cambiar estado evento id={Id}", id);
                return StatusCode(500, new { success = false, message = $"Error: {ex.Message}" });
            }
        }

        /// <summary>
        /// Adds an annotation (note) to an event.
        /// </summary>
        [HttpPost("{id:long}/anotaciones")]
        public async Task<ActionResult> CreateAnotacion(long id, [FromBody] DtoAnotacionRequest request, CancellationToken ct)
        {
            try
            {
                var (usuario, username, maquina) = ObtenerAuditoria();
                var result = await _service.CreateAnotacionAsync(id, request, usuario, username, maquina, ct);
                if (!result.Success)
                    return BadRequest(new { success = false, message = result.Message });
                return Ok(new { success = true, id = result.Id, message = result.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al crear anotación evento id={Id}", id);
                return StatusCode(500, new { success = false, message = $"Error: {ex.Message}" });
            }
        }

        /// <summary>
        /// Retrieves all annotations for an event.
        /// </summary>
        [HttpGet("{id:long}/anotaciones")]
        public async Task<ActionResult> GetAnotaciones(long id, CancellationToken ct)
        {
            try
            {
                var result = await _service.GetAnotacionesAsync(id, ct);
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al listar anotaciones evento id={Id}", id);
                return StatusCode(500, new { success = false, message = $"Error: {ex.Message}" });
            }
        }

        /// <summary>
        /// Closes an event from the dispatcher module.
        /// Persists closure codes and observation to cad_eventos only.
        /// cad_pedidos.comentario is IMMUTABLE and is never touched here —
        /// only cad_pedidos.estado is updated to 'C'.
        /// </summary>
        [HttpPost("{id:long}/cerrar")]
        public async Task<ActionResult> Cerrar(long id, [FromBody] Ev.DtoCerrarEventoDespachoRequest request, CancellationToken ct)
        {
            try
            {
                var (usuarioId, username, maquina) = ObtenerAuditoria();
                var result = await _service.CerrarEventoDesdeDespachoAsync(id, request, usuarioId, username, maquina, ct);
                if (!result.Success)
                    return BadRequest(new { success = false, message = result.Message });
                return Ok(new { success = true, message = result.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al cerrar evento id={Id}", id);
                return StatusCode(500, new { success = false, message = $"Error: {ex.Message}" });
            }
        }

        /// <summary>
        /// Returns the dispatch channels available for a given recording site.
        /// Used by the canal selector in the Eventos UI.
        /// </summary>
        [HttpGet("canales")]
        public async Task<ActionResult> GetCanales([FromQuery] int? sitioGraba, CancellationToken ct)
        {
            var sitio = sitioGraba ?? GetIntClaim("sitio_graba");
            try
            {
                var result = await _service.GetCanalesPorSitioAsync(sitio, ct);
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al listar canales sitioGraba={Sg}", sitio);
                return StatusCode(500, new { success = false, message = $"Error: {ex.Message}" });
            }
        }

        // ─── Helpers ──────────────────────────────────────────────────────────

        private (long usuario, string username, string maquina) ObtenerAuditoria()
        {
            var rawId = User.FindFirstValue("id_usuario")
                ?? User.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? User.FindFirstValue("nameid");
            long.TryParse(rawId, out var usuario);
            if (usuario == 0) usuario = 1;

            var username = User.FindFirstValue("username")
                ?? User.FindFirstValue(ClaimTypes.Name)
                ?? "sistema";

            var maquina = HttpContext.Connection.RemoteIpAddress?.ToString()
                ?? Environment.MachineName
                ?? "N/A";

            return (usuario, username, maquina);
        }

        private int GetIntClaim(string claimType)
        {
            var raw = User.FindFirstValue(claimType);
            return int.TryParse(raw, out var val) ? val : 0;
        }
    }
}

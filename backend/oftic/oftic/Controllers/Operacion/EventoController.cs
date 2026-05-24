using Comun.Dtos.Incidentes;
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
    /// This controller does NOT expose Create/Update — those belong to Recepción.
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

            var result = await _service.GetEventosByCanalAsync(resolvedCanal, resolvedFuerza, estado, ct);
            return Ok(result);
        }

        /// <summary>
        /// Returns the full detail of a specific event (incident), including annotations.
        /// </summary>
        [HttpGet("{id:long}")]
        public async Task<ActionResult> GetById(long id, CancellationToken ct)
        {
            var result = await _service.GetByIdAsync(id, ct);
            if (result == null)
                return NotFound(new { success = false, message = "Evento no encontrado." });
            return Ok(result);
        }

        /// <summary>
        /// Changes the management state of an event.
        /// Valid states: A=Activo, P=Pendiente, E=En proceso, T=Seguimiento, R=Revisión, C=Cerrado
        /// </summary>
        [HttpPut("{id:long}/estado")]
        public async Task<ActionResult> SetEstado(long id, [FromBody] DtoEstadoPedidoRequest request, CancellationToken ct)
        {
            var (usuario, _, maquina) = ObtenerAuditoria();
            var result = await _service.SetEstadoAsync(id, request.Estado, usuario, maquina, ct);
            if (!result.Success)
                return BadRequest(new { success = false, message = result.Message });
            return Ok(new { success = true, message = result.Message });
        }

        /// <summary>
        /// Adds an annotation (note) to an event.
        /// </summary>
        [HttpPost("{id:long}/anotaciones")]
        public async Task<ActionResult> CreateAnotacion(long id, [FromBody] DtoAnotacionRequest request, CancellationToken ct)
        {
            var (usuario, username, maquina) = ObtenerAuditoria();
            var result = await _service.CreateAnotacionAsync(id, request, usuario, username, maquina, ct);
            if (!result.Success)
                return BadRequest(new { success = false, message = result.Message });
            return Ok(new { success = true, id = result.Id, message = result.Message });
        }

        /// <summary>
        /// Retrieves all annotations for an event.
        /// </summary>
        [HttpGet("{id:long}/anotaciones")]
        public async Task<ActionResult> GetAnotaciones(long id, CancellationToken ct)
        {
            var result = await _service.GetAnotacionesAsync(id, ct);
            return Ok(result);
        }

        /// <summary>
        /// Quick-close an event with a closing comment.
        /// </summary>
        [HttpPost("{id:long}/cerrar")]
        public async Task<ActionResult> Cerrar(long id, [FromBody] DtoCerrarRapidoRequest request, CancellationToken ct)
        {
            var (usuario, _, maquina) = ObtenerAuditoria();
            var result = await _service.CerrarRapidoAsync(id, request, usuario, maquina, ct);
            if (!result.Success)
                return BadRequest(new { success = false, message = result.Message });
            return Ok(new { success = true, message = result.Message });
        }

        /// <summary>
        /// Returns the dispatch channels available for a given recording site.
        /// Used by the canal selector in the Eventos UI.
        /// </summary>
        [HttpGet("canales")]
        public async Task<ActionResult> GetCanales([FromQuery] int? sitioGraba, CancellationToken ct)
        {
            var sitio = sitioGraba ?? GetIntClaim("sitio_graba");
            var result = await _service.GetCanalesPorSitioAsync(sitio, ct);
            return Ok(result);
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

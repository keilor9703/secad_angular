using Comun.Dtos.Operacion;
using Datos.Interfaz;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Api.Controllers.Operacion
{
    /// <summary>
    /// Bitácora de turno — §6.15 Anotaciones Generales.
    /// Registro de comunicados, revistas, novedades y actividades
    /// durante el turno, independiente de incidentes.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [EnableCors("PublicCors")]
    [Authorize]
    public class AnotacionTurnoController : ControllerBase
    {
        private readonly IDbAnotacionTurnoRepository _repo;
        private readonly ILogger<AnotacionTurnoController> _logger;

        public AnotacionTurnoController(
            IDbAnotacionTurnoRepository repo,
            ILogger<AnotacionTurnoController> logger)
        {
            _repo   = repo;
            _logger = logger;
        }

        // ─── GET /api/AnotacionTurno ─────────────────────────────────────────
        [HttpGet]
        public async Task<IActionResult> GetList(
            [FromQuery] int?    canal,
            [FromQuery] int?    sitio,
            [FromQuery] string? tipo,
            [FromQuery] string? desde,
            [FromQuery] string? hasta,
            CancellationToken ct)
        {
            var data = await _repo.GetListAsync(canal, sitio, tipo, desde, hasta, ct);
            return Ok(new { success = true, data });
        }

        // ─── GET /api/AnotacionTurno/{id} ────────────────────────────────────
        [HttpGet("{id:long}")]
        public async Task<IActionResult> GetById(long id, CancellationToken ct)
        {
            var item = await _repo.GetByIdAsync(id, ct);
            if (item is null) return NotFound(new { success = false, message = "No encontrada." });
            return Ok(new { success = true, data = item });
        }

        // ─── POST /api/AnotacionTurno ────────────────────────────────────────
        [HttpPost]
        public async Task<IActionResult> Create(
            [FromBody] DtoAnotacionTurnoRequest request,
            CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(request.Descripcion))
                return BadRequest(new { success = false, message = "La descripción es requerida." });

            var (idUsuario, username, nombreCompleto) = GetUserClaims();
            var maquina = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "API";

            var created = await _repo.CreateAsync(
                request, idUsuario, username, nombreCompleto, maquina, ct);

            return Ok(new { success = true, data = created,
                message = "Anotación registrada correctamente." });
        }

        // ─── PUT /api/AnotacionTurno/{id} ────────────────────────────────────
        [HttpPut("{id:long}")]
        public async Task<IActionResult> Update(
            long id,
            [FromBody] DtoAnotacionTurnoRequest request,
            CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(request.Descripcion))
                return BadRequest(new { success = false, message = "La descripción es requerida." });

            var (_, username, _) = GetUserClaims();
            var ok = await _repo.UpdateAsync(id, request, username, ct);

            return ok
                ? Ok(new { success = true, message = "Anotación actualizada." })
                : NotFound(new { success = false, message = "Anotación no encontrada." });
        }

        // ─── DELETE /api/AnotacionTurno/{id} ─────────────────────────────────
        [HttpDelete("{id:long}")]
        public async Task<IActionResult> Delete(long id, CancellationToken ct)
        {
            var ok = await _repo.DeleteAsync(id, ct);
            return ok
                ? Ok(new { success = true, message = "Anotación eliminada." })
                : NotFound(new { success = false, message = "Anotación no encontrada." });
        }

        // ─── Helpers ─────────────────────────────────────────────────────────

        private (long idUsuario, string username, string nombreCompleto) GetUserClaims()
        {
            var claims = User.Claims;
            long.TryParse(
                claims.FirstOrDefault(c => c.Type == "id_usuario")?.Value ?? "0",
                out var idUsuario);
            var username       = claims.FirstOrDefault(c => c.Type == ClaimTypes.Name
                                    || c.Type == "unique_name")?.Value ?? "sistema";
            var nombreCompleto = claims.FirstOrDefault(c => c.Type == "nombre_completo"
                                    || c.Type == ClaimTypes.GivenName)?.Value ?? username;
            return (idUsuario, username, nombreCompleto);
        }
    }
}

using Comun.Dtos.Dominio;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Negocio.Interfaz;
using System.Security.Claims;

namespace Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class DominioController : ControllerBase
    {
        private readonly IDbDominioService _service;
        private readonly ILogger<DominioController> _logger;
        public DominioController(
            IDbDominioService service,
            ILogger<DominioController> logger)
        {
            _service = service;
            _logger = logger;
        }

        [HttpPost]
        public async Task<ActionResult> Create([FromBody] DtoDominioRequest request)
        {
            try
            {
                _logger.LogInformation(
                    "LineaMando Create - Identificacion={Identificacion}, Nombre={Nombre}",
                    request?.Identificacion,
                    request?.Nombre
                    
                );

                var (usuario, maquina) = ObtenerAuditoria();

                _logger.LogInformation("LineaMando Create - Auditoria: usuario={Usuario}, maquina={Maquina}", usuario, maquina);

                var result = await _service.CreateAsync(request, usuario, maquina, CancellationToken.None);

                if (!result.Success)
                {
                    _logger.LogWarning("Dominio Create - Error: {Message}", result.Message);
                    return BadRequest(new { success = false, message = result.Message });
                }

                return Ok(new { success = true, id = result.Id, message = result.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al crear Dominio");
                return StatusCode(500, new { success = false, message = $"Error: {ex.Message}", detail = ex.ToString() });
            }
        }

        private (long usuario, string maquina) ObtenerAuditoria()
        {
            var rawId = User.FindFirstValue("id_usuario")
                ?? User.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? User.FindFirstValue("nameid");

            long.TryParse(rawId, out var usuario);

            if (usuario == 0)
            {
                usuario = 1;
            }

            var maquina = HttpContext.Connection.RemoteIpAddress?.ToString()
                ?? Environment.MachineName
                ?? "N/A";

            return (usuario, maquina);
        }

    }
}

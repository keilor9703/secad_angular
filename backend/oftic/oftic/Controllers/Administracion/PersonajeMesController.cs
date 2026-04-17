using Comun.Dtos.PersonajeMes;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Negocio.Interfaz;
using System.Security.Claims;

namespace Api.Controllers.Administracion
{
    [ApiController]
    [Route("api/[controller]")]
    [EnableCors("PublicCors")]
    public class PersonajeMesController : ControllerBase
    {
        private readonly IDbPersonajeMesService _service;
        private readonly ILogger<PersonajeMesController> _logger;

        public PersonajeMesController(
            IDbPersonajeMesService service,
            ILogger<PersonajeMesController> logger)
        {
            _service = service;
            _logger = logger;
        }

        [HttpGet]
        public async Task<ActionResult> GetAll()
        {
            var result = await _service.GetAllAsync(CancellationToken.None);
            return Ok(result);
        }

        [HttpPost]
        public async Task<ActionResult> Create([FromBody] DtoPersonajeMesRequest request)
        {
            try
            {
                _logger.LogInformation(
                    "PersonajeMes Create - Identificacion={Identificacion}, Nombre={Nombre}, FotoLen={FotoLen}",
                    request?.Identificacion,
                    request?.Nombres,
                    request?.FotoModificada?.Length ?? 0
                );

                var (usuario, maquina) = ObtenerAuditoria();

                _logger.LogInformation("PersonajeMes Create - Auditoria: usuario={Usuario}, maquina={Maquina}", usuario, maquina);

                var result = await _service.CreateAsync(request, usuario, maquina, CancellationToken.None);

                if (!result.Success)
                {
                    _logger.LogWarning("PersonajeMes Create - Error: {Message}", result.Message);
                    return BadRequest(new { success = false, message = result.Message });
                }

                return Ok(new { success = true, id = result.Id, message = result.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al crear Personaje de Mes");
                return StatusCode(500, new { success = false, message = $"Error: {ex.Message}", detail = ex.ToString() });
            }
        }
     
        [HttpPut("{id:long}")]
        public async Task<ActionResult> Update(long id, [FromBody] DtoPersonajeMesRequest request)
        {
            var (usuario, maquina) = ObtenerAuditoria();
            var result = await _service.UpdateAsync(id, request, usuario, maquina, CancellationToken.None);

            _logger.LogInformation("Update result - ID: {Id}, Success: {Success}, Message: {Message}",
                id, result.Success, result.Message); // â† agrega esto

            if (!result.Success)
            {
                return BadRequest(new { success = false, message = result.Message });
            }
            return Ok(new { success = true, message = result.Message });
        }
        [HttpDelete("{id:long}")]
        public async Task<ActionResult> Delete(long id)
        {
            var (usuario, maquina) = ObtenerAuditoria();

            var result = await _service.DeleteAsync(id, usuario, maquina, CancellationToken.None);

            if (!result.Success)
            {
                return BadRequest(new { success = false, message = result.Message });
            }

            return Ok(new { success = true, message = result.Message });
        }

        [HttpPut("{id:long}/vigente")]
        public async Task<ActionResult> SetVigente(long id, [FromBody] DtoPersMesVigenteRequest request)
        {
            var (usuario, maquina) = ObtenerAuditoria();

            var result = await _service.SetVigenteAsync(id, request.Vigente, usuario, maquina, CancellationToken.None);

            if (!result.Success)
            {
                return BadRequest(new { success = false, message = result.Message });
            }

            return Ok(new { success = true, message = result.Message });
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

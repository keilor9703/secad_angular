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

        [HttpGet("grupo")]
        public async Task<ActionResult> GetAllGrupo()
        {
            var result = await _service.GetAllAsyncGrupo(CancellationToken.None);
            return Ok(result);
        }

        [HttpPost("grupo")]
        public async Task<ActionResult> CreateGrupo([FromBody] DtoPersonajeGrupoRequest request)
        {
            try
            {
                

                var (usuario, maquina) = ObtenerAuditoria();

                _logger.LogInformation("PersonajeGrupo Create - Auditoria: usuario={Usuario}, maquina={Maquina}", usuario, maquina);

                var result = await _service.CreateAsyncGrupo(request, usuario, maquina, CancellationToken.None);

                if (!result.Success)
                {
                    _logger.LogWarning("PersonajeGrupo Create - Error: {Message}", result.Message);
                    return BadRequest(new { success = false, message = result.Message });
                }

                return Ok(new { success = true, id = result.Id, message = result.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al crear Equipo o grupo de alto rendimiento");
                return StatusCode(500, new { success = false, message = $"Error: {ex.Message}", detail = ex.ToString() });
            }
        }

        [HttpPut("grupo/{id:long}")]
        public async Task<ActionResult> UpdateGrupo(long id, [FromBody] DtoPersonajeGrupoRequest request)
        {
            var (usuario, maquina) = ObtenerAuditoria();
            var result = await _service.UpdateAsyncGrupo(id, request, usuario, maquina, CancellationToken.None);

            _logger.LogInformation("Update result - ID: {Id}, Success: {Success}, Message: {Message}",
                id, result.Success, result.Message); // â† agrega esto

            if (!result.Success)
            {
                return BadRequest(new { success = false, message = result.Message });
            }
            return Ok(new { success = true, message = result.Message });
        }
        [HttpDelete("grupo/{id:long}")]
        public async Task<ActionResult> DeleteGrupo(long id)
        {
            var (usuario, maquina) = ObtenerAuditoria();

            var result = await _service.DeleteAsyncGrupo(id, usuario, maquina, CancellationToken.None);

            if (!result.Success)
            {
                return BadRequest(new { success = false, message = result.Message });
            }

            return Ok(new { success = true, message = result.Message });
        }

        [HttpPut("grupo/{id:long}/vigente")]
        public async Task<ActionResult> SetVigenteGrupo(long id, [FromBody] DtoPersGrupoVigenteRequest request)
        {
            var (usuario, maquina) = ObtenerAuditoria();

            var result = await _service.SetVigenteAsyncGrupo(id, request.Vigente, usuario, maquina, CancellationToken.None);

            if (!result.Success)
            {
                return BadRequest(new { success = false, message = result.Message });
            }

            return Ok(new { success = true, message = result.Message });
        }

        [HttpPost("Bulk")]
        public async Task<ActionResult> CreateBulk([FromBody] DtoPersonajeMesBulkRequest request)
        {
            try
            {
                if (request?.Items == null || request.Items.Count == 0)
                {
                    return BadRequest(new { success = false, message = "No hay elementos para procesar." });
                }

                _logger.LogInformation("PersonajeMes Bulk - Total items: {Total}", request.Items.Count);

                var (usuario, maquina) = ObtenerAuditoria();

                var result = await _service.CreateBulkAsync(request.Items, usuario, maquina, CancellationToken.None);

                if (!result.Success)
                {
                    _logger.LogWarning("PersonajeMes Bulk - Error: {Message}", result.Message);
                    return BadRequest(new { success = false, message = result.Message, totalProcesados = result.TotalProcesados, totalExitosos = result.TotalExitosos });
                }

                return Ok(new { success = true, message = result.Message, totalProcesados = result.TotalProcesados, totalExitosos = result.TotalExitosos });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al crear Personajes de Mes en bulk");
                return StatusCode(500, new { success = false, message = $"Error: {ex.Message}" });
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

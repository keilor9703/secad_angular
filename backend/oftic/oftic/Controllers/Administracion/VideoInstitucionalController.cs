using Comun.Dtos.Videos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Negocio.Interfaz;
using System.Security.Claims;

namespace ofic.Controllers.Administracion
{
    [ApiController]
    [Route("api/[controller]")]
    [EnableCors("PublicCors")]
    public class VideoInstitucionalController : ControllerBase
    {
        private readonly IDbVideoInstitucionalService _service;
        private readonly ILogger<VideoInstitucionalController> _logger;

        public VideoInstitucionalController(
            IDbVideoInstitucionalService service,
            ILogger<VideoInstitucionalController> logger)
        {
            _service = service;
            _logger = logger;
        }

        [HttpGet("current")]
        [AllowAnonymous]
        public async Task<IActionResult> GetCurrent()
        {
            try
            {
                var video = await _service.GetActiveAsync(CancellationToken.None);
                if (video is null)
                    return Ok(new { hasVideo = false });

                return Ok(new { hasVideo = true, data = video });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error consultando video institucional activo");
                return StatusCode(500, new { success = false, message = "Error consultando video institucional." });
            }
        }

        [HttpPost]
        [Authorize]
        public async Task<IActionResult> Create([FromBody] DtoVideoInstitucionalRequest request)
        {
            try
            {
                var (usuario, maquina) = ObtenerAuditoria();
                var result = await _service.CreateAsync(request, usuario, maquina, CancellationToken.None);

                if (!result.Success)
                    return BadRequest(new { success = false, message = result.Message });

                return Ok(new { success = true, id = result.Id, message = result.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creando video institucional");
                return StatusCode(500, new { success = false, message = "Error creando video institucional." });
            }
        }

        [HttpPut("{id:long}")]
        [Authorize]
        public async Task<IActionResult> Update(long id, [FromBody] DtoVideoInstitucionalRequest request)
        {
            try
            {
                var (usuario, maquina) = ObtenerAuditoria();
                var result = await _service.UpdateAsync(id, request, usuario, maquina, CancellationToken.None);

                if (!result.Success)
                    return BadRequest(new { success = false, message = result.Message });

                return Ok(new { success = true, message = result.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error actualizando video institucional {Id}", id);
                return StatusCode(500, new { success = false, message = "Error actualizando video institucional." });
            }
        }

        [HttpDelete("{id:long}")]
        [Authorize]
        public async Task<IActionResult> Delete(long id)
        {
            try
            {
                var (usuario, maquina) = ObtenerAuditoria();
                var result = await _service.DeleteAsync(id, usuario, maquina, CancellationToken.None);

                if (!result.Success)
                    return BadRequest(new { success = false, message = result.Message });

                return Ok(new { success = true, message = result.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error eliminando video institucional {Id}", id);
                return StatusCode(500, new { success = false, message = "Error eliminando video institucional." });
            }
        }

        private (string usuario, string maquina) ObtenerAuditoria()
        {
            var usuario = User.FindFirstValue(ClaimTypes.Name)
                ?? User.FindFirstValue("unique_name")
                ?? User.FindFirstValue("nameid")
                ?? "sistema";

            var maquina = HttpContext.Connection.RemoteIpAddress?.ToString()
                ?? Environment.MachineName
                ?? "N/A";

            return (usuario, maquina);
        }
    }
}

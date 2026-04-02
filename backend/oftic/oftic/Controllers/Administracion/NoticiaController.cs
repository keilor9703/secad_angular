using Comun.Dtos.Noticias;
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
    public class NoticiaController : ControllerBase
    {
        private readonly IDbNoticiaService _service;
        private readonly ILogger<NoticiaController> _logger;

        public NoticiaController(
            IDbNoticiaService service,
            ILogger<NoticiaController> logger)
        {
            _service = service;
            _logger = logger;
        }

        [HttpGet]
        [AllowAnonymous]
        public async Task<IActionResult> GetAll()
        {
            try
            {
                var noticias = await _service.GetAllAsync(CancellationToken.None);
                return Ok(noticias);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error consultando todas las noticias");
                return StatusCode(500, new { success = false, message = "Error consultando noticias." });
            }
        }

        [HttpGet("activas")]
        [AllowAnonymous]
        public async Task<IActionResult> GetActivas()
        {
            try
            {
                var noticias = await _service.GetActivasAsync(CancellationToken.None);
                return Ok(noticias);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error consultando noticias activas");
                return StatusCode(500, new { success = false, message = "Error consultando noticias." });
            }
        }

        [HttpGet("{id:long}")]
        [AllowAnonymous]
        public async Task<IActionResult> GetById(long id)
        {
            try
            {
                var noticia = await _service.GetByIdAsync(id, CancellationToken.None);
                if (noticia is null)
                    return NotFound(new { success = false, message = "Noticia no encontrada." });

                return Ok(noticia);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error consultando noticia {Id}", id);
                return StatusCode(500, new { success = false, message = "Error consultando noticia." });
            }
        }

        [HttpPost]
        [Authorize]
        public async Task<IActionResult> Create([FromBody] DtoNoticiaRequest request)
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
                _logger.LogError(ex, "Error creando noticia");
                return StatusCode(500, new { success = false, message = "Error creando noticia." });
            }
        }

        [HttpPut("{id:long}")]
        [Authorize]
        public async Task<IActionResult> Update(long id, [FromBody] DtoNoticiaRequest request)
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
                _logger.LogError(ex, "Error actualizando noticia {Id}", id);
                return StatusCode(500, new { success = false, message = "Error actualizando noticia." });
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
                _logger.LogError(ex, "Error eliminando noticia {Id}", id);
                return StatusCode(500, new { success = false, message = "Error eliminando noticia." });
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
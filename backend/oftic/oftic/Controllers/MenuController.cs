using Comun.Dtos.Menu;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Negocio.Interfaz;
using System.Security.Claims;

namespace Api.Controllers
{
    [ApiController]
    [Route("api/menu")]
    public class MenuController : ControllerBase
    {
        private readonly IDbMenuService _service;
        private readonly ILogger<MenuController> _logger;

        public MenuController(IDbMenuService service, ILogger<MenuController> logger)
        {
            _service = service;
            _logger = logger;
        }

        [HttpGet("by-user/{idUsuario:long}")]
        [AllowAnonymous]
        public async Task<ActionResult<List<DtoMenuItem>>> GetByUser(long idUsuario, CancellationToken ct)
        {
            var menu = await _service.GetMyMenuAsync(idUsuario, ct);
            return Ok(menu);
        }

        [HttpGet("me")]
        [Authorize]
        public async Task<ActionResult<List<DtoMenuItem>>> GetMyMenu(CancellationToken ct)
        {
            var rawId = User.FindFirstValue("id_usuario")
                ?? User.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? User.FindFirstValue("nameid");

            if (!long.TryParse(rawId, out var idUsuario) || idUsuario <= 0)
            {
                _logger.LogWarning("No se pudo resolver id_usuario desde JWT.");
                return Unauthorized();
            }

            var menu = await _service.GetMyMenuAsync(idUsuario, ct);
            _logger.LogInformation("Menu por claim para idUsuario {IdUsuario}: {Count} items", idUsuario, menu.Count);
            return Ok(menu);
        }
    }
}

using Comun.Dtos.Menu;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Negocio.Interfaz;

namespace Api.Controllers
{
    [ApiController]
    [Route("api/menu")]
    public class MenuController : ControllerBase
    {
        private readonly IDbMenuService _service;
        public MenuController(IDbMenuService service)
        {
            _service = service;
        }

        [HttpGet("by-user/{idUsuario:long}")]
        [AllowAnonymous]
        public async Task<ActionResult<List<DtoMenuItem>>> GetByUser(long idUsuario, CancellationToken ct)
        {
            var menu = await _service.GetMyMenuAsync(idUsuario, ct);
            return Ok(menu);
        }
    }
}

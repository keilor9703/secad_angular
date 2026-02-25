using Comun.Dtos.Menu;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Datos.Interfaz;
using Negocio.Interfaz;
using System.Security.Claims;
using System.Globalization;

namespace Api.Controllers
{
    [ApiController]
    [Route("api/menu")]
    public class MenuController : ControllerBase
    {
        private readonly IDbMenuService _service;
        private readonly IDbUsuarioRepository _dbUsuarioRepository;
        private readonly ILogger<MenuController> _logger;
        private readonly HashSet<long> _superUserIds;

        public MenuController(
            IDbMenuService service,
            IDbUsuarioRepository dbUsuarioRepository,
            IConfiguration configuration,
            ILogger<MenuController> logger)
        {
            _service = service;
            _dbUsuarioRepository = dbUsuarioRepository;
            _logger = logger;
            _superUserIds = ResolveSuperUserIds(configuration);
        }

        [HttpGet("by-user/{idUsuario:long}")]
        [AllowAnonymous]
        public async Task<ActionResult<List<DtoMenuItem>>> GetByUser(long idUsuario, CancellationToken ct)
        {
            var menu = await GetMenuForUserAsync(idUsuario, ct);
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

            var menu = await GetMenuForUserAsync(idUsuario, ct);
            _logger.LogInformation("Menu por claim para idUsuario {IdUsuario}: {Count} items", idUsuario, menu.Count);
            return Ok(menu);
        }

        [HttpGet("admin")]
        [Authorize]
        public async Task<ActionResult<List<DtoMenuItem>>> GetAdminMenu(CancellationToken ct)
        {
            var menu = await _service.GetAdminMenuAsync(ct);
            return Ok(menu);
        }

        [HttpPost("admin")]
        [Authorize]
        public async Task<IActionResult> SaveMenu([FromBody] DtoMenuSaveRequest request, CancellationToken ct)
        {
            try
            {
                if (request is null)
                {
                    return BadRequest(new { success = false, message = "Payload requerido." });
                }

                if (string.IsNullOrWhiteSpace(request.Descripcion))
                {
                    return BadRequest(new { success = false, message = "Descripción requerida." });
                }

                if (request.Posicion < 0)
                {
                    return BadRequest(new { success = false, message = "Posición inválida." });
                }

                if (string.IsNullOrWhiteSpace(request.Tipo))
                {
                    return BadRequest(new { success = false, message = "Tipo requerido." });
                }

                if (request.Vigente is not 0 and not 1)
                {
                    return BadRequest(new { success = false, message = "Vigente debe ser 0 o 1." });
                }

                var userId = await ResolveUsuarioAuditoriaAsync(ct);
                var machine = ResolveMachine();
                var result = await _service.SaveMenuAsync(request, userId, machine, ct);

                if (result.Id <= 0)
                {
                    return BadRequest(new { success = false, id = result.Id, message = result.Message });
                }

                return Ok(new { success = true, id = result.Id, message = result.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error guardando menú.");
                return StatusCode(500, new { success = false, message = "Error guardando menú", detail = ex.Message });
            }
        }

        [HttpPatch("admin/{idMenu:long}/estado")]
        [Authorize]
        public async Task<IActionResult> SetEstado(long idMenu, [FromBody] DtoMenuEstadoRequest request, CancellationToken ct)
        {
            try
            {
                if (idMenu <= 0)
                {
                    return BadRequest(new { success = false, message = "Id de menú inválido." });
                }

                if (request is null || request.Vigente is not 0 and not 1)
                {
                    return BadRequest(new { success = false, message = "Vigente debe ser 0 o 1." });
                }

                var userId = await ResolveUsuarioAuditoriaAsync(ct);
                var machine = ResolveMachine();
                var result = await _service.SetEstadoMenuAsync(idMenu, request.Vigente, userId, machine, ct);

                if (result.Id <= 0)
                {
                    return BadRequest(new { success = false, id = result.Id, message = result.Message });
                }

                return Ok(new { success = true, id = result.Id, message = result.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error actualizando estado de menú.");
                return StatusCode(500, new { success = false, message = "Error actualizando estado", detail = ex.Message });
            }
        }

        private async Task<long> ResolveUsuarioAuditoriaAsync(CancellationToken ct)
        {
            var rawCedula = User.FindFirstValue("identificacion")
                ?? User.FindFirstValue("cedula")
                ?? User.FindFirstValue("numeroDocumento")
                ?? User.FindFirstValue("documento");
            if (long.TryParse(rawCedula, out var cedulaClaim) && cedulaClaim > 0)
            {
                return cedulaClaim;
            }

            var username =
                User?.Identity?.Name
                ?? User?.FindFirstValue(ClaimTypes.Name)
                ?? User?.FindFirstValue("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name");

            if (!string.IsNullOrWhiteSpace(username))
            {
                var cedulaDb = await _dbUsuarioRepository.GetIdentificacionByUsernameAsync(username.Trim(), ct);
                if (long.TryParse(cedulaDb, out var cedula) && cedula > 0)
                {
                    return cedula;
                }
            }

            return 0;
        }

        private string ResolveMachine()
        {
            return HttpContext.Connection.RemoteIpAddress?.ToString()
                ?? Environment.MachineName
                ?? "N/A";
        }

        private async Task<List<DtoMenuItem>> GetMenuForUserAsync(long idUsuario, CancellationToken ct)
        {
            if (IsSuperUser(idUsuario))
            {
                var adminMenu = await _service.GetAdminMenuAsync(ct);
                var filtered = adminMenu.Where(x => x.Vigente == 1).ToList();
                _logger.LogInformation("Regla superusuario aplicada para idUsuario {IdUsuario}. Menú admin vigente: {Count}", idUsuario, filtered.Count);
                return filtered;
            }

            return await _service.GetMyMenuAsync(idUsuario, ct);
        }

        private bool IsSuperUser(long idUsuario)
        {
            return _superUserIds.Contains(idUsuario);
        }

        private static HashSet<long> ResolveSuperUserIds(IConfiguration configuration)
        {
            var ids = new HashSet<long> { 1 }; // fallback por defecto

            var configured = configuration["Menu:SuperUserIds"];
            if (string.IsNullOrWhiteSpace(configured))
            {
                return ids;
            }

            var values = configured
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

            foreach (var value in values)
            {
                if (long.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var id) && id > 0)
                {
                    ids.Add(id);
                }
            }

            return ids;
        }
    }
}

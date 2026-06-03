using Datos.Interfaz;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Api.Controllers.Operacion
{
    /// <summary>
    /// Módulo GIS 2D — Mapa de Incidentes.
    /// Proporciona los datos necesarios para pintar marcadores en el mapa Leaflet del frontend.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [EnableCors("PublicCors")]
    [Authorize]
    public class MapaController : ControllerBase
    {
        private readonly IDbMapaRepository            _repo;
        private readonly ILogger<MapaController>      _logger;

        public MapaController(IDbMapaRepository repo, ILogger<MapaController> logger)
        {
            _repo   = repo;
            _logger = logger;
        }

        /// <summary>
        /// Retorna los incidentes activos con coordenadas válidas para el módulo GIS 2D.
        /// El filtro por sitioGraba proviene del JWT del operador.
        /// Los super-admin pueden pasar sitioGraba=0 para ver todos los CADs del tenant.
        /// </summary>
        [HttpGet("incidentes")]
        public async Task<ActionResult> GetIncidentesActivos(
            [FromQuery] int? sitioGraba,
            [FromQuery] int? canalCodigo,
            CancellationToken ct)
        {
            var resolvedSitio  = sitioGraba  ?? GetIntClaim("sitio_graba");
            var resolvedCanal  = canalCodigo ?? 0;   // 0 = todos los canales

            var data = await _repo.GetIncidentesActivosAsync(resolvedSitio, resolvedCanal, ct);
            return Ok(data);
        }

        // ── Helpers ───────────────────────────────────────────────────────────

        private int GetIntClaim(string claimType)
        {
            var val = User.FindFirst(claimType)?.Value;
            return int.TryParse(val, out var n) ? n : 0;
        }
    }
}

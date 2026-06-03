using Comun.Dtos.Mapa;

namespace Datos.Interfaz
{
    /// <summary>
    /// Repositorio de datos para el módulo GIS 2D (Mapa de Incidentes).
    /// </summary>
    public interface IDbMapaRepository
    {
        /// <summary>
        /// Retorna todos los incidentes activos (no cerrados / no anulados)
        /// que tienen coordenadas geográficas válidas, para ser pintados en el mapa.
        /// </summary>
        /// <param name="sitioGraba">Filtra por sitio de grabación. Si es 0, retorna todos.</param>
        /// <param name="canalCodigo">Filtra por canal de atención. Si es 0, retorna todos los canales.</param>
        /// <param name="ct">Token de cancelación.</param>
        Task<List<DtoMapaIncidente>> GetIncidentesActivosAsync(int sitioGraba, int canalCodigo, CancellationToken ct);
    }
}

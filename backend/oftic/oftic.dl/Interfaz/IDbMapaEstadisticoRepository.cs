using Comun.Dtos.Mapa;

namespace Datos.Interfaz
{
    public interface IDbMapaEstadisticoRepository
    {
        Task<DtoAnalisisEstadistico> GetAnalisisAsync(DtoFiltroEstadistico filtro, CancellationToken ct);
        Task<List<string>> GetCiudadesAsync(CancellationToken ct);
        Task<List<string>> GetBarriosAsync(string? ciudad, CancellationToken ct);
    }
}

using Comun.Dtos.Noticias;

namespace Negocio.Interfaz;

public interface IDbNoticiaService
{
    Task<List<DtoNoticia>> GetAllAsync(CancellationToken ct);
    Task<DtoNoticia?> GetByIdAsync(long id, CancellationToken ct);
    Task<List<DtoNoticia>> GetActivasAsync(CancellationToken ct);
    Task<DtoNoticiaResult> CreateAsync(DtoNoticiaRequest request, string usuario, string maquina, CancellationToken ct);
    Task<DtoNoticiaResult> UpdateAsync(long id, DtoNoticiaRequest request, string usuario, string maquina, CancellationToken ct);
    Task<DtoNoticiaResult> DeleteAsync(long id, string usuario, string maquina, CancellationToken ct);
    Task<DtoNoticiaResult> DarLikeAsync(long id, CancellationToken ct);
}
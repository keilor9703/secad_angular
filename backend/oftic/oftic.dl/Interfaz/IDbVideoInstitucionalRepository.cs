using Comun.Dtos.Videos;

namespace Datos.Interfaz;

public interface IDbVideoInstitucionalRepository
{
    Task<DtoVideoInstitucional?> GetActiveAsync(CancellationToken ct);
    Task<DtoVideoInstitucionalResult> CreateAsync(DtoVideoInstitucionalRequest request, string usuarioAuditoria, string maquinaAuditoria, CancellationToken ct);
    Task<DtoVideoInstitucionalResult> UpdateAsync(long id, DtoVideoInstitucionalRequest request, string usuarioAuditoria, string maquinaAuditoria, CancellationToken ct);
    Task<DtoVideoInstitucionalResult> DeleteAsync(long id, string usuarioAuditoria, string maquinaAuditoria, CancellationToken ct);
}

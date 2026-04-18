using Comun.Dtos.Radio;

namespace Negocio.Interfaz
{
    public interface IDbRadioService
    {
        Task<List<DtoRadioEmisora>> GetPublicasAsync(CancellationToken ct);
        Task<List<DtoRadioEmisora>> GetAdminAsync(CancellationToken ct);
        Task<DtoRadioEmisora?> GetByIdAsync(long idEmisora, CancellationToken ct);
        Task<DtoRadioResult> CreateAsync(DtoRadioEmisoraRequest request, string usuarioAuditoria, string maquinaAuditoria, CancellationToken ct);
        Task<DtoRadioResult> UpdateAsync(long idEmisora, DtoRadioEmisoraRequest request, string usuarioAuditoria, string maquinaAuditoria, CancellationToken ct);
        Task<DtoRadioResult> DeleteAsync(long idEmisora, string usuarioAuditoria, string maquinaAuditoria, CancellationToken ct);
        Task<DtoRadioResult> SetActivoAsync(long idEmisora, int activo, string usuarioAuditoria, string maquinaAuditoria, CancellationToken ct);
    }
}


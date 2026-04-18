using Comun.Dtos.Modal;

namespace Negocio.Interfaz
{
    public interface IDbModalService
    {
        Task<List<DtoModal>> GetAllAsync(CancellationToken ct);
        Task<DtoModal?> GetByIdAsync(long id, CancellationToken ct);
        Task<List<DtoModalActivo>> GetActivosAsync(CancellationToken ct);
        Task<DtoModalResult> CreateAsync(DtoModalRequest request, string usuarioAuditoria, string maquinaAuditoria, CancellationToken ct);
        Task<DtoModalResult> UpdateAsync(long id, DtoModalRequest request, string usuarioAuditoria, string maquinaAuditoria, CancellationToken ct);
        Task<DtoModalResult> DeleteLogicalAsync(long id, string usuarioAuditoria, string maquinaAuditoria, CancellationToken ct);
        Task<DtoModalResult> ToggleVigenteAsync(long id, int vigente, string usuarioAuditoria, string maquinaAuditoria, CancellationToken ct);
        Task<DtoModalResult> RegistrarInteraccionAsync(long idModal, string tipoAccion, string usuario, string maquina, CancellationToken ct);
        Task<List<DtoModalInteraccion>> GetInteraccionesAsync(long idModal, CancellationToken ct);
    }
}

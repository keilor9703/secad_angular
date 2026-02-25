using Comun.Dtos.Sliders;

namespace Datos.Interfaz
{
    public interface IDbSliders
    {
        Task<List<DtoSliders>> GetPublicosAsync(CancellationToken ct);
        Task<List<DtoSliders>> GetAdminAsync(CancellationToken ct);
        Task<DtoSliderResult> SaveAsync(
            DtoSaveSliderRequest request,
            long usuarioAuditoria,
            string maquinaAuditoria,
            CancellationToken ct);
        Task<DtoSliderResult> SetEstadoAsync(
            long idSlider,
            int vigente,
            long usuarioAuditoria,
            string maquinaAuditoria,
            CancellationToken ct);
    }
}

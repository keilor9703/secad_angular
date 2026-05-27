using Comun.Dtos.Incidentes;

namespace Negocio.Interfaz
{
    public interface IDbPedidoService
    {
        Task<List<DtoPedidoListItem>> GetListAsync(string? estado, int? sitioGraba, CancellationToken ct);
        Task<DtoPedidoDetalle?> GetByIdAsync(long id, CancellationToken ct);
        Task<DtoPedidoResult> CreateAsync(DtoPedidoRequest request, long usuarioAuditoria, string usernameAuditoria, string maquinaAuditoria, CancellationToken ct);
        Task<DtoPedidoResult> UpdateAsync(long id, DtoPedidoRequest request, long usuarioAuditoria, string usernameAuditoria, string maquinaAuditoria, CancellationToken ct);
        Task<DtoPedidoResult> CerrarRapidoAsync(long id, DtoCerrarRapidoRequest request, long usuarioAuditoria, string maquinaAuditoria, CancellationToken ct);
        Task<DtoPedidoResult> SetEstadoAsync(long id, string estado, long usuarioAuditoria, string maquinaAuditoria, CancellationToken ct);
        Task<List<DtoAnotacion>> GetAnotacionesAsync(long idPedido, CancellationToken ct);
        Task<DtoPedidoResult> CreateAnotacionAsync(long idPedido, DtoAnotacionRequest request, long usuarioAuditoria, string usernameAuditoria, string maquinaAuditoria, CancellationToken ct);
        Task<List<DtoPedidoAsociar>> BuscarParaAsociarAsync(int sitioGraba, CancellationToken ct);

        // ─── Eventos (dispatcher queue) ──────────────────────────────────────
        Task<List<DtoEventoListItem>> GetEventosByCanalAsync(int canalCodigo, int fuerzaId, string? estado, CancellationToken ct);
        Task<List<DtoCanalItem>> GetCanalesPorSitioAsync(int sitioGraba, CancellationToken ct);

        // ─── Conteos y turno ──────────────────────────────────────────────────
        Task<DtoEventoConteos> GetConteosByCanalAsync(int canalCodigo, int fuerzaId, CancellationToken ct);

        // ─── Auditoría y SLA ──────────────────────────────────────────────────
        Task RegistrarAccesoAsync(long pedidoId, long usuarioId, string username,
                                  string ip, string accion, CancellationToken ct);
        Task<List<DtoSlaConfig>> GetSlaConfigAsync(CancellationToken ct);
    }
}

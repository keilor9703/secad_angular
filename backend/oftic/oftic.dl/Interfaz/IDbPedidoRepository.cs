using Comun.Dtos.Incidentes;

namespace Datos.Interfaz
{
    public interface IDbPedidoRepository
    {
        Task<List<DtoPedidoListItem>> GetListAsync(string? estado, int? sitioGraba, CancellationToken ct);
        Task<DtoPedidoDetalle?> GetByIdAsync(long id, CancellationToken ct);
        Task<DtoPedidoResult> CreateAsync(DtoPedidoRequest request, long usuarioAuditoria, string maquinaAuditoria, CancellationToken ct);
        Task<DtoPedidoResult> UpdateAsync(long id, DtoPedidoRequest request, long usuarioAuditoria, string maquinaAuditoria, CancellationToken ct);
        Task<DtoPedidoResult> CerrarRapidoAsync(long id, DtoCerrarRapidoRequest request, long usuarioAuditoria, string maquinaAuditoria, CancellationToken ct);
        Task<DtoPedidoResult> SetEstadoAsync(long id, string estado, long usuarioAuditoria, string maquinaAuditoria, CancellationToken ct);
        Task<List<DtoAnotacion>> GetAnotacionesAsync(long idPedido, CancellationToken ct);
        Task<DtoPedidoResult> CreateAnotacionAsync(long idPedido, DtoAnotacionRequest request, long usuarioAuditoria, string usernameAuditoria, string maquinaAuditoria, CancellationToken ct);
        Task<List<DtoPedidoAsociar>> BuscarParaAsociarAsync(int sitioGraba, CancellationToken ct);

        // ─── Eventos (dispatcher queue) ──────────────────────────────────────
        /// <summary>
        /// Returns incidents dispatched to a specific canal, ordered by priority
        /// then oldest-first within each priority group.
        /// </summary>
        Task<List<DtoEventoListItem>> GetEventosByCanalAsync(int canalCodigo, int fuerzaId, string? estado, CancellationToken ct);

        /// <summary>
        /// Returns the dispatch channels available for a given recording site.
        /// </summary>
        Task<List<DtoCanalItem>> GetCanalesPorSitioAsync(int sitioGraba, CancellationToken ct);
    }
}

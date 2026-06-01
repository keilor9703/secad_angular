using Comun.Dtos.Incidentes;
using Ev = Comun.Dtos.Eventos;

namespace Datos.Interfaz
{
    public interface IDbPedidoRepository
    {
        Task<List<DtoPedidoListItem>> GetListAsync(string? estado, int? sitioGraba, CancellationToken ct);
        Task<DtoPedidoDetalle?> GetByIdAsync(long id, CancellationToken ct);
        Task<DtoPedidoResult> CreateAsync(DtoPedidoRequest request, long usuarioAuditoria, string usernameAuditoria, string maquinaAuditoria, CancellationToken ct);
        Task<DtoPedidoResult> UpdateAsync(long id, DtoPedidoRequest request, long usuarioAuditoria, string maquinaAuditoria, CancellationToken ct);
        Task<DtoPedidoResult> CerrarRapidoAsync(long id, DtoCerrarRapidoRequest request, long usuarioAuditoria, string maquinaAuditoria, CancellationToken ct);

        /// <summary>
        /// Cierra un evento desde el módulo Despachador.
        /// Actualiza cad_eventos + cad_eventos_codigos_cierre con los datos de cierre;
        /// en cad_pedidos SOLO actualiza estado='C' — NUNCA toca comentario ni codi_pedido.
        /// </summary>
        Task<DtoPedidoResult> CerrarEventoDesdeDespachoAsync(
            long pedidoId, Ev.DtoCerrarEventoDespachoRequest request,
            long usuarioId, string username, string maquina, CancellationToken ct);

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

        // ─── Conteos para badges de filtro ───────────────────────────────────
        /// <summary>
        /// Devuelve contadores por estado para la bandeja del canal.
        /// Siempre excluye eventos cerrados del total activo;
        /// para cerrados solo cuenta los del turno vigente.
        /// </summary>
        Task<DtoEventoConteos> GetConteosByCanalAsync(int canalCodigo, int fuerzaId, CancellationToken ct);

        // ─── Auditoría de acceso ──────────────────────────────────────────────
        /// <summary>
        /// Logs a dispatcher's access to an event and marks fecha_primer_acceso
        /// on cad_pedidos if this is the first view. Non-throwing.
        /// </summary>
        Task RegistrarAccesoAsync(long pedidoId, long usuarioId, string username,
                                  string ip, string accion, CancellationToken ct);

        // ─── SLA configuration ────────────────────────────────────────────────
        /// <summary>Returns active SLA thresholds from cad_config_sla.</summary>
        Task<List<DtoSlaConfig>> GetSlaConfigAsync(CancellationToken ct);
    }
}

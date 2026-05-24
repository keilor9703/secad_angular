using Comun.Dtos.Eventos;
using Comun.Dtos.Recepcion;

namespace Datos.Interfaz
{
    public interface IDbRecepcionRepository
    {
        // ── CTI / Incoming call ─────────────────────────────────────────────────
        /// <summary>Poll CTI interface for an unregistered incoming call.</summary>
        Task<DtoLlamadaEntrante?> F_GetLlamadasAsync(int sitioGraba, int acd, CancellationToken ct);

        /// <summary>Get the next call-sequence Snowflake ID (no DB round-trip).</summary>
        Task<long> F_ConsultarSeqPedidoAsync(CancellationToken ct);

        // ── Catalog lookups ─────────────────────────────────────────────────────
        /// <summary>Full-text / LIKE search on cad_casos.</summary>
        Task<List<DtoCasoItem>> F_GetCasosIntelAsync(string busqueda, CancellationToken ct);

        /// <summary>Exact-code lookup on cad_casos.</summary>
        Task<DtoCasoItem?> F_GetCasoPorCodigoAsync(string codigo, CancellationToken ct);

        /// <summary>Channels available for a given recording-site, grouped by fuerza.</summary>
        Task<List<DtoCanalRecepcion>> F_GetCanalesAsync(int sitioGraba, CancellationToken ct);

        /// <summary>Reference catalog rows for a given category (TIPO_PEDIDO, CALI_PEDIDO, …).</summary>
        Task<List<DtoReferenciaSecad>> F_GetReferenciasAsync(string nombre, CancellationToken ct);

        /// <summary>Recent calls eligible for association (200-min window, exclude code 900).</summary>
        Task<List<DtoLlamadaAsociar>> F_BuscarLlamadasAsociarAsync(
            int sitioGraba, string horaCaso, long numeLlamada, CancellationToken ct);

        // ── Save / close reception calls ────────────────────────────────────────
        /// <summary>
        /// Insert full reception form into cad_pedidos + cad_pedidos_canales + cad_eventos.
        /// Returns the generated evento ID inside DtoRecepcionResult.EventoId.
        /// </summary>
        Task<DtoRecepcionResult> P_GuardarLlamadaAsync(
            DtoRecepcion datos, int canalFuerza, string usuario, long idEmpleado, CancellationToken ct);

        /// <summary>
        /// Quick-close: minimal INSERT into cad_pedidos + cad_eventos with estado=V.
        /// </summary>
        Task<DtoRecepcionResult> P_CerrarLlamadaRapidaAsync(
            DtoRecepcion datos, string usuario, CancellationToken ct);

        // ── Event lifecycle (used from Eventos / dispatcher module) ─────────────
        /// <summary>Get full event detail including closing codes.</summary>
        Task<DtoEvento?> G_GetEventoAsync(long eventoId, CancellationToken ct);

        /// <summary>List events linked to a specific pedido (call).</summary>
        Task<List<DtoEventoListItem>> G_GetEventosPorPedidoAsync(long pedidoId, CancellationToken ct);

        /// <summary>
        /// Update the operational cycle timestamp: Despachado (D) or Atendido (A).
        /// </summary>
        Task<DtoEventoResult> P_ActualizarEstadoEventoAsync(
            long eventoId, string estado, string usuario, CancellationToken ct);

        /// <summary>
        /// Close an event: set estado=C|V, record timestamp, insert all closing codes
        /// into cad_eventos_codigos_cierre. All in one transaction.
        /// </summary>
        Task<DtoEventoResult> P_CerrarEventoAsync(
            DtoCierreEventoRequest request, string usuario, CancellationToken ct);

        // ── External integrations ───────────────────────────────────────────────
        /// <summary>
        /// Create a pedido + evento from an external system (mobile app, API client, etc.).
        /// </summary>
        Task<DtoEventoResult> P_CrearEventoIntegracionAsync(
            DtoEventoIntegracionRequest request, string usuario, CancellationToken ct);
    }
}

using Comun.Dtos.Actuaciones;

namespace Datos.Interfaz
{
    public interface IDbActuacionRepository
    {
        // ── Consultas ───────────────────────────────────────────────────────────

        /// <summary>
        /// Lista resumida de todas las actuaciones de un evento, una por agencia/canal.
        /// </summary>
        Task<List<DtoActuacionListItem>> G_GetActuacionesEventoAsync(
            long eventoId, CancellationToken ct);

        /// <summary>
        /// Detalle completo de una actuación: datos base + códigos de cierre
        /// + unidades despachadas + notas de campo.
        /// </summary>
        Task<DtoActuacion?> G_GetActuacionAsync(long actuacionId, CancellationToken ct);

        // ── Ciclo operativo ─────────────────────────────────────────────────────

        /// <summary>
        /// Crea una nueva actuación en estado P (Pendiente/Asignado).
        /// Vincula el medio al evento si se proporciona MedioId.
        /// Este es el primer paso del flujo de despacho:
        ///   Asignar (P) → En ruta (D) → En sitio (A) → Atendió (C).
        /// </summary>
        Task<DtoActuacionResult> P_CrearActuacionAsync(
            DtoCrearActuacionRequest req,
            string usuario,
            CancellationToken ct);

        /// <summary>
        /// Avanza la actuación al estado D (Despachada) o A (Atendida).
        /// Registra el timestamp correspondiente y, opcionalmente,
        /// actualiza la unidad/placa asignada.
        /// También actualiza el estado operativo del medio vinculado:
        ///   D → medio 30 (En ruta) | A → medio 28 (En sitio/Ocupado).
        /// </summary>
        Task<DtoActuacionResult> P_ActualizarEstadoActuacionAsync(
            long actuacionId,
            DtoActualizarEstadoActuacionRequest req,
            string usuario,
            CancellationToken ct);

        /// <summary>
        /// Cierra la actuación (estado C o V) con sus códigos de cierre.
        /// Inserta los códigos en cad_actuaciones_codigos y llama a
        /// fn_recalcular_estado_evento para actualizar el estado global del evento.
        /// Todo en una sola transacción.
        /// </summary>
        Task<DtoActuacionResult> P_CerrarActuacionAsync(
            DtoCierreActuacionRequest req,
            string usuario,
            CancellationToken ct);

        // ── Sub-registros ───────────────────────────────────────────────────────

        /// <summary>
        /// Agrega una nota de campo a la actuación (novedad, alerta, cierre, etc.).
        /// </summary>
        Task<DtoActuacionResult> P_AgregarNotaActuacionAsync(
            long actuacionId,
            DtoAgregarNotaActuacionRequest req,
            string usuario,
            CancellationToken ct);

        /// <summary>
        /// Registra una unidad adicional despachada dentro de la misma actuación.
        /// Usar cuando la agencia envía más de un recurso al incidente.
        /// </summary>
        Task<DtoActuacionResult> P_AgregarUnidadActuacionAsync(
            long actuacionId,
            DtoAgregarUnidadActuacionRequest req,
            string usuario,
            CancellationToken ct);

        /// <summary>
        /// Desasigna un recurso de una actuación que aún no ha salido en ruta (estado P).
        /// Pasa la actuación a estado V (Anulada), libera el medio (estado=27, evento_id=NULL)
        /// y recalcula el estado global del evento.
        /// Solo funciona si la actuación está en estado P; si ya salió en ruta, rechaza.
        /// </summary>
        Task<DtoActuacionResult> P_DesasignarActuacionAsync(
            long actuacionId,
            string motivo,
            string usuario,
            CancellationToken ct);

        // ── Catálogos ───────────────────────────────────────────────────────────

        /// <summary>
        /// Retorna el catálogo de actividades policiales (cad_act_policial).
        /// tipo = "O" para Operativas, "P" para Preventivas, null para todas.
        /// </summary>
        Task<List<DtoActividadPolicial>> G_GetActividadesPolicialesAsync(
            string? tipo, CancellationToken ct);

        /// <summary>
        /// Búsqueda full-text de delitos del Código Penal (cad_delitos).
        /// Filtra por descripción, artículo o bien jurídico.
        /// </summary>
        Task<List<DtoDelitoItem>> G_BuscarDelitosAsync(
            string q, int limit, CancellationToken ct);

        /// <summary>
        /// Búsqueda de códigos de tipificación/cierre en cad_casos.
        /// Misma tabla que usa el módulo de Recepción.
        /// </summary>
        Task<List<DtoCodigoCasoItem>> G_BuscarCodigosCierreAsync(
            string q, int limit, CancellationToken ct);
    }
}

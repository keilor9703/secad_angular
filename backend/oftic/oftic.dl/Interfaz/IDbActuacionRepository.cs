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
        /// Avanza la actuación al estado D (Despachada) o A (Atendida).
        /// Registra el timestamp correspondiente y, opcionalmente,
        /// actualiza la unidad/placa asignada.
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
    }
}

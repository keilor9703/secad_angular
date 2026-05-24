using Comun.Dtos.Turnos;

namespace Datos.Interfaz
{
    public interface IDbTurnoRepository
    {
        // ── Consultas de turnos ─────────────────────────────────────────────────

        /// <summary>Lista de turnos para una fecha y fuerza.</summary>
        Task<List<DtoTurnoListItem>> G_GetTurnosAsync(
            int fuerzaId, string fechaTurno, int sitioGraba, CancellationToken ct);

        /// <summary>Detalle de un turno con sus unidades.</summary>
        Task<DtoTurno?> G_GetTurnoPorIdAsync(long turnoId, CancellationToken ct);

        /// <summary>Unidades registradas en un turno.</summary>
        Task<List<DtoTurnoUnidad>> G_GetUnidadesTurnoAsync(long turnoId, CancellationToken ct);

        /// <summary>Medios disponibles de una unidad en un turno.</summary>
        Task<List<DtoMedioDisponible>> G_GetMediosTurnoAsync(
            long turnoId, long? turnoUnidadId, CancellationToken ct);

        // ── Panel de despacho (Módulo de Eventos) ───────────────────────────────

        /// <summary>
        /// Recursos activos en turno para un canal de radio.
        /// Solo devuelve turnos vigentes (hora_inicia ≤ NOW ≤ hora_termina).
        /// Incluye posición GPS y personal.
        /// </summary>
        Task<List<DtoMedioDisponible>> G_GetMediosActivosPorCanalAsync(
            int canalCodigo, int sitioGraba, CancellationToken ct);

        /// <summary>Versión compacta para polling rápido desde el frontend.</summary>
        Task<List<DtoMedioDisponibleResumen>> G_GetResumenMediosCanalAsync(
            int canalCodigo, int sitioGraba, CancellationToken ct);

        // ── Creación / edición de turnos ────────────────────────────────────────

        /// <summary>
        /// Crea un nuevo turno. Valida duración (6-9h), no solapamiento
        /// y unicidad por clase_turno + día + fuerza.
        /// </summary>
        Task<DtoTurnoResult> P_CrearTurnoAsync(
            DtoCrearTurnoRequest req, string usuario, CancellationToken ct);

        /// <summary>
        /// Copia un turno existente a una nueva franja horaria,
        /// duplicando todas sus unidades y medios.
        /// </summary>
        Task<DtoTurnoResult> P_CopiarTurnoAsync(
            DtoCopiarTurnoRequest req, string usuario, CancellationToken ct);

        // ── Unidades ────────────────────────────────────────────────────────────

        Task<DtoTurnoResult> P_AgregarUnidadAsync(
            DtoAgregarUnidadRequest req, string usuario, CancellationToken ct);

        // ── Medios disponibles ──────────────────────────────────────────────────

        Task<DtoTurnoResult> P_AgregarMedioAsync(
            DtoAgregarMedioRequest req, string usuario, CancellationToken ct);

        /// <summary>
        /// Importa medios y personal desde la minuta SIVICC
        /// (equivalente a P_InsMediosEnTurnoSivicc del Oracle anterior).
        /// Requiere que la vista SIVICC esté accesible.
        /// </summary>
        Task<DtoTurnoResult> P_ImportarDesdeSiviccAsync(
            DtoImportarSiviccRequest req, string usuario, CancellationToken ct);

        // ── Estado de medios (tiempo real) ──────────────────────────────────────

        /// <summary>
        /// Cambia el estado de un medio (libre ↔ en ruta ↔ ocupado ↔ fuera)
        /// y escribe el log de cambio.
        /// </summary>
        Task<DtoTurnoResult> P_CambiarEstadoMedioAsync(
            long medioId, DtoCambiarEstadoMedioRequest req, string usuario, CancellationToken ct);

        /// <summary>
        /// Actualiza las posiciones GPS de múltiples medios en lote.
        /// Llamado por el backend cada vez que GESPO provee nuevas posiciones.
        /// </summary>
        Task<int> P_ActualizarUbicacionesGespoAsync(
            IEnumerable<DtoGespoUbicacion> ubicaciones, CancellationToken ct);
    }
}

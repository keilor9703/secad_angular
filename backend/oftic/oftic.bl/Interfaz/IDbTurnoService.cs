using Comun.Dtos.Turnos;

namespace Negocio.Interfaz
{
    public interface IDbTurnoService
    {
        // ── Consultas de turnos ─────────────────────────────────────────────────

        Task<List<DtoTurnoListItem>> G_GetTurnosAsync(
            int fuerzaId, string fechaTurno, int sitioGraba, CancellationToken ct);

        Task<DtoTurno?> G_GetTurnoPorIdAsync(long turnoId, CancellationToken ct);

        Task<List<DtoTurnoUnidad>> G_GetUnidadesTurnoAsync(long turnoId, CancellationToken ct);

        Task<List<DtoMedioDisponible>> G_GetMediosTurnoAsync(
            long turnoId, long? turnoUnidadId, CancellationToken ct);

        // ── Panel de despacho (Módulo de Eventos) ───────────────────────────────

        Task<List<DtoMedioDisponible>> G_GetMediosActivosPorCanalAsync(
            int canalCodigo, int sitioGraba, CancellationToken ct);

        Task<List<DtoMedioDisponibleResumen>> G_GetResumenMediosCanalAsync(
            int canalCodigo, int sitioGraba, CancellationToken ct);

        Task<List<Dictionary<string, object?>>> G_DiagnosticoCanalAsync(
            int canalCodigo, int sitioGraba, CancellationToken ct);

        // ── Creación / edición de turnos ────────────────────────────────────────

        Task<DtoTurnoResult> P_CrearTurnoAsync(
            DtoCrearTurnoRequest req, string usuario, CancellationToken ct);

        Task<DtoTurnoResult> P_CopiarTurnoAsync(
            DtoCopiarTurnoRequest req, string usuario, CancellationToken ct);

        // ── Unidades ────────────────────────────────────────────────────────────

        Task<DtoTurnoResult> P_AgregarUnidadAsync(
            DtoAgregarUnidadRequest req, string usuario, CancellationToken ct);

        // ── Medios disponibles ──────────────────────────────────────────────────

        Task<DtoTurnoResult> P_AgregarMedioAsync(
            DtoAgregarMedioRequest req, string usuario, CancellationToken ct);

        Task<DtoTurnoResult> P_ActualizarMedioAsync(
            long medioId, DtoActualizarMedioRequest req, string usuario, CancellationToken ct);

        /// <summary>
        /// Consulta las unidades disponibles en SIVICC para el turno.
        /// Los filtros (sigla física, clase turno, fecha) se obtienen del turno en BD.
        /// </summary>
        Task<List<DtoUnidadSivicc>> G_GetUnidadesSiviccAsync(
            long turnoId, CancellationToken ct);

        Task<DtoTurnoResult> P_ImportarDesdeSiviccAsync(
            DtoImportarSiviccRequest req, string usuario, CancellationToken ct);

        // ── Estado de medios (tiempo real) ──────────────────────────────────────

        Task<DtoTurnoResult> P_CambiarEstadoMedioAsync(
            long medioId, DtoCambiarEstadoMedioRequest req, string usuario, CancellationToken ct);

        Task<int> P_ActualizarUbicacionesGespoAsync(
            IEnumerable<DtoGespoUbicacion> ubicaciones, CancellationToken ct);
    }
}

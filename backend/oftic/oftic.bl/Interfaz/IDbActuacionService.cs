using Comun.Dtos.Actuaciones;

namespace Negocio.Interfaz
{
    public interface IDbActuacionService
    {
        Task<List<DtoActuacionListItem>> G_GetActuacionesEventoAsync(
            long eventoId, CancellationToken ct);

        Task<DtoActuacion?> G_GetActuacionAsync(
            long actuacionId, CancellationToken ct);

        Task<DtoActuacionResult> P_CrearActuacionAsync(
            DtoCrearActuacionRequest req,
            string usuario,
            CancellationToken ct);

        Task<DtoActuacionResult> P_ActualizarEstadoActuacionAsync(
            long actuacionId,
            DtoActualizarEstadoActuacionRequest req,
            string usuario,
            CancellationToken ct);

        Task<DtoActuacionResult> P_CerrarActuacionAsync(
            DtoCierreActuacionRequest req,
            string usuario,
            CancellationToken ct);

        Task<DtoActuacionResult> P_AgregarNotaActuacionAsync(
            long actuacionId,
            DtoAgregarNotaActuacionRequest req,
            string usuario,
            CancellationToken ct);

        Task<DtoActuacionResult> P_AgregarUnidadActuacionAsync(
            long actuacionId,
            DtoAgregarUnidadActuacionRequest req,
            string usuario,
            CancellationToken ct);

        /// <summary>
        /// Desasigna un recurso de una actuación en estado P.
        /// Solo aplicable cuando el recurso aún no ha salido en ruta.
        /// </summary>
        Task<DtoActuacionResult> P_DesasignarActuacionAsync(
            long actuacionId,
            string motivo,
            string usuario,
            CancellationToken ct);

        /// <summary>Catálogo de actividades policiales. tipo = O/P/null (todas).</summary>
        Task<List<DtoActividadPolicial>> G_GetActividadesPolicialesAsync(
            string? tipo, CancellationToken ct);

        /// <summary>Búsqueda de delitos del Código Penal por texto libre.</summary>
        Task<List<DtoDelitoItem>> G_BuscarDelitosAsync(
            string q, int limit, CancellationToken ct);

        /// <summary>Búsqueda de códigos de tipificación/cierre (cad_casos).</summary>
        Task<List<DtoCodigoCasoItem>> G_BuscarCodigosCierreAsync(
            string q, int limit, CancellationToken ct);
    }
}

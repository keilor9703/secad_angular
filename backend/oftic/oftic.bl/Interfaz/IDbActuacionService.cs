using Comun.Dtos.Actuaciones;

namespace Negocio.Interfaz
{
    public interface IDbActuacionService
    {
        Task<List<DtoActuacionListItem>> G_GetActuacionesEventoAsync(
            long eventoId, CancellationToken ct);

        Task<DtoActuacion?> G_GetActuacionAsync(
            long actuacionId, CancellationToken ct);

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
    }
}

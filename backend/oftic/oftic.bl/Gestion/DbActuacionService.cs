using Comun.Dtos.Actuaciones;
using Datos.Interfaz;
using Negocio.Interfaz;

namespace Negocio.Gestion
{
    public class DbActuacionService : IDbActuacionService
    {
        private readonly IDbActuacionRepository _repo;

        public DbActuacionService(IDbActuacionRepository repo)
        {
            _repo = repo;
        }

        public Task<List<DtoActuacionListItem>> G_GetActuacionesEventoAsync(
            long eventoId, CancellationToken ct)
            => _repo.G_GetActuacionesEventoAsync(eventoId, ct);

        public Task<DtoActuacion?> G_GetActuacionAsync(
            long actuacionId, CancellationToken ct)
            => _repo.G_GetActuacionAsync(actuacionId, ct);

        public Task<DtoActuacionResult> P_ActualizarEstadoActuacionAsync(
            long actuacionId,
            DtoActualizarEstadoActuacionRequest req,
            string usuario,
            CancellationToken ct)
            => _repo.P_ActualizarEstadoActuacionAsync(actuacionId, req, usuario, ct);

        public Task<DtoActuacionResult> P_CerrarActuacionAsync(
            DtoCierreActuacionRequest req,
            string usuario,
            CancellationToken ct)
            => _repo.P_CerrarActuacionAsync(req, usuario, ct);

        public Task<DtoActuacionResult> P_AgregarNotaActuacionAsync(
            long actuacionId,
            DtoAgregarNotaActuacionRequest req,
            string usuario,
            CancellationToken ct)
            => _repo.P_AgregarNotaActuacionAsync(actuacionId, req, usuario, ct);

        public Task<DtoActuacionResult> P_AgregarUnidadActuacionAsync(
            long actuacionId,
            DtoAgregarUnidadActuacionRequest req,
            string usuario,
            CancellationToken ct)
            => _repo.P_AgregarUnidadActuacionAsync(actuacionId, req, usuario, ct);
    }
}

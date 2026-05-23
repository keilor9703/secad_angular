using Comun.Dtos.Recepcion;
using Datos.Interfaz;
using Negocio.Interfaz;

namespace Negocio.Gestion
{
    public class DbRecepcionService : IDbRecepcionService
    {
        private readonly IDbRecepcionRepository _repo;

        public DbRecepcionService(IDbRecepcionRepository repo)
        {
            _repo = repo;
        }

        public Task<DtoLlamadaEntrante?> F_GetLlamadasAsync(int sitioGraba, int acd, CancellationToken ct)
            => _repo.F_GetLlamadasAsync(sitioGraba, acd, ct);

        public Task<long> F_ConsultarSeqPedidoAsync(CancellationToken ct)
            => _repo.F_ConsultarSeqPedidoAsync(ct);

        public Task<List<DtoCasoItem>> F_GetCasosIntelAsync(string busqueda, CancellationToken ct)
            => _repo.F_GetCasosIntelAsync(busqueda, ct);

        public Task<DtoCasoItem?> F_GetCasoPorCodigoAsync(string codigo, CancellationToken ct)
            => _repo.F_GetCasoPorCodigoAsync(codigo, ct);

        public Task<List<DtoCanalRecepcion>> F_GetCanalesAsync(int sitioGraba, CancellationToken ct)
            => _repo.F_GetCanalesAsync(sitioGraba, ct);

        public Task<List<DtoReferenciaSecad>> F_GetReferenciasAsync(string nombre, CancellationToken ct)
            => _repo.F_GetReferenciasAsync(nombre, ct);

        public Task<List<DtoLlamadaAsociar>> F_BuscarLlamadasAsociarAsync(int sitioGraba, string horaCaso, long numeLlamada, CancellationToken ct)
            => _repo.F_BuscarLlamadasAsociarAsync(sitioGraba, horaCaso, numeLlamada, ct);

        public Task<DtoRecepcionResult> P_GuardarLlamadaAsync(DtoRecepcion datos, int canalFuerza, string usuario, long idEmpleado, CancellationToken ct)
            => _repo.P_GuardarLlamadaAsync(datos, canalFuerza, usuario, idEmpleado, ct);

        public Task<DtoRecepcionResult> P_CerrarLlamadaRapidaAsync(DtoRecepcion datos, string usuario, CancellationToken ct)
            => _repo.P_CerrarLlamadaRapidaAsync(datos, usuario, ct);
    }
}

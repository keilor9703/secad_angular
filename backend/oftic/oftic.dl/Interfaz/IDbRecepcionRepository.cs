using Comun.Dtos.Recepcion;

namespace Datos.Interfaz
{
    public interface IDbRecepcionRepository
    {
        /// <summary>Poll CTI interface for an unregistered incoming call.</summary>
        Task<DtoLlamadaEntrante?> F_GetLlamadasAsync(int sitioGraba, int acd, CancellationToken ct);

        /// <summary>Get the next call-sequence number.</summary>
        Task<long> F_ConsultarSeqPedidoAsync(CancellationToken ct);

        /// <summary>Full-text / LIKE search on cad_casos.</summary>
        Task<List<DtoCasoItem>> F_GetCasosIntelAsync(string busqueda, CancellationToken ct);

        /// <summary>Exact-code lookup on cad_casos.</summary>
        Task<DtoCasoItem?> F_GetCasoPorCodigoAsync(string codigo, CancellationToken ct);

        /// <summary>Channels available for a given recording-site, grouped by fuerza.</summary>
        Task<List<DtoCanalRecepcion>> F_GetCanalesAsync(int sitioGraba, CancellationToken ct);

        /// <summary>Reference catalog rows for a given category (TIPO_PEDIDO, CALI_PEDIDO, …).</summary>
        Task<List<DtoReferenciaSecad>> F_GetReferenciasAsync(string nombre, CancellationToken ct);

        /// <summary>Recent calls eligible for association (200-min window, exclude code 900).</summary>
        Task<List<DtoLlamadaAsociar>> F_BuscarLlamadasAsociarAsync(int sitioGraba, string horaCaso, long numeLlamada, CancellationToken ct);

        /// <summary>Insert full reception form into cad_pedidos + cad_pedidos_canales.</summary>
        Task<DtoRecepcionResult> P_GuardarLlamadaAsync(DtoRecepcion datos, int canalFuerza, string usuario, long idEmpleado, CancellationToken ct);

        /// <summary>Quick-close: minimal INSERT into cad_pedidos with estado=C.</summary>
        Task<DtoRecepcionResult> P_CerrarLlamadaRapidaAsync(DtoRecepcion datos, string usuario, CancellationToken ct);
    }
}

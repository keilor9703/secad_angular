using Comun.Dtos.Turnos;

namespace Datos.Interfaz
{
    /// <summary>
    /// Lee la georreferenciación GPS actual de las patrullas directamente desde
    /// Oracle (vista GESPO V_CONSULTA_GPS_SECAD), sin pasar por Postgres/FDW.
    /// </summary>
    public interface IGespoOracleReader
    {
        /// <summary>
        /// Devuelve un item por cuadrante/patrulla (el fix más reciente entre todos
        /// los policiales de ese cuadrante). Lista vacía si la lectura está
        /// deshabilitada o sin configurar (GespoOracle:Enabled = false o sin
        /// ConnectionString). Si la consulta a Oracle falla, la excepción se
        /// propaga — el llamador (GespoUbicacionPollerService) la captura y loguea.
        /// </summary>
        Task<List<DtoGespoUbicacion>> LeerUbicacionesActualesAsync(CancellationToken ct);
    }
}

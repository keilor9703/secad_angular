using Comun.Dtos.Turnos;

namespace Datos.Interfaz
{
    /// <summary>
    /// Lee la georreferenciación GPS actual de las patrullas directamente desde
    /// Oracle (vista GESPO VW_CONSULTA_ACTUAL_GPS), sin pasar por Postgres/FDW.
    /// </summary>
    public interface IGespoOracleReader
    {
        /// <summary>
        /// Devuelve un item por cuadrante/patrulla (el fix más reciente entre todos
        /// los policiales de ese cuadrante) filtrado a la unidad indicada por
        /// <paramref name="siglaUnidad"/> (columna SIGLA_PAPA_UNIDAD de la vista
        /// Oracle — ver secad_tenants.gespo_sigla_unidad), para que un tenant nunca
        /// reciba patrullas de otras ciudades. Lista vacía si la lectura está
        /// deshabilitada o sin configurar (GespoOracle:Enabled = false o sin
        /// ConnectionString), o si <paramref name="siglaUnidad"/> viene vacío. Si la
        /// consulta a Oracle falla, la excepción se propaga — el llamador
        /// (GespoUbicacionPollerService) la captura y loguea.
        /// </summary>
        Task<List<DtoGespoUbicacion>> LeerUbicacionesActualesAsync(string siglaUnidad, CancellationToken ct);
    }
}

namespace Api.BackgroundServices
{
    /// <summary>
    /// Parámetros de configuración para el poller de ubicaciones GPS de GESPO.
    /// Se ligan a la sección <c>GespoUbicacionPoller</c> de appsettings.json.
    /// </summary>
    public sealed class GespoUbicacionPollerOptions
    {
        public const string Section = "GespoUbicacionPoller";

        /// <summary>
        /// Habilita o deshabilita el poller completamente. Aunque esté en <c>true</c>,
        /// no escribe nada mientras <c>GespoOracle:Enabled</c> sea <c>false</c> o falte
        /// el ConnectionString (ver <see cref="Datos.Gestion.GespoOracleOptions"/>).
        /// Valor por defecto: <c>false</c>.
        /// </summary>
        public bool Enabled { get; set; } = false;

        /// <summary>
        /// Intervalo en segundos entre ciclos de sincronización completos (todos los
        /// tenants activos). La vista Oracle de origen se refresca cada ~15s, así que
        /// un intervalo menor no trae datos más frescos — solo agrega carga al FDW.
        /// Valor por defecto: <c>12</c> segundos.
        /// </summary>
        public int IntervalSeconds { get; set; } = 12;

        /// <summary>
        /// Máximo de tenants sincronizados en paralelo por ciclo.
        /// Limita la presión sobre el link FDW hacia Oracle.
        /// Valor por defecto: <c>4</c>.
        /// </summary>
        public int MaxParallelTenants { get; set; } = 4;

        /// <summary>
        /// Segundos de espera inicial tras el arranque de la aplicación antes del
        /// primer ciclo. Valor por defecto: <c>20</c> segundos.
        /// </summary>
        public int StartupDelaySeconds { get; set; } = 20;
    }
}

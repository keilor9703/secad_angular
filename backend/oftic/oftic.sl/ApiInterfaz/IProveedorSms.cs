namespace Servicios.ApiInterfaz
{
    /// <summary>
    /// Envío de SMS saliente — abstrae el proveedor real. Implementado por
    /// <see cref="Servicios.Api.InfobipProveedorSms"/>; si Infobip no está
    /// configurado (o falla), simplemente devuelve false sin bloquear el resto
    /// del flujo de videollamada — el link sigue disponible para el despachador.
    /// </summary>
    public interface IProveedorSms
    {
        /// <summary>true si el proveedor confirmó el envío; false si no hay proveedor configurado o falló.</summary>
        Task<bool> EnviarSmsAsync(string numero, string mensaje, CancellationToken ct = default);
    }
}

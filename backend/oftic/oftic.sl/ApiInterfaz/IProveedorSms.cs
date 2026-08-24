namespace Servicios.ApiInterfaz
{
    /// <summary>
    /// Envío de SMS saliente — abstrae el proveedor real (operador celular,
    /// gateway comercial, etc.) que aún no está contratado. Mientras tanto,
    /// <see cref="Servicios.Api.LogOnlyProveedorSms"/> registra el mensaje sin
    /// enviarlo de verdad, para no bloquear el resto del flujo de videollamada.
    /// </summary>
    public interface IProveedorSms
    {
        /// <summary>true si el proveedor confirmó el envío; false si no hay proveedor configurado o falló.</summary>
        Task<bool> EnviarSmsAsync(string numero, string mensaje, CancellationToken ct = default);
    }
}

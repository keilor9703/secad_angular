using Microsoft.Extensions.Logging;
using Servicios.ApiInterfaz;

namespace Servicios.Api
{
    /// <summary>
    /// Implementación de respaldo de <see cref="IProveedorSms"/> mientras no haya
    /// un proveedor de SMS saliente contratado: solo deja el mensaje en el log y
    /// devuelve false (no enviado). El despachador sigue viendo el link en la
    /// respuesta de VideoLlamadaController para copiarlo y enviarlo por el canal
    /// que tenga a mano (WhatsApp, dictado, etc.) mientras se define el gateway real.
    ///
    /// Cuando se contrate un proveedor, se reemplaza registrando la implementación
    /// real en Program.cs (AddScoped&lt;IProveedorSms, ProveedorSmsReal&gt;) — nada
    /// más del sistema depende de cuál sea.
    /// </summary>
    public class LogOnlyProveedorSms : IProveedorSms
    {
        private readonly ILogger<LogOnlyProveedorSms> _log;

        public LogOnlyProveedorSms(ILogger<LogOnlyProveedorSms> log)
        {
            _log = log;
        }

        public Task<bool> EnviarSmsAsync(string numero, string mensaje, CancellationToken ct = default)
        {
            _log.LogWarning(
                "[SMS] Sin proveedor configurado — mensaje NO enviado. Destino={Numero} Mensaje={Mensaje}",
                numero, mensaje);
            return Task.FromResult(false);
        }
    }
}

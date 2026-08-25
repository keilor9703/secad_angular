using Comun.Dtos.Operacion;
using Datos.Interfaz;
using Microsoft.Extensions.Logging;
using Negocio.Interfaz;
using Servicios.ApiInterfaz;

namespace Negocio.Gestion
{
    public class DbVideoLlamadaService : IDbVideoLlamadaService
    {
        private readonly IDbVideoLlamadaRepository _repo;
        private readonly IProveedorSms _sms;
        private readonly ILogger<DbVideoLlamadaService> _logger;

        public DbVideoLlamadaService(
            IDbVideoLlamadaRepository repo, IProveedorSms sms, ILogger<DbVideoLlamadaService> logger)
        {
            _repo   = repo;
            _sms    = sms;
            _logger = logger;
        }

        public Task<long> CrearSesionAsync(
            long pedidoId, int sitioGraba, string usuarioDespachador,
            DateTime fechaExpira, string? numeroTelefono, CancellationToken ct)
            => _repo.CrearSesionAsync(pedidoId, sitioGraba, usuarioDespachador, fechaExpira, numeroTelefono, ct);

        public async Task<bool> EnviarLinkAsync(string numeroTelefono, string link, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(numeroTelefono)) return false;

            var mensaje = $"Policía Nacional: para que el despachador vea la situación en video, toque este enlace: {link}";
            try
            {
                return await _sms.EnviarSmsAsync(numeroTelefono, mensaje, ct);
            }
            catch (Exception ex)
            {
                // No relanzar — el despachador siempre recibe el link en la respuesta
                // del endpoint aunque el envío falle, para copiarlo manualmente.
                _logger.LogWarning(ex, "[VideoLlamada] Error enviando SMS a {Numero}", numeroTelefono);
                return false;
            }
        }

        public Task<DtoVideoSesionEstado?> GetEstadoAsync(long sesionId, CancellationToken ct)
            => _repo.GetPorIdAsync(sesionId, ct);

        public Task MarcarConectadaAsync(long sesionId, string? ipCiudadano, CancellationToken ct)
            => _repo.MarcarConectadaAsync(sesionId, ipCiudadano, ct);

        public Task MarcarFinalizadaAsync(long sesionId, CancellationToken ct)
            => _repo.MarcarFinalizadaAsync(sesionId, ct);

        public Task VincularGrabacionAsync(long sesionId, long adjuntoId, CancellationToken ct)
            => _repo.VincularGrabacionAsync(sesionId, adjuntoId, ct);
    }
}

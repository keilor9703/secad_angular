using Comun.Dtos.Operacion;

namespace Negocio.Interfaz
{
    public interface IDbVideoLlamadaService
    {
        /// <summary>Crea la sesión en estado PENDIENTE. La firma del token JWT la hace el controlador (VideoSessionTokenService).</summary>
        Task<long> CrearSesionAsync(
            long pedidoId, int sitioGraba, string usuarioDespachador,
            DateTime fechaExpira, string? numeroTelefono, CancellationToken ct);

        /// <summary>Envía el link por SMS (best-effort, ver IProveedorSms). No lanza si falla — el llamador decide qué mostrar.</summary>
        Task<bool> EnviarLinkAsync(string numeroTelefono, string link, CancellationToken ct);

        Task<DtoVideoSesionEstado?> GetEstadoAsync(long sesionId, CancellationToken ct);
        Task MarcarConectadaAsync(long sesionId, string? ipCiudadano, CancellationToken ct);
        Task MarcarFinalizadaAsync(long sesionId, CancellationToken ct);
        Task VincularGrabacionAsync(long sesionId, long adjuntoId, CancellationToken ct);
    }
}

using Comun.Dtos.Operacion;

namespace Datos.Interfaz
{
    public interface IDbVideoLlamadaRepository
    {
        /// <summary>Inserta la sesión en estado PENDIENTE. Retorna el id generado (Snowflake).</summary>
        Task<long> CrearSesionAsync(
            long pedidoId, int sitioGraba, string usuarioDespachador,
            DateTime fechaExpira, CancellationToken ct);

        /// <summary>Lee el estado de una sesión por id. Null si no existe.</summary>
        Task<DtoVideoSesionEstado?> GetPorIdAsync(long sesionId, CancellationToken ct);

        /// <summary>Marca CONECTADA la primera vez que el ciudadano entra. No-op si ya estaba conectada.</summary>
        Task MarcarConectadaAsync(long sesionId, string? ipCiudadano, CancellationToken ct);

        /// <summary>Marca FINALIZADA (cierre normal, por cualquiera de los dos extremos).</summary>
        Task MarcarFinalizadaAsync(long sesionId, CancellationToken ct);

        /// <summary>Vincula el adjunto de la grabación subida al cerrar la sesión.</summary>
        Task VincularGrabacionAsync(long sesionId, long adjuntoId, CancellationToken ct);

        /// <summary>Barrido de sesiones PENDIENTE cuya fecha_expira ya pasó → EXPIRADA. Llamado bajo demanda, no hay job de fondo.</summary>
        Task ExpirarVencidasAsync(CancellationToken ct);
    }
}

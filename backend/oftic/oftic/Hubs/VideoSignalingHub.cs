using Api.Services;
using Datos.Interfaz;
using Datos.Tenant;
using Microsoft.AspNetCore.SignalR;
using Negocio.Interfaz;
using System.Security.Claims;

namespace Api.Hubs
{
    /// <summary>
    /// Señalización WebRTC (SDP offer/answer + candidatos ICE) entre el navegador
    /// del ciudadano y la consola del despachador — punto-a-punto, sin SFU. El
    /// audio/video en sí nunca pasa por este servidor, solo los mensajes de
    /// negociación necesarios para que ambos extremos establezcan la conexión
    /// directa (vía STUN/TURN).
    ///
    /// No lleva [Authorize] a nivel de Hub porque atiende dos tipos de conexión
    /// muy distintos: el despachador (JWT normal, autenticado como cualquier otro
    /// endpoint de SECAD) y el ciudadano (anónimo, autenticado solo por el
    /// VideoSessionToken de un solo uso que trae en el link). Cada método valida
    /// lo que corresponde según quién lo llama.
    ///
    /// Un SignalR group por sesión = "video-{sesionId}" — como cada sesión tiene
    /// exactamente dos participantes, no hace falta más que relayar entre ellos.
    /// </summary>
    public class VideoSignalingHub : Hub
    {
        private readonly TenantContext            _tenantContext;
        private readonly IDbMasterRepository      _masterRepo;
        private readonly ConnectionPoolManager    _poolManager;
        private readonly IDbVideoLlamadaService   _videoService;
        private readonly VideoSessionTokenService _sessionToken;
        private readonly ILogger<VideoSignalingHub> _logger;

        public VideoSignalingHub(
            TenantContext tenantContext,
            IDbMasterRepository masterRepo,
            ConnectionPoolManager poolManager,
            IDbVideoLlamadaService videoService,
            VideoSessionTokenService sessionToken,
            ILogger<VideoSignalingHub> logger)
        {
            _tenantContext = tenantContext;
            _masterRepo    = masterRepo;
            _poolManager   = poolManager;
            _videoService  = videoService;
            _sessionToken  = sessionToken;
            _logger        = logger;
        }

        private static string GroupName(long sesionId) => $"video-{sesionId}";

        // ════════════════════════════════════════════════════════════════════════
        // DESPACHADOR — conexión autenticada (JWT normal de SECAD)
        // ════════════════════════════════════════════════════════════════════════

        /// <summary>El despachador entra a la sala de su propia sesión (la que acaba de crear).</summary>
        public async Task JoinAsDespachador(string sesionId)
        {
            if (Context.User?.Identity?.IsAuthenticated != true)
            {
                await Clients.Caller.SendAsync("error", "No autenticado.");
                return;
            }
            if (!long.TryParse(sesionId, out var id))
            {
                await Clients.Caller.SendAsync("error", "sesionId inválido.");
                return;
            }

            var estado = await _videoService.GetEstadoAsync(id, Context.ConnectionAborted);
            if (estado is null)
            {
                await Clients.Caller.SendAsync("error", "Sesión no encontrada.");
                return;
            }

            // Mismo criterio de IDOR ya aplicado en PedidoController: un despachador
            // de otro sitio no puede entrar a una sesión que no le pertenece,
            // salvo administradores.
            var esAdmin = string.Equals(Context.User.FindFirst("es_admin")?.Value, "true", StringComparison.OrdinalIgnoreCase);
            var sitioClaim = int.TryParse(Context.User.FindFirst("sitio_graba")?.Value, out var sg) ? sg : 0;
            if (!esAdmin && estado.SitioGraba != sitioClaim)
            {
                await Clients.Caller.SendAsync("error", "No autorizado para esta sesión.");
                return;
            }

            await Groups.AddToGroupAsync(Context.ConnectionId, GroupName(id));
            await Clients.Caller.SendAsync("unido", estado.Estado);
        }

        // ════════════════════════════════════════════════════════════════════════
        // CIUDADANO — conexión anónima, autenticada solo por el VideoSessionToken
        // ════════════════════════════════════════════════════════════════════════

        /// <summary>El ciudadano toca el link → su navegador llama esto con el token de la URL.</summary>
        public async Task JoinAsCiudadano(string token)
        {
            var data = _sessionToken.ValidateToken(token);
            if (data is null)
            {
                await Clients.Caller.SendAsync("error", "Enlace inválido o expirado.");
                return;
            }

            // El ciudadano no trae JWT de SECAD, así que no hay TenantMiddleware que
            // resuelva el tenant — se resuelve aquí a mano a partir del cod_dane que
            // el propio VideoSessionToken ya llevaba firmado desde su creación.
            var tenant = await _masterRepo.GetTenantByCodDaneAsync(data.CodDane, Context.ConnectionAborted);
            if (tenant is null)
            {
                await Clients.Caller.SendAsync("error", "No fue posible validar el enlace.");
                return;
            }
            _tenantContext.Set(_poolManager.GetOrCreate(tenant), tenant.CodDane, tenant.Nombre);

            var ip = GetIp();
            await _videoService.MarcarConectadaAsync(data.SesionId, ip, Context.ConnectionAborted);

            await Groups.AddToGroupAsync(Context.ConnectionId, GroupName(data.SesionId));
            await Clients.Caller.SendAsync("unido", "CONECTADA");
            await Clients.OthersInGroup(GroupName(data.SesionId)).SendAsync("ciudadano-conectado");
        }

        private string? GetIp() =>
            Context.GetHttpContext()?.Connection.RemoteIpAddress?.ToString();

        // ════════════════════════════════════════════════════════════════════════
        // SEÑALIZACIÓN — relay puro, sin lógica de negocio (offer/answer/ICE)
        // ════════════════════════════════════════════════════════════════════════

        public Task SendOffer(string sesionId, string sdp) =>
            Clients.OthersInGroup(GroupName(ParseSesionId(sesionId))).SendAsync("offer", sdp);

        public Task SendAnswer(string sesionId, string sdp) =>
            Clients.OthersInGroup(GroupName(ParseSesionId(sesionId))).SendAsync("answer", sdp);

        public Task SendIceCandidate(string sesionId, string candidate) =>
            Clients.OthersInGroup(GroupName(ParseSesionId(sesionId))).SendAsync("ice-candidate", candidate);

        private static long ParseSesionId(string sesionId) =>
            long.TryParse(sesionId, out var id) ? id : 0;

        // ════════════════════════════════════════════════════════════════════════
        // CIERRE
        // ════════════════════════════════════════════════════════════════════════

        public async Task EndSession(string sesionId)
        {
            if (!long.TryParse(sesionId, out var id)) return;
            await _videoService.MarcarFinalizadaAsync(id, Context.ConnectionAborted);
            await Clients.Group(GroupName(id)).SendAsync("sesion-finalizada");
        }
    }
}

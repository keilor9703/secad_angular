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

        private const string CodDaneItemKey = "codDane";

        /// <summary>
        /// SignalR crea una instancia nueva del Hub (y un scope de DI nuevo, por
        /// tanto un TenantContext vacío) en CADA invocación de método — a
        /// diferencia de un request HTTP normal, donde TenantMiddleware lo resuelve
        /// una sola vez por request y ese mismo scope se reutiliza durante todo el
        /// request. Por eso cualquier método de este hub que toque la base de
        /// datos (a través de _videoService) debe resolver el tenant a mano.
        /// Context.Items sí persiste durante toda la conexión (no por invocación),
        /// así que cachea ahí el cod_dane ya resuelto para no releer claims/token
        /// en cada llamada subsiguiente sobre la misma conexión.
        /// </summary>
        private async Task<bool> AsegurarTenantAsync()
        {
            if (_tenantContext.IsInitialized) return true;

            var codDane = Context.Items.TryGetValue(CodDaneItemKey, out var cached) ? cached as string : null;

            if (string.IsNullOrWhiteSpace(codDane) && Context.User?.Identity?.IsAuthenticated == true)
                codDane = Context.User.FindFirst("cod_dane")?.Value;

            if (string.IsNullOrWhiteSpace(codDane))
            {
                await Clients.Caller.SendAsync("error", "No fue posible resolver el tenant de la sesión.");
                return false;
            }

            if (!_poolManager.TryGet(codDane, out var dataSource) || dataSource is null)
            {
                var tenant = await _masterRepo.GetTenantByCodDaneAsync(codDane, Context.ConnectionAborted);
                if (tenant is null)
                {
                    await Clients.Caller.SendAsync("error", "Tenant no autorizado.");
                    return false;
                }
                dataSource = _poolManager.GetOrCreate(tenant);
            }

            string? nombreCad     = null;
            int?    sitioEfectivo = _poolManager.GetSitioGraba(codDane);
            if (Context.User?.Identity?.IsAuthenticated == true)
            {
                nombreCad = Context.User.FindFirst("nombre_cad")?.Value;
                if (int.TryParse(Context.User.FindFirst("sitio_graba")?.Value, out var sg))
                    sitioEfectivo = sg;
            }

            _tenantContext.Set(dataSource, codDane, nombreCad, sitioEfectivo, _poolManager.GetGespoSigla(codDane));
            Context.Items[CodDaneItemKey] = codDane;
            return true;
        }

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

            if (!await AsegurarTenantAsync()) return;

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
            // resuelva el tenant — el cod_dane sale del propio VideoSessionToken,
            // firmado desde su creación. Se cachea en Context.Items para que
            // AsegurarTenantAsync() lo reutilice en llamadas posteriores sobre esta
            // misma conexión (p.ej. EndSession), donde ya no hay token disponible.
            Context.Items[CodDaneItemKey] = data.CodDane;
            if (!await AsegurarTenantAsync()) return;

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
        // UBICACIÓN — el ciudadano reporta su posición GPS en vivo (opcional, si
        // concedió el permiso). Se persiste (última conocida, no histórico) y se
        // relaya al despachador para que la vea en el mini-mapa del panel.
        // ════════════════════════════════════════════════════════════════════════

        public async Task EnviarUbicacion(string sesionId, double lat, double lng, double? precision)
        {
            var id = ParseSesionId(sesionId);
            if (id == 0) return;
            if (!await AsegurarTenantAsync()) return;

            await _videoService.ActualizarUbicacionAsync(id, lat, lng, precision, Context.ConnectionAborted);
            await Clients.OthersInGroup(GroupName(id)).SendAsync("ubicacion", lat, lng, precision);
        }

        // ════════════════════════════════════════════════════════════════════════
        // CIERRE
        // ════════════════════════════════════════════════════════════════════════

        public async Task EndSession(string sesionId)
        {
            if (!long.TryParse(sesionId, out var id)) return;
            if (!await AsegurarTenantAsync()) return;
            await _videoService.MarcarFinalizadaAsync(id, Context.ConnectionAborted);
            await Clients.Group(GroupName(id)).SendAsync("sesion-finalizada");
        }
    }
}

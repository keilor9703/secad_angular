using System.Text.Json.Serialization;

namespace Comun.Dtos.Operacion
{
    // ── Estados posibles de cad_video_sesiones.estado ─────────────────────────
    public static class EstadoVideoSesion
    {
        public const string Pendiente  = "PENDIENTE";
        public const string Conectada  = "CONECTADA";
        public const string Finalizada = "FINALIZADA";
        public const string Expirada   = "EXPIRADA";
        public const string Cancelada  = "CANCELADA";
    }

    /// <summary>POST api/VideoLlamada — el despachador solicita crear una sesión para un caso.</summary>
    public class DtoCrearVideoSesionRequest
    {
        [JsonNumberHandling(JsonNumberHandling.WriteAsString | JsonNumberHandling.AllowReadingFromString)]
        public long   PedidoId       { get; set; }
        /// <summary>Número del ciudadano a quien enviar el link — el despachador lo confirma/edita en el panel.</summary>
        public string NumeroTelefono { get; set; } = "";
    }

    /// <summary>Respuesta al despachador tras crear la sesión: el link listo para enviar.</summary>
    public class DtoCrearVideoSesionResult
    {
        public bool    Success       { get; set; }
        public string  Message       { get; set; } = "";
        [JsonNumberHandling(JsonNumberHandling.WriteAsString | JsonNumberHandling.AllowReadingFromString)]
        public long    SesionId      { get; set; }
        /// <summary>Token firmado de corta vida (JWT) — el frontend arma la URL pública con esto: /video/{token}.</summary>
        public string  SessionToken  { get; set; } = "";
        public DateTime FechaExpira  { get; set; }
        /// <summary>true si IProveedorSms confirmó el envío; false si solo quedó disponible para copiar/enviar manualmente.</summary>
        public bool    SmsEnviado    { get; set; }
    }

    /// <summary>Estado de una sesión, expuesto al despachador para refrescar el panel.</summary>
    public class DtoVideoSesionEstado
    {
        [JsonNumberHandling(JsonNumberHandling.WriteAsString | JsonNumberHandling.AllowReadingFromString)]
        public long    SesionId          { get; set; }
        public int     SitioGraba        { get; set; }
        public string  Estado            { get; set; } = "";
        public DateTime FechaCreacion    { get; set; }
        public DateTime FechaExpira      { get; set; }
        public DateTime? FechaConectado  { get; set; }
        public DateTime? FechaFinalizado { get; set; }
    }

    /// <summary>
    /// Lo mínimo que la página pública del ciudadano necesita saber al validar su
    /// token — nunca expone el pedidoId real ni datos internos del caso.
    /// </summary>
    public class DtoVideoSesionPublica
    {
        public bool   Valido  { get; set; }
        public string Estado  { get; set; } = "";
        public string Mensaje { get; set; } = "";
        /// <summary>Necesario en el cliente para relayar señalización (SendAnswer/SendIceCandidate) tras unirse al Hub.</summary>
        [JsonNumberHandling(JsonNumberHandling.WriteAsString | JsonNumberHandling.AllowReadingFromString)]
        public long   SesionId { get; set; }
    }
}

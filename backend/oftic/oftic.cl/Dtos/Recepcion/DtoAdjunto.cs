using Microsoft.AspNetCore.Http;
using System.Text.Json.Serialization;

namespace Comun.Dtos.Recepcion
{
    // ── Adjunto guardado (respuesta de API) ─────────────────────────────────
    public class DtoAdjunto
    {
        [JsonNumberHandling(JsonNumberHandling.WriteAsString | JsonNumberHandling.AllowReadingFromString)]
        public long   Id             { get; set; }
        public long   PedidoId       { get; set; }
        public int    SitioGraba     { get; set; }
        public string TipoAdjunto    { get; set; } = "FOTO";
        public string NombreOriginal { get; set; } = "";
        public string NombreGuardado { get; set; } = "";
        public string RutaRelativa   { get; set; } = "";
        /// <summary>URL pública servida por /uploads/…</summary>
        public string UrlPublica     { get; set; } = "";
        public string MimeType       { get; set; } = "";
        public long   TamanioBytes   { get; set; }
        public string? Descripcion   { get; set; }
        public string CanalOrigen    { get; set; } = "MANUAL";
        public string SubidoPor      { get; set; } = "";
        public string FechaSubida    { get; set; } = "";
    }

    // ── Solicitud multipart para subir una foto ──────────────────────────────
    public class DtoUploadAdjuntoRequest
    {
        public IFormFile? File        { get; set; }
        public long       PedidoId    { get; set; }
        public int        SitioGraba  { get; set; }
        public string?    Descripcion { get; set; }
        /// <summary>MANUAL | API_CHAT | API_SMS | API_FOTO</summary>
        public string     CanalOrigen { get; set; } = "MANUAL";
    }
}

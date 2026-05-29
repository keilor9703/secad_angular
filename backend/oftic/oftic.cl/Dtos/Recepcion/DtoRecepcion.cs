using System.Text.Json.Serialization;

namespace Comun.Dtos.Recepcion
{
    // ── Incoming telephony event (from CTI interface) ───────────────────────────
    public class DtoLlamadaEntrante
    {
        public long   NUME_LLAMADA  { get; set; }
        public long   NUME_TELEFONO { get; set; }
        public string CORDX         { get; set; } = "0";
        public string CORDY         { get; set; } = "0";
        public string TIPOSHAPE     { get; set; } = "";
        public int    RADIO         { get; set; }
        public string FECHAGMLC     { get; set; } = "";
        public string OPERADOR      { get; set; } = "";
    }

    // ── Case code autocomplete item ─────────────────────────────────────────────
    public class DtoCasoItem
    {
        [JsonPropertyName("CODIGO_CASO")]
        public string CODIGO_CASO { get; set; } = "";

        [JsonPropertyName("DESCRIPCION_CASO")]
        public string DESCRIPCION_CASO { get; set; } = "";

        /// <summary>
        /// ID de la categoría del Asistente Inteligente vinculada a este caso.
        /// Se serializa como string para preservar la precisión de Snowflake IDs (19 dígitos).
        /// Null cuando el caso no tiene categoría configurada.
        /// </summary>
        [JsonPropertyName("ID_CATEGORIA_ASISTENTE")]
        public string? ID_CATEGORIA_ASISTENTE { get; set; }

        /// <summary>Código interno de la categoría (ej: HURTO, RINA). Usado para seleccionar plantilla narrativa.</summary>
        [JsonPropertyName("CATEGORIA_CODIGO")]
        public string? CATEGORIA_CODIGO { get; set; }

        /// <summary>Descripción de la categoría del asistente (JOIN informativo).</summary>
        [JsonPropertyName("CATEGORIA_DESCRIPCION")]
        public string? CATEGORIA_DESCRIPCION { get; set; }
    }

    // ── Dispatch channel ────────────────────────────────────────────────────────
    public class DtoCanalRecepcion
    {
        public int    Codigo      { get; set; }
        public string Descripcion { get; set; } = "";
        public string Fuerza      { get; set; } = "";
    }

    // ── Reference catalog row (TIPO_PEDIDO, CALI_PEDIDO, …) ────────────────────
    public class DtoReferenciaSecad
    {
        public string Nombre       { get; set; } = "";
        public string Codigo       { get; set; } = "";
        public string Descripcion  { get; set; } = "";
        public string Abreviatura  { get; set; } = "";
    }

    // ── "Associate call" search request ────────────────────────────────────────
    public class DtoBusquedaAsociarLlamada
    {
        public int    SitioGraba  { get; set; }
        public string HoraCaso    { get; set; } = "";
        public long   NumeLlamada { get; set; }
    }

    // ── Row returned by F_BuscarLlamadasAsociar ─────────────────────────────────
    public class DtoLlamadaAsociar
    {
        public long   NUME_LLAMADA  { get; set; }
        public string HORA_CASO     { get; set; } = "";
        public long   NUME_TELEFONO { get; set; }
        public string CALI_PEDIDO   { get; set; } = "";
        public string CIUDAD        { get; set; } = "";
        public string NOMB_LLAMANTE { get; set; } = "";
        public string DIRE_CASO     { get; set; } = "";
        public string CODI_PEDIDO   { get; set; } = "";
        public string ESTADO        { get; set; } = "";
        public int    SITIO_GRABA   { get; set; }
    }

    // ── Main reception-form payload (used for both save and quick-close) ────────
    public class DtoRecepcion
    {
        public int    SITIO_GRABA    { get; set; }
        public long   NUME_LLAMADA   { get; set; }
        /// <summary>Format: dd/MM/yyyy HH:mm:ss</summary>
        public string HORA_CASO      { get; set; } = "";
        public long   NUME_TELEFONO  { get; set; }
        public string PROP_TELEFONO  { get; set; } = "";
        public string NOMB_LLAMANTE  { get; set; } = "";
        public string DIRE_LLAMANTE  { get; set; } = "";
        public string TIPO_PEDIDO    { get; set; } = "";
        public string CALI_PEDIDO    { get; set; } = "";
        public string BARRIO         { get; set; } = "";
        public string CIUDAD         { get; set; } = "";
        public string DIRE_CASO      { get; set; } = "";
        public string LATITUD_CASO   { get; set; } = "";
        public string LONGITUD_CASO  { get; set; } = "";
        public string COMENTARIO     { get; set; } = "";
        public string CODI_PEDIDO    { get; set; } = "";
        public string CODI_PEDIDO2   { get; set; } = "";
        public string IMPORTANCIA    { get; set; } = "01";
        public string PRIORIDAD      { get; set; } = "03";
        public string DISP_TELEFONICO{ get; set; } = "";
        /// <summary>celda_marcacion / cell ID of calling device</summary>
        public string OPERADOR       { get; set; } = "";
        public string ESTADO         { get; set; } = "A";
        public string ENVIAR         { get; set; } = "N";
        /// <summary>
        /// Origen del evento a registrar en cad_eventos.
        /// Valores: CTI | RECEPCION | APP_MOVIL | INTEGRACION | SIEDCO | INTERNO | MANUAL.
        /// El frontend envía "CTI" cuando la llamada llega de la centralita,
        /// "RECEPCION" cuando el operador la digita manualmente.
        /// </summary>
        public string Origen         { get; set; } = "RECEPCION";
        public List<int> CANALES_SELECCIONADOS { get; set; } = new();
        public int?   CANAL_FUERZA   { get; set; }
        public string? CADPEDI_SITIO_GRABA  { get; set; }
        public string? CADPEDI_NUME_LLAMADA { get; set; }
    }

    // ── Result wrapper for save/close operations ─────────────────────────────────
    public class DtoRecepcionResult
    {
        public bool   Success { get; set; }
        public string Message { get; set; } = "";
    }
}

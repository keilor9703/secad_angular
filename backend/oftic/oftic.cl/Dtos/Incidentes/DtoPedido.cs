namespace Comun.Dtos.Incidentes
{
    // ─── Request DTOs ──────────────────────────────────────────────────────────

    public class DtoPedidoRequest
    {
        public int SitioGraba { get; set; }
        public long NumeLlamada { get; set; }
        public string HoraCaso { get; set; } = string.Empty;
        public long NumeTelefono { get; set; }
        public string PropTelefono { get; set; } = string.Empty;
        public string NombLlamante { get; set; } = string.Empty;
        public string Barrio { get; set; } = string.Empty;
        public string Ciudad { get; set; } = string.Empty;
        public string DireLlamante { get; set; } = string.Empty;
        public string DireCaso { get; set; } = string.Empty;
        public string LatitudCaso { get; set; } = string.Empty;
        public string LongitudCaso { get; set; } = string.Empty;
        public string Cordx { get; set; } = string.Empty;
        public string Cordy { get; set; } = string.Empty;
        public string Tiposhape { get; set; } = string.Empty;
        public int Radio { get; set; }
        public string Comentario { get; set; } = string.Empty;
        public string CodiPedido { get; set; } = string.Empty;
        public string CodiPedido2 { get; set; } = string.Empty;
        public string TipoPedido { get; set; } = string.Empty;
        public string CaliPedido { get; set; } = string.Empty;
        public string Importancia { get; set; } = string.Empty;
        public string Prioridad { get; set; } = string.Empty;
        public string DispTelefonico { get; set; } = string.Empty;
        public string CeldaMarcacion { get; set; } = string.Empty;
        public List<int> CanalesSeleccionados { get; set; } = new();
        public string CanalFuerza { get; set; } = string.Empty;
        public string Enviar { get; set; } = "N";
        public string Estado { get; set; } = "A";
        public int? PedidoPadreSitio { get; set; }
        public long? PedidoPadreNum { get; set; }
    }

    public class DtoCerrarRapidoRequest
    {
        public string Comentario { get; set; } = string.Empty;
        public string CodiPedido { get; set; } = string.Empty;
        public string Enviar { get; set; } = "N";
    }

    public class DtoAnotacionRequest
    {
        public string Titulo { get; set; } = string.Empty;
        public string Anotacion { get; set; } = string.Empty;
        public string TipoAnotacion { get; set; } = "GENERAL";
    }

    public class DtoEstadoPedidoRequest
    {
        public string Estado { get; set; } = string.Empty;
    }

    // ─── Response DTOs ─────────────────────────────────────────────────────────

    public class DtoPedidoListItem
    {
        public long Id { get; set; }
        public int SitioGraba { get; set; }
        public long? NumeLlamada { get; set; }
        public DateTime? HoraCaso { get; set; }
        public long? NumeTelefono { get; set; }
        public string DireCaso { get; set; } = string.Empty;
        public string Estado { get; set; } = string.Empty;
        public string Enviar { get; set; } = string.Empty;
        public string CodiPedido { get; set; } = string.Empty;
        public string CodiPedido2 { get; set; } = string.Empty;
        public string Comentario { get; set; } = string.Empty;
        public string UsernameCreacion { get; set; } = string.Empty;
        public DateTime? FechaCreacion { get; set; }
    }

    public class DtoPedidoDetalle : DtoPedidoListItem
    {
        public string PropTelefono { get; set; } = string.Empty;
        public string NombLlamante { get; set; } = string.Empty;
        public string Barrio { get; set; } = string.Empty;
        public string Ciudad { get; set; } = string.Empty;
        public string DireLlamante { get; set; } = string.Empty;
        public string LatitudCaso { get; set; } = string.Empty;
        public string LongitudCaso { get; set; } = string.Empty;
        public string Cordx { get; set; } = string.Empty;
        public string Cordy { get; set; } = string.Empty;
        public string Tiposhape { get; set; } = string.Empty;
        public int Radio { get; set; }
        public string TipoPedido { get; set; } = string.Empty;
        public string CaliPedido { get; set; } = string.Empty;
        public string Importancia { get; set; } = string.Empty;
        public string Prioridad { get; set; } = string.Empty;
        public string DispTelefonico { get; set; } = string.Empty;
        public string CeldaMarcacion { get; set; } = string.Empty;
        public string Canales { get; set; } = string.Empty;
        public string CanalFuerza { get; set; } = string.Empty;
        public int? PedidoPadreSitio { get; set; }
        public long? PedidoPadreNum { get; set; }
        public List<DtoAnotacion> Anotaciones { get; set; } = new();
    }

    public class DtoPedidoResult
    {
        public bool Success { get; set; }
        public string Message { get; set; } = string.Empty;
        public long Id { get; set; }
    }

    public class DtoAnotacion
    {
        public long Id { get; set; }
        public long IdPedido { get; set; }
        public string Titulo { get; set; } = string.Empty;
        public string Anotacion { get; set; } = string.Empty;
        public string TipoAnotacion { get; set; } = string.Empty;
        public long? UsuarioCreacion { get; set; }
        public string UsernameCreacion { get; set; } = string.Empty;
        public DateTime? FechaCreacion { get; set; }
        public string MaquinaCreacion { get; set; } = string.Empty;
    }

    public class DtoPedidoAsociar
    {
        public long Id { get; set; }
        public long? NumeLlamada { get; set; }
        public string HoraCaso { get; set; } = string.Empty;
        public long? NumeTelefono { get; set; }
        public string CaliPedido { get; set; } = string.Empty;
        public string Ciudad { get; set; } = string.Empty;
        public string NombLlamante { get; set; } = string.Empty;
        public string DireCaso { get; set; } = string.Empty;
        public string CodiPedido { get; set; } = string.Empty;
        public string Estado { get; set; } = string.Empty;
        public int SitioGraba { get; set; }
    }

    // ─── Eventos (dispatcher queue) DTOs ──────────────────────────────────────

    /// <summary>
    /// List item for the dispatcher's queue. Extends DtoPedidoListItem with
    /// fields needed for semaforización without loading the full detail.
    /// </summary>
    public class DtoEventoListItem : DtoPedidoListItem
    {
        public string Prioridad  { get; set; } = string.Empty;
        public string CaliPedido { get; set; } = string.Empty;
        public string Ciudad     { get; set; } = string.Empty;
    }

    /// <summary>
    /// Represents a dispatch channel available in the site.
    /// </summary>
    public class DtoCanalItem
    {
        public int    Codigo      { get; set; }
        public int    FuerzaId    { get; set; }
        public string Descripcion { get; set; } = string.Empty;
        public string FuerzaDesc  { get; set; } = string.Empty;
    }
}

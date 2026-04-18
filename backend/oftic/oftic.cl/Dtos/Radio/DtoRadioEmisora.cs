namespace Comun.Dtos.Radio
{
    public class DtoRadioEmisora
    {
        public long idEmisora { get; set; }
        public string nombre { get; set; } = string.Empty;
        public string streamUrl { get; set; } = string.Empty;
        public string? logoUrl { get; set; }
        public int orden { get; set; }
        public int activo { get; set; }
    }

    public class DtoRadioEmisoraRequest
    {
        public string? nombre { get; set; }
        public string? streamUrl { get; set; }
        public string? logoUrl { get; set; }
        public int orden { get; set; }
        public int? activo { get; set; }
    }

    public class DtoRadioEstadoRequest
    {
        public int activo { get; set; }
    }

    public class DtoRadioResult
    {
        public long id { get; set; }
        public bool success { get; set; }
        public string message { get; set; } = string.Empty;
    }
}


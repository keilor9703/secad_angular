namespace Comun.Dtos.LineasMando
{
    public class DtoLineaMando
    {
        public long IdLineaMando { get; set; }
        public string Identificacion { get; set; } = string.Empty;
        public string Nombre { get; set; } = string.Empty;
        public string Apellidos { get; set; } = string.Empty;
        public string Grado { get; set; } = string.Empty;
        public string Cargo { get; set; } = string.Empty;
        public string Peso { get; set; } = string.Empty;
        public string Unidad { get; set; } = string.Empty;
        public string? FotoBase64 { get; set; }
        public int Orden { get; set; } = 1;
        public int Vigente { get; set; } = 1;
    }

    public class DtoLineaMandoRequest
    {
        public string Identificacion { get; set; } = string.Empty;
        public string Nombre { get; set; } = string.Empty;
        public string Apellidos { get; set; } = string.Empty;
        public string Grado { get; set; } = string.Empty;
        public string Cargo { get; set; } = string.Empty;
        public string Peso { get; set; } = string.Empty;
        public string Unidad { get; set; } = string.Empty;
        public string? FotoBase64 { get; set; }
        public int Orden { get; set; } = 1;
    }

    public class DtoLineaMandoResult
    {
        public long Id { get; set; }
        public bool Success { get; set; }
        public string Message { get; set; } = string.Empty;
    }
}

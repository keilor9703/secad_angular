using System.Text.Json.Serialization;

namespace Comun.Dtos.Modal
{
    public class DtoModal
    {
        public long IdModal { get; set; }
        public string Titulo { get; set; } = string.Empty;
        public string Descripcion { get; set; } = string.Empty;
        public string TipoRecurso { get; set; } = string.Empty;
        public string RutaRecurso { get; set; } = string.Empty;
        public string TipoAccion { get; set; } = string.Empty;
        public DateTime FechaInicio { get; set; }
        public DateTime FechaFin { get; set; }
        public string Unidad { get; set; } = string.Empty;
        public int Orden { get; set; }
        public long ConteoVistas { get; set; }
        public long ConteoAceptados { get; set; }
        public long ConteoCerrados { get; set; }
        public int Vigente { get; set; }
        public DateTime FechaCreacion { get; set; }
        public string UsuarioCreacion { get; set; } = string.Empty;
        public string MaquinaCreacion { get; set; } = string.Empty;
        public DateTime? FechaModifica { get; set; }
        public string UsuarioModifica { get; set; } = string.Empty;
        public string MaquinaModifica { get; set; } = string.Empty;
    }

    public class DtoModalActivo
    {
        public long IdModal { get; set; }
        public string Titulo { get; set; } = string.Empty;
        public string Descripcion { get; set; } = string.Empty;
        public string TipoRecurso { get; set; } = string.Empty;
        public string RutaRecurso { get; set; } = string.Empty;
        public string TipoAccion { get; set; } = string.Empty;
        public DateTime FechaInicio { get; set; }
        public DateTime FechaFin { get; set; }
        public string Unidad { get; set; } = string.Empty;
        public int Orden { get; set; }
    }

    public class DtoModalRequest
    {
        [JsonPropertyName("Titulo")]
        public string Titulo { get; set; } = string.Empty;

        [JsonPropertyName("Descripcion")]
        public string Descripcion { get; set; } = string.Empty;

        [JsonPropertyName("TipoRecurso")]
        public string TipoRecurso { get; set; } = string.Empty;

        [JsonPropertyName("RutaRecurso")]
        public string RutaRecurso { get; set; } = string.Empty;

        [JsonPropertyName("TipoAccion")]
        public string TipoAccion { get; set; } = "INFO";

        [JsonPropertyName("FechaInicio")]
        public DateTime FechaInicio { get; set; }

        [JsonPropertyName("FechaFin")]
        public DateTime FechaFin { get; set; }

        [JsonPropertyName("Unidad")]
        public string Unidad { get; set; } = string.Empty;

        [JsonPropertyName("Orden")]
        public int Orden { get; set; } = 1;

        [JsonPropertyName("Vigente")]
        public int Vigente { get; set; } = 1;
    }

    public class DtoModalToggleRequest
    {
        [JsonPropertyName("Vigente")]
        public int Vigente { get; set; }
    }

    public class DtoModalResult
    {
        public long Id { get; set; }
        public bool Success { get; set; }
        public string Message { get; set; } = string.Empty;
    }

    public class DtoModalInteraccion
    {
        public long IdInteraccion { get; set; }
        public long IdModal { get; set; }
        public string TipoAccion { get; set; } = string.Empty;
        public string Usuario { get; set; } = string.Empty;
        public string Maquina { get; set; } = string.Empty;
        public DateTime FechaInteraccion { get; set; }
    }

    public class DtoInteraccionRequest
    {
        [JsonPropertyName("IdModal")]
        public long IdModal { get; set; }

        [JsonPropertyName("TipoAccion")]
        public string TipoAccion { get; set; } = string.Empty;
    }
}

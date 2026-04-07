using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json.Serialization;
using System.Threading.Tasks;

namespace Comun.Dtos.PersonajeMes
{
    public class DtoPersonajeMes
    {
        public long IdPersonajeMes { get; set; }
        public string Identificacion { get; set; } = string.Empty;
        public string Nombres { get; set; } = string.Empty;
        public string Apellidos { get; set; } = string.Empty;
        public string Grado { get; set; } = string.Empty;
        public string Cargo { get; set; } = string.Empty;
        public string Unidad { get; set; } = string.Empty;
        public string? FotoBase64 { get; set; }
        public long IdCategoria { get; set; }
        public string NumeroActa { get; set; } = string.Empty;
        public int Vigente { get; set; } = 1;
    }
    public class DtoPersonajeMesRequest
    {
        [JsonPropertyName("identificacion")]
        public string Identificacion { get; set; } = string.Empty;
        [JsonPropertyName("nombres")]
        public string Nombres { get; set; } = string.Empty;
        [JsonPropertyName("apellidos")]
        public string Apellidos { get; set; } = string.Empty;
        [JsonPropertyName("grado")]
        public string Grado { get; set; } = string.Empty;
        [JsonPropertyName("cargo")]
        public string Cargo { get; set; } = string.Empty;        
        [JsonPropertyName("unidad")]
        public string Unidad { get; set; } = string.Empty;
        [JsonPropertyName("fotoBase64")]
        public string? FotoBase64 { get; set; }
        [JsonPropertyName("IdCategoria")]
        public int IdCategoria { get; set; }
        [JsonPropertyName("NumeroActa")]
        public string NumeroActa { get; set; } = string.Empty;


    }
    public class DtoPersonajeMesResult
    {
        public long Id { get; set; }
        public bool Success { get; set; }
        public string Message { get; set; } = string.Empty;
    }

    public class DtoPersMesVigenteRequest
    {
        [JsonPropertyName("vigente")]
        public int Vigente { get; set; }
    }
}

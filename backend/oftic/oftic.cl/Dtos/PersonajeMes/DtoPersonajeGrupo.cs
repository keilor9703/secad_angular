using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json.Serialization;
using System.Threading.Tasks;

namespace Comun.Dtos.PersonajeMes
{
    public class DtoPersonajeGrupo
    {
        public long IdPersonajeGrupo { get; set; }
        public string NombreGrupo { get; set; } = string.Empty;
        public string? FotoGrupo { get; set; }
        public string NumeroActa { get; set; } = string.Empty;
        public int Mes { get; set; }
        public int Anio { get; set; }
        public int Vigente { get; set; } = 1;
              
    }
    public class DtoPersonajeGrupoRequest
    {
        
        [JsonPropertyName("NombreGrupo")]
        public string NombreGrupo { get; set; } = string.Empty;

        [JsonPropertyName("FotoGrupo")]
        public string? FotoGrupo { get; set; }

        [JsonPropertyName("NumeroActa")]
        public string NumeroActa { get; set; } = string.Empty;

        [JsonPropertyName("Mes")]
        public int Mes { get; set; }
        [JsonPropertyName("Anio")]
        public int Anio { get; set; }

    }
    public class DtoPersonajeGrupoResult
    {
        public long Id { get; set; }
        public bool Success { get; set; }
        public string Message { get; set; } = string.Empty;
    }

    public class DtoPersGrupoVigenteRequest
    {
        [JsonPropertyName("vigente")]
        public int Vigente { get; set; }
    }
}

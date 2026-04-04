using System.Text.Json.Serialization;

namespace Comun.Dtos.Videos;

public class DtoVideoInstitucional
{
    [JsonPropertyName("idVideoInst")]
    public long IdVideoInst { get; set; }

    [JsonPropertyName("titulo")]
    public string Titulo { get; set; } = string.Empty;

    [JsonPropertyName("descripcion")]
    public string? Descripcion { get; set; }

    [JsonPropertyName("urlYoutube")]
    public string UrlYoutube { get; set; } = string.Empty;

    [JsonPropertyName("embedUrl")]
    public string EmbedUrl { get; set; } = string.Empty;

    [JsonPropertyName("vigente")]
    public int Vigente { get; set; }

    [JsonPropertyName("usuarioCreacion")]
    public string UsuarioCreacion { get; set; } = string.Empty;

    [JsonPropertyName("fechaCreacion")]
    public DateTime FechaCreacion { get; set; }

    [JsonPropertyName("usuarioModifica")]
    public string? UsuarioModifica { get; set; }

    [JsonPropertyName("maquinaModifica")]
    public string? MaquinaModifica { get; set; }

    [JsonPropertyName("fechaModifica")]
    public DateTime? FechaModifica { get; set; }
}

public class DtoVideoInstitucionalRequest
{
    [JsonPropertyName("titulo")]
    public string Titulo { get; set; } = string.Empty;

    [JsonPropertyName("descripcion")]
    public string? Descripcion { get; set; }

    [JsonPropertyName("urlYoutube")]
    public string UrlYoutube { get; set; } = string.Empty;
}

public class DtoVideoInstitucionalResult
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public long Id { get; set; }
}

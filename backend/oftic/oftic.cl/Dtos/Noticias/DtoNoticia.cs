using System.Text.Json.Serialization;

namespace Comun.Dtos.Noticias;

public class DtoNoticia
{
    [JsonPropertyName("idNoticia")]
    public long IdNoticia { get; set; }

    [JsonPropertyName("unidad")]
    public string Unidad { get; set; } = string.Empty;

    [JsonPropertyName("titulo")]
    public string Titulo { get; set; } = string.Empty;

    [JsonPropertyName("seccion")]
    public string Seccion { get; set; } = string.Empty;

    [JsonPropertyName("ciudad")]
    public string Ciudad { get; set; } = string.Empty;

    [JsonPropertyName("imagenNoticia")]
    public string? ImagenNoticia { get; set; }

    [JsonPropertyName("subtitulo")]
    public string? Subtitulo { get; set; }

    [JsonPropertyName("contenido")]
    public string? Contenido { get; set; }

    [JsonPropertyName("vigente")]
    public int Vigente { get; set; }

    [JsonPropertyName("fechaCreacion")]
    public DateTime FechaCreacion { get; set; }

    [JsonPropertyName("usuarioCreacion")]
    public string UsuarioCreacion { get; set; } = string.Empty;

    [JsonPropertyName("maquinaCreacion")]
    public string? MaquinaCreacion { get; set; }

    [JsonPropertyName("fechaModifica")]
    public DateTime? FechaModifica { get; set; }

    [JsonPropertyName("usuarioModifica")]
    public string? UsuarioModifica { get; set; }

    [JsonPropertyName("maquinaModifica")]
    public string? MaquinaModifica { get; set; }
}

public class DtoNoticiaRequest
{
    [JsonPropertyName("unidad")]
    public string Unidad { get; set; } = string.Empty;

    [JsonPropertyName("titulo")]
    public string Titulo { get; set; } = string.Empty;

    [JsonPropertyName("seccion")]
    public string Seccion { get; set; } = string.Empty;

    [JsonPropertyName("ciudad")]
    public string Ciudad { get; set; } = string.Empty;

    [JsonPropertyName("imagenNoticia")]
    public string? ImagenNoticia { get; set; }

    [JsonPropertyName("subtitulo")]
    public string? Subtitulo { get; set; }

    [JsonPropertyName("contenido")]
    public string? Contenido { get; set; }
}

public class DtoNoticiaResult
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public long Id { get; set; }
}
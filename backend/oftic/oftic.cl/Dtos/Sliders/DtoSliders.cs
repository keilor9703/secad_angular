using System;

namespace Comun.Dtos.Sliders
{
    public class DtoSliders
    {
        public long idSlider { get; set; }
        public string? titulo { get; set; }
        public string? subtitulo { get; set; }
        public string? urlImagen { get; set; }
        public string? urlDestino { get; set; }
        public int orden { get; set; }
        public int vigente { get; set; }
        public DateTime? fechaInicio { get; set; }
        public DateTime? fechaFin { get; set; }
    }

    public class DtoSaveSliderRequest
    {
        public long? idSlider { get; set; }
        public string? titulo { get; set; }
        public string? subtitulo { get; set; }
        public string? urlImagen { get; set; }
        public string? urlDestino { get; set; }
        public int orden { get; set; }
        public int vigente { get; set; } = 1;
        public DateTime? fechaInicio { get; set; }
        public DateTime? fechaFin { get; set; }
    }

    public class DtoSetEstadoSliderRequest
    {
        public long idSlider { get; set; }
        public int vigente { get; set; }
    }

    public class DtoSliderResult
    {
        public long id { get; set; }
        public string message { get; set; } = string.Empty;
    }
}

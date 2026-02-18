using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Comun.Dtos.Menu
{
    public class DtoMenuItem
    {
        public long IdMenu { get; set; }
        public string Descripcion { get; set; } = "";
        public long IdPadre { get; set; }
        public int Posicion { get; set; }
        public string Tipo { get; set; } = "";
        public string? Icono { get; set; }
        public int Vigente { get; set; }
        public string? Detalle { get; set; }


    }
}

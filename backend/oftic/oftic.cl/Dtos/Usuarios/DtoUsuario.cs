using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Comun.Dtos
{
    public class DtoFuncionario
    {
        public string? identificacion { get; set; }
        public string? nombres { get; set; }
        public string? apellidos { get; set; }
        public string? situacionLaboral { get; set; }
        public string? correo { get; set; }
        public string? usuario { get; set; }
        public string? celular { get; set; }
        public string? dependencia { get; set; }
        public string? cargo { get; set; }
        public bool activo { get; set; } = true;
    }

    public class DtoRol
    {
        public int id { get; set; }
        public string? nombre { get; set; }
    }

    public class DtoRolAsignado
    {
        public int id { get; set; }
        public string? rol { get; set; }
        public string? fechaInicio { get; set; }
        public string? fechaFin { get; set; }
        public string? estado { get; set; }
    }

    public class DtoTokenRequest
    {
        public string? Usuario { get; set; }
        public string? Contrasena { get; set; }
    }

    public class DtoTokenResponse
    {
        public string? token { get; set; }
        public string? usuario { get; set; }
        public bool success { get; set; }
        public string? message { get; set; }
    }

    public class DtoUsuarioRequest
    {
        public string? identificacion { get; set; }
        public string? nombres { get; set; }
        public string? apellidos { get; set; }
        public string? situacionLaboral { get; set; }
        public string? correo { get; set; }
        public string? usuario { get; set; }
        public string? celular { get; set; }
        public string? dependencia { get; set; }
        public string? cargo { get; set; }
        public bool activo { get; set; }
    }

    public class DtoAsignarRolRequest
    {
        public int usuarioId { get; set; }
        public int rolId { get; set; }
        public string? justificacion { get; set; }
        public string? fechaFin { get; set; }
    }
}

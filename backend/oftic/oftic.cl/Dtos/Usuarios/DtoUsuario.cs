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
        public string? siglaFisica { get; set; }
        public string? siglaLaborando { get; set; }
        public string? nombreGrado { get; set; }
        public string? cargo { get; set; }
        public string? tiempoServicio { get; set; }
        public string? gradAlfabetico { get; set; }
        public string? funcionarioCodigo { get; set; }
        public string? undeLaborandoCodigo { get; set; }
        public string? codigoCargo { get; set; }
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
        public string? justificacion { get; set; }
    }

    public class DtoUsuarioListadoItem
    {
        public long idUsuario { get; set; }
        public string identificacion { get; set; } = string.Empty;
        public string username { get; set; } = string.Empty;
        public string nombreCompleto { get; set; } = string.Empty;
        public string rol { get; set; } = string.Empty;
        public string? fechaFinRol { get; set; }
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
        public string? username { get; set; }
        public string? identificacion { get; set; }
        public string? nombres { get; set; }
        public string? apellidos { get; set; }
        public string? email { get; set; }
        public string? gradAlfabetico { get; set; }
        public string? funcionario { get; set; }
        public string? undeLaborando { get; set; }
        public string? codigoCargo { get; set; }
        public bool activo { get; set; }
    }

    public class DtoGuardarUsuarioResult
    {
        public long idUsuario { get; set; }
        public string message { get; set; } = string.Empty;
    }

    public class DtoAsignarRolRequest
    {
        public int usuarioId { get; set; }
        public string? usuario { get; set; }
        public string? identificacion { get; set; }
        public int rolId { get; set; }
        public string? justificacion { get; set; }
        public string? fechaFin { get; set; }
        public int vigente { get; set; } = 1;
    }

    public class DtoRolAdmin
    {
        public int id { get; set; }
        public string? nombre { get; set; }
        public int vigente { get; set; }
    }

    public class DtoSaveRolRequest
    {
        public int? id { get; set; }
        public string? nombre { get; set; }
        public int vigente { get; set; } = 1;
    }

    public class DtoSetRolEstadoRequest
    {
        public int vigente { get; set; }
    }

    public class DtoSaveRolResult
    {
        public long idRol { get; set; }
        public string message { get; set; } = string.Empty;
    }
}

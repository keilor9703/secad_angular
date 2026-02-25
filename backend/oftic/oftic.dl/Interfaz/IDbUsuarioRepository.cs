using Comun.Dtos;

namespace Datos.Interfaz
{
    public interface IDbUsuarioRepository
    {
        Task<long?> GetUsuarioIdByUsernameAsync(string username, CancellationToken ct);
        Task<long?> GetUsuarioIdByIdentificacionAsync(string identificacion, CancellationToken ct);
        Task<string?> GetIdentificacionByUsernameAsync(string username, CancellationToken ct);
        Task<bool?> GetActivoByIdentificacionOrUsernameAsync(string? identificacion, string? username, CancellationToken ct);
        Task<long> EnsureUsuarioExistsAsync(DtoFuncionario funcionario, CancellationToken ct);
        Task<List<DtoRolAsignado>> GetRolesAsignadosAsync(string username, CancellationToken ct);
        Task<List<DtoRol>> GetRolesAsync(CancellationToken ct);
        Task<DtoGuardarUsuarioResult> SaveUsuarioAsync(
            DtoUsuarioRequest request,
            string usuarioAuditoria,
            string maquinaAuditoria,
            CancellationToken ct);
        Task<DtoGuardarUsuarioResult> AsignarRolAsync(
            long idUsuario,
            DtoAsignarRolRequest request,
            string usuarioAuditoria,
            string maquinaAuditoria,
            CancellationToken ct);
    }
}

using Comun.Dtos.Tenant;

namespace Datos.Interfaz
{
    public interface IDbMasterRepository
    {
        Task<DtoTenant?> GetTenantByCodDaneAsync(string codDane, CancellationToken ct);
        Task<DtoTenant?> GetTenantByCodUnidadAsync(string codUnidad, CancellationToken ct);
        Task<(string? codDane, string? passwordHash)> GetFallbackUserAsync(string username, CancellationToken ct);
        Task AuditFallbackLoginAsync(string username, string codDane, string? ipOrigen, bool modoFallback, CancellationToken ct);
    }
}

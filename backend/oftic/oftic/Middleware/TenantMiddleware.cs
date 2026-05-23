using Datos.Interfaz;
using Datos.Tenant;
using System.Security.Claims;

namespace Api.Middleware
{
    public class TenantMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<TenantMiddleware> _logger;

        public TenantMiddleware(RequestDelegate next, ILogger<TenantMiddleware> logger)
        {
            _next = next;
            _logger = logger;
        }

        public async Task InvokeAsync(
            HttpContext context,
            TenantContext tenantContext,
            ConnectionPoolManager poolManager,
            IDbMasterRepository masterRepo)
        {
            if (context.User.Identity?.IsAuthenticated == true)
            {
                var codDane = context.User.FindFirstValue("cod_dane");
                var nombreCad = context.User.FindFirstValue("nombre_cad");

                if (!string.IsNullOrWhiteSpace(codDane))
                {
                    if (!poolManager.TryGet(codDane, out var dataSource) || dataSource is null)
                    {
                        var tenant = await masterRepo.GetTenantByCodDaneAsync(codDane, context.RequestAborted);
                        if (tenant is null)
                        {
                            _logger.LogWarning("TenantMiddleware: tenant no encontrado para cod_dane={CodDane}", codDane);
                            context.Response.StatusCode = StatusCodes.Status403Forbidden;
                            await context.Response.WriteAsJsonAsync(new { message = "Tenant no autorizado." });
                            return;
                        }
                        dataSource = poolManager.GetOrCreate(tenant);
                    }

                    tenantContext.Set(dataSource, codDane, nombreCad);
                }
            }

            await _next(context);
        }
    }
}

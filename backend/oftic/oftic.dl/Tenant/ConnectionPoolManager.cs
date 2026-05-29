using Comun.Dtos.Tenant;
using Npgsql;
using System.Collections.Concurrent;

namespace Datos.Tenant
{
    /// <summary>
    /// Singleton: keeps one NpgsqlDataSource (connection pool) per CAD tenant.
    /// The master DB is queried only on the first access for each cod_dane.
    /// </summary>
    public class ConnectionPoolManager
    {
        private readonly ConcurrentDictionary<string, NpgsqlDataSource> _pools = new(StringComparer.OrdinalIgnoreCase);

        public NpgsqlDataSource GetOrCreate(DtoTenant tenant)
        {
            return _pools.GetOrAdd(tenant.CodDane, _ => BuildDataSource(tenant));
        }

        public bool TryGet(string codDane, out NpgsqlDataSource? dataSource)
        {
            return _pools.TryGetValue(codDane, out dataSource);
        }

        /// <summary>
        /// Removes a cached DataSource for the given tenant, forcing reconnection on next request.
        /// Call this after updating tenant credentials.
        /// </summary>
        public void Invalidate(string codDane)
        {
            if (_pools.TryRemove(codDane, out var ds))
            {
                try { ds.Dispose(); } catch { /* best-effort */ }
            }
        }

        private static NpgsqlDataSource BuildDataSource(DtoTenant tenant)
        {
            var builder = new NpgsqlConnectionStringBuilder
            {
                Host = tenant.DbHost,
                Port = tenant.DbPort,
                Database = tenant.DbName,
                Username = tenant.DbUsername,
                Password = tenant.DbPassword,
                Pooling = true,
                MinPoolSize = 2,
                MaxPoolSize = 20,
                ConnectionIdleLifetime = 300,
                Timeout = 30
            };

            return NpgsqlDataSource.Create(builder.ConnectionString);
        }
    }
}

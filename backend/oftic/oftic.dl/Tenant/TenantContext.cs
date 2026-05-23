using Npgsql;

namespace Datos.Tenant
{
    public class TenantContext
    {
        private NpgsqlDataSource? _dataSource;

        public string? CodDane { get; private set; }
        public string? NombreCad { get; private set; }

        public NpgsqlDataSource DataSource =>
            _dataSource ?? throw new InvalidOperationException(
                "TenantContext no ha sido inicializado. Asegúrese de que TenantMiddleware esté configurado o que el tenant sea resuelto antes de usar este contexto.");

        public void Set(NpgsqlDataSource dataSource, string codDane, string? nombreCad = null)
        {
            _dataSource = dataSource;
            CodDane = codDane;
            NombreCad = nombreCad;
        }

        public bool IsInitialized => _dataSource is not null;
    }
}

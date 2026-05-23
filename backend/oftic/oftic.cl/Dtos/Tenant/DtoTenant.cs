namespace Comun.Dtos.Tenant
{
    public class DtoTenant
    {
        public int Id { get; set; }
        public string CodDane { get; set; } = string.Empty;
        public string? CodUnidad { get; set; }
        public string Nombre { get; set; } = string.Empty;
        public string? Departamento { get; set; }
        public string? Municipio { get; set; }
        public string DbHost { get; set; } = string.Empty;
        public int DbPort { get; set; } = 5432;
        public string DbName { get; set; } = string.Empty;
        public string DbUsername { get; set; } = string.Empty;
        public string DbPassword { get; set; } = string.Empty;
    }
}

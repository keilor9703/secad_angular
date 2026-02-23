using System.Threading;
using System.Threading.Tasks;

namespace Servicios.ApiInterfaz
{
    public interface IApiWebOud
    {
        Task<bool> ValidarCredencialesAsync(string usuario, string contrasena, CancellationToken ct);
    }
}

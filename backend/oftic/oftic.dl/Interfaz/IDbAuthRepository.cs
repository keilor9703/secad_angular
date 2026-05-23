using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Datos.Interfaz
{
    public interface IDbAuthRepository
    {
        Task<(long? idUsuario, List<long> roles, int sitioGraba, int acd, int fuerzaId)> GetUsuarioYRolesAsync(string usuario, CancellationToken ct);
    }
}

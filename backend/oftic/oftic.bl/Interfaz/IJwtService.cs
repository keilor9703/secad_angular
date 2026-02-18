using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Negocio.Interfaz
{
    public interface IJwtService
    {
        string CreateToken(long idUsuario, string usuario, List<long> roles);
        string GenerateToken(string usuario);
    }
}

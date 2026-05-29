using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Negocio.Interfaz
{
    public interface IJwtService
    {
        /// <summary>
        /// Issues a JWT for the given user.
        /// </summary>
        /// <param name="homeCodDane">
        /// The user's original/home tenant cod_dane. Only set when issuing a context-switch token for a
        /// SuperAdmin — allows them to return to their original tenant later. Leave null on normal login.
        /// </param>
        string CreateToken(long idUsuario, string usuario, List<long> roles, string codDane, string? nombreCad,
                           int sitioGraba = 0, int acd = 0, int fuerzaId = 0, int canalId = 0,
                           string? homeCodDane = null);
        string GenerateToken(string usuario);
    }
}

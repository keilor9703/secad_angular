using Comun.Dtos.Menu;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Negocio.Interfaz
{
    public interface IDbMenuService
    {
        Task<List<DtoMenuItem>> GetMyMenuAsync(long idUsuario, CancellationToken ct);
    }
}

using Comun.Dtos.Menu;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Datos.Interfaz
{
    public interface IDbMenuRepository
    {
        Task<List<DtoMenuItem>> GetMyMenuAsync(long idUsuario, CancellationToken ct);
    }
}
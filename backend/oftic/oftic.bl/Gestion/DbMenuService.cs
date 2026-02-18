using Comun.Dtos.Menu;
using Negocio.Interfaz;
using Datos.Interfaz;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Negocio.Gestion
{
    public class DbMenuService : IDbMenuService
    {
        private readonly IDbMenuRepository _repo;

        public DbMenuService(IDbMenuRepository repo)
        {
            _repo = repo;
        }
        public Task<List<DtoMenuItem>> GetMyMenuAsync(long idUsuario, CancellationToken ct)
        => _repo.GetMyMenuAsync(idUsuario, ct);
    }
}
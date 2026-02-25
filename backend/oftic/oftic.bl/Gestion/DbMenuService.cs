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

        public Task<List<DtoMenuItem>> GetAdminMenuAsync(CancellationToken ct)
        => _repo.GetAdminMenuAsync(ct);

        public Task<DtoMenuResult> SaveMenuAsync(DtoMenuSaveRequest request, long usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        => _repo.SaveMenuAsync(request, usuarioAuditoria, maquinaAuditoria, ct);

        public Task<DtoMenuResult> SetEstadoMenuAsync(long idMenu, int vigente, long usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        => _repo.SetEstadoMenuAsync(idMenu, vigente, usuarioAuditoria, maquinaAuditoria, ct);
    }
}

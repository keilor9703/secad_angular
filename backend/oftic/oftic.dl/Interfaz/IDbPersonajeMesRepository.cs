using Comun.Dtos.LineasMando;
using Comun.Dtos.PersonajeMes;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Datos.Interfaz
{
public interface IDbPersonajeMesRepository
    {
        Task<List<DtoPersonajeMes>> GetAllAsync(CancellationToken ct);
        Task<DtoPersonajeMesResult> CreateAsync(DtoPersonajeMesRequest request, long usuarioAuditoria, string maquinaAuditoria, CancellationToken ct);
        Task<DtoPersonajeMesResult> UpdateAsync(long id, DtoPersonajeMesRequest request, long usuarioAuditoria, string maquinaAuditoria, CancellationToken ct);
        Task<DtoPersonajeMesResult> DeleteAsync(long id, long usuarioAuditoria, string maquinaAuditoria, CancellationToken ct);
        Task<DtoPersonajeMesResult> SetVigenteAsync(long id, int vigente, long usuarioAuditoria, string maquinaAuditoria, CancellationToken ct);
        Task<List<DtoPersonajeGrupo>> GetAllAsyncGrupo(CancellationToken ct);
        Task<DtoPersonajeGrupoResult> CreateAsyncGrupo(DtoPersonajeGrupoRequest request, long usuarioAuditoria, string maquinaAuditoria, CancellationToken ct);
        Task<DtoPersonajeGrupoResult> UpdateAsyncGrupo(long id, DtoPersonajeGrupoRequest request, long usuarioAuditoria, string maquinaAuditoria, CancellationToken ct);
        Task<DtoPersonajeGrupoResult> DeleteAsyncGrupo(long id, long usuarioAuditoria, string maquinaAuditoria, CancellationToken ct);
        Task<DtoPersonajeGrupoResult> SetVigenteAsyncGrupo(long id, int vigente, long usuarioAuditoria, string maquinaAuditoria, CancellationToken ct);
        Task<DtoPersonajeMesBulkResult> CreateBulkAsync(List<DtoPersonajeMesRequest> items, long usuarioAuditoria, string maquinaAuditoria, CancellationToken ct);
    }
}

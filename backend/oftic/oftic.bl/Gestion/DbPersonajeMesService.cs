using Comun.Dtos.PersonajeMes;
using Datos.Interfaz;
using Negocio.Interfaz;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Negocio.Gestion
{
    public class DbPersonajeMesService : IDbPersonajeMesService
    {
        private readonly IDbPersonajeMesRepository _repository;

        public DbPersonajeMesService(IDbPersonajeMesRepository repository)
        {
            _repository = repository;
        }

        public async Task<List<DtoPersonajeMes>> GetAllAsync(CancellationToken ct)
        {
            return await _repository.GetAllAsync(ct);
        }

        public async Task<DtoPersonajeMesResult> CreateAsync(DtoPersonajeMesRequest request, long usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        {
            if (request == null)
            {
                return new DtoPersonajeMesResult
                {
                    Success = false,
                    Message = "Los datos son requeridos"
                };
            }

            if (string.IsNullOrWhiteSpace(request.Identificacion))
            {
                return new DtoPersonajeMesResult
                {
                    Success = false,
                    Message = "La identificación es requerida"
                };
            }

            if (string.IsNullOrWhiteSpace(request.Nombres))
            {
                return new DtoPersonajeMesResult
                {
                    Success = false,
                    Message = "El nombre es requerido"
                };
            }

           

            return await _repository.CreateAsync(request, usuarioAuditoria, maquinaAuditoria, ct);
        }

        public async Task<DtoPersonajeMesResult> UpdateAsync(long id, DtoPersonajeMesRequest request, long usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        {
            if (id <= 0)
            {
                return new DtoPersonajeMesResult
                {
                    Success = false,
                    Message = "ID inválido"
                };
            }

            if (request == null)
            {
                return new DtoPersonajeMesResult
                {
                    Success = false,
                    Message = "Los datos son requeridos"
                };
            }

            if (string.IsNullOrWhiteSpace(request.Identificacion))
            {
                return new DtoPersonajeMesResult
                {
                    Success = false,
                    Message = "La identificación es requerida"
                };
            }

           

            return await _repository.UpdateAsync(id, request, usuarioAuditoria, maquinaAuditoria, ct);
        }
        

        public async Task<DtoPersonajeMesResult> DeleteAsync(long id, long usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        {
            if (id <= 0)
            {
                return new DtoPersonajeMesResult
                {
                    Success = false,
                    Message = "ID inválido"
                };
            }

            return await _repository.DeleteAsync(id, usuarioAuditoria, maquinaAuditoria, ct);
        }

        public async Task<DtoPersonajeMesResult> SetVigenteAsync(long id, int vigente, long usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        {
            if (id <= 0)
            {
                return new DtoPersonajeMesResult
                {
                    Success = false,
                    Message = "ID inválido"
                };
            }

            if (vigente == 0)
            {
                return await _repository.DeleteAsync(id, usuarioAuditoria, maquinaAuditoria, ct);
            }

return await _repository.SetVigenteAsync(id, vigente, usuarioAuditoria, maquinaAuditoria, ct);
        }


        public async Task<List<DtoPersonajeGrupo>> GetAllAsyncGrupo(CancellationToken ct)
        {
            return await _repository.GetAllAsyncGrupo(ct);
        }

        public async Task<DtoPersonajeGrupoResult> CreateAsyncGrupo(DtoPersonajeGrupoRequest request, long usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        {
            if (request == null)
            {
                return new DtoPersonajeGrupoResult
                {
                    Success = false,
                    Message = "Los datos son requeridos"
                };
            }

            



            return await _repository.CreateAsyncGrupo(request, usuarioAuditoria, maquinaAuditoria, ct);
        }

        public async Task<DtoPersonajeGrupoResult> UpdateAsyncGrupo(long id, DtoPersonajeGrupoRequest request, long usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        {
            if (id <= 0)
            {
                return new DtoPersonajeGrupoResult
                {
                    Success = false,
                    Message = "ID inválido"
                };
            }

            



            return await _repository.UpdateAsyncGrupo(id, request, usuarioAuditoria, maquinaAuditoria, ct);
        }


        public async Task<DtoPersonajeGrupoResult> DeleteAsyncGrupo(long id, long usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        {
            if (id <= 0)
            {
                return new DtoPersonajeGrupoResult
                {
                    Success = false,
                    Message = "ID inválido"
                };
            }

            return await _repository.DeleteAsyncGrupo(id, usuarioAuditoria, maquinaAuditoria, ct);
        }

        public async Task<DtoPersonajeGrupoResult> SetVigenteAsyncGrupo(long id, int vigente, long usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        {
            if (id <= 0)
            {
                return new DtoPersonajeGrupoResult
                {
                    Success = false,
                    Message = "ID inválido"
                };
            }

            if (vigente == 0)
            {
                return await _repository.DeleteAsyncGrupo(id, usuarioAuditoria, maquinaAuditoria, ct);
            }

            return await _repository.SetVigenteAsyncGrupo(id, vigente, usuarioAuditoria, maquinaAuditoria, ct);
        }

        public async Task<DtoPersonajeMesBulkResult> CreateBulkAsync(List<DtoPersonajeMesRequest> items, long usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        {
            if (items == null || items.Count == 0)
            {
                return new DtoPersonajeMesBulkResult
                {
                    Success = false,
                    Message = "No hay elementos para procesar"
                };
            }

            return await _repository.CreateBulkAsync(items, usuarioAuditoria, maquinaAuditoria, ct);
        }
    }
}

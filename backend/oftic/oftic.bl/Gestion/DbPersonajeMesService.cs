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
    }
}

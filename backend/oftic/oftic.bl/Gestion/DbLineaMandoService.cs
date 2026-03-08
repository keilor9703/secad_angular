using Comun.Dtos.LineasMando;
using Datos.Interfaz;
using Negocio.Interfaz;
using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace Negocio.Gestion
{
    public class DbLineaMandoService : IDbLineaMandoService
    {
        private readonly IDbLineaMandoRepository _repository;

        public DbLineaMandoService(IDbLineaMandoRepository repository)
        {
            _repository = repository;
        }

        public async Task<List<DtoLineaMando>> GetAllAsync(CancellationToken ct)
        {
            return await _repository.GetAllAsync(ct);
        }

        public async Task<DtoLineaMando?> GetByIdAsync(long id, CancellationToken ct)
        {
            if (id <= 0)
            {
                return null;
            }

            return await _repository.GetByIdAsync(id, ct);
        }

        public async Task<DtoLineaMando?> GetByIdentificacionAsync(string identificacion, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(identificacion))
            {
                return null;
            }

            return await _repository.GetByIdentificacionAsync(identificacion.Trim(), ct);
        }

        public async Task<DtoLineaMandoResult> CreateAsync(DtoLineaMandoRequest request, long usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        {
            if (request == null)
            {
                return new DtoLineaMandoResult
                {
                    Success = false,
                    Message = "Los datos son requeridos"
                };
            }

            if (string.IsNullOrWhiteSpace(request.Identificacion))
            {
                return new DtoLineaMandoResult
                {
                    Success = false,
                    Message = "La identificación es requerida"
                };
            }

            if (string.IsNullOrWhiteSpace(request.Nombre))
            {
                return new DtoLineaMandoResult
                {
                    Success = false,
                    Message = "El nombre es requerido"
                };
            }

            return await _repository.CreateAsync(request, usuarioAuditoria, maquinaAuditoria, ct);
        }

        public async Task<DtoLineaMandoResult> UpdateAsync(long id, DtoLineaMandoRequest request, long usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        {
            if (id <= 0)
            {
                return new DtoLineaMandoResult
                {
                    Success = false,
                    Message = "ID inválido"
                };
            }

            if (request == null)
            {
                return new DtoLineaMandoResult
                {
                    Success = false,
                    Message = "Los datos son requeridos"
                };
            }

            if (string.IsNullOrWhiteSpace(request.Identificacion))
            {
                return new DtoLineaMandoResult
                {
                    Success = false,
                    Message = "La identificación es requerida"
                };
            }

            return await _repository.UpdateAsync(id, request, usuarioAuditoria, maquinaAuditoria, ct);
        }

        public async Task<DtoLineaMandoResult> DeleteAsync(long id, long usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        {
            if (id <= 0)
            {
                return new DtoLineaMandoResult
                {
                    Success = false,
                    Message = "ID inválido"
                };
            }

            return await _repository.DeleteAsync(id, usuarioAuditoria, maquinaAuditoria, ct);
        }
    }
}

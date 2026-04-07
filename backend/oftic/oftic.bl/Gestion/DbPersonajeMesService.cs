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

            if (!string.IsNullOrEmpty(request.FotoBase64) && !EsBase64Valido(request.FotoBase64))
            {
                return new DtoPersonajeMesResult
                {
                    Success = false,
                    Message = "El formato de la imagen es inválido"
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

            if (!string.IsNullOrEmpty(request.FotoBase64) && !EsBase64Valido(request.FotoBase64))
            {
                return new DtoPersonajeMesResult
                {
                    Success = false,
                    Message = "El formato de la imagen es inválido"
                };
            }

            return await _repository.UpdateAsync(id, request, usuarioAuditoria, maquinaAuditoria, ct);
        }

        private static bool EsBase64Valido(string base64)
        {
            if (string.IsNullOrWhiteSpace(base64))
                return true;

            var cleanBase64 = base64.Trim();

            if (!cleanBase64.StartsWith("data:image/"))
                return false;

            var commaIndex = cleanBase64.IndexOf(',');
            if (commaIndex < 0 || commaIndex >= cleanBase64.Length - 1)
                return false;

            var dataPart = cleanBase64.Substring(commaIndex + 1);

            try
            {
                Convert.FromBase64String(dataPart);
                return true;
            }
            catch
            {
                return false;
            }
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

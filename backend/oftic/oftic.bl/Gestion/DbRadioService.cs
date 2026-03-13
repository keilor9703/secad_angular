using Comun.Dtos.Radio;
using Datos.Interfaz;
using Negocio.Interfaz;

namespace Negocio.Gestion
{
    public class DbRadioService : IDbRadioService
    {
        private readonly IDbRadioRepository _repository;

        public DbRadioService(IDbRadioRepository repository)
        {
            _repository = repository;
        }

        public Task<List<DtoRadioEmisora>> GetPublicasAsync(CancellationToken ct)
            => _repository.GetAllAsync(1, ct);

        public Task<List<DtoRadioEmisora>> GetAdminAsync(CancellationToken ct)
            => _repository.GetAllAsync(null, ct);

        public async Task<DtoRadioEmisora?> GetByIdAsync(long idEmisora, CancellationToken ct)
        {
            if (idEmisora <= 0)
            {
                return null;
            }

            return await _repository.GetByIdAsync(idEmisora, ct);
        }

        public async Task<DtoRadioResult> CreateAsync(DtoRadioEmisoraRequest request, string usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        {
            var validation = Validate(request, isUpdate: false);
            if (!validation.success)
            {
                return validation;
            }

            return await _repository.CreateAsync(request, usuarioAuditoria, maquinaAuditoria, ct);
        }

        public async Task<DtoRadioResult> UpdateAsync(long idEmisora, DtoRadioEmisoraRequest request, string usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        {
            if (idEmisora <= 0)
            {
                return new DtoRadioResult { success = false, message = "ID inválido." };
            }

            var validation = Validate(request, isUpdate: true);
            if (!validation.success)
            {
                return validation;
            }

            return await _repository.UpdateAsync(idEmisora, request, usuarioAuditoria, maquinaAuditoria, ct);
        }

        public async Task<DtoRadioResult> DeleteAsync(long idEmisora, string usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        {
            if (idEmisora <= 0)
            {
                return new DtoRadioResult { success = false, message = "ID inválido." };
            }

            return await _repository.DeleteAsync(idEmisora, usuarioAuditoria, maquinaAuditoria, ct);
        }

        public async Task<DtoRadioResult> SetActivoAsync(long idEmisora, int activo, string usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        {
            if (idEmisora <= 0)
            {
                return new DtoRadioResult { success = false, message = "ID inválido." };
            }

            if (activo is not 0 and not 1)
            {
                return new DtoRadioResult { success = false, message = "Activo debe ser 0 o 1." };
            }

            return await _repository.SetActivoAsync(idEmisora, activo, usuarioAuditoria, maquinaAuditoria, ct);
        }

        private static DtoRadioResult Validate(DtoRadioEmisoraRequest request, bool isUpdate)
        {
            if (request is null)
            {
                return new DtoRadioResult { success = false, message = "Payload requerido." };
            }

            if (string.IsNullOrWhiteSpace(request.nombre))
            {
                return new DtoRadioResult { success = false, message = "El nombre es requerido." };
            }

            if (string.IsNullOrWhiteSpace(request.streamUrl))
            {
                return new DtoRadioResult { success = false, message = "La URL del stream es requerida." };
            }

            if (request.orden < 0)
            {
                return new DtoRadioResult { success = false, message = "El orden no puede ser negativo." };
            }

            if (isUpdate && request.activo.HasValue && request.activo.Value is not 0 and not 1)
            {
                return new DtoRadioResult { success = false, message = "Activo debe ser 0 o 1." };
            }

            return new DtoRadioResult { success = true, message = "OK" };
        }
    }
}


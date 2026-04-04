using Comun.Dtos.Videos;
using Datos.Gestion;
using Datos.Interfaz;
using Negocio.Interfaz;

namespace Negocio.Gestion
{
    public class DbVideoInstitucionalService : IDbVideoInstitucionalService
    {
        private readonly IDbVideoInstitucionalRepository _repository;

        public DbVideoInstitucionalService(IDbVideoInstitucionalRepository repository)
        {
            _repository = repository;
        }

        public Task<DtoVideoInstitucional?> GetActiveAsync(CancellationToken ct)
            => _repository.GetActiveAsync(ct);

        public async Task<DtoVideoInstitucionalResult> CreateAsync(DtoVideoInstitucionalRequest request, string usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        {
            var validation = Validate(request);
            if (!validation.Success) return validation;

            return await _repository.CreateAsync(request, usuarioAuditoria, maquinaAuditoria, ct);
        }

        public async Task<DtoVideoInstitucionalResult> UpdateAsync(long id, DtoVideoInstitucionalRequest request, string usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        {
            if (id <= 0)
                return new DtoVideoInstitucionalResult { Success = false, Message = "ID inválido." };

            var validation = Validate(request);
            if (!validation.Success) return validation;

            return await _repository.UpdateAsync(id, request, usuarioAuditoria, maquinaAuditoria, ct);
        }

        public async Task<DtoVideoInstitucionalResult> DeleteAsync(long id, string usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        {
            if (id <= 0)
                return new DtoVideoInstitucionalResult { Success = false, Message = "ID inválido." };

            return await _repository.DeleteAsync(id, usuarioAuditoria, maquinaAuditoria, ct);
        }

        private static DtoVideoInstitucionalResult Validate(DtoVideoInstitucionalRequest request)
        {
            if (request is null)
                return new DtoVideoInstitucionalResult { Success = false, Message = "Payload requerido." };

            if (string.IsNullOrWhiteSpace(request.Titulo))
                return new DtoVideoInstitucionalResult { Success = false, Message = "El título es requerido." };

            if (request.Titulo.Length > 150)
                return new DtoVideoInstitucionalResult { Success = false, Message = "El título no puede superar 150 caracteres." };

            if (string.IsNullOrWhiteSpace(request.UrlYoutube))
                return new DtoVideoInstitucionalResult { Success = false, Message = "La URL de YouTube es requerida." };

            if (request.UrlYoutube.Length > 500)
                return new DtoVideoInstitucionalResult { Success = false, Message = "La URL no puede superar 500 caracteres." };

            if (string.IsNullOrWhiteSpace(Datos.Gestion.DbVideoInstitucionalRepository.BuildEmbedUrl(request.UrlYoutube)))
                return new DtoVideoInstitucionalResult { Success = false, Message = "La URL no corresponde a un video de YouTube válido." };

            return new DtoVideoInstitucionalResult { Success = true, Message = "OK" };
        }
    }
}

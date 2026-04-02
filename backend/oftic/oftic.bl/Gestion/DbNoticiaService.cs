using Comun.Dtos.Noticias;
using Datos.Interfaz;
using Negocio.Interfaz;
using System.Text.RegularExpressions;

namespace Negocio.Gestion;

public class DbNoticiaService : IDbNoticiaService
{
    private readonly IDbNoticiaRepository _repository;

    public DbNoticiaService(IDbNoticiaRepository repository)
    {
        _repository = repository;
    }

    public async Task<List<DtoNoticia>> GetAllAsync(CancellationToken ct)
    {
        return await _repository.GetAllAsync(ct);
    }

    public async Task<DtoNoticia?> GetByIdAsync(long id, CancellationToken ct)
    {
        return await _repository.GetByIdAsync(id, ct);
    }

    public async Task<List<DtoNoticia>> GetActivasAsync(CancellationToken ct)
    {
        return await _repository.GetActivasAsync(ct);
    }

    public async Task<DtoNoticiaResult> CreateAsync(DtoNoticiaRequest request, string usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
    {
        var validation = Validate(request);
        if (!validation.Success)
            return validation;

        return await _repository.CreateAsync(request, usuarioAuditoria, maquinaAuditoria, ct);
    }

    public async Task<DtoNoticiaResult> UpdateAsync(long id, DtoNoticiaRequest request, string usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
    {
        if (id <= 0)
            return new DtoNoticiaResult { Success = false, Message = "ID inválido." };

        var validation = Validate(request);
        if (!validation.Success)
            return validation;

        return await _repository.UpdateAsync(id, request, usuarioAuditoria, maquinaAuditoria, ct);
    }

    public async Task<DtoNoticiaResult> DeleteAsync(long id, string usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
    {
        if (id <= 0)
            return new DtoNoticiaResult { Success = false, Message = "ID inválido." };

        return await _repository.DeleteAsync(id, usuarioAuditoria, maquinaAuditoria, ct);
    }

    private static DtoNoticiaResult Validate(DtoNoticiaRequest request)
    {
        if (request == null)
            return new DtoNoticiaResult { Success = false, Message = "Payload requerido." };

        if (string.IsNullOrWhiteSpace(request.Unidad))
            return new DtoNoticiaResult { Success = false, Message = "La unidad es requerida." };

        if (request.Unidad.Length > 100)
            return new DtoNoticiaResult { Success = false, Message = "La unidad no puede superar 100 caracteres." };

        if (string.IsNullOrWhiteSpace(request.Titulo))
            return new DtoNoticiaResult { Success = false, Message = "El título es requerido." };

        if (request.Titulo.Length > 300)
            return new DtoNoticiaResult { Success = false, Message = "El título no puede superar 300 caracteres." };

        if (string.IsNullOrWhiteSpace(request.Seccion))
            return new DtoNoticiaResult { Success = false, Message = "La sección es requerida." };

        if (string.IsNullOrWhiteSpace(request.Ciudad))
            return new DtoNoticiaResult { Success = false, Message = "La ciudad es requerida." };

        return new DtoNoticiaResult { Success = true, Message = "OK" };
    }
}
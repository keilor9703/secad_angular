using Comun.Dtos.Modal;
using Datos.Interfaz;
using Negocio.Interfaz;

namespace Negocio.Gestion
{
    public class DbModalService : IDbModalService
    {
        private readonly IDbModalRepository _repository;

        public DbModalService(IDbModalRepository repository)
        {
            _repository = repository;
        }

        public async Task<List<DtoModal>> GetAllAsync(CancellationToken ct)
            => await _repository.GetAllAsync(ct);

        public async Task<DtoModal?> GetByIdAsync(long id, CancellationToken ct)
        {
            if (id <= 0) return null;
            return await _repository.GetByIdAsync(id, ct);
        }

        public async Task<List<DtoModalActivo>> GetActivosAsync(CancellationToken ct)
            => await _repository.GetActivosAsync(ct);

        public async Task<DtoModalResult> CreateAsync(DtoModalRequest request, string usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        {
            if (request == null)
                return Error("Los datos son requeridos");

            if (string.IsNullOrWhiteSpace(request.Titulo))
                return Error("El título es requerido");

            if (request.FechaFin < request.FechaInicio)
                return Error("La fecha fin no puede ser menor a la fecha inicio");

            var tiposRecurso = new[] { "IMAGEN", "VIDEO", "TEXTO", "" };
            if (!tiposRecurso.Contains(request.TipoRecurso?.ToUpper()))
                return Error("TipoRecurso debe ser IMAGEN, VIDEO o TEXTO");

            var tiposAccion = new[] { "INFO", "ACEPTAR", "CONFIRMAR" };
            if (!tiposAccion.Contains(request.TipoAccion?.ToUpper()))
                return Error("TipoAccion debe ser INFO, ACEPTAR o CONFIRMAR");

            return await _repository.CreateAsync(request, usuarioAuditoria, maquinaAuditoria, ct);
        }

        public async Task<DtoModalResult> UpdateAsync(long id, DtoModalRequest request, string usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        {
            if (id <= 0)
                return Error("ID inválido");

            if (request == null)
                return Error("Los datos son requeridos");

            if (string.IsNullOrWhiteSpace(request.Titulo))
                return Error("El título es requerido");

            if (request.FechaFin < request.FechaInicio)
                return Error("La fecha fin no puede ser menor a la fecha inicio");

            return await _repository.UpdateAsync(id, request, usuarioAuditoria, maquinaAuditoria, ct);
        }

        public async Task<DtoModalResult> DeleteLogicalAsync(long id, string usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        {
            if (id <= 0)
                return Error("ID inválido");

            return await _repository.DeleteLogicalAsync(id, usuarioAuditoria, maquinaAuditoria, ct);
        }

        public async Task<DtoModalResult> ToggleVigenteAsync(long id, int vigente, string usuarioAuditoria, string maquinaAuditoria, CancellationToken ct)
        {
            if (id <= 0)
                return Error("ID inválido");

            if (vigente != 0 && vigente != 1)
                return Error("Vigente debe ser 0 o 1");

            return await _repository.ToggleVigenteAsync(id, vigente, usuarioAuditoria, maquinaAuditoria, ct);
        }

        public async Task<DtoModalResult> RegistrarInteraccionAsync(long idModal, string tipoAccion, string usuario, string maquina, CancellationToken ct)
        {
            if (idModal <= 0)
                return Error("ID de modal inválido");

            var acciones = new[] { "VISTA", "ACEPTAR", "CERRAR" };
            if (!acciones.Contains(tipoAccion?.ToUpper()))
                return Error("TipoAccion debe ser VISTA, ACEPTAR o CERRAR");

            return await _repository.RegistrarInteraccionAsync(idModal, tipoAccion!.ToUpper(), usuario, maquina, ct);
        }

        public async Task<List<DtoModalInteraccion>> GetInteraccionesAsync(long idModal, CancellationToken ct)
        {
            if (idModal <= 0) return [];
            return await _repository.GetInteraccionesAsync(idModal, ct);
        }

        private static DtoModalResult Error(string message) => new() { Success = false, Message = message };
    }
}

using Comun.Dtos.Operacion;

namespace Datos.Interfaz
{
    /// <summary>
    /// Repositorio para la bitácora de turno (§6.15 Anotaciones Generales).
    /// Las anotaciones NO están ligadas a incidentes — son registros de turno.
    /// </summary>
    public interface IDbAnotacionTurnoRepository
    {
        /// <summary>Obtiene anotaciones filtradas por canal, sitio y/o fecha.</summary>
        Task<List<DtoAnotacionTurno>> GetListAsync(
            int?     canalCodigo,
            int?     sitioGraba,
            string?  tipo,
            string?  fechaDesde,   // "yyyy-MM-dd"
            string?  fechaHasta,   // "yyyy-MM-dd"
            CancellationToken ct);

        /// <summary>Obtiene una anotación por su ID Snowflake.</summary>
        Task<DtoAnotacionTurno?> GetByIdAsync(long id, CancellationToken ct);

        /// <summary>Crea una nueva anotación de turno y devuelve el registro creado.</summary>
        Task<DtoAnotacionTurno> CreateAsync(
            DtoAnotacionTurnoRequest request,
            long     idUsuario,
            string   username,
            string   nombreCompleto,
            string   maquina,
            CancellationToken ct);

        /// <summary>Actualiza título y descripción de una anotación existente.</summary>
        Task<bool> UpdateAsync(
            long     id,
            DtoAnotacionTurnoRequest request,
            string   username,
            CancellationToken ct);

        /// <summary>Elimina una anotación (solo el autor o un supervisor).</summary>
        Task<bool> DeleteAsync(long id, CancellationToken ct);
    }
}

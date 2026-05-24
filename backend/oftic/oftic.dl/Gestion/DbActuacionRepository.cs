using Comun.Dtos.Actuaciones;
using Comun.Snowflake;
using Datos.Interfaz;
using Datos.Tenant;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace Datos.Gestion
{
    public class DbActuacionRepository : IDbActuacionRepository
    {
        private readonly TenantContext                   _tenant;
        private readonly ILogger<DbActuacionRepository> _logger;
        private readonly ISnowflakeGenerator             _snowflake;

        private const string TsFormat = "DD/MM/YYYY HH24:MI:SS";

        public DbActuacionRepository(
            TenantContext tenant,
            ILogger<DbActuacionRepository> logger,
            ISnowflakeGenerator snowflake)
        {
            _tenant    = tenant;
            _logger    = logger;
            _snowflake = snowflake;
        }

        // ════════════════════════════════════════════════════════════════════════
        // LISTA DE ACTUACIONES DE UN EVENTO
        // ════════════════════════════════════════════════════════════════════════

        public async Task<List<DtoActuacionListItem>> G_GetActuacionesEventoAsync(
            long eventoId, CancellationToken ct)
        {
            var result = new List<DtoActuacionListItem>();
            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);
            await using var cmd  = conn.CreateCommand();
            cmd.CommandText = $@"
SELECT a.id, a.evento_id,
       COALESCE(a.fuerza_descripcion,
                f.descripcion, '')                  AS fuerza_desc,
       COALESCE(a.canal_descripcion,
                c.descripcion, '')                  AS canal_desc,
       a.unidad_asignada,
       a.estado,
       TO_CHAR(a.fecha_creacion  AT TIME ZONE 'America/Bogota','{TsFormat}'),
       TO_CHAR(a.fecha_despacho  AT TIME ZONE 'America/Bogota','{TsFormat}'),
       TO_CHAR(a.fecha_llegada   AT TIME ZONE 'America/Bogota','{TsFormat}'),
       TO_CHAR(a.fecha_cierre    AT TIME ZONE 'America/Bogota','{TsFormat}'),
       a.cali_pedido,
       (SELECT COUNT(*) FROM cad_actuaciones_unidades u WHERE u.actuacion_id = a.id) AS total_unidades,
       (SELECT COUNT(*) FROM cad_actuaciones_notas    n WHERE n.actuacion_id = a.id) AS total_notas
FROM   cad_actuaciones a
LEFT   JOIN cad_fuerzas f ON f.id     = a.fuerza_id
LEFT   JOIN cad_canales c ON c.codigo = a.canal_codigo
WHERE  a.evento_id = @eid
ORDER  BY a.fecha_creacion ASC";
            cmd.Parameters.AddWithValue("eid", eventoId);

            await using var rdr = await cmd.ExecuteReaderAsync(ct);
            while (await rdr.ReadAsync(ct))
                result.Add(new DtoActuacionListItem
                {
                    Id            = rdr.GetInt64(0),
                    EventoId      = rdr.GetInt64(1),
                    FuerzaDesc    = rdr.IsDBNull(2)  ? "" : rdr.GetString(2),
                    CanalDesc     = rdr.IsDBNull(3)  ? "" : rdr.GetString(3),
                    UnidadAsignada= rdr.IsDBNull(4)  ? null : rdr.GetString(4),
                    Estado        = rdr.IsDBNull(5)  ? "" : rdr.GetString(5),
                    FechaCreacion = rdr.IsDBNull(6)  ? "" : rdr.GetString(6),
                    FechaDespacho = rdr.IsDBNull(7)  ? null : rdr.GetString(7),
                    FechaLlegada  = rdr.IsDBNull(8)  ? null : rdr.GetString(8),
                    FechaCierre   = rdr.IsDBNull(9)  ? null : rdr.GetString(9),
                    CaliPedido    = rdr.IsDBNull(10) ? null : rdr.GetString(10),
                    TotalUnidades = rdr.IsDBNull(11) ? 0   : (int)rdr.GetInt64(11),
                    TotalNotas    = rdr.IsDBNull(12) ? 0   : (int)rdr.GetInt64(12)
                });
            return result;
        }

        // ════════════════════════════════════════════════════════════════════════
        // DETALLE COMPLETO DE UNA ACTUACIÓN
        // ════════════════════════════════════════════════════════════════════════

        public async Task<DtoActuacion?> G_GetActuacionAsync(
            long actuacionId, CancellationToken ct)
        {
            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);

            DtoActuacion? act = null;

            // ── Datos base ───────────────────────────────────────────────────────
            await using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = $@"
SELECT a.id, a.evento_id, a.pedido_id, a.sitio_graba,
       a.fuerza_id, a.canal_codigo,
       COALESCE(a.fuerza_descripcion, f.descripcion, '') AS fuerza_desc,
       COALESCE(a.canal_descripcion,  c.descripcion, '') AS canal_desc,
       a.despachador_usuario, a.tipo_despachador,
       a.unidad_asignada, a.placa_unidad,
       a.estado,
       TO_CHAR(a.fecha_creacion   AT TIME ZONE 'America/Bogota','{TsFormat}'),
       TO_CHAR(a.fecha_despacho   AT TIME ZONE 'America/Bogota','{TsFormat}'),
       TO_CHAR(a.fecha_llegada    AT TIME ZONE 'America/Bogota','{TsFormat}'),
       TO_CHAR(a.fecha_cierre     AT TIME ZONE 'America/Bogota','{TsFormat}'),
       a.codigo_cierre_primario, a.clasif_cierre, a.observacion_cierre,
       a.cali_pedido,
       TO_CHAR(a.fecha_modificacion AT TIME ZONE 'America/Bogota','{TsFormat}'),
       a.usuario_modifica
FROM   cad_actuaciones a
LEFT   JOIN cad_fuerzas f ON f.id     = a.fuerza_id
LEFT   JOIN cad_canales c ON c.codigo = a.canal_codigo
WHERE  a.id = @id";
                cmd.Parameters.AddWithValue("id", actuacionId);

                await using var rdr = await cmd.ExecuteReaderAsync(ct);
                if (!await rdr.ReadAsync(ct)) return null;

                act = new DtoActuacion
                {
                    Id                    = rdr.GetInt64(0),
                    EventoId              = rdr.GetInt64(1),
                    PedidoId              = rdr.IsDBNull(2)  ? null : rdr.GetInt64(2),
                    SitioGraba            = rdr.GetInt32(3),
                    FuerzaId              = rdr.IsDBNull(4)  ? null : rdr.GetInt32(4),
                    CanalCodigo           = rdr.IsDBNull(5)  ? null : rdr.GetInt32(5),
                    FuerzaDescripcion     = rdr.IsDBNull(6)  ? "" : rdr.GetString(6),
                    CanalDescripcion      = rdr.IsDBNull(7)  ? "" : rdr.GetString(7),
                    DespachadorUsuario    = rdr.IsDBNull(8)  ? null : rdr.GetString(8),
                    TipoDespachador       = rdr.IsDBNull(9)  ? null : rdr.GetString(9),
                    UnidadAsignada        = rdr.IsDBNull(10) ? null : rdr.GetString(10),
                    PlacaUnidad           = rdr.IsDBNull(11) ? null : rdr.GetString(11),
                    Estado                = rdr.IsDBNull(12) ? "" : rdr.GetString(12),
                    FechaCreacion         = rdr.IsDBNull(13) ? "" : rdr.GetString(13),
                    FechaDespacho         = rdr.IsDBNull(14) ? null : rdr.GetString(14),
                    FechaLlegada          = rdr.IsDBNull(15) ? null : rdr.GetString(15),
                    FechaCierre           = rdr.IsDBNull(16) ? null : rdr.GetString(16),
                    CodigoCierrePrimario  = rdr.IsDBNull(17) ? null : rdr.GetString(17),
                    ClasifCierre          = rdr.IsDBNull(18) ? null : rdr.GetString(18),
                    ObservacionCierre     = rdr.IsDBNull(19) ? null : rdr.GetString(19),
                    CaliPedido            = rdr.IsDBNull(20) ? null : rdr.GetString(20),
                    FechaModificacion     = rdr.IsDBNull(21) ? null : rdr.GetString(21),
                    UsuarioModifica       = rdr.IsDBNull(22) ? null : rdr.GetString(22)
                };
            }

            // ── Códigos de cierre ────────────────────────────────────────────────
            await using (var cmdCod = conn.CreateCommand())
            {
                cmdCod.CommandText = @"
SELECT orden, codigo_cierre, tipo_codigo, descripcion_libre
FROM   cad_actuaciones_codigos
WHERE  actuacion_id = @id
ORDER  BY orden";
                cmdCod.Parameters.AddWithValue("id", actuacionId);
                await using var rdr = await cmdCod.ExecuteReaderAsync(ct);
                while (await rdr.ReadAsync(ct))
                    act.CodigosCierre.Add(new DtoCodigoCierreActuacion
                    {
                        Orden            = rdr.IsDBNull(0) ? 1  : rdr.GetInt16(0),
                        CodigoCierre     = rdr.IsDBNull(1) ? "" : rdr.GetString(1),
                        TipoCodigo       = rdr.IsDBNull(2) ? "" : rdr.GetString(2),
                        DescripcionLibre = rdr.IsDBNull(3) ? null : rdr.GetString(3)
                    });
            }

            // ── Unidades despachadas ─────────────────────────────────────────────
            await using (var cmdUni = conn.CreateCommand())
            {
                cmdUni.CommandText = $@"
SELECT id, unidad_codigo, placa, tipo_unidad, estado,
       TO_CHAR(fecha_despacho   AT TIME ZONE 'America/Bogota','{TsFormat}'),
       TO_CHAR(fecha_llegada    AT TIME ZONE 'America/Bogota','{TsFormat}'),
       TO_CHAR(fecha_liberacion AT TIME ZONE 'America/Bogota','{TsFormat}'),
       observacion
FROM   cad_actuaciones_unidades
WHERE  actuacion_id = @id
ORDER  BY id";
                cmdUni.Parameters.AddWithValue("id", actuacionId);
                await using var rdr = await cmdUni.ExecuteReaderAsync(ct);
                while (await rdr.ReadAsync(ct))
                    act.Unidades.Add(new DtoActuacionUnidad
                    {
                        Id              = rdr.GetInt64(0),
                        UnidadCodigo    = rdr.IsDBNull(1) ? "" : rdr.GetString(1),
                        Placa           = rdr.IsDBNull(2) ? null : rdr.GetString(2),
                        TipoUnidad      = rdr.IsDBNull(3) ? null : rdr.GetString(3),
                        Estado          = rdr.IsDBNull(4) ? "D" : rdr.GetString(4),
                        FechaDespacho   = rdr.IsDBNull(5) ? null : rdr.GetString(5),
                        FechaLlegada    = rdr.IsDBNull(6) ? null : rdr.GetString(6),
                        FechaLiberacion = rdr.IsDBNull(7) ? null : rdr.GetString(7),
                        Observacion     = rdr.IsDBNull(8) ? null : rdr.GetString(8)
                    });
            }

            // ── Notas de campo ───────────────────────────────────────────────────
            await using (var cmdNot = conn.CreateCommand())
            {
                cmdNot.CommandText = $@"
SELECT id, nota, tipo_nota, usuario_registra,
       TO_CHAR(fecha_registra AT TIME ZONE 'America/Bogota','{TsFormat}')
FROM   cad_actuaciones_notas
WHERE  actuacion_id = @id
ORDER  BY fecha_registra ASC";
                cmdNot.Parameters.AddWithValue("id", actuacionId);
                await using var rdr = await cmdNot.ExecuteReaderAsync(ct);
                while (await rdr.ReadAsync(ct))
                    act.Notas.Add(new DtoActuacionNota
                    {
                        Id              = rdr.GetInt64(0),
                        Nota            = rdr.IsDBNull(1) ? "" : rdr.GetString(1),
                        TipoNota        = rdr.IsDBNull(2) ? "GENERAL" : rdr.GetString(2),
                        UsuarioRegistra = rdr.IsDBNull(3) ? "" : rdr.GetString(3),
                        FechaRegistra   = rdr.IsDBNull(4) ? "" : rdr.GetString(4)
                    });
            }

            return act;
        }

        // ════════════════════════════════════════════════════════════════════════
        // ACTUALIZAR ESTADO OPERATIVO (Despachada → Atendida)
        // ════════════════════════════════════════════════════════════════════════

        public async Task<DtoActuacionResult> P_ActualizarEstadoActuacionAsync(
            long actuacionId,
            DtoActualizarEstadoActuacionRequest req,
            string usuario,
            CancellationToken ct)
        {
            if (req.Estado != EstadoActuacion.Despachada && req.Estado != EstadoActuacion.Atendida)
                return new DtoActuacionResult
                {
                    Success     = false,
                    ActuacionId = actuacionId,
                    Message     = $"Estado inválido para ciclo operativo: '{req.Estado}'. Use D o A."
                };

            var tsCol = req.Estado == EstadoActuacion.Despachada ? "fecha_despacho" : "fecha_llegada";

            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);
            await using var cmd  = conn.CreateCommand();
            cmd.CommandText = $@"
UPDATE cad_actuaciones
SET    estado              = @estado,
       {tsCol}             = NOW(),
       unidad_asignada     = COALESCE(@unidad, unidad_asignada),
       placa_unidad        = COALESCE(@placa,  placa_unidad),
       fecha_modificacion  = NOW(),
       usuario_modifica    = @usuario
WHERE  id = @id
  AND  estado NOT IN ('C','V')";  /* -- no se reabre una actuación cerrada*/

            cmd.Parameters.AddWithValue("estado",  req.Estado);
            cmd.Parameters.AddWithValue("unidad",  NullOrString(req.UnidadAsignada));
            cmd.Parameters.AddWithValue("placa",   NullOrString(req.PlacaUnidad));
            cmd.Parameters.AddWithValue("usuario", usuario);
            cmd.Parameters.AddWithValue("id",      actuacionId);

            var rows = await cmd.ExecuteNonQueryAsync(ct);
            return new DtoActuacionResult
            {
                Success     = rows > 0,
                ActuacionId = actuacionId,
                Message     = rows > 0
                    ? $"Actuación {actuacionId} → {req.Estado}."
                    : $"Actuación {actuacionId} no encontrada o ya cerrada/anulada."
            };
        }

        // ════════════════════════════════════════════════════════════════════════
        // CERRAR ACTUACIÓN CON CÓDIGOS DE CIERRE
        // UPDATE cad_actuaciones + INSERT cad_actuaciones_codigos
        // + fn_recalcular_estado_evento — todo en una transacción.
        // ════════════════════════════════════════════════════════════════════════

        public async Task<DtoActuacionResult> P_CerrarActuacionAsync(
            DtoCierreActuacionRequest req,
            string usuario,
            CancellationToken ct)
        {
            if (req.ActuacionId <= 0)
                return new DtoActuacionResult
                {
                    Success = false,
                    Message = "ActuacionId inválido."
                };

            var estadoFinal = req.Estado is EstadoActuacion.Cerrada or EstadoActuacion.Anulada
                            ? req.Estado : EstadoActuacion.Cerrada;

            var codigoPrimario = req.CodigosCierre
                .OrderBy(x => x.Orden)
                .FirstOrDefault()?.CodigoCierre ?? "";

            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);
            await using var tx   = await conn.BeginTransactionAsync(ct);

            try
            {
                // ── 1. Obtener evento_id para el recálculo ────────────────────
                long eventoId = 0;
                await using (var qEvt = conn.CreateCommand())
                {
                    qEvt.Transaction = tx;
                    qEvt.CommandText = "SELECT evento_id FROM cad_actuaciones WHERE id = @id";
                    qEvt.Parameters.AddWithValue("id", req.ActuacionId);
                    var raw = await qEvt.ExecuteScalarAsync(ct);
                    if (raw is null or DBNull)
                    {
                        await tx.RollbackAsync(ct);
                        return new DtoActuacionResult
                        {
                            Success     = false,
                            ActuacionId = req.ActuacionId,
                            Message     = $"Actuación {req.ActuacionId} no encontrada."
                        };
                    }
                    eventoId = Convert.ToInt64(raw);
                }

                // ── 2. UPDATE cad_actuaciones ─────────────────────────────────
                await using (var upd = conn.CreateCommand())
                {
                    upd.Transaction = tx;
                    upd.CommandText = @"
UPDATE cad_actuaciones
SET    estado                 = @estado,
       fecha_cierre           = NOW(),
       codigo_cierre_primario = @codPrimario,
       clasif_cierre          = @clasif,
       observacion_cierre     = @obs,
       fecha_modificacion     = NOW(),
       usuario_modifica       = @usuario
WHERE  id = @id
  AND  estado NOT IN ('C','V')";
                    upd.Parameters.AddWithValue("estado",      estadoFinal);
                    upd.Parameters.AddWithValue("codPrimario", NullOrString(codigoPrimario));
                    upd.Parameters.AddWithValue("clasif",      NullOrString(req.ClasifCierre));
                    upd.Parameters.AddWithValue("obs",         NullOrString(req.ObservacionCierre));
                    upd.Parameters.AddWithValue("usuario",     usuario);
                    upd.Parameters.AddWithValue("id",          req.ActuacionId);
                    var rows = await upd.ExecuteNonQueryAsync(ct);
                    if (rows == 0)
                    {
                        await tx.RollbackAsync(ct);
                        return new DtoActuacionResult
                        {
                            Success     = false,
                            ActuacionId = req.ActuacionId,
                            Message     = $"Actuación {req.ActuacionId} ya cerrada/anulada o no existe."
                        };
                    }
                }

                // ── 3. Limpiar códigos previos (corrección de cierre) ─────────
                await using (var del = conn.CreateCommand())
                {
                    del.Transaction = tx;
                    del.CommandText = "DELETE FROM cad_actuaciones_codigos WHERE actuacion_id = @id";
                    del.Parameters.AddWithValue("id", req.ActuacionId);
                    await del.ExecuteNonQueryAsync(ct);
                }

                // ── 4. INSERT códigos de cierre ───────────────────────────────
                foreach (var cod in req.CodigosCierre.OrderBy(x => x.Orden))
                {
                    await using var insCod = conn.CreateCommand();
                    insCod.Transaction = tx;
                    insCod.CommandText = @"
INSERT INTO cad_actuaciones_codigos
    (actuacion_id, orden, codigo_cierre, tipo_codigo,
     descripcion_libre, usuario_registra, fecha_registra)
VALUES (@actId, @orden, @codigo, @tipo, @desc, @usuario, NOW())";
                    insCod.Parameters.AddWithValue("actId",   req.ActuacionId);
                    insCod.Parameters.AddWithValue("orden",   cod.Orden);
                    insCod.Parameters.AddWithValue("codigo",  cod.CodigoCierre);
                    insCod.Parameters.AddWithValue("tipo",    string.IsNullOrWhiteSpace(cod.TipoCodigo)
                                                              ? "CIERRE" : cod.TipoCodigo);
                    insCod.Parameters.AddWithValue("desc",    NullOrString(cod.DescripcionLibre));
                    insCod.Parameters.AddWithValue("usuario", usuario);
                    await insCod.ExecuteNonQueryAsync(ct);
                }

                // ── 5. Recalcular estado global del evento ────────────────────
                // fn_recalcular_estado_evento ya existe en BD (creada en V8).
                await using (var fnEvt = conn.CreateCommand())
                {
                    fnEvt.Transaction = tx;
                    fnEvt.CommandText = "SELECT fn_recalcular_estado_evento(@eid)";
                    fnEvt.Parameters.AddWithValue("eid", eventoId);
                    await fnEvt.ExecuteNonQueryAsync(ct);
                }

                await tx.CommitAsync(ct);
                return new DtoActuacionResult
                {
                    Success     = true,
                    ActuacionId = req.ActuacionId,
                    Message     = $"Actuación {req.ActuacionId} cerrada con " +
                                  $"{req.CodigosCierre.Count} código(s). " +
                                  $"Evento {eventoId} recalculado."
                };
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync(ct);
                _logger.LogError(ex, "P_CerrarActuacion error id={Id}", req.ActuacionId);
                return new DtoActuacionResult
                {
                    Success     = false,
                    ActuacionId = req.ActuacionId,
                    Message     = ex.Message
                };
            }
        }

        // ════════════════════════════════════════════════════════════════════════
        // AGREGAR NOTA DE CAMPO
        // ════════════════════════════════════════════════════════════════════════

        public async Task<DtoActuacionResult> P_AgregarNotaActuacionAsync(
            long actuacionId,
            DtoAgregarNotaActuacionRequest req,
            string usuario,
            CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(req.Nota))
                return new DtoActuacionResult
                {
                    Success     = false,
                    ActuacionId = actuacionId,
                    Message     = "El texto de la nota no puede estar vacío."
                };

            var tipoNota = req.TipoNota is "GENERAL" or "NOVEDAD" or "ALERTA" or "CIERRE"
                         ? req.TipoNota : "GENERAL";

            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);
            await using var cmd  = conn.CreateCommand();
            cmd.CommandText = @"
INSERT INTO cad_actuaciones_notas
    (actuacion_id, nota, tipo_nota, usuario_registra, fecha_registra)
VALUES (@actId, @nota, @tipo, @usuario, NOW())
RETURNING id";
            cmd.Parameters.AddWithValue("actId",   actuacionId);
            cmd.Parameters.AddWithValue("nota",    req.Nota);
            cmd.Parameters.AddWithValue("tipo",    tipoNota);
            cmd.Parameters.AddWithValue("usuario", usuario);

            var newId = await cmd.ExecuteScalarAsync(ct);
            return new DtoActuacionResult
            {
                Success     = true,
                ActuacionId = actuacionId,
                SubId       = newId is null ? null : Convert.ToInt64(newId),
                Message     = "Nota registrada."
            };
        }

        // ════════════════════════════════════════════════════════════════════════
        // AGREGAR UNIDAD ADICIONAL
        // ════════════════════════════════════════════════════════════════════════

        public async Task<DtoActuacionResult> P_AgregarUnidadActuacionAsync(
            long actuacionId,
            DtoAgregarUnidadActuacionRequest req,
            string usuario,
            CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(req.UnidadCodigo))
                return new DtoActuacionResult
                {
                    Success     = false,
                    ActuacionId = actuacionId,
                    Message     = "El código de unidad es obligatorio."
                };

            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);
            await using var cmd  = conn.CreateCommand();
            cmd.CommandText = @"
INSERT INTO cad_actuaciones_unidades
    (actuacion_id, unidad_codigo, placa, tipo_unidad,
     fecha_despacho, estado, observacion, fecha_creacion)
VALUES (@actId, @codigo, @placa, @tipo,
        NOW(), 'D', @obs, NOW())
RETURNING id";
            cmd.Parameters.AddWithValue("actId",  actuacionId);
            cmd.Parameters.AddWithValue("codigo", req.UnidadCodigo);
            cmd.Parameters.AddWithValue("placa",  NullOrString(req.Placa));
            cmd.Parameters.AddWithValue("tipo",   NullOrString(req.TipoUnidad));
            cmd.Parameters.AddWithValue("obs",    NullOrString(req.Observacion));

            var newId = await cmd.ExecuteScalarAsync(ct);
            return new DtoActuacionResult
            {
                Success     = true,
                ActuacionId = actuacionId,
                SubId       = newId is null ? null : Convert.ToInt64(newId),
                Message     = $"Unidad '{req.UnidadCodigo}' despachada."
            };
        }

        // ════════════════════════════════════════════════════════════════════════
        // PRIVATE HELPERS
        // ════════════════════════════════════════════════════════════════════════

        private static object NullOrString(string? value) =>
            string.IsNullOrWhiteSpace(value) ? DBNull.Value : value;
    }
}

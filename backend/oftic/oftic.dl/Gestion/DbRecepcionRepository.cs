using Comun.Dtos.Eventos;
using Comun.Dtos.Recepcion;
using Comun.Snowflake;
using Datos.Interfaz;
using Datos.Tenant;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace Datos.Gestion
{
    public class DbRecepcionRepository : IDbRecepcionRepository
    {
        private readonly TenantContext              _tenant;
        private readonly ILogger<DbRecepcionRepository> _logger;
        private readonly ISnowflakeGenerator        _snowflake;

        // Formato heredado del SECAD JS original (obtenerFechaActual / txtFechaIngreso)
        private const string HoraFormat    = "dd/MM/yyyy HH:mm:ss";
        private const string TsFormat      = "dd/MM/yyyy HH:mm:ss";

        public DbRecepcionRepository(
            TenantContext tenant,
            ILogger<DbRecepcionRepository> logger,
            ISnowflakeGenerator snowflake)
        {
            _tenant    = tenant;
            _logger    = logger;
            _snowflake = snowflake;
        }

        // ════════════════════════════════════════════════════════════════════════
        // CTI / INCOMING CALL
        // ════════════════════════════════════════════════════════════════════════

        public async Task<DtoLlamadaEntrante?> F_GetLlamadasAsync(
            int sitioGraba, int acd, CancellationToken ct)
        {
            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);
            long numeTelefono    = 0;

            await using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = @"
                    SELECT id, nume_telefono
                    FROM   cad_interfaz_cti
                    WHERE  sitio_graba = @sg AND acd = @acd AND registrada = 'N'
                    ORDER  BY fecha_registro ASC
                    LIMIT  1";
                cmd.Parameters.AddWithValue("sg",  sitioGraba);
                cmd.Parameters.AddWithValue("acd", acd);

                await using var rdr = await cmd.ExecuteReaderAsync(ct);
                if (!await rdr.ReadAsync(ct)) return null;
                numeTelefono = rdr.IsDBNull(1) ? 0 : rdr.GetInt64(1);
            }

            if (numeTelefono == 0) return null;

            // Generar ID Snowflake — sin round-trip a la BD
            long numeLlamada = _snowflake.NextId();

            await using (var upd = conn.CreateCommand())
            {
                upd.CommandText = @"
                    UPDATE cad_interfaz_cti
                    SET    registrada = 'S'
                    WHERE  sitio_graba = @sg AND acd = @acd AND registrada = 'N'";
                upd.Parameters.AddWithValue("sg",  sitioGraba);
                upd.Parameters.AddWithValue("acd", acd);
                await upd.ExecuteNonQueryAsync(ct);
            }

            return new DtoLlamadaEntrante
            {
                NUME_LLAMADA  = numeLlamada,
                NUME_TELEFONO = numeTelefono,
                CORDX         = "0",
                CORDY         = "0",
                TIPOSHAPE     = "Nulo",
                RADIO         = 0,
                FECHAGMLC     = DateTime.Now.ToString(HoraFormat),
                OPERADOR      = ""
            };
        }

        // ════════════════════════════════════════════════════════════════════════
        // ID GENERATION (Snowflake — sin acceso a BD)
        // ════════════════════════════════════════════════════════════════════════

        public Task<long> F_ConsultarSeqPedidoAsync(CancellationToken ct)
            => Task.FromResult(_snowflake.NextId());

        // ════════════════════════════════════════════════════════════════════════
        // CATALOG LOOKUPS
        // ════════════════════════════════════════════════════════════════════════

        public async Task<List<DtoCasoItem>> F_GetCasosIntelAsync(
            string busqueda, CancellationToken ct)
        {
            var result = new List<DtoCasoItem>();
            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);
            await using var cmd  = conn.CreateCommand();
            cmd.CommandText = @"
                SELECT codigo AS CODIGO_CASO, descripcion AS DESCRIPCION_CASO
                FROM   cad_casos
                WHERE (UPPER(codigo)      LIKE '%' || UPPER(@b) || '%'
                    OR UPPER(descripcion) LIKE '%' || UPPER(@b) || '%')
                  AND vigente = 'S'
                ORDER  BY descripcion
                LIMIT  50";
            cmd.Parameters.AddWithValue("b", busqueda ?? "");
            await using var rdr = await cmd.ExecuteReaderAsync(ct);
            while (await rdr.ReadAsync(ct))
                result.Add(new DtoCasoItem
                {
                    CODIGO_CASO      = rdr.IsDBNull(0) ? "" : rdr.GetString(0),
                    DESCRIPCION_CASO = rdr.IsDBNull(1) ? "" : rdr.GetString(1)
                });
            return result;
        }

        public async Task<DtoCasoItem?> F_GetCasoPorCodigoAsync(
            string codigo, CancellationToken ct)
        {
            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);
            await using var cmd  = conn.CreateCommand();
            cmd.CommandText = @"
                SELECT codigo AS CODIGO_CASO, descripcion AS DESCRIPCION_CASO
                FROM   cad_casos
                WHERE  TRIM(UPPER(codigo)) = TRIM(UPPER(@c))
                LIMIT  1";
            cmd.Parameters.Add("c", NpgsqlTypes.NpgsqlDbType.Varchar).Value = codigo ?? "";
            await using var rdr = await cmd.ExecuteReaderAsync(ct);
            if (!await rdr.ReadAsync(ct)) return null;
            return new DtoCasoItem
            {
                CODIGO_CASO      = rdr.IsDBNull(0) ? "" : rdr.GetString(0),
                DESCRIPCION_CASO = rdr.IsDBNull(1) ? "" : rdr.GetString(1)
            };
        }

        public async Task<List<DtoCanalRecepcion>> F_GetCanalesAsync(
            int sitioGraba, CancellationToken ct)
        {
            var result = new List<DtoCanalRecepcion>();
            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);
            await using var cmd  = conn.CreateCommand();
            cmd.CommandText = @"
                SELECT r.codigo, r.descripcion, f.descripcion AS fuerza
                FROM   cad_canales r
                JOIN   cad_fuerzas f ON r.cadfuerz_id = f.id
                WHERE  f.sitio_graba = @sg AND r.vigente = 'S'
                ORDER  BY r.descripcion ASC";
            cmd.Parameters.AddWithValue("sg", sitioGraba);
            await using var rdr = await cmd.ExecuteReaderAsync(ct);
            while (await rdr.ReadAsync(ct))
                result.Add(new DtoCanalRecepcion
                {
                    Codigo      = rdr.IsDBNull(0) ? 0  : rdr.GetInt32(0),
                    Descripcion = rdr.IsDBNull(1) ? "" : rdr.GetString(1),
                    Fuerza      = rdr.IsDBNull(2) ? "" : rdr.GetString(2)
                });
            return result;
        }

        public async Task<List<DtoReferenciaSecad>> F_GetReferenciasAsync(
            string nombre, CancellationToken ct)
        {
            var result = new List<DtoReferenciaSecad>();
            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);
            await using var cmd  = conn.CreateCommand();
            cmd.CommandText = @"
                SELECT nombre, codigo, descripcion, COALESCE(abreviatura,'')
                FROM   cad_referencias_secad
                WHERE  nombre = @n
                ORDER  BY descripcion";
            cmd.Parameters.AddWithValue("n", nombre ?? "");
            await using var rdr = await cmd.ExecuteReaderAsync(ct);
            while (await rdr.ReadAsync(ct))
                result.Add(new DtoReferenciaSecad
                {
                    Nombre      = rdr.IsDBNull(0) ? "" : rdr.GetString(0),
                    Codigo      = rdr.IsDBNull(1) ? "" : rdr.GetString(1),
                    Descripcion = rdr.IsDBNull(2) ? "" : rdr.GetString(2),
                    Abreviatura = rdr.IsDBNull(3) ? "" : rdr.GetString(3)
                });
            return result;
        }

        public async Task<List<DtoLlamadaAsociar>> F_BuscarLlamadasAsociarAsync(
            int sitioGraba, string horaCaso, long numeLlamada, CancellationToken ct)
        {
            var result = new List<DtoLlamadaAsociar>();
            if (!DateTime.TryParseExact(horaCaso, HoraFormat,
                    System.Globalization.CultureInfo.InvariantCulture,
                    System.Globalization.DateTimeStyles.None, out var fechaRef))
                fechaRef = DateTime.UtcNow;

            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);
            await using var cmd  = conn.CreateCommand();
            cmd.CommandText = @"
                SELECT a.nume_llamada,
                       TO_CHAR(a.hora_caso AT TIME ZONE 'America/Bogota','DD/MM/YYYY HH24:MI:SS'),
                       a.nume_telefono,
                       COALESCE(a.cali_pedido,''),
                       COALESCE(l.descripcion,''),
                       COALESCE(a.nomb_llamante,''),
                       COALESCE(a.dire_caso,''),
                       COALESCE(a.codi_pedido,''),
                       COALESCE(a.estado,''),
                       a.sitio_graba
                FROM   cad_pedidos a
                LEFT   JOIN cad_lugares_geograficos l ON l.codigo = a.luge_codigo
                WHERE  a.sitio_graba = @sg
                  AND  COALESCE(TRIM(a.codi_pedido),'0') <> '900'
                  AND  a.hora_caso <= @ref
                  AND  a.hora_caso  > @ref - INTERVAL '200 minutes'
                  AND  a.cadpedi_nume_llamada IS NULL
                  AND  a.nume_llamada <> @id
                ORDER  BY a.hora_caso DESC";
            cmd.Parameters.AddWithValue("sg",  sitioGraba);
            cmd.Parameters.AddWithValue("ref", fechaRef);
            cmd.Parameters.AddWithValue("id",  numeLlamada);
            await using var rdr = await cmd.ExecuteReaderAsync(ct);
            while (await rdr.ReadAsync(ct))
                result.Add(new DtoLlamadaAsociar
                {
                    NUME_LLAMADA  = rdr.IsDBNull(0) ? 0  : rdr.GetInt64(0),
                    HORA_CASO     = rdr.IsDBNull(1) ? "" : rdr.GetString(1),
                    NUME_TELEFONO = rdr.IsDBNull(2) ? 0  : rdr.GetInt64(2),
                    CALI_PEDIDO   = rdr.IsDBNull(3) ? "" : rdr.GetString(3),
                    CIUDAD        = rdr.IsDBNull(4) ? "" : rdr.GetString(4),
                    NOMB_LLAMANTE = rdr.IsDBNull(5) ? "" : rdr.GetString(5),
                    DIRE_CASO     = rdr.IsDBNull(6) ? "" : rdr.GetString(6),
                    CODI_PEDIDO   = rdr.IsDBNull(7) ? "" : rdr.GetString(7),
                    ESTADO        = rdr.IsDBNull(8) ? "" : rdr.GetString(8),
                    SITIO_GRABA   = rdr.IsDBNull(9) ? 0  : rdr.GetInt32(9)
                });
            return result;
        }

        // ════════════════════════════════════════════════════════════════════════
        // GUARDAR LLAMADA COMPLETA
        // Inserta: cad_pedidos → cad_eventos → cad_pedidos_canales (por canal)
        // Todo dentro de una sola transacción.
        // ════════════════════════════════════════════════════════════════════════

        public async Task<DtoRecepcionResult> P_GuardarLlamadaAsync(
            DtoRecepcion d, int canalFuerza, string usuario, long idEmpleado, CancellationToken ct)
        {
            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);
            await using var tx   = await conn.BeginTransactionAsync(ct);

            try
            {
                var (codiBarrio, lugeBarrio, barrioNoEncontrado) =
                    await BuscarBarrioAsync(conn, tx, d.SITIO_GRABA, d.BARRIO, d.CIUDAD, ct);

                DateTime.TryParseExact(d.HORA_CASO, HoraFormat,
                    System.Globalization.CultureInfo.InvariantCulture,
                    System.Globalization.DateTimeStyles.None, out var horaCaso);

                // ── 1. INSERT cad_pedidos ─────────────────────────────────────
                await using (var ins = conn.CreateCommand())
                {
                    ins.Transaction = tx;
                    ins.CommandText = @"
INSERT INTO cad_pedidos
    (sitio_graba, nume_llamada, hora_caso, fech_caso,
     disp_telefonico, celda_marcacion,
     nume_telefono, prop_telefono,
     luge_codigo,
     tipo_pedido, cali_pedido,
     nomb_llamante, dire_llamante,
     luge_barrio, dire_caso, codi_barrio,
     latitud_caso, longitud_caso,
     comentario, codi_pedido, importancia, prioridad, codi_pedido2,
     estado, enviar,
     cadusua_usuario, cadpoli_cedu_empleado,
     cadpedi_sitio_graba, cadpedi_nume_llamada,
     fecha_creacion, total_canales,
     barrio, ciudad)
VALUES
    (@sg, @nl, @hc, @hc,
     @disp, @celda,
     @tel, @propTel,
     @luge,
     @tpedido, @cpedido,
     @nomb, @direl,
     @lugeB, @direc, @codiB,
     @lat, @lon,
     @coment, @codi, @impo, @prio, @codi2,
     @estado, @enviar,
     @usuario, @empleado,
     @cadiSitio, @cadiNum,
     NOW(), 'N',
     @barrio, @ciudad)";

                    ins.Parameters.AddWithValue("sg",       d.SITIO_GRABA);
                    ins.Parameters.AddWithValue("nl",       d.NUME_LLAMADA);
                    ins.Parameters.AddWithValue("hc",       horaCaso == default ? (object)DBNull.Value : horaCaso);
                    ins.Parameters.AddWithValue("disp",     NullOrString(d.DISP_TELEFONICO));
                    ins.Parameters.AddWithValue("celda",    NullOrString(d.OPERADOR));
                    ins.Parameters.AddWithValue("tel",      d.NUME_TELEFONO);
                    ins.Parameters.AddWithValue("propTel",  NullOrString(d.PROP_TELEFONO));
                    ins.Parameters.AddWithValue("luge",     lugeBarrio == 0 ? (object)DBNull.Value : lugeBarrio);
                    ins.Parameters.AddWithValue("tpedido",  NullOrString(d.TIPO_PEDIDO));
                    ins.Parameters.AddWithValue("cpedido",  NullOrString(d.CALI_PEDIDO));
                    ins.Parameters.AddWithValue("nomb",     NullOrString(d.NOMB_LLAMANTE));
                    ins.Parameters.AddWithValue("direl",    NullOrString(d.DIRE_LLAMANTE));
                    ins.Parameters.AddWithValue("lugeB",    lugeBarrio == 0 ? (object)DBNull.Value : lugeBarrio);
                    ins.Parameters.AddWithValue("direc",    NullOrString(d.DIRE_CASO));
                    ins.Parameters.AddWithValue("codiB",    codiBarrio == 0 ? (object)DBNull.Value : codiBarrio);
                    ins.Parameters.AddWithValue("lat",      NullOrString(d.LATITUD_CASO));
                    ins.Parameters.AddWithValue("lon",      NullOrString(d.LONGITUD_CASO));
                    ins.Parameters.AddWithValue("coment",   NullOrString(d.COMENTARIO));
                    ins.Parameters.AddWithValue("codi",     NullOrString(d.CODI_PEDIDO));
                    ins.Parameters.AddWithValue("impo",     NullOrString(d.IMPORTANCIA));
                    ins.Parameters.AddWithValue("prio",     NullOrString(d.PRIORIDAD));
                    ins.Parameters.AddWithValue("codi2",    NullOrString(d.CODI_PEDIDO2));
                    ins.Parameters.AddWithValue("estado",   NullOrString(d.ESTADO));
                    ins.Parameters.AddWithValue("enviar",   NullOrString(d.ENVIAR));
                    ins.Parameters.AddWithValue("usuario",  NullOrString(usuario));
                    ins.Parameters.AddWithValue("empleado", idEmpleado == 0 ? (object)DBNull.Value : idEmpleado);
                    ins.Parameters.AddWithValue("cadiSitio",NullOrString(d.CADPEDI_SITIO_GRABA));
                    ins.Parameters.AddWithValue("cadiNum",  string.IsNullOrWhiteSpace(d.CADPEDI_NUME_LLAMADA)
                                                            ? (object)DBNull.Value
                                                            : Convert.ToInt64(d.CADPEDI_NUME_LLAMADA));
                    ins.Parameters.AddWithValue("barrio",   NullOrString(d.BARRIO));
                    ins.Parameters.AddWithValue("ciudad",   NullOrString(d.CIUDAD));
                    await ins.ExecuteNonQueryAsync(ct);
                }

                // ── 2. Generar ID del evento (Snowflake — sin round-trip) ─────
                long numeEvento   = _snowflake.NextId();
                int  canalPrimario = d.CANALES_SELECCIONADOS.Count > 0
                                   ? d.CANALES_SELECCIONADOS[0] : 0;
                string origenEvento = string.IsNullOrWhiteSpace(d.Origen)
                                    ? OrigenEvento.Recepcion : d.Origen;

                // ── 3. INSERT cad_eventos ─────────────────────────────────────
                await using (var insEvt = conn.CreateCommand())
                {
                    insEvt.Transaction  = tx;
                    insEvt.CommandText  = @"
INSERT INTO cad_eventos (
    id, sitio_graba, origen,
    pedido_id, pedido_sitio_graba,
    fuerza_id, canal_codigo,
    cedu_empleado, usuario_genera, tipo_despachador,
    estado, fecha_creacion
) VALUES (
    @id, @sg, @origen,
    @pedidoId, @pedidoSg,
    @fuerzaId, @canal,
    @cedu, @usuario, 'O',
    'P', NOW()
)";
                    insEvt.Parameters.AddWithValue("id",       numeEvento);
                    insEvt.Parameters.AddWithValue("sg",       d.SITIO_GRABA);
                    insEvt.Parameters.AddWithValue("origen",   origenEvento);
                    insEvt.Parameters.AddWithValue("pedidoId", d.NUME_LLAMADA);
                    insEvt.Parameters.AddWithValue("pedidoSg", d.SITIO_GRABA);
                    insEvt.Parameters.AddWithValue("fuerzaId", canalFuerza == 0
                                                               ? (object)DBNull.Value : canalFuerza);
                    insEvt.Parameters.AddWithValue("canal",    canalPrimario == 0
                                                               ? (object)DBNull.Value : canalPrimario);
                    insEvt.Parameters.AddWithValue("cedu",     idEmpleado == 0
                                                               ? (object)DBNull.Value
                                                               : idEmpleado.ToString());
                    insEvt.Parameters.AddWithValue("usuario",  usuario);
                    await insEvt.ExecuteNonQueryAsync(ct);
                }

                // ── 4. INSERT cad_pedidos_canales + cad_actuaciones (uno por canal) ──
                foreach (var canal in d.CANALES_SELECCIONADOS)
                {
                    // ── 4a. cad_pedidos_canales ───────────────────────────────
                    await using var insCan = conn.CreateCommand();
                    insCan.Transaction  = tx;
                    insCan.CommandText  = @"
INSERT INTO cad_pedidos_canales
    (cadpedi_sitiograba, cadpedi_numellamada,
     cadcana_fuerz_id, cadcana_codigo,
     cali_pedido, comentario,
     estado, enviar,
     cadeven_sitio_graba, cadeven_nume_evento,
     fecha_grabacion, fecha_modificacion, usua_modifica)
VALUES
    (@sg, @nl, @fuerza, @canal,
     '01', @coment,
     @estado, @enviar,
     @sg, @evento,
     NOW(), NOW(), @usuario)";
                    insCan.Parameters.AddWithValue("sg",      d.SITIO_GRABA);
                    insCan.Parameters.AddWithValue("nl",      d.NUME_LLAMADA);
                    insCan.Parameters.AddWithValue("fuerza",  canalFuerza);
                    insCan.Parameters.AddWithValue("canal",   canal);
                    insCan.Parameters.AddWithValue("coment",  NullOrString(d.COMENTARIO));
                    insCan.Parameters.AddWithValue("estado",  NullOrString(d.ESTADO));
                    insCan.Parameters.AddWithValue("enviar",  NullOrString(d.ENVIAR));
                    insCan.Parameters.AddWithValue("evento",  numeEvento);
                    insCan.Parameters.AddWithValue("usuario", NullOrString(usuario));
                    await insCan.ExecuteNonQueryAsync(ct);

                    // ── 4b. cad_actuaciones (una por agencia/canal despachado) ─
                    // Guardamos snapshot de descripción usando sub-select para que
                    // renombrar el canal futuro no altere el historial.
                    long actuacionId = _snowflake.NextId();
                    await using var insAct = conn.CreateCommand();
                    insAct.Transaction = tx;
                    insAct.CommandText = @"
INSERT INTO cad_actuaciones (
    id, evento_id, pedido_id, sitio_graba,
    fuerza_id, canal_codigo,
    fuerza_descripcion, canal_descripcion,
    despachador_usuario, tipo_despachador,
    cali_pedido,
    estado, fecha_creacion
)
SELECT
    @id, @eventoId, @pedidoId, @sg,
    c.cadfuerz_id,   @canal,
    f.descripcion,   c.descripcion,
    @usuario,        'O',
    @cali,
    'P', NOW()
FROM   cad_canales c
JOIN   cad_fuerzas f ON f.id = c.cadfuerz_id
WHERE  c.codigo = @canal
LIMIT  1";
                    insAct.Parameters.AddWithValue("id",       actuacionId);
                    insAct.Parameters.AddWithValue("eventoId", numeEvento);
                    insAct.Parameters.AddWithValue("pedidoId", d.NUME_LLAMADA);
                    insAct.Parameters.AddWithValue("sg",       d.SITIO_GRABA);
                    insAct.Parameters.AddWithValue("canal",    canal);
                    insAct.Parameters.AddWithValue("usuario",  usuario);
                    insAct.Parameters.AddWithValue("cali",     NullOrString(d.CALI_PEDIDO));
                    await insAct.ExecuteNonQueryAsync(ct);
                }

                await tx.CommitAsync(ct);

                var msg = barrioNoEncontrado
                    ? $"Llamada enviada ID: {d.NUME_LLAMADA} — Evento: {numeEvento}. Barrio \"{d.BARRIO}\" no encontrado."
                    : $"Llamada enviada ID: {d.NUME_LLAMADA} — Evento: {numeEvento}";

                return new DtoRecepcionResult { Success = true, Message = msg };
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync(ct);
                _logger.LogError(ex, "P_GuardarLlamada error");
                return new DtoRecepcionResult { Success = false, Message = $"Error al guardar la llamada: {ex.Message}" };
            }
        }

        // ════════════════════════════════════════════════════════════════════════
        // CIERRE RÁPIDO
        // Inserta cad_pedidos + cad_eventos con estado=V (anulado) en una tx.
        // ════════════════════════════════════════════════════════════════════════

        public async Task<DtoRecepcionResult> P_CerrarLlamadaRapidaAsync(
            DtoRecepcion d, string usuario, CancellationToken ct)
        {
            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);
            await using var tx   = await conn.BeginTransactionAsync(ct);

            try
            {
                DateTime.TryParseExact(d.HORA_CASO, HoraFormat,
                    System.Globalization.CultureInfo.InvariantCulture,
                    System.Globalization.DateTimeStyles.None, out var horaCaso);

                // ── 1. INSERT cad_pedidos ─────────────────────────────────────
                await using (var ins = conn.CreateCommand())
                {
                    ins.Transaction = tx;
                    ins.CommandText = @"
INSERT INTO cad_pedidos
    (sitio_graba, nume_llamada, hora_caso, fech_caso,
     nume_telefono, prop_telefono,
     luge_codigo, dire_caso, codi_barrio, luge_barrio,
     latitud_caso, longitud_caso,
     comentario, codi_pedido, importancia, prioridad,
     estado, enviar, cadusua_usuario,
     fecha_creacion, total_canales)
VALUES
    (@sg, @nl, @hc, @hc,
     @tel, @propTel,
     @sg, NULL, NULL, @sg,
     NULL, NULL,
     @coment, @codi, '01', '01',
     @estado, @enviar, @usuario,
     NOW(), 'N')";
                    ins.Parameters.AddWithValue("sg",      d.SITIO_GRABA);
                    ins.Parameters.AddWithValue("nl",      d.NUME_LLAMADA);
                    ins.Parameters.AddWithValue("hc",      horaCaso == default ? (object)DBNull.Value : horaCaso);
                    ins.Parameters.AddWithValue("tel",     d.NUME_TELEFONO);
                    ins.Parameters.AddWithValue("propTel", NullOrString(d.PROP_TELEFONO));
                    ins.Parameters.AddWithValue("coment",  NullOrString(d.COMENTARIO));
                    ins.Parameters.AddWithValue("codi",    NullOrString(d.CODI_PEDIDO));
                    ins.Parameters.AddWithValue("estado",  NullOrString(d.ESTADO));
                    ins.Parameters.AddWithValue("enviar",  NullOrString(d.ENVIAR));
                    ins.Parameters.AddWithValue("usuario", NullOrString(usuario));
                    await ins.ExecuteNonQueryAsync(ct);
                }

                // ── 2. INSERT cad_eventos con estado=V, cierre inmediato ──────
                long eventoId = _snowflake.NextId();
                await using (var insEvt = conn.CreateCommand())
                {
                    insEvt.Transaction = tx;
                    insEvt.CommandText = @"
INSERT INTO cad_eventos (
    id, sitio_graba, origen,
    pedido_id, pedido_sitio_graba,
    usuario_genera, tipo_despachador,
    estado, fecha_creacion, fecha_cierre
) VALUES (
    @id, @sg, @origen,
    @pedidoId, @pedidoSg,
    @usuario, 'O',
    'V', NOW(), NOW()
)";
                    insEvt.Parameters.AddWithValue("id",       eventoId);
                    insEvt.Parameters.AddWithValue("sg",       d.SITIO_GRABA);
                    insEvt.Parameters.AddWithValue("origen",   string.IsNullOrWhiteSpace(d.Origen)
                                                               ? OrigenEvento.Recepcion : d.Origen);
                    insEvt.Parameters.AddWithValue("pedidoId", d.NUME_LLAMADA);
                    insEvt.Parameters.AddWithValue("pedidoSg", d.SITIO_GRABA);
                    insEvt.Parameters.AddWithValue("usuario",  usuario);
                    await insEvt.ExecuteNonQueryAsync(ct);
                }

                await tx.CommitAsync(ct);
                return new DtoRecepcionResult { Success = true, Message = $"Llamada cerrada. ID: {d.NUME_LLAMADA}" };
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync(ct);
                _logger.LogError(ex, "P_CerrarLlamadaRapida error");
                return new DtoRecepcionResult { Success = false, Message = $"Error al cerrar la llamada: {ex.Message}" };
            }
        }

        // ════════════════════════════════════════════════════════════════════════
        // CONSULTAR EVENTO COMPLETO (con sus códigos de cierre)
        // ════════════════════════════════════════════════════════════════════════

        public async Task<DtoEvento?> G_GetEventoAsync(long eventoId, CancellationToken ct)
        {
            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);

            DtoEvento? evt = null;

            await using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = @"
SELECT e.id, e.sitio_graba, e.origen,
       e.origen_referencia_ext, e.integracion_cliente_id,
       COALESCE(ic.nombre,'')                       AS integracion_nombre,
       e.pedido_id, e.pedido_sitio_graba,
       COALESCE(TO_CHAR(p.hora_caso AT TIME ZONE 'America/Bogota',
                        'DD/MM/YYYY HH24:MI:SS'),'') AS hora_caso_pedido,
       COALESCE(p.dire_caso,'')                     AS direccion_caso,
       COALESCE(p.codi_pedido,'')                   AS codi_pedido,
       COALESCE(p.cali_pedido,'')                   AS cali_pedido,
       e.fuerza_id,
       COALESCE(f.descripcion,'')                   AS fuerza_desc,
       e.canal_codigo,
       COALESCE(c.descripcion,'')                   AS canal_desc,
       e.cedu_empleado, e.usuario_genera, e.tipo_despachador,
       e.estado,
       TO_CHAR(e.fecha_creacion AT TIME ZONE 'America/Bogota',
               'DD/MM/YYYY HH24:MI:SS')             AS fecha_creacion,
       TO_CHAR(e.fecha_despacho AT TIME ZONE 'America/Bogota',
               'DD/MM/YYYY HH24:MI:SS')             AS fecha_despacho,
       TO_CHAR(e.fecha_llegada  AT TIME ZONE 'America/Bogota',
               'DD/MM/YYYY HH24:MI:SS')             AS fecha_llegada,
       TO_CHAR(e.fecha_cierre   AT TIME ZONE 'America/Bogota',
               'DD/MM/YYYY HH24:MI:SS')             AS fecha_cierre,
       e.codigo_cierre_primario, e.clasif_cierre, e.observacion_cierre
FROM   cad_eventos e
LEFT   JOIN cad_integraciones_clientes ic ON ic.id  = e.integracion_cliente_id
LEFT   JOIN cad_pedidos p  ON p.sitio_graba  = e.pedido_sitio_graba
                           AND p.nume_llamada = e.pedido_id
LEFT   JOIN cad_fuerzas f  ON f.id           = e.fuerza_id
LEFT   JOIN cad_canales c  ON c.codigo        = e.canal_codigo
WHERE  e.id = @id";
                cmd.Parameters.AddWithValue("id", eventoId);

                await using var rdr = await cmd.ExecuteReaderAsync(ct);
                if (!await rdr.ReadAsync(ct)) return null;

                evt = new DtoEvento
                {
                    Id                   = rdr.GetInt64(0),
                    SitioGraba           = rdr.GetInt32(1),
                    Origen               = rdr.IsDBNull(2)  ? "" : rdr.GetString(2),
                    OrigenReferenciaExt  = rdr.IsDBNull(3)  ? null : rdr.GetString(3),
                    IntegracionClienteId = rdr.IsDBNull(4)  ? null : rdr.GetInt32(4),
                    IntegracionNombre    = rdr.IsDBNull(5)  ? null : rdr.GetString(5),
                    PedidoId             = rdr.IsDBNull(6)  ? null : rdr.GetInt64(6),
                    PedidoSitioGraba     = rdr.IsDBNull(7)  ? null : rdr.GetInt32(7),
                    HoraCasoPedido       = rdr.IsDBNull(8)  ? "" : rdr.GetString(8),
                    DireccionCaso        = rdr.IsDBNull(9)  ? "" : rdr.GetString(9),
                    CodiPedido           = rdr.IsDBNull(10) ? "" : rdr.GetString(10),
                    CaliPedido           = rdr.IsDBNull(11) ? "" : rdr.GetString(11),
                    FuerzaId             = rdr.IsDBNull(12) ? null : rdr.GetInt32(12),
                    FuerzaDescripcion    = rdr.IsDBNull(13) ? "" : rdr.GetString(13),
                    CanalCodigo          = rdr.IsDBNull(14) ? null : rdr.GetInt32(14),
                    CanalDescripcion     = rdr.IsDBNull(15) ? "" : rdr.GetString(15),
                    CeduEmpleado         = rdr.IsDBNull(16) ? null : rdr.GetString(16),
                    UsuarioGenera        = rdr.IsDBNull(17) ? "" : rdr.GetString(17),
                    TipoDespachador      = rdr.IsDBNull(18) ? null : rdr.GetString(18),
                    Estado               = rdr.IsDBNull(19) ? "" : rdr.GetString(19),
                    FechaCreacion        = rdr.IsDBNull(20) ? "" : rdr.GetString(20),
                    FechaDespacho        = rdr.IsDBNull(21) ? null : rdr.GetString(21),
                    FechaLlegada         = rdr.IsDBNull(22) ? null : rdr.GetString(22),
                    FechaCierre          = rdr.IsDBNull(23) ? null : rdr.GetString(23),
                    CodigoCierrePrimario = rdr.IsDBNull(24) ? null : rdr.GetString(24),
                    ClasifCierre         = rdr.IsDBNull(25) ? null : rdr.GetString(25),
                    ObservacionCierre    = rdr.IsDBNull(26) ? null : rdr.GetString(26)
                };
            }

            // Cargar códigos de cierre asociados
            await using (var cmdCod = conn.CreateCommand())
            {
                cmdCod.CommandText = @"
SELECT orden, codigo_cierre, tipo_codigo, descripcion_libre
FROM   cad_eventos_codigos_cierre
WHERE  evento_id = @id
ORDER  BY orden";
                cmdCod.Parameters.AddWithValue("id", eventoId);
                await using var rdr2 = await cmdCod.ExecuteReaderAsync(ct);
                while (await rdr2.ReadAsync(ct))
                    evt.CodigosCierre.Add(new DtoCodigoCierreEvento
                    {
                        Orden            = rdr2.IsDBNull(0) ? 1  : rdr2.GetInt16(0),
                        CodigoCierre     = rdr2.IsDBNull(1) ? "" : rdr2.GetString(1),
                        TipoCodigo       = rdr2.IsDBNull(2) ? "" : rdr2.GetString(2),
                        DescripcionLibre = rdr2.IsDBNull(3) ? null : rdr2.GetString(3)
                    });
            }

            return evt;
        }

        // ════════════════════════════════════════════════════════════════════════
        // EVENTOS DE UN PEDIDO (para panel de detalle en Recepción o Eventos)
        // ════════════════════════════════════════════════════════════════════════

        public async Task<List<DtoEventoListItem>> G_GetEventosPorPedidoAsync(
            long pedidoId, CancellationToken ct)
        {
            var result = new List<DtoEventoListItem>();
            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);
            await using var cmd  = conn.CreateCommand();
            cmd.CommandText = @"
SELECT e.id, e.origen, e.estado,
       e.pedido_id,
       COALESCE(p.dire_caso,'')  AS direccion_caso,
       COALESCE(p.codi_pedido,'') AS codi_pedido,
       COALESCE(p.cali_pedido,'') AS cali_pedido,
       COALESCE(f.descripcion,'') AS fuerza_desc,
       COALESCE(c.descripcion,'') AS canal_desc,
       TO_CHAR(e.fecha_creacion AT TIME ZONE 'America/Bogota','DD/MM/YYYY HH24:MI:SS'),
       TO_CHAR(e.fecha_despacho AT TIME ZONE 'America/Bogota','DD/MM/YYYY HH24:MI:SS'),
       TO_CHAR(e.fecha_cierre   AT TIME ZONE 'America/Bogota','DD/MM/YYYY HH24:MI:SS')
FROM   cad_eventos e
LEFT   JOIN cad_pedidos p ON p.nume_llamada = e.pedido_id
LEFT   JOIN cad_fuerzas f ON f.id = e.fuerza_id
LEFT   JOIN cad_canales c ON c.codigo = e.canal_codigo
WHERE  e.pedido_id = @pid
ORDER  BY e.fecha_creacion DESC";
            cmd.Parameters.AddWithValue("pid", pedidoId);
            await using var rdr = await cmd.ExecuteReaderAsync(ct);
            while (await rdr.ReadAsync(ct))
                result.Add(new DtoEventoListItem
                {
                    Id            = rdr.GetInt64(0),
                    Origen        = rdr.IsDBNull(1)  ? "" : rdr.GetString(1),
                    Estado        = rdr.IsDBNull(2)  ? "" : rdr.GetString(2),
                    PedidoId      = rdr.IsDBNull(3)  ? null : rdr.GetInt64(3),
                    DireccionCaso = rdr.IsDBNull(4)  ? "" : rdr.GetString(4),
                    CodiPedido    = rdr.IsDBNull(5)  ? "" : rdr.GetString(5),
                    CaliPedido    = rdr.IsDBNull(6)  ? "" : rdr.GetString(6),
                    FuerzaDesc    = rdr.IsDBNull(7)  ? "" : rdr.GetString(7),
                    CanalDesc     = rdr.IsDBNull(8)  ? "" : rdr.GetString(8),
                    FechaCreacion = rdr.IsDBNull(9)  ? "" : rdr.GetString(9),
                    FechaDespacho = rdr.IsDBNull(10) ? null : rdr.GetString(10),
                    FechaCierre   = rdr.IsDBNull(11) ? null : rdr.GetString(11)
                });
            return result;
        }

        // ════════════════════════════════════════════════════════════════════════
        // ACTUALIZAR ESTADO OPERATIVO (Despachado / Atendido)
        // Solo cambia la marca de tiempo y el estado; sin códigos de cierre.
        // ════════════════════════════════════════════════════════════════════════

        public async Task<DtoEventoResult> P_ActualizarEstadoEventoAsync(
            long eventoId, string estado, string usuario, CancellationToken ct)
        {
            if (estado != EstadoEvento.Despachado && estado != EstadoEvento.Atendido)
                return new DtoEventoResult
                {
                    Success  = false,
                    EventoId = eventoId,
                    Message  = $"Estado inválido para actualización de ciclo: '{estado}'. Use D o A."
                };

            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);
            await using var cmd  = conn.CreateCommand();

            // Asignar la columna de timestamp correcta según el estado
            var tsColumn = estado == EstadoEvento.Despachado ? "fecha_despacho" : "fecha_llegada";
            cmd.CommandText = $@"
UPDATE cad_eventos
SET    estado               = @estado,
       {tsColumn}           = NOW(),
       fecha_modificacion   = NOW(),
       usuario_modifica     = @usuario
WHERE  id = @id
  AND  estado NOT IN ('C','V')";    // no se puede reabrir un evento cerrado/anulado

            cmd.Parameters.AddWithValue("estado",  estado);
            cmd.Parameters.AddWithValue("usuario", usuario);
            cmd.Parameters.AddWithValue("id",      eventoId);

            var rows = await cmd.ExecuteNonQueryAsync(ct);
            return new DtoEventoResult
            {
                Success  = rows > 0,
                EventoId = eventoId,
                Message  = rows > 0
                    ? $"Evento {eventoId} actualizado a estado '{estado}'."
                    : $"Evento {eventoId} no encontrado o ya está cerrado."
            };
        }

        // ════════════════════════════════════════════════════════════════════════
        // CERRAR EVENTO CON CÓDIGOS DE CIERRE
        // UPDATE cad_eventos + INSERT cad_eventos_codigos_cierre en una tx.
        // ════════════════════════════════════════════════════════════════════════

        public async Task<DtoEventoResult> P_CerrarEventoAsync(
            DtoCierreEventoRequest req, string usuario, CancellationToken ct)
        {
            if (req.EventoId <= 0)
                return new DtoEventoResult { Success = false, Message = "EventoId inválido." };

            var estadoFinal = req.Estado is EstadoEvento.Cerrado or EstadoEvento.Anulado
                            ? req.Estado : EstadoEvento.Cerrado;

            var codigoPrimario = req.CodigosCierre
                .OrderBy(x => x.Orden)
                .FirstOrDefault()?.CodigoCierre ?? "";

            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);
            await using var tx   = await conn.BeginTransactionAsync(ct);

            try
            {
                // ── UPDATE cad_eventos ────────────────────────────────────────
                await using (var upd = conn.CreateCommand())
                {
                    upd.Transaction = tx;
                    upd.CommandText = @"
UPDATE cad_eventos
SET    estado                = @estado,
       fecha_cierre          = NOW(),
       codigo_cierre_primario= @codPrimario,
       clasif_cierre         = @clasif,
       observacion_cierre    = @obs,
       fecha_modificacion    = NOW(),
       usuario_modifica      = @usuario
WHERE  id = @id
  AND  estado NOT IN ('C','V')";
                    upd.Parameters.AddWithValue("estado",      estadoFinal);
                    upd.Parameters.AddWithValue("codPrimario", NullOrString(codigoPrimario));
                    upd.Parameters.AddWithValue("clasif",      NullOrString(req.ClasifCierre));
                    upd.Parameters.AddWithValue("obs",         NullOrString(req.ObservacionCierre));
                    upd.Parameters.AddWithValue("usuario",     usuario);
                    upd.Parameters.AddWithValue("id",          req.EventoId);
                    var rows = await upd.ExecuteNonQueryAsync(ct);
                    if (rows == 0)
                    {
                        await tx.RollbackAsync(ct);
                        return new DtoEventoResult
                        {
                            Success  = false,
                            EventoId = req.EventoId,
                            Message  = $"Evento {req.EventoId} no encontrado o ya está cerrado/anulado."
                        };
                    }
                }

                // ── Limpiar códigos previos (si se re-cierra por corrección) ──
                await using (var del = conn.CreateCommand())
                {
                    del.Transaction = tx;
                    del.CommandText = "DELETE FROM cad_eventos_codigos_cierre WHERE evento_id = @id";
                    del.Parameters.AddWithValue("id", req.EventoId);
                    await del.ExecuteNonQueryAsync(ct);
                }

                // ── INSERT código(s) de cierre ────────────────────────────────
                foreach (var codigo in req.CodigosCierre.OrderBy(x => x.Orden))
                {
                    await using var insCod = conn.CreateCommand();
                    insCod.Transaction  = tx;
                    insCod.CommandText  = @"
INSERT INTO cad_eventos_codigos_cierre
    (evento_id, orden, codigo_cierre, tipo_codigo, descripcion_libre,
     usuario_registra, fecha_registra)
VALUES
    (@eventoId, @orden, @codigo, @tipo, @desc, @usuario, NOW())";
                    insCod.Parameters.AddWithValue("eventoId", req.EventoId);
                    insCod.Parameters.AddWithValue("orden",    codigo.Orden);
                    insCod.Parameters.AddWithValue("codigo",   codigo.CodigoCierre);
                    insCod.Parameters.AddWithValue("tipo",     string.IsNullOrWhiteSpace(codigo.TipoCodigo)
                                                               ? "CIERRE" : codigo.TipoCodigo);
                    insCod.Parameters.AddWithValue("desc",     NullOrString(codigo.DescripcionLibre));
                    insCod.Parameters.AddWithValue("usuario",  usuario);
                    await insCod.ExecuteNonQueryAsync(ct);
                }

                await tx.CommitAsync(ct);
                return new DtoEventoResult
                {
                    Success  = true,
                    EventoId = req.EventoId,
                    Message  = $"Evento {req.EventoId} cerrado con {req.CodigosCierre.Count} código(s)."
                };
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync(ct);
                _logger.LogError(ex, "P_CerrarEvento error eventoId={Id}", req.EventoId);
                return new DtoEventoResult { Success = false, EventoId = req.EventoId, Message = ex.Message };
            }
        }

        // ════════════════════════════════════════════════════════════════════════
        // CREAR EVENTO DESDE INTEGRACIÓN EXTERNA
        // (app móvil, sistema de cámaras, SIEDCO, otro sistema policial, etc.)
        // Genera un pedido ficticio + un evento en una sola transacción.
        // ════════════════════════════════════════════════════════════════════════

        public async Task<DtoEventoResult> P_CrearEventoIntegracionAsync(
            DtoEventoIntegracionRequest req, string usuario, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(req.DireccionCaso))
                return new DtoEventoResult { Success = false, Message = "La dirección del caso es obligatoria." };
            if (req.SitioGraba <= 0)
                return new DtoEventoResult { Success = false, Message = "SitioGraba inválido." };

            var origenValidos = new[]
            {
                OrigenEvento.AppMovil, OrigenEvento.Integracion,
                OrigenEvento.Interno, OrigenEvento.Siedco
            };
            if (!origenValidos.Contains(req.Origen))
                return new DtoEventoResult { Success = false,
                    Message = $"Origen '{req.Origen}' inválido para integración. " +
                              $"Use: {string.Join(", ", origenValidos)}" };

            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);
            await using var tx   = await conn.BeginTransactionAsync(ct);

            try
            {
                long pedidoId = _snowflake.NextId();
                long eventoId = _snowflake.NextId();

                // ── INSERT cad_pedidos (registro mínimo de origen externo) ────
                await using (var ins = conn.CreateCommand())
                {
                    ins.Transaction = tx;
                    ins.CommandText = @"
INSERT INTO cad_pedidos
    (sitio_graba, nume_llamada, hora_caso, fech_caso,
     dire_caso, barrio, ciudad,
     latitud_caso, longitud_caso,
     comentario, codi_pedido, cali_pedido,
     nomb_llamante, nume_telefono,
     importancia, prioridad,
     estado, enviar, cadusua_usuario,
     fecha_creacion, total_canales)
VALUES
    (@sg, @id, NOW(), NOW(),
     @dir, @barrio, @ciudad,
     @lat, @lon,
     @coment, @codi, @cali,
     @nomb, @tel,
     '01', '01',
     'A', 'N', @usuario,
     NOW(), 'N')";
                    ins.Parameters.AddWithValue("sg",      req.SitioGraba);
                    ins.Parameters.AddWithValue("id",      pedidoId);
                    ins.Parameters.AddWithValue("dir",     req.DireccionCaso);
                    ins.Parameters.AddWithValue("barrio",  NullOrString(req.Barrio));
                    ins.Parameters.AddWithValue("ciudad",  NullOrString(req.Ciudad));
                    ins.Parameters.AddWithValue("lat",     NullOrString(req.LatitudCaso));
                    ins.Parameters.AddWithValue("lon",     NullOrString(req.LongitudCaso));
                    ins.Parameters.AddWithValue("coment",  NullOrString(req.Comentario));
                    ins.Parameters.AddWithValue("codi",    NullOrString(req.CodiPedido));
                    ins.Parameters.AddWithValue("cali",    NullOrString(req.CaliPedido));
                    ins.Parameters.AddWithValue("nomb",    NullOrString(req.NombReportante));
                    ins.Parameters.AddWithValue("tel",     string.IsNullOrWhiteSpace(req.TelefonoReportante)
                                                           ? (object)DBNull.Value
                                                           : (long.TryParse(req.TelefonoReportante,
                                                                            out var tel) ? tel : (object)DBNull.Value));
                    ins.Parameters.AddWithValue("usuario", usuario);
                    await ins.ExecuteNonQueryAsync(ct);
                }

                // ── INSERT cad_eventos ────────────────────────────────────────
                await using (var insEvt = conn.CreateCommand())
                {
                    insEvt.Transaction = tx;
                    insEvt.CommandText = @"
INSERT INTO cad_eventos (
    id, sitio_graba, origen,
    integracion_cliente_id, origen_referencia_ext,
    pedido_id, pedido_sitio_graba,
    usuario_genera, tipo_despachador,
    estado, fecha_creacion
) VALUES (
    @id, @sg, @origen,
    @clienteId, @refExt,
    @pedidoId, @pedidoSg,
    @usuario, 'S',
    'P', NOW()
)";
                    insEvt.Parameters.AddWithValue("id",        eventoId);
                    insEvt.Parameters.AddWithValue("sg",        req.SitioGraba);
                    insEvt.Parameters.AddWithValue("origen",    req.Origen);
                    insEvt.Parameters.AddWithValue("clienteId", req.IntegracionClienteId == 0
                                                                ? (object)DBNull.Value
                                                                : req.IntegracionClienteId);
                    insEvt.Parameters.AddWithValue("refExt",    NullOrString(req.OrigenReferenciaExt));
                    insEvt.Parameters.AddWithValue("pedidoId",  pedidoId);
                    insEvt.Parameters.AddWithValue("pedidoSg",  req.SitioGraba);
                    insEvt.Parameters.AddWithValue("usuario",   usuario);
                    await insEvt.ExecuteNonQueryAsync(ct);
                }

                await tx.CommitAsync(ct);
                return new DtoEventoResult
                {
                    Success  = true,
                    EventoId = eventoId,
                    PedidoId = pedidoId,
                    Message  = $"Evento {eventoId} creado desde integración '{req.Origen}'."
                };
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync(ct);
                _logger.LogError(ex, "P_CrearEventoIntegracion error");
                return new DtoEventoResult { Success = false, Message = ex.Message };
            }
        }

        // ════════════════════════════════════════════════════════════════════════
        // PRIVATE HELPERS
        // ════════════════════════════════════════════════════════════════════════

        private static object NullOrString(string? value) =>
            string.IsNullOrWhiteSpace(value) ? DBNull.Value : value;

        /// <summary>
        /// 4-level barrio lookup (mirrors Oracle SP strategy).
        /// Returns (codiBarrio, lugeBarrio, notFound).
        /// </summary>
        private static async Task<(int codiBarrio, int lugeBarrio, bool notFound)> BuscarBarrioAsync(
            NpgsqlConnection conn, NpgsqlTransaction tx,
            int sitioGraba, string barrio, string ciudad, CancellationToken ct)
        {
            var barrioCleaned = (barrio ?? "").Trim().ToUpper();

            var (c1, l1) = await BarrioQuery(conn, tx, @"
SELECT codigo, luge_codigo FROM cad_barrios
WHERE  luge_codigo = @sg AND TRIM(UPPER(descripcion)) = @b LIMIT 1",
                new[] { ("sg", (object)sitioGraba), ("b", barrioCleaned) }, ct);
            if (c1 > 0) return (c1, l1, false);

            var words = barrioCleaned.Replace("BARRIO ", "").Trim()
                                     .Split(' ', StringSplitOptions.RemoveEmptyEntries);
            if (words.Length > 0)
            {
                var sql2   = "SELECT codigo, luge_codigo FROM cad_barrios WHERE luge_codigo = @sg";
                var parms2 = new List<(string, object)> { ("sg", (object)sitioGraba) };
                for (var i = 0; i < words.Length; i++)
                {
                    sql2 += $" AND UPPER(descripcion) LIKE '%' || @w{i} || '%'";
                    parms2.Add(($"w{i}", words[i]));
                }
                sql2 += " LIMIT 1";
                var (c2, l2) = await BarrioQuery(conn, tx, sql2, parms2.ToArray(), ct);
                if (c2 > 0) return (c2, l2, false);
            }

            var ciudadUpper = (ciudad ?? "").ToUpper();
            var (c3, l3) = await BarrioQuery(conn, tx, @"
SELECT b.codigo, b.luge_codigo FROM cad_barrios b
JOIN   cad_lugares_geograficos l ON b.luge_codigo = l.codigo
WHERE  UPPER(l.descripcion) LIKE '%' || @c || '%'
  AND  TRIM(UPPER(b.descripcion)) = @b LIMIT 1",
                new[] { ("c", (object)ciudadUpper), ("b", barrioCleaned) }, ct);
            if (c3 > 0) return (c3, l3, false);

            if (words.Length > 0)
            {
                var sql4 = @"
SELECT b.codigo, b.luge_codigo FROM cad_barrios b
JOIN   cad_lugares_geograficos l ON b.luge_codigo = l.codigo
WHERE  UPPER(l.descripcion) LIKE '%' || @c || '%'";
                var parms4 = new List<(string, object)> { ("c", (object)ciudadUpper) };
                for (var i = 0; i < words.Length; i++)
                {
                    sql4 += $" AND UPPER(b.descripcion) LIKE '%' || @w{i} || '%'";
                    parms4.Add(($"w{i}", words[i]));
                }
                sql4 += " LIMIT 1";
                var (c4, l4) = await BarrioQuery(conn, tx, sql4, parms4.ToArray(), ct);
                if (c4 > 0) return (c4, l4, false);
            }

            return (sitioGraba, sitioGraba, true);
        }

        private static async Task<(int code, int luge)> BarrioQuery(
            NpgsqlConnection conn, NpgsqlTransaction tx, string sql,
            (string name, object value)[] parms, CancellationToken ct)
        {
            await using var cmd = conn.CreateCommand();
            cmd.Transaction = tx;
            cmd.CommandText = sql;
            foreach (var (name, value) in parms)
                cmd.Parameters.AddWithValue(name, value);
            await using var rdr = await cmd.ExecuteReaderAsync(ct);
            if (!await rdr.ReadAsync(ct)) return (0, 0);
            return (rdr.IsDBNull(0) ? 0 : rdr.GetInt32(0),
                    rdr.IsDBNull(1) ? 0 : rdr.GetInt32(1));
        }
    }
}

using Comun.Dtos.Recepcion;
using Datos.Interfaz;
using Datos.Tenant;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace Datos.Gestion
{
    public class DbRecepcionRepository : IDbRecepcionRepository
    {
        private readonly TenantContext _tenant;
        private readonly ILogger<DbRecepcionRepository> _logger;

        // Format used by the original SECAD JS (obtenerFechaActual / txtFechaIngreso)
        private const string HoraFormat = "dd/MM/yyyy HH:mm:ss";

        public DbRecepcionRepository(TenantContext tenant, ILogger<DbRecepcionRepository> logger)
        {
            _tenant = tenant;
            _logger = logger;
        }

        // ── CTI Poll ────────────────────────────────────────────────────────────

        public async Task<DtoLlamadaEntrante?> F_GetLlamadasAsync(int sitioGraba, int acd, CancellationToken ct)
        {
            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);

            long numeTelefono = 0;

            // Read first unregistered call
            await using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = @"
                                    SELECT id, nume_telefono
                                    FROM cad_interfaz_cti
                                    WHERE sitio_graba = @sg AND acd = @acd AND registrada = 'N'
                                    ORDER BY fecha_registro ASC
                                    LIMIT 1";
                cmd.Parameters.AddWithValue("sg",  sitioGraba);
                cmd.Parameters.AddWithValue("acd", acd);

                await using var rdr = await cmd.ExecuteReaderAsync(ct);
                if (!await rdr.ReadAsync(ct)) return null;   // no incoming call
                numeTelefono = rdr.IsDBNull(1) ? 0 : rdr.GetInt64(1);
            }

            if (numeTelefono == 0) return null;

            // Allocate sequence number
            long numeLlamada = await F_ConsultarSeqPedidoAsync(ct);

            // Mark as registered
            await using (var upd = conn.CreateCommand())
            {
                upd.CommandText = @"
UPDATE cad_interfaz_cti
SET registrada = 'S'
WHERE sitio_graba = @sg AND acd = @acd AND registrada = 'N'";
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

        // ── Sequence ────────────────────────────────────────────────────────────

        public async Task<long> F_ConsultarSeqPedidoAsync(CancellationToken ct)
        {
            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);
            await using var cmd  = conn.CreateCommand();
            cmd.CommandText = "SELECT nextval('seq_pedidos')";
            var obj = await cmd.ExecuteScalarAsync(ct);
            return obj is null || obj == DBNull.Value ? 0 : Convert.ToInt64(obj);
        }

        // ── Case search ─────────────────────────────────────────────────────────

        public async Task<List<DtoCasoItem>> F_GetCasosIntelAsync(string busqueda, CancellationToken ct)
        {
            var result = new List<DtoCasoItem>();
            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);
            await using var cmd  = conn.CreateCommand();
            cmd.CommandText = @"
SELECT codigo AS CODIGO_CASO, descripcion AS DESCRIPCION_CASO
FROM cad_casos
WHERE (UPPER(codigo) LIKE '%' || UPPER(@b) || '%'
    OR UPPER(descripcion) LIKE '%' || UPPER(@b) || '%')
  AND vigente = 'S'
ORDER BY descripcion
LIMIT 50";
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

        public async Task<DtoCasoItem?> F_GetCasoPorCodigoAsync(string codigo, CancellationToken ct)
        {
            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);
            await using var cmd  = conn.CreateCommand();
            cmd.CommandText = @"
SELECT codigo AS CODIGO_CASO, descripcion AS DESCRIPCION_CASO
FROM cad_casos
WHERE UPPER(codigo) = UPPER(@c)
LIMIT 1";
            cmd.Parameters.AddWithValue("c", codigo ?? "");
            await using var rdr = await cmd.ExecuteReaderAsync(ct);
            if (!await rdr.ReadAsync(ct)) return null;
            return new DtoCasoItem
            {
                CODIGO_CASO      = rdr.IsDBNull(0) ? "" : rdr.GetString(0),
                DESCRIPCION_CASO = rdr.IsDBNull(1) ? "" : rdr.GetString(1)
            };
        }

        // ── Channels ────────────────────────────────────────────────────────────

        public async Task<List<DtoCanalRecepcion>> F_GetCanalesAsync(int sitioGraba, CancellationToken ct)
        {
            var result = new List<DtoCanalRecepcion>();
            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);
            await using var cmd  = conn.CreateCommand();
            cmd.CommandText = @"
SELECT r.codigo AS Codigo, r.descripcion AS Descripcion, f.descripcion AS Fuerza
FROM cad_canales r
JOIN cad_fuerzas f ON r.cadfuerz_id = f.id
WHERE f.sitio_graba = @sg
  AND r.vigente = 'S'
ORDER BY r.descripcion ASC";
            cmd.Parameters.AddWithValue("sg", sitioGraba);
            await using var rdr = await cmd.ExecuteReaderAsync(ct);
            while (await rdr.ReadAsync(ct))
                result.Add(new DtoCanalRecepcion
                {
                    Codigo      = rdr.IsDBNull(0) ? 0 : rdr.GetInt32(0),
                    Descripcion = rdr.IsDBNull(1) ? "" : rdr.GetString(1),
                    Fuerza      = rdr.IsDBNull(2) ? "" : rdr.GetString(2)
                });
            return result;
        }

        // ── References ──────────────────────────────────────────────────────────

        public async Task<List<DtoReferenciaSecad>> F_GetReferenciasAsync(string nombre, CancellationToken ct)
        {
            var result = new List<DtoReferenciaSecad>();
            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);
            await using var cmd  = conn.CreateCommand();
            cmd.CommandText = @"
SELECT nombre, codigo, descripcion, COALESCE(abreviatura,'') AS abreviatura
FROM cad_referencias_secad
WHERE nombre = @n
ORDER BY descripcion";
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

        // ── Associate-call search ────────────────────────────────────────────────

        public async Task<List<DtoLlamadaAsociar>> F_BuscarLlamadasAsociarAsync(
            int sitioGraba, string horaCaso, long numeLlamada, CancellationToken ct)
        {
            var result = new List<DtoLlamadaAsociar>();

            // Parse horaCaso (dd/MM/yyyy HH:mm:ss) ─────────────────────────────
            if (!DateTime.TryParseExact(horaCaso, HoraFormat,
                    System.Globalization.CultureInfo.InvariantCulture,
                    System.Globalization.DateTimeStyles.None, out var fechaRef))
            {
                fechaRef = DateTime.UtcNow;
            }

            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);
            await using var cmd  = conn.CreateCommand();
            cmd.CommandText = @"
SELECT a.nume_llamada,
       TO_CHAR(a.hora_caso AT TIME ZONE 'America/Bogota', 'DD/MM/YYYY HH24:MI:SS') AS hora_caso,
       a.nume_telefono,
       COALESCE(a.cali_pedido,'')       AS cali_pedido,
       COALESCE(l.descripcion,'')       AS ciudad,
       COALESCE(a.nomb_llamante,'')     AS nomb_llamante,
       COALESCE(a.dire_caso,'')         AS dire_caso,
       COALESCE(a.codi_pedido,'')       AS codi_pedido,
       COALESCE(a.estado,'')            AS estado,
       a.sitio_graba
FROM cad_pedidos a
LEFT JOIN cad_lugares_geograficos l ON l.codigo = a.luge_codigo
WHERE a.sitio_graba = @sg
  AND COALESCE(TRIM(a.codi_pedido),'0') <> '900'
  AND a.hora_caso <= @ref
  AND a.hora_caso > @ref - INTERVAL '200 minutes'
  AND a.cadpedi_nume_llamada IS NULL
  AND a.nume_llamada <> @id
ORDER BY a.hora_caso DESC";

            cmd.Parameters.AddWithValue("sg",  sitioGraba);
            cmd.Parameters.AddWithValue("ref", fechaRef);
            cmd.Parameters.AddWithValue("id",  numeLlamada);

            await using var rdr = await cmd.ExecuteReaderAsync(ct);
            while (await rdr.ReadAsync(ct))
                result.Add(new DtoLlamadaAsociar
                {
                    NUME_LLAMADA  = rdr.IsDBNull(0) ? 0   : rdr.GetInt64(0),
                    HORA_CASO     = rdr.IsDBNull(1) ? ""  : rdr.GetString(1),
                    NUME_TELEFONO = rdr.IsDBNull(2) ? 0   : rdr.GetInt64(2),
                    CALI_PEDIDO   = rdr.IsDBNull(3) ? ""  : rdr.GetString(3),
                    CIUDAD        = rdr.IsDBNull(4) ? ""  : rdr.GetString(4),
                    NOMB_LLAMANTE = rdr.IsDBNull(5) ? ""  : rdr.GetString(5),
                    DIRE_CASO     = rdr.IsDBNull(6) ? ""  : rdr.GetString(6),
                    CODI_PEDIDO   = rdr.IsDBNull(7) ? ""  : rdr.GetString(7),
                    ESTADO        = rdr.IsDBNull(8) ? ""  : rdr.GetString(8),
                    SITIO_GRABA   = rdr.IsDBNull(9) ? 0   : rdr.GetInt32(9)
                });
            return result;
        }

        // ── Save full reception call ─────────────────────────────────────────────

        public async Task<DtoRecepcionResult> P_GuardarLlamadaAsync(
            DtoRecepcion d, int canalFuerza, string usuario, long idEmpleado, CancellationToken ct)
        {
            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);
            await using var tx   = await conn.BeginTransactionAsync(ct);

            try
            {
                // ── Barrio lookup (4-level fallback, matching Oracle SP) ──────────
                var (codiBarrio, lugeBarrio, barrioNoEncontrado) =
                    await BuscarBarrioAsync(conn, tx, d.SITIO_GRABA, d.BARRIO, d.CIUDAD, ct);

                // ── Parse horaCaso ────────────────────────────────────────────────
                DateTime.TryParseExact(d.HORA_CASO, HoraFormat,
                    System.Globalization.CultureInfo.InvariantCulture,
                    System.Globalization.DateTimeStyles.None, out var horaCaso);

                // ── INSERT cad_pedidos ────────────────────────────────────────────
                await using (var ins = conn.CreateCommand())
                {
                    ins.Transaction  = tx;
                    ins.CommandText  = @"
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
                    ins.Parameters.AddWithValue("cadiNum",  string.IsNullOrWhiteSpace(d.CADPEDI_NUME_LLAMADA) ? (object)DBNull.Value : Convert.ToInt64(d.CADPEDI_NUME_LLAMADA));
                    ins.Parameters.AddWithValue("barrio",   NullOrString(d.BARRIO));
                    ins.Parameters.AddWithValue("ciudad",   NullOrString(d.CIUDAD));

                    await ins.ExecuteNonQueryAsync(ct);
                }

                // ── Get next event number ─────────────────────────────────────────
                long numeEvento = 0;
                await using (var seqCmd = conn.CreateCommand())
                {
                    seqCmd.Transaction  = tx;
                    seqCmd.CommandText  = "SELECT nextval('seq_eventos')";
                    var obj = await seqCmd.ExecuteScalarAsync(ct);
                    numeEvento = obj is null || obj == DBNull.Value ? 0 : Convert.ToInt64(obj);
                }

                // ── INSERT cad_pedidos_canales for each selected channel ───────────
                foreach (var canal in d.CANALES_SELECCIONADOS)
                {
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

        // ── Quick-close ─────────────────────────────────────────────────────────

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

                await using var ins = conn.CreateCommand();
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
                await tx.CommitAsync(ct);

                return new DtoRecepcionResult
                {
                    Success = true,
                    Message = $"Llamada cerrada. ID: {d.NUME_LLAMADA}"
                };
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync(ct);
                _logger.LogError(ex, "P_CerrarLlamadaRapida error");
                return new DtoRecepcionResult { Success = false, Message = $"Error al cerrar la llamada: {ex.Message}" };
            }
        }

        // ── Private helpers ──────────────────────────────────────────────────────

        private static object NullOrString(string? value) =>
            string.IsNullOrWhiteSpace(value) ? DBNull.Value : value;

        /// <summary>
        /// 4-level barrio lookup (mirrors Oracle SP strategy).
        /// Returns (codiBarrio, lugeBarrio, notFound).
        /// </summary>
        private static async Task<(int codiBarrio, int lugeBarrio, bool notFound)> BuscarBarrioAsync(
            NpgsqlConnection conn, NpgsqlTransaction tx, int sitioGraba, string barrio, string ciudad, CancellationToken ct)
        {
            var barrioCleaned = (barrio ?? "").Trim().ToUpper();

            // ── Strategy 1: exact match by site ──────────────────────────────────
            var (c1, l1) = await BarrioQuery(conn, tx, @"
SELECT codigo, luge_codigo FROM cad_barrios
WHERE luge_codigo = @sg AND TRIM(UPPER(descripcion)) = @b LIMIT 1",
                new[] { ("sg", (object)sitioGraba), ("b", barrioCleaned) }, ct);

            if (c1 > 0) return (c1, l1, false);

            // ── Strategy 2: flexible by site (word LIKE) ─────────────────────────
            var words = barrioCleaned.Replace("BARRIO ", "").Trim()
                                     .Split(' ', StringSplitOptions.RemoveEmptyEntries);
            if (words.Length > 0)
            {
                var sql2 = "SELECT codigo, luge_codigo FROM cad_barrios WHERE luge_codigo = @sg";
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

            // ── Strategy 3: exact by city ─────────────────────────────────────────
            var ciudadUpper = (ciudad ?? "").ToUpper();
            var (c3, l3) = await BarrioQuery(conn, tx, @"
SELECT b.codigo, b.luge_codigo FROM cad_barrios b
JOIN cad_lugares_geograficos l ON b.luge_codigo = l.codigo
WHERE UPPER(l.descripcion) LIKE '%' || @c || '%'
  AND TRIM(UPPER(b.descripcion)) = @b LIMIT 1",
                new[] { ("c", (object)ciudadUpper), ("b", barrioCleaned) }, ct);

            if (c3 > 0) return (c3, l3, false);

            // ── Strategy 4: flexible by city ──────────────────────────────────────
            if (words.Length > 0)
            {
                var sql4 = @"
SELECT b.codigo, b.luge_codigo FROM cad_barrios b
JOIN cad_lugares_geograficos l ON b.luge_codigo = l.codigo
WHERE UPPER(l.descripcion) LIKE '%' || @c || '%'";
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

            // ── Fallback: use sitio_graba as surrogate ────────────────────────────
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

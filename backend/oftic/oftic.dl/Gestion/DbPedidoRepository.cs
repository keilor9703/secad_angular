using Comun.Dtos.Incidentes;
using Datos.Interfaz;
using Datos.Tenant;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace Datos.Gestion
{
    public class DbPedidoRepository : IDbPedidoRepository
    {
        private readonly TenantContext _tenant;
        private readonly ILogger<DbPedidoRepository> _logger;

        public DbPedidoRepository(TenantContext tenant, ILogger<DbPedidoRepository> logger)
        {
            _tenant = tenant;
            _logger = logger;
        }

        // ─── Queries ──────────────────────────────────────────────────────────

        public async Task<List<DtoPedidoListItem>> GetListAsync(string? estado, int? sitioGraba, CancellationToken ct)
        {
            var result = new List<DtoPedidoListItem>();
            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);
            await using var cmd = conn.CreateCommand();

            var sql = @"
SELECT p.id, p.sitio_graba, p.nume_llamada, p.hora_caso,
       p.nume_telefono, p.dire_caso, p.estado, p.enviar,
       p.codi_pedido, p.codi_pedido2, p.comentario,
       u.username AS username_creacion, p.fecha_creacion
FROM cad_pedidos p
LEFT JOIN ctr_usuarios u ON u.id_usuario = p.usuario_creacion
WHERE 1=1";

            if (!string.IsNullOrWhiteSpace(estado))
                sql += " AND p.estado = @estado";
            if (sitioGraba.HasValue)
                sql += " AND p.sitio_graba = @sitioGraba";

            sql += " ORDER BY p.hora_caso DESC LIMIT 500";

            cmd.CommandText = sql;
            if (!string.IsNullOrWhiteSpace(estado))
                cmd.Parameters.AddWithValue("estado", estado);
            if (sitioGraba.HasValue)
                cmd.Parameters.AddWithValue("sitioGraba", sitioGraba.Value);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
                result.Add(MapListItem(reader));

            return result;
        }

        public async Task<DtoPedidoDetalle?> GetByIdAsync(long id, CancellationToken ct)
        {
            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = @"
SELECT p.id, p.sitio_graba, p.nume_llamada, p.hora_caso,
       p.nume_telefono, p.prop_telefono, p.nomb_llamante,
       p.barrio, p.ciudad, p.dire_llamante, p.dire_caso,
       p.latitud_caso, p.longitud_caso, p.cordx, p.cordy,
       p.tiposhape, p.radio, p.comentario,
       p.codi_pedido, p.codi_pedido2, p.tipo_pedido, p.cali_pedido,
       p.importancia, p.prioridad, p.disp_telefonico, p.celda_marcacion,
       p.canales, p.canal_fuerza, p.enviar, p.estado,
       p.pedido_padre_sitio, p.pedido_padre_num,
       u.username AS username_creacion, p.fecha_creacion
FROM cad_pedidos p
LEFT JOIN ctr_usuarios u ON u.id_usuario = p.usuario_creacion
WHERE p.id = @id";
            cmd.Parameters.AddWithValue("id", id);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            if (!await reader.ReadAsync(ct))
                return null;

            var item = MapDetalle(reader);
            await reader.CloseAsync();

            item.Anotaciones = await GetAnotacionesAsync(id, ct);
            return item;
        }

        // ─── Mutations ────────────────────────────────────────────────────────

        public async Task<DtoPedidoResult> CreateAsync(DtoPedidoRequest req, long usuario, string maquina, CancellationToken ct)
        {
            var result = new DtoPedidoResult();
            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);

            try
            {
                await using var cmd = conn.CreateCommand();
                cmd.Transaction = tx;
                cmd.CommandText = @"
INSERT INTO cad_pedidos
    (sitio_graba, nume_llamada, hora_caso, nume_telefono, prop_telefono,
     nomb_llamante, barrio, ciudad, dire_llamante, dire_caso,
     latitud_caso, longitud_caso, cordx, cordy, tiposhape, radio,
     comentario, codi_pedido, codi_pedido2, tipo_pedido, cali_pedido,
     importancia, prioridad, disp_telefonico, celda_marcacion,
     canales, canal_fuerza, enviar, estado,
     pedido_padre_sitio, pedido_padre_num,
     usuario_creacion, fecha_creacion, maquina_creacion)
VALUES
    (@sitioGraba, @numeLlamada, @horaCaso, @numeTelefono, @propTelefono,
     @nombLlamante, @barrio, @ciudad, @direLlamante, @direCaso,
     @latitudCaso, @longitudCaso, @cordx, @cordy, @tiposhape, @radio,
     @comentario, @codiPedido, @codiPedido2, @tipoPedido, @caliPedido,
     @importancia, @prioridad, @dispTelefonico, @celdaMarcacion,
     @canales, @canalFuerza, @enviar, @estado,
     @pedidoPadreSitio, @pedidoPadreNum,
     @usuario, NOW(), @maquina)
RETURNING id";

                BindPedidoParams(cmd, req, usuario, maquina);

                result.Id = Convert.ToInt64(await cmd.ExecuteScalarAsync(ct));
                result.Success = true;
                result.Message = "Caso registrado exitosamente.";
                await tx.CommitAsync(ct);
                _logger.LogInformation("Pedido creado ID={Id}", result.Id);
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync(ct);
                result.Success = false;
                result.Message = $"Error: {ex.Message}";
                _logger.LogError(ex, "Error creando pedido");
            }

            return result;
        }

        public async Task<DtoPedidoResult> UpdateAsync(long id, DtoPedidoRequest req, long usuario, string maquina, CancellationToken ct)
        {
            var result = new DtoPedidoResult();
            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);

            try
            {
                await using var cmd = conn.CreateCommand();
                cmd.Transaction = tx;
                cmd.CommandText = @"
UPDATE cad_pedidos SET
    sitio_graba = @sitioGraba, nume_llamada = @numeLlamada,
    hora_caso = @horaCaso, nume_telefono = @numeTelefono,
    prop_telefono = @propTelefono, nomb_llamante = @nombLlamante,
    barrio = @barrio, ciudad = @ciudad,
    dire_llamante = @direLlamante, dire_caso = @direCaso,
    latitud_caso = @latitudCaso, longitud_caso = @longitudCaso,
    cordx = @cordx, cordy = @cordy, tiposhape = @tiposhape, radio = @radio,
    comentario = @comentario, codi_pedido = @codiPedido,
    codi_pedido2 = @codiPedido2, tipo_pedido = @tipoPedido,
    cali_pedido = @caliPedido, importancia = @importancia,
    prioridad = @prioridad, disp_telefonico = @dispTelefonico,
    celda_marcacion = @celdaMarcacion, canales = @canales,
    canal_fuerza = @canalFuerza, enviar = @enviar, estado = @estado,
    pedido_padre_sitio = @pedidoPadreSitio, pedido_padre_num = @pedidoPadreNum,
    usuario_modifica = @usuario, fecha_modifica = NOW(), maquina_modifica = @maquina
WHERE id = @id";

                BindPedidoParams(cmd, req, usuario, maquina);
                cmd.Parameters.AddWithValue("id", id);

                var rows = await cmd.ExecuteNonQueryAsync(ct);
                result.Success = rows > 0;
                result.Message = rows > 0 ? "Caso actualizado exitosamente." : "Caso no encontrado.";
                result.Id = id;

                if (result.Success) await tx.CommitAsync(ct);
                else await tx.RollbackAsync(ct);
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync(ct);
                result.Success = false;
                result.Message = $"Error: {ex.Message}";
                _logger.LogError(ex, "Error actualizando pedido id={Id}", id);
            }

            return result;
        }

        public async Task<DtoPedidoResult> CerrarRapidoAsync(long id, DtoCerrarRapidoRequest req, long usuario, string maquina, CancellationToken ct)
        {
            var result = new DtoPedidoResult();
            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);

            try
            {
                await using var cmd = conn.CreateCommand();
                cmd.Transaction = tx;
                cmd.CommandText = @"
UPDATE cad_pedidos SET
    comentario       = @comentario,
    codi_pedido      = @codiPedido,
    estado           = 'C',
    enviar           = @enviar,
    usuario_modifica = @usuario,
    fecha_modifica   = NOW(),
    maquina_modifica = @maquina
WHERE id = @id";

                cmd.Parameters.AddWithValue("comentario", (object?)req.Comentario ?? DBNull.Value);
                cmd.Parameters.AddWithValue("codiPedido", (object?)req.CodiPedido ?? DBNull.Value);
                cmd.Parameters.AddWithValue("enviar", string.IsNullOrWhiteSpace(req.Enviar) ? "N" : req.Enviar);
                cmd.Parameters.AddWithValue("usuario", usuario);
                cmd.Parameters.AddWithValue("maquina", Truncate(maquina, 100));
                cmd.Parameters.AddWithValue("id", id);

                var rows = await cmd.ExecuteNonQueryAsync(ct);
                result.Success = rows > 0;
                result.Message = rows > 0 ? "Caso cerrado exitosamente." : "Caso no encontrado.";
                result.Id = id;

                if (result.Success) await tx.CommitAsync(ct);
                else await tx.RollbackAsync(ct);
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync(ct);
                result.Success = false;
                result.Message = $"Error: {ex.Message}";
                _logger.LogError(ex, "Error cerrando pedido id={Id}", id);
            }

            return result;
        }

        public async Task<DtoPedidoResult> SetEstadoAsync(long id, string estado, long usuario, string maquina, CancellationToken ct)
        {
            var result = new DtoPedidoResult();
            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);

            try
            {
                await using var cmd = conn.CreateCommand();
                cmd.Transaction = tx;
                cmd.CommandText = @"
UPDATE cad_pedidos SET
    estado           = @estado,
    usuario_modifica = @usuario,
    fecha_modifica   = NOW(),
    maquina_modifica = @maquina
WHERE id = @id";

                cmd.Parameters.AddWithValue("estado", Truncate(estado, 20));
                cmd.Parameters.AddWithValue("usuario", usuario);
                cmd.Parameters.AddWithValue("maquina", Truncate(maquina, 100));
                cmd.Parameters.AddWithValue("id", id);

                var rows = await cmd.ExecuteNonQueryAsync(ct);
                result.Success = rows > 0;
                result.Message = rows > 0 ? "Estado actualizado." : "Caso no encontrado.";
                result.Id = id;

                if (result.Success) await tx.CommitAsync(ct);
                else await tx.RollbackAsync(ct);
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync(ct);
                result.Success = false;
                result.Message = $"Error: {ex.Message}";
                _logger.LogError(ex, "Error actualizando estado pedido id={Id}", id);
            }

            return result;
        }

        // ─── Annotations ──────────────────────────────────────────────────────

        public async Task<List<DtoAnotacion>> GetAnotacionesAsync(long idPedido, CancellationToken ct)
        {
            var result = new List<DtoAnotacion>();
            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = @"
SELECT id, id_pedido, titulo, anotacion, tipo_anotacion,
       usuario_creacion, username_creacion, fecha_creacion, maquina_creacion
FROM cad_anotaciones
WHERE id_pedido = @idPedido
ORDER BY fecha_creacion DESC";
            cmd.Parameters.AddWithValue("idPedido", idPedido);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
                result.Add(MapAnotacion(reader));

            return result;
        }

        public async Task<DtoPedidoResult> CreateAnotacionAsync(long idPedido, DtoAnotacionRequest req, long usuario, string username, string maquina, CancellationToken ct)
        {
            var result = new DtoPedidoResult();
            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);
            await using var tx = await conn.BeginTransactionAsync(ct);

            try
            {
                await using var cmd = conn.CreateCommand();
                cmd.Transaction = tx;
                cmd.CommandText = @"
INSERT INTO cad_anotaciones
    (id_pedido, titulo, anotacion, tipo_anotacion,
     usuario_creacion, username_creacion, fecha_creacion, maquina_creacion)
VALUES
    (@idPedido, @titulo, @anotacion, @tipoAnotacion,
     @usuario, @username, NOW(), @maquina)
RETURNING id";

                cmd.Parameters.AddWithValue("idPedido", idPedido);
                cmd.Parameters.AddWithValue("titulo", Truncate(req.Titulo, 200));
                cmd.Parameters.AddWithValue("anotacion", (object?)req.Anotacion ?? DBNull.Value);
                cmd.Parameters.AddWithValue("tipoAnotacion", Truncate(req.TipoAnotacion, 50));
                cmd.Parameters.AddWithValue("usuario", usuario);
                cmd.Parameters.AddWithValue("username", Truncate(username, 100));
                cmd.Parameters.AddWithValue("maquina", Truncate(maquina, 100));

                result.Id = Convert.ToInt64(await cmd.ExecuteScalarAsync(ct));
                result.Success = true;
                result.Message = "Anotación registrada.";
                await tx.CommitAsync(ct);
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync(ct);
                result.Success = false;
                result.Message = $"Error: {ex.Message}";
                _logger.LogError(ex, "Error creando anotacion para pedido id={Id}", idPedido);
            }

            return result;
        }

        public async Task<List<DtoPedidoAsociar>> BuscarParaAsociarAsync(int sitioGraba, CancellationToken ct)
        {
            var result = new List<DtoPedidoAsociar>();
            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = @"
SELECT id, nume_llamada, hora_caso, nume_telefono, cali_pedido,
       ciudad, nomb_llamante, dire_caso, codi_pedido, estado, sitio_graba
FROM cad_pedidos
WHERE sitio_graba = @sitioGraba
  AND estado = 'A'
ORDER BY hora_caso DESC
LIMIT 50";
            cmd.Parameters.AddWithValue("sitioGraba", sitioGraba);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
                result.Add(MapAsociar(reader));

            return result;
        }

        // ─── Eventos (dispatcher queue) ──────────────────────────────────────

        public async Task<List<DtoEventoListItem>> GetEventosByCanalAsync(
            int canalCodigo, int fuerzaId, string? estado, CancellationToken ct)
        {
            var result = new List<DtoEventoListItem>();
            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);
            await using var cmd  = conn.CreateCommand();

            // Filter: record must have been sent to dispatch (enviar='S')
            // and the canal must appear in cad_pedidos_canales OR in the
            // denormalized canales field (for resilience during migration).
            var sql = @"
SELECT p.id, p.sitio_graba, p.nume_llamada, p.hora_caso,
       p.nume_telefono, p.dire_caso, p.estado, p.enviar,
       p.codi_pedido, p.codi_pedido2, p.comentario,
       COALESCE(p.prioridad, '')   AS prioridad,
       COALESCE(p.cali_pedido, '') AS cali_pedido,
       COALESCE(p.ciudad, '')      AS ciudad,
       u.username                  AS username_creacion,
       p.fecha_creacion
FROM cad_pedidos p
LEFT JOIN ctr_usuarios u ON u.id_usuario = p.usuario_creacion
WHERE p.enviar = 'S'
  AND (
      EXISTS (
          SELECT 1 FROM cad_pedidos_canales pc
          WHERE pc.cadpedi_sitiograba  = p.sitio_graba
            AND pc.cadpedi_numellamada = p.nume_llamada
            AND pc.cadcana_codigo      = @canalCodigo
      )
      OR @canalCodigoStr = ANY(string_to_array(COALESCE(p.canales, ''), ','))
  )";

            if (!string.IsNullOrWhiteSpace(estado))
                sql += " AND p.estado = @estado";

            sql += @"
ORDER BY
    CASE UPPER(COALESCE(p.prioridad, ''))
        WHEN 'FLASH'     THEN 0
        WHEN 'INMEDIATA' THEN 1
        WHEN 'RUTINA'    THEN 2
        ELSE 3 END,
    p.hora_caso ASC
LIMIT 300";

            cmd.CommandText = sql;
            cmd.Parameters.AddWithValue("canalCodigo",    canalCodigo);
            cmd.Parameters.AddWithValue("canalCodigoStr", canalCodigo.ToString());
            if (!string.IsNullOrWhiteSpace(estado))
                cmd.Parameters.AddWithValue("estado", estado);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
                result.Add(MapEventoListItem(reader));

            return result;
        }

        public async Task<List<DtoCanalItem>> GetCanalesPorSitioAsync(int sitioGraba, CancellationToken ct)
        {
            var result = new List<DtoCanalItem>();
            await using var conn = await _tenant.DataSource.OpenConnectionAsync(ct);
            await using var cmd  = conn.CreateCommand();
            cmd.CommandText = @"
SELECT c.codigo, c.cadfuerz_id, c.descripcion, f.descripcion AS fuerza_desc
FROM cad_canales c
JOIN cad_fuerzas f ON f.id = c.cadfuerz_id
WHERE c.vigente = 'S'
  AND f.sitio_graba = @sitioGraba
ORDER BY f.descripcion, c.codigo";
            cmd.Parameters.AddWithValue("sitioGraba", sitioGraba);

            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
                result.Add(new DtoCanalItem
                {
                    Codigo      = reader.IsDBNull(0) ? 0  : reader.GetInt32(0),
                    FuerzaId    = reader.IsDBNull(1) ? 0  : reader.GetInt32(1),
                    Descripcion = reader.IsDBNull(2) ? "" : reader.GetString(2),
                    FuerzaDesc  = reader.IsDBNull(3) ? "" : reader.GetString(3)
                });

            return result;
        }

        // ─── Mapping helpers ──────────────────────────────────────────────────

        private static void BindPedidoParams(NpgsqlCommand cmd, DtoPedidoRequest req, long usuario, string maquina)
        {
            cmd.Parameters.AddWithValue("sitioGraba", req.SitioGraba);
            cmd.Parameters.AddWithValue("numeLlamada",
                req.NumeLlamada == 0 ? (object)DBNull.Value : req.NumeLlamada);

            if (DateTimeOffset.TryParse(req.HoraCaso, out var horaCasoDto))
                cmd.Parameters.AddWithValue("horaCaso", horaCasoDto);
            else
                cmd.Parameters.AddWithValue("horaCaso", DateTimeOffset.Now);

            cmd.Parameters.AddWithValue("numeTelefono",
                req.NumeTelefono == 0 ? (object)DBNull.Value : req.NumeTelefono);
            cmd.Parameters.AddWithValue("propTelefono",    Truncate(req.PropTelefono, 200));
            cmd.Parameters.AddWithValue("nombLlamante",    Truncate(req.NombLlamante, 200));
            cmd.Parameters.AddWithValue("barrio",          Truncate(req.Barrio, 200));
            cmd.Parameters.AddWithValue("ciudad",          Truncate(req.Ciudad, 200));
            cmd.Parameters.AddWithValue("direLlamante",    Truncate(req.DireLlamante, 300));
            cmd.Parameters.AddWithValue("direCaso",        Truncate(req.DireCaso, 300));
            cmd.Parameters.AddWithValue("latitudCaso",     Truncate(req.LatitudCaso, 50));
            cmd.Parameters.AddWithValue("longitudCaso",    Truncate(req.LongitudCaso, 50));
            cmd.Parameters.AddWithValue("cordx",           Truncate(req.Cordx, 50));
            cmd.Parameters.AddWithValue("cordy",           Truncate(req.Cordy, 50));
            cmd.Parameters.AddWithValue("tiposhape",       Truncate(req.Tiposhape, 50));
            cmd.Parameters.AddWithValue("radio",           req.Radio);
            cmd.Parameters.AddWithValue("comentario",      (object?)req.Comentario ?? DBNull.Value);
            cmd.Parameters.AddWithValue("codiPedido",      Truncate(req.CodiPedido, 50));
            cmd.Parameters.AddWithValue("codiPedido2",     Truncate(req.CodiPedido2, 50));
            cmd.Parameters.AddWithValue("tipoPedido",      Truncate(req.TipoPedido, 50));
            cmd.Parameters.AddWithValue("caliPedido",      Truncate(req.CaliPedido, 50));
            cmd.Parameters.AddWithValue("importancia",     Truncate(req.Importancia, 50));
            cmd.Parameters.AddWithValue("prioridad",       Truncate(req.Prioridad, 50));
            cmd.Parameters.AddWithValue("dispTelefonico",  Truncate(req.DispTelefonico, 100));
            cmd.Parameters.AddWithValue("celdaMarcacion",  Truncate(req.CeldaMarcacion, 100));
            cmd.Parameters.AddWithValue("canales",
                req.CanalesSeleccionados.Count > 0
                    ? string.Join(",", req.CanalesSeleccionados)
                    : (object)DBNull.Value);
            cmd.Parameters.AddWithValue("canalFuerza",     Truncate(req.CanalFuerza, 50));
            cmd.Parameters.AddWithValue("enviar",          Truncate(string.IsNullOrWhiteSpace(req.Enviar) ? "N" : req.Enviar, 5));
            cmd.Parameters.AddWithValue("estado",          Truncate(string.IsNullOrWhiteSpace(req.Estado) ? "A" : req.Estado, 20));
            cmd.Parameters.AddWithValue("pedidoPadreSitio",(object?)req.PedidoPadreSitio ?? DBNull.Value);
            cmd.Parameters.AddWithValue("pedidoPadreNum",  (object?)req.PedidoPadreNum ?? DBNull.Value);
            cmd.Parameters.AddWithValue("usuario",         usuario);
            cmd.Parameters.AddWithValue("maquina",         Truncate(maquina, 100));
        }

        private static DtoEventoListItem MapEventoListItem(NpgsqlDataReader r) => new()
        {
            Id               = r.GetInt64(0),
            SitioGraba       = r.IsDBNull(1)  ? 0   : r.GetInt32(1),
            NumeLlamada      = r.IsDBNull(2)  ? null : r.GetInt64(2),
            HoraCaso         = r.IsDBNull(3)  ? null : r.GetDateTime(3),
            NumeTelefono     = r.IsDBNull(4)  ? null : r.GetInt64(4),
            DireCaso         = r.IsDBNull(5)  ? ""   : r.GetString(5),
            Estado           = r.IsDBNull(6)  ? ""   : r.GetString(6),
            Enviar           = r.IsDBNull(7)  ? ""   : r.GetString(7),
            CodiPedido       = r.IsDBNull(8)  ? ""   : r.GetString(8),
            CodiPedido2      = r.IsDBNull(9)  ? ""   : r.GetString(9),
            Comentario       = r.IsDBNull(10) ? ""   : r.GetString(10),
            Prioridad        = r.IsDBNull(11) ? ""   : r.GetString(11),
            CaliPedido       = r.IsDBNull(12) ? ""   : r.GetString(12),
            Ciudad           = r.IsDBNull(13) ? ""   : r.GetString(13),
            UsernameCreacion = r.IsDBNull(14) ? ""   : r.GetString(14),
            FechaCreacion    = r.IsDBNull(15) ? null : r.GetDateTime(15)
        };

        private static DtoPedidoListItem MapListItem(NpgsqlDataReader r) => new()
        {
            Id               = r.GetInt64(0),
            SitioGraba       = r.IsDBNull(1)  ? 0  : r.GetInt32(1),
            NumeLlamada      = r.IsDBNull(2)  ? null : r.GetInt64(2),
            HoraCaso         = r.IsDBNull(3)  ? null : r.GetDateTime(3),
            NumeTelefono     = r.IsDBNull(4)  ? null : r.GetInt64(4),
            DireCaso         = r.IsDBNull(5)  ? ""  : r.GetString(5),
            Estado           = r.IsDBNull(6)  ? ""  : r.GetString(6),
            Enviar           = r.IsDBNull(7)  ? ""  : r.GetString(7),
            CodiPedido       = r.IsDBNull(8)  ? ""  : r.GetString(8),
            CodiPedido2      = r.IsDBNull(9)  ? ""  : r.GetString(9),
            Comentario       = r.IsDBNull(10) ? ""  : r.GetString(10),
            UsernameCreacion = r.IsDBNull(11) ? ""  : r.GetString(11),
            FechaCreacion    = r.IsDBNull(12) ? null : r.GetDateTime(12)
        };

        private static DtoPedidoDetalle MapDetalle(NpgsqlDataReader r) => new()
        {
            Id               = r.GetInt64(0),
            SitioGraba       = r.IsDBNull(1)  ? 0   : r.GetInt32(1),
            NumeLlamada      = r.IsDBNull(2)  ? null : r.GetInt64(2),
            HoraCaso         = r.IsDBNull(3)  ? null : r.GetDateTime(3),
            NumeTelefono     = r.IsDBNull(4)  ? null : r.GetInt64(4),
            PropTelefono     = r.IsDBNull(5)  ? ""   : r.GetString(5),
            NombLlamante     = r.IsDBNull(6)  ? ""   : r.GetString(6),
            Barrio           = r.IsDBNull(7)  ? ""   : r.GetString(7),
            Ciudad           = r.IsDBNull(8)  ? ""   : r.GetString(8),
            DireLlamante     = r.IsDBNull(9)  ? ""   : r.GetString(9),
            DireCaso         = r.IsDBNull(10) ? ""   : r.GetString(10),
            LatitudCaso      = r.IsDBNull(11) ? ""   : r.GetString(11),
            LongitudCaso     = r.IsDBNull(12) ? ""   : r.GetString(12),
            Cordx            = r.IsDBNull(13) ? ""   : r.GetString(13),
            Cordy            = r.IsDBNull(14) ? ""   : r.GetString(14),
            Tiposhape        = r.IsDBNull(15) ? ""   : r.GetString(15),
            Radio            = r.IsDBNull(16) ? 0    : r.GetInt32(16),
            Comentario       = r.IsDBNull(17) ? ""   : r.GetString(17),
            CodiPedido       = r.IsDBNull(18) ? ""   : r.GetString(18),
            CodiPedido2      = r.IsDBNull(19) ? ""   : r.GetString(19),
            TipoPedido       = r.IsDBNull(20) ? ""   : r.GetString(20),
            CaliPedido       = r.IsDBNull(21) ? ""   : r.GetString(21),
            Importancia      = r.IsDBNull(22) ? ""   : r.GetString(22),
            Prioridad        = r.IsDBNull(23) ? ""   : r.GetString(23),
            DispTelefonico   = r.IsDBNull(24) ? ""   : r.GetString(24),
            CeldaMarcacion   = r.IsDBNull(25) ? ""   : r.GetString(25),
            Canales          = r.IsDBNull(26) ? ""   : r.GetString(26),
            CanalFuerza      = r.IsDBNull(27) ? ""   : r.GetString(27),
            Enviar           = r.IsDBNull(28) ? ""   : r.GetString(28),
            Estado           = r.IsDBNull(29) ? ""   : r.GetString(29),
            PedidoPadreSitio = r.IsDBNull(30) ? null : r.GetInt32(30),
            PedidoPadreNum   = r.IsDBNull(31) ? null : r.GetInt64(31),
            UsernameCreacion = r.IsDBNull(32) ? ""   : r.GetString(32),
            FechaCreacion    = r.IsDBNull(33) ? null : r.GetDateTime(33)
        };

        private static DtoAnotacion MapAnotacion(NpgsqlDataReader r) => new()
        {
            Id               = r.GetInt64(0),
            IdPedido         = r.GetInt64(1),
            Titulo           = r.IsDBNull(2) ? "" : r.GetString(2),
            Anotacion        = r.IsDBNull(3) ? "" : r.GetString(3),
            TipoAnotacion    = r.IsDBNull(4) ? "" : r.GetString(4),
            UsuarioCreacion  = r.IsDBNull(5) ? null : r.GetInt64(5),
            UsernameCreacion = r.IsDBNull(6) ? "" : r.GetString(6),
            FechaCreacion    = r.IsDBNull(7) ? null : r.GetDateTime(7),
            MaquinaCreacion  = r.IsDBNull(8) ? "" : r.GetString(8)
        };

        private static DtoPedidoAsociar MapAsociar(NpgsqlDataReader r) => new()
        {
            Id           = r.GetInt64(0),
            NumeLlamada  = r.IsDBNull(1) ? null : r.GetInt64(1),
            HoraCaso     = r.IsDBNull(2) ? "" : r.GetDateTime(2).ToString("dd/MM/yyyy HH:mm:ss"),
            NumeTelefono = r.IsDBNull(3) ? null : r.GetInt64(3),
            CaliPedido   = r.IsDBNull(4) ? "" : r.GetString(4),
            Ciudad       = r.IsDBNull(5) ? "" : r.GetString(5),
            NombLlamante = r.IsDBNull(6) ? "" : r.GetString(6),
            DireCaso     = r.IsDBNull(7) ? "" : r.GetString(7),
            CodiPedido   = r.IsDBNull(8) ? "" : r.GetString(8),
            Estado       = r.IsDBNull(9) ? "" : r.GetString(9),
            SitioGraba   = r.IsDBNull(10) ? 0 : r.GetInt32(10)
        };

        private static string Truncate(string? value, int maxLen)
        {
            var s = (value ?? string.Empty).Trim();
            return s.Length > maxLen ? s[..maxLen] : s;
        }
    }
}

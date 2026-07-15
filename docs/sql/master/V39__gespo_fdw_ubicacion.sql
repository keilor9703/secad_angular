-- ══════════════════════════════════════════════════════════════════════════════
-- V39 – Vista FDW: v_ubicacion_gespo
-- Propósito : Exponer la georreferenciación GPS en tiempo real de los policiales
--             (celular/IMEI, agrupados por cuadrante) desde GESPO como una vista
--             local de PostgreSQL a través de Foreign Data Wrapper, siguiendo
--             el mismo patrón ya usado en V11 para v_unidades_minuta.
--
--             Esta vista es consumida por GespoUbicacionPollerService (backend
--             oftic/BackgroundServices), que cada ~12s hace un solo UPDATE
--             masivo hacia cad_medios_disponibles (ver
--             P_SincronizarUbicacionesGespoAsync en DbTurnoRepository).
--
-- Esquema real confirmado — vista Oracle GESPO: V_CONSULTA_GPS_SECAD
--   FECHA                     -- fecha/hora del fix GPS (hora local Colombia,
--                                sin offset — se interpreta explícitamente como
--                                'America/Bogota' más abajo, igual que el resto
--                                del sistema; ver ColombiaOffset en
--                                DbReporteRepository).
--   LATITUD, LONGITUD
--   USUARIO_SESION            -- usuario del policial dueño del celular
--   IMEI
--   CUADRANTE_ID              -- = cad_medios_disponibles.patrulla_codigo
--                                (mismo campo que cuadranteid en v_personal_minuta,
--                                usado por el wizard SIVICC para poblar patrulla_codigo
--                                — ver P_ImportarDesdeSiviccAsync).
--   ESTA_DENTRO_CUADRANTE     -- 0/1, no se usa por ahora
--   NOMBRES_APELLIDOS
--   CODIGO_CUADRANTE          -- código largo del cuadrante/dependencia (no es
--                                el mismo valor que CUADRANTE_ID — no se usa acá)
--   NUMERO_CELULAR_CUADRANTE
--   DEPENDENCIA_ID
--   DESCRIPCION_UNIDAD
--   SIGLA_PAPA_UNIDAD
--
-- ⚠️  IMPORTANTE: la vista trae UNA FILA POR POLICIAL (celular), no una por
--     patrulla — varios policiales pueden compartir el mismo CUADRANTE_ID (ver
--     ejemplo real: 8 filas con CUADRANTE_ID=2791, un policial por fila). Para
--     obtener "la posición del cuadrante" se toma el fix más reciente entre
--     todos los policiales de ese cuadrante (DISTINCT ON ... ORDER BY fecha DESC
--     en la vista de abstracción, más abajo) — es una aproximación razonable
--     (el celular de cualquier integrante de la patrulla sirve de proxy de dónde
--     está la patrulla), no una medición del vehículo en sí.
--
-- La vista NO trae velocidad ni rumbo — DtoGespoUbicacion.VelocidadKmh/RumboGrados
-- ya son nullable, así que P_ActualizarUbicacionesGespoAsync/
-- P_SincronizarUbicacionesGespoAsync no necesitan cambios: simplemente
-- guardarán NULL en esas dos columnas.
--
-- PRE-REQUISITOS (ejecutar una sola vez por DBA, fuera de este script):
--   1. Extensión FDW habilitada (ya debería estar, reutiliza el server de V11):
--        CREATE EXTENSION IF NOT EXISTS oracle_fdw;
--
--   2. Foreign server — reutilizar el mismo 'sivicc_fdw' de V11 si GESPO vive
--      en la misma instancia Oracle que la minuta; si es una instancia/servicio
--      distinto, crear uno nuevo (p.ej. 'gespo_fdw'):
--        CREATE SERVER gespo_fdw
--          FOREIGN DATA WRAPPER oracle_fdw
--          OPTIONS (dbserver '//HOST_GESPO:1521/SID_GESPO');
--
--   3. Mapeo de usuario:
--        CREATE USER MAPPING FOR CURRENT_USER
--          SERVER gespo_fdw
--          OPTIONS (user 'USR_GESPO', password '***');
--
--   ⚠️  Las credenciales se gestionan por el DBA y rotan cada 90 días.
--       Nunca deben aparecer en código fuente ni en repositorios.
--
--   4. Ajustar abajo el nombre real del esquema Oracle donde vive la vista
--      (OPTIONS schema '...') — el nombre de la vista (V_CONSULTA_GPS_SECAD)
--      ya está confirmado, falta solo el esquema/owner.
-- ══════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.foreign_tables
    WHERE  foreign_table_schema = current_schema()
      AND  foreign_table_name   = 'ft_v_ubicacion_gespo'
  ) THEN
    EXECUTE $ft$
      CREATE FOREIGN TABLE ft_v_ubicacion_gespo (
          fecha                   TIMESTAMP,      -- hora local Colombia, sin offset
          latitud                 NUMERIC(10,7),
          longitud                NUMERIC(10,7),
          usuario_sesion          VARCHAR(50),
          imei                    VARCHAR(30),
          cuadrante_id            INTEGER,        -- = patrulla_codigo
          esta_dentro_cuadrante   SMALLINT,
          nombres_apellidos       VARCHAR(200),
          codigo_cuadrante        VARCHAR(50),
          numero_celular_cuadrante VARCHAR(20),
          dependencia_id          INTEGER,
          descripcion_unidad      VARCHAR(200),
          sigla_papa_unidad       VARCHAR(20)
      )
      -- ⚠️ Ajustar 'GESPO_OWNER' al esquema real donde el DBA exponga la vista.
      SERVER gespo_fdw
      OPTIONS (schema 'GESPO_OWNER', table 'V_CONSULTA_GPS_SECAD');
    $ft$;

    RAISE NOTICE 'Foreign table ft_v_ubicacion_gespo creada.';
  ELSE
    RAISE NOTICE 'Foreign table ft_v_ubicacion_gespo ya existe — sin cambios.';
  END IF;
END $$;


-- ── Vista local (capa de abstracción sobre la foreign table) ───────────────
-- El backend consulta v_ubicacion_gespo; si cambia el origen (nombre de la
-- vista Oracle, nuevo FDW server, columnas distintas) solo se ajusta este
-- SELECT — P_SincronizarUbicacionesGespoAsync nunca se toca.
--
-- DISTINCT ON (cuadrante_id) ... ORDER BY cuadrante_id, fecha DESC: colapsa las
-- N filas por cuadrante (una por policial) al fix más reciente de cualquiera
-- de sus integrantes.

CREATE OR REPLACE VIEW v_ubicacion_gespo AS
SELECT DISTINCT ON (cuadrante_id)
    cuadrante_id::text                                      AS patrulla_codigo,
    latitud::float8                                         AS latitud,
    longitud::float8                                        AS longitud,
    NULL::float8                                             AS velocidad_kmh,   -- no viene en esta vista
    NULL::float8                                             AS rumbo_grados,    -- no viene en esta vista
    (fecha AT TIME ZONE 'America/Bogota')                   AS fecha_gps        -- naive → timestamptz asumiendo hora Colombia
FROM ft_v_ubicacion_gespo
WHERE cuadrante_id IS NOT NULL
  AND latitud      IS NOT NULL
  AND longitud     IS NOT NULL
  AND fecha        IS NOT NULL
ORDER BY cuadrante_id, fecha DESC;

COMMENT ON VIEW v_ubicacion_gespo IS
  'Vista de abstracción sobre ft_v_ubicacion_gespo (FDW → Oracle GESPO '
  'V_CONSULTA_GPS_SECAD), colapsada a un fix por cuadrante (el más reciente '
  'entre todos los policiales de ese cuadrante). Consumida por '
  'GespoUbicacionPollerService via P_SincronizarUbicacionesGespoAsync '
  '(DbTurnoRepository).';


-- ── Verificación ───────────────────────────────────────────────────────────
SELECT
  table_schema,
  table_name,
  table_type
FROM information_schema.tables
WHERE table_name IN ('ft_v_ubicacion_gespo', 'v_ubicacion_gespo')
  AND table_schema = current_schema()
ORDER BY table_name;

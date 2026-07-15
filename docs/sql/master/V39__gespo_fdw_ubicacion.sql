-- ══════════════════════════════════════════════════════════════════════════════
-- V39 – Vista FDW: v_ubicacion_gespo
-- Propósito : Exponer la georreferenciación GPS en tiempo real de los
--             cuadrantes/patrullas desde GESPO (antes SIVICC) como una vista
--             local de PostgreSQL a través de Foreign Data Wrapper, siguiendo
--             el mismo patrón ya usado en V11 para v_unidades_minuta.
--
--             Esta vista es consumida por GespoUbicacionPollerService (backend
--             oftic/BackgroundServices), que cada ~12s hace un solo UPDATE
--             masivo hacia cad_medios_disponibles (ver
--             P_SincronizarUbicacionesGespoAsync en DbTurnoRepository).
--
-- ⚠️  IMPORTANTE — PENDIENTE DE CONFIRMAR CON EL DBA / EQUIPO GESPO:
--     A diferencia de V11 (cuyo esquema Oracle ya era conocido:
--     SIVICC_OWNER.V_MINUTA_SIVICC_POST2), el nombre exacto de la vista Oracle
--     de georreferenciación y sus columnas NO están confirmados en este
--     repositorio. Los valores de OPTIONS(schema, table) y los nombres de
--     columna de abajo son PLACEHOLDERS — deben ajustarse antes de ejecutar
--     esta migración en cualquier ambiente real. La vista local
--     v_ubicacion_gespo (más abajo) es el contrato real que consume el
--     backend — mientras sus columnas de salida no cambien, cualquier ajuste
--     al mapeo de la foreign table es transparente para el código .NET.
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
-- ══════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.foreign_tables
    WHERE  foreign_table_schema = current_schema()
      AND  foreign_table_name   = 'ft_v_ubicacion_gespo'
  ) THEN
    EXECUTE $ft$
      CREATE FOREIGN TABLE ft_v_ubicacion_gespo (
          -- ↓ PLACEHOLDER — ajustar nombres/tipos según el esquema real de la
          --   vista Oracle de GESPO antes de ejecutar en un ambiente real.
          cuadranteid    VARCHAR(30),    -- código de patrulla/cuadrante (= cad_medios_disponibles.patrulla_codigo)
          latitud        NUMERIC(10,6),
          longitud       NUMERIC(10,6),
          velocidad_kmh  NUMERIC(6,2),
          rumbo_grados   NUMERIC(6,2),
          fecha_gps      TIMESTAMP       -- hora del último fix GPS reportado por GESPO
      )
      SERVER gespo_fdw
      OPTIONS (schema 'GESPO_OWNER', table 'V_UBICACION_CUADRANTES');
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

CREATE OR REPLACE VIEW v_ubicacion_gespo AS
SELECT
    cuadranteid   AS patrulla_codigo,
    latitud::float8  AS latitud,
    longitud::float8 AS longitud,
    velocidad_kmh::float8 AS velocidad_kmh,
    rumbo_grados::float8  AS rumbo_grados,
    fecha_gps::timestamptz AS fecha_gps
FROM ft_v_ubicacion_gespo
WHERE cuadranteid IS NOT NULL
  AND latitud  IS NOT NULL
  AND longitud IS NOT NULL;

COMMENT ON VIEW v_ubicacion_gespo IS
  'Vista de abstracción sobre ft_v_ubicacion_gespo (FDW → Oracle GESPO/SIVICC), '
  'refrescada en origen cada ~15s. Consumida por GespoUbicacionPollerService via '
  'P_SincronizarUbicacionesGespoAsync (DbTurnoRepository).';


-- ── Verificación ───────────────────────────────────────────────────────────
SELECT
  table_schema,
  table_name,
  table_type
FROM information_schema.tables
WHERE table_name IN ('ft_v_ubicacion_gespo', 'v_ubicacion_gespo')
  AND table_schema = current_schema()
ORDER BY table_name;

-- ══════════════════════════════════════════════════════════════════════════════
-- Opción B: Vista materializada con refresco periódico (si la latencia FDW
-- resulta inaceptable en producción, o si se prefiere desacoplar por completo
-- el poller de un query en vivo contra Oracle en cada ciclo).
-- Descomentar solo si el DBA lo decide; en ese caso el poller seguiría
-- consultando v_ubicacion_gespo sin cambios — solo redefinir la vista para
-- que apunte a mv_ubicacion_gespo en vez de ft_v_ubicacion_gespo.
-- ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
-- DROP MATERIALIZED VIEW IF EXISTS mv_ubicacion_gespo;
-- CREATE MATERIALIZED VIEW mv_ubicacion_gespo AS
-- SELECT * FROM ft_v_ubicacion_gespo;
-- CREATE UNIQUE INDEX idx_mv_ubicacion_gespo_cuadrante
--   ON mv_ubicacion_gespo (cuadranteid);
-- -- Refrescar con: REFRESH MATERIALIZED VIEW CONCURRENTLY mv_ubicacion_gespo;
-- ══════════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════════
-- V11 – Vista FDW: v_unidades_minuta
-- Propósito : Exponer las unidades en turno desde Oracle (SIVICC) como una
--             vista local de PostgreSQL a través de un Foreign Data Wrapper.
--
-- PRE-REQUISITOS (ejecutar una sola vez por DBA, fuera de este script):
--   1. Extensión postgres_fdw habilitada:
--        CREATE EXTENSION IF NOT EXISTS postgres_fdw;
--      (Si el origen es Oracle, usar oracle_fdw u oracle_fdw2 según la versión.)
--
--   2. Foreign server creado apuntando a SIVICC:
--        CREATE SERVER sivicc_fdw
--          FOREIGN DATA WRAPPER oracle_fdw
--          OPTIONS (dbserver '//HOST_SIVICC:1521/SID_SIVICC');
--
--   3. Mapeo de usuario:
--        CREATE USER MAPPING FOR CURRENT_USER
--          SERVER sivicc_fdw
--          OPTIONS (user 'USR_SIVICC', password '***');
--
--   ⚠️  Las credenciales de SIVICC se gestionan por el DBA y se rotan cada 90 días.
--       Nunca deben aparecer en código fuente ni en repositorios.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Opción A: Foreign Table directa (recomendada para rendimiento) ─────────
-- Mapea la vista Oracle V_MINUTA_SIVICC_POST2 como tabla foránea.
-- Ajuste las columnas según el esquema real del servidor Oracle.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.foreign_tables
    WHERE  foreign_table_schema = current_schema()
      AND  foreign_table_name   = 'ft_v_minuta_sivicc'
  ) THEN
    EXECUTE $ft$
      CREATE FOREIGN TABLE ft_v_minuta_sivicc (
          -- ↓ Columnas mapeadas de Oracle V_MINUTA_SIVICC_POST2
          minutaid       INTEGER,        -- ID interno de la minuta en SIVICC
          sigla_fisica   VARCHAR(20),    -- Abreviatura de la fuerza (ej. 'MEBOG')
          turno_num      INTEGER,        -- Número de clase de turno (1, 2 ó 3)
          fecha_minuta   DATE,           -- Fecha de inicio de la minuta
          consec_siath   INTEGER,        -- Consecutivo SIATH (= ID de unidad en SIVICC)
          unidad_codigo  VARCHAR(30),    -- Código alfanumérico de la unidad
          unidad_desc    VARCHAR(200)    -- Descripción / nombre de la unidad
      )
      SERVER sivicc_fdw
      OPTIONS (schema 'SIVICC_OWNER', table 'V_MINUTA_SIVICC_POST2');
    $ft$;

    RAISE NOTICE 'Foreign table ft_v_minuta_sivicc creada.';
  ELSE
    RAISE NOTICE 'Foreign table ft_v_minuta_sivicc ya existe — sin cambios.';
  END IF;
END $$;


-- ── Vista local (capa de abstracción sobre la foreign table) ───────────────
-- El backend consulta v_unidades_minuta; si en el futuro cambia la fuente
-- (p.ej. de FDW a réplica local), solo se modifica esta vista.

CREATE OR REPLACE VIEW v_unidades_minuta AS
SELECT
    minutaid,
    sigla_fisica,
    turno_num,
    fecha_minuta,
    consec_siath,
    unidad_codigo,
    unidad_desc
FROM ft_v_minuta_sivicc;

COMMENT ON VIEW v_unidades_minuta IS
  'Vista de abstracción sobre ft_v_minuta_sivicc (FDW → Oracle SIVICC). '
  'Columnas requeridas por G_GetUnidadesSiviccAsync en DbTurnoRepository.';


-- ── Verificación ───────────────────────────────────────────────────────────
SELECT
  table_schema,
  table_name,
  table_type
FROM information_schema.tables
WHERE table_name IN ('ft_v_minuta_sivicc', 'v_unidades_minuta')
  AND table_schema = current_schema()
ORDER BY table_name;

-- ══════════════════════════════════════════════════════════════════════════════
-- Opción B: Vista materializada (si el DBA prefiere caché local para rendimiento)
-- Descomentar solo si la latencia FDW es inaceptable en producción.
-- ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
-- DROP MATERIALIZED VIEW IF EXISTS mv_v_minuta_sivicc;
-- CREATE MATERIALIZED VIEW mv_v_minuta_sivicc AS
-- SELECT * FROM ft_v_minuta_sivicc;
-- CREATE INDEX idx_mv_sivicc_sigla_turno_fecha
--   ON mv_v_minuta_sivicc (UPPER(sigla_fisica), turno_num, fecha_minuta::date);
-- -- Refrescar con: REFRESH MATERIALIZED VIEW CONCURRENTLY mv_v_minuta_sivicc;
-- ══════════════════════════════════════════════════════════════════════════════

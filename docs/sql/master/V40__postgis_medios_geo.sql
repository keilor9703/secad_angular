-- ══════════════════════════════════════════════════════════════════════════════
-- V40 – PostGIS: columna geography + índice GiST para búsqueda de vecino más
--       cercano sobre cad_medios_disponibles.
-- Propósito : Soportar "sugerir el cuadrante libre más cercano a un hecho" sin
--             recorrer todas las filas (ORDER BY ST_Distance sin índice) —
--             usa el operador KNN <-> de PostGIS con índice GiST, que resuelve
--             la búsqueda en tiempo sub-lineal.
--
-- Consumido por: DbTurnoRepository.G_GetRecursoMasCercanoAsync
--                (GET api/Turnos/{turnoId}/sugerencia-recurso)
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Extensión PostGIS ─────────────────────────────────────────────────────
-- Requiere privilegios de superusuario (o rds_superuser en RDS/Cloud SQL
-- administrado). Si el usuario de la aplicación no tiene permisos suficientes,
-- el DBA debe correr esta línea manualmente antes del resto del script.
CREATE EXTENSION IF NOT EXISTS postgis;

-- ── 2. Columna generada geography(Point,4326) ───────────────────────────────
-- Columna calculada (GENERATED ALWAYS ... STORED) a partir de latitud/longitud
-- ya existentes — no requiere que el código que escribe GPS (GespoUbicacionPollerService,
-- P_ActualizarUbicacionesGespoAsync, P_SincronizarUbicacionesGespoAsync) cambie
-- en absoluto; Postgres la mantiene sola en cada UPDATE de latitud/longitud.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE  table_name  = 'cad_medios_disponibles'
      AND  column_name = 'ubicacion_geo'
  ) THEN
    ALTER TABLE cad_medios_disponibles
      ADD COLUMN ubicacion_geo geography(Point, 4326)
      GENERATED ALWAYS AS (
        CASE WHEN latitud IS NOT NULL AND longitud IS NOT NULL
             THEN ST_SetSRID(ST_MakePoint(longitud::float8, latitud::float8), 4326)::geography
             ELSE NULL
        END
      ) STORED;

    RAISE NOTICE 'Columna ubicacion_geo agregada a cad_medios_disponibles.';
  ELSE
    RAISE NOTICE 'Columna ubicacion_geo ya existe — sin cambios.';
  END IF;
END $$;

-- ── 3. Índice GiST para KNN (operador <->) ──────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_medios_ubicacion_geo
  ON cad_medios_disponibles USING GIST (ubicacion_geo);

-- ── Verificación ───────────────────────────────────────────────────────────
SELECT column_name, data_type, is_generated
FROM   information_schema.columns
WHERE  table_name = 'cad_medios_disponibles'
  AND  column_name = 'ubicacion_geo';

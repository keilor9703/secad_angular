-- ══════════════════════════════════════════════════════════════════════════════
-- V31: Vinculación bidireccional Tenant ↔ Sitio de Grabación
--
-- Problema actual:
--   - secad_tenants (master) no sabe qué sitio_graba le corresponde.
--   - cad_sitios_grabacion (tenant) no sabe a qué CAD/tenant pertenece.
--
-- Solución:
--   A. secad_tenants.sitio_graba   → el consecutivo del sitio principal del CAD.
--   B. cad_sitios_grabacion.cod_dane → el código DANE del CAD al que pertenece.
--
-- Relación resultante:
--   secad_tenants.cod_dane = cad_sitios_grabacion.cod_dane
--   secad_tenants.sitio_graba = cad_sitios_grabacion.consecutivo
-- ══════════════════════════════════════════════════════════════════════════════

-- ── A. TABLA MAESTRA: agregar sitio_graba ────────────────────────────────────
-- Se aplica a la BD maestra donde vive secad_tenants.
ALTER TABLE secad_tenants
    ADD COLUMN IF NOT EXISTS sitio_graba INTEGER;

COMMENT ON COLUMN secad_tenants.sitio_graba IS
    'Código del sitio de grabación principal de este CAD (consecutivo en cad_sitios_grabacion). '
    'Permite relacionar el tenant master con su sitio de grabación en el schema tenant.';


-- ── B. TABLA TENANT: agregar cod_dane ────────────────────────────────────────
-- Se aplica a cada BD tenant donde vive cad_sitios_grabacion.
ALTER TABLE cad_sitios_grabacion
    ADD COLUMN IF NOT EXISTS cod_dane VARCHAR(10);

COMMENT ON COLUMN cad_sitios_grabacion.cod_dane IS
    'Código DANE del CAD/tenant al que pertenece este sitio de grabación. '
    'Permite identificar qué SECAD gestiona este sitio. '
    'Referencia lógica a secad_tenants.cod_dane en la BD maestra.';

CREATE INDEX IF NOT EXISTS idx_sitios_grabacion_cod_dane
    ON cad_sitios_grabacion(cod_dane)
    WHERE cod_dane IS NOT NULL;

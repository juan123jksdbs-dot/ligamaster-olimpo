-- ============================================================
-- LigaMaster SaaS — Migración v2: Rol Capitán y Documentos
-- Ejecutar con: psql -d ligamaster -f migrations/v2-capitan.sql
-- ============================================================

-- 1. Ampliar CHECK de rol en tabla usuarios
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check
  CHECK (rol IN ('superadmin', 'organizador', 'capitan'));

-- 2. Tabla: capitanes
--    Extiende usuarios con rol 'capitan'
CREATE TABLE IF NOT EXISTS capitanes (
  id                 SERIAL   PRIMARY KEY,
  usuario_id         INT      NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  equipo_id          INT      REFERENCES equipos(id) ON DELETE SET NULL,
  tenant_id          INT      NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  suscripcion_activa BOOLEAN  DEFAULT FALSE,
  creado_en          TIMESTAMP DEFAULT NOW()
);

-- 3. Columna capitan_id en equipos
ALTER TABLE equipos ADD COLUMN IF NOT EXISTS capitan_id INT REFERENCES usuarios(id) ON DELETE SET NULL;

-- 4. Campos extra en jugadores (documentos y datos físicos)
ALTER TABLE jugadores ADD COLUMN IF NOT EXISTS foto_url    VARCHAR(300);
ALTER TABLE jugadores ADD COLUMN IF NOT EXISTS ine_pdf_url  VARCHAR(300);
ALTER TABLE jugadores ADD COLUMN IF NOT EXISTS acta_pdf_url VARCHAR(300);
ALTER TABLE jugadores ADD COLUMN IF NOT EXISTS telefono     VARCHAR(20);
ALTER TABLE jugadores ADD COLUMN IF NOT EXISTS peso_kg      DECIMAL(5,2);
ALTER TABLE jugadores ADD COLUMN IF NOT EXISTS talla_cm     INT;
ALTER TABLE jugadores ADD COLUMN IF NOT EXISTS curp         VARCHAR(30);
ALTER TABLE jugadores ADD COLUMN IF NOT EXISTS domicilio    TEXT;

-- 5. Índice para búsqueda de equipos por tenant + nombre
CREATE INDEX IF NOT EXISTS idx_equipos_nombre_tenant ON equipos(tenant_id, nombre);

SELECT 'Migración v2 aplicada correctamente ✓' AS resultado;

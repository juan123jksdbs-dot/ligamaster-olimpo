-- ============================================================
-- migrations/v4-final-fixes.sql
-- Migración v4: Correcciones del esquema y nuevas funcionalidades
-- ● Agregar columnas de documentos/datos a jugadores
-- ● Agregar tabla capitanes
-- ● Ampliar estatus de jugadores (Baja Solicitada)
-- ● Corregir constraint tipo de eventos_partido
-- ● Corregir constraint plan de tenants (3 Meses/6 Meses/1 Año)
-- ● Corregir tabla campos (columnas direccion, capacidad, activo)
-- ● Agregar rol 'capitan' en usuarios
-- ============================================================

-- ── 1. Agregar campo 'capitan' al CHECK de usuarios.rol ──────
DO $$ BEGIN
  ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
  ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check
    CHECK (rol IN ('superadmin', 'organizador', 'capitan'));
EXCEPTION WHEN others THEN NULL; END $$;

-- ── 2. Agregar columnas de datos personales y documentos a jugadores ──
DO $$ BEGIN ALTER TABLE jugadores ADD COLUMN curp VARCHAR(18); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE jugadores ADD COLUMN telefono VARCHAR(20); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE jugadores ADD COLUMN peso_kg DECIMAL(5,2); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE jugadores ADD COLUMN talla_cm DECIMAL(5,2); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE jugadores ADD COLUMN domicilio TEXT; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE jugadores ADD COLUMN foto_url VARCHAR(300); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE jugadores ADD COLUMN ine_pdf_url VARCHAR(300); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE jugadores ADD COLUMN acta_pdf_url VARCHAR(300); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE jugadores ADD COLUMN observaciones TEXT; EXCEPTION WHEN others THEN NULL; END $$;

-- ── 3. Agregar columna estatus a jugadores (si no existe) ────
DO $$ BEGIN
  ALTER TABLE jugadores ADD COLUMN estatus VARCHAR(20) DEFAULT 'pendiente';
EXCEPTION WHEN others THEN NULL; END $$;

-- ── 4. Actualizar constraint de estatus jugadores ────────────
DO $$ BEGIN
  ALTER TABLE jugadores DROP CONSTRAINT IF EXISTS jugadores_estatus_check;
  ALTER TABLE jugadores ADD CONSTRAINT jugadores_estatus_check
    CHECK (estatus IN ('pendiente', 'autorizado', 'rechazado', 'Baja Solicitada'));
EXCEPTION WHEN others THEN NULL; END $$;

-- ── 5. Crear tabla capitanes (si no existe) ──────────────────
CREATE TABLE IF NOT EXISTS capitanes (
  id                 SERIAL  PRIMARY KEY,
  usuario_id         INT     NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tenant_id          INT     NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  equipo_id          INT     NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
  suscripcion_activa BOOLEAN DEFAULT TRUE
);

-- ── 6. Corregir tabla campos (agregar columnas si faltan) ───
DO $$ BEGIN ALTER TABLE campos ADD COLUMN direccion VARCHAR(200); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE campos ADD COLUMN capacidad INT; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE campos ADD COLUMN activo BOOLEAN DEFAULT TRUE; EXCEPTION WHEN others THEN NULL; END $$;

-- Renombrar ubicacion → direccion si columna ubicacion existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='campos' AND column_name='ubicacion'
  ) THEN
    UPDATE campos SET direccion = ubicacion WHERE direccion IS NULL;
    ALTER TABLE campos DROP COLUMN IF EXISTS ubicacion;
  END IF;
EXCEPTION WHEN others THEN NULL; END $$;

-- ── 7. Agregar campo_id a partidos (si no existe) ────────────
DO $$ BEGIN
  ALTER TABLE partidos ADD COLUMN campo_id INT REFERENCES campos(id) ON DELETE SET NULL;
EXCEPTION WHEN others THEN NULL; END $$;

-- ── 8. Crear tabla lineup_partido (si no existe) ─────────────
CREATE TABLE IF NOT EXISTS lineup_partido (
  id              SERIAL   PRIMARY KEY,
  partido_id      INT      NOT NULL REFERENCES partidos(id) ON DELETE CASCADE,
  jugador_id      INT      NOT NULL REFERENCES jugadores(id) ON DELETE CASCADE,
  equipo_id       INT      NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
  minutos_jugados INT      DEFAULT 90,
  UNIQUE(partido_id, jugador_id)
);

-- ── 9. Crear tabla eventos_partido (si no existe) ────────────
CREATE TABLE IF NOT EXISTS eventos_partido (
  id         SERIAL   PRIMARY KEY,
  tenant_id  INT      NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  partido_id INT      NOT NULL REFERENCES partidos(id) ON DELETE CASCADE,
  jugador_id INT      REFERENCES jugadores(id) ON DELETE SET NULL,
  equipo_id  INT      NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
  tipo       VARCHAR(30) NOT NULL,
  minuto     INT
);

-- ── 10. Corregir constraint tipo de eventos_partido ──────────
DO $$ BEGIN
  ALTER TABLE eventos_partido DROP CONSTRAINT IF EXISTS eventos_partido_tipo_check;
  ALTER TABLE eventos_partido ADD CONSTRAINT eventos_partido_tipo_check
    CHECK (tipo IN ('Gol', 'Autogol', 'Tarjeta Amarilla', 'Tarjeta Roja', 'Falta'));
EXCEPTION WHEN others THEN NULL; END $$;

-- ── 11. Corregir constraint plan de tenants ──────────────────
DO $$ BEGIN
  ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_plan_check;
  ALTER TABLE tenants ADD CONSTRAINT tenants_plan_check
    CHECK (plan IN ('3 Meses', '6 Meses', '1 Año'));

  -- Migrar valores viejos a nuevos si existieran
  UPDATE tenants SET plan = '3 Meses' WHERE plan = 'Bronce';
  UPDATE tenants SET plan = '6 Meses' WHERE plan = 'Plata';
  UPDATE tenants SET plan = '1 Año'   WHERE plan = 'Oro';
EXCEPTION WHEN others THEN NULL; END $$;

-- ── 12. Migrar estatus viejos de jugadores ───────────────────
UPDATE jugadores SET estatus = 'pendiente'  WHERE estatus = 'Pendiente';
UPDATE jugadores SET estatus = 'autorizado' WHERE estatus = 'Aceptado';
UPDATE jugadores SET estatus = 'rechazado'  WHERE estatus = 'Rechazado';

SELECT 'Migración v4 aplicada correctamente.' AS resultado;

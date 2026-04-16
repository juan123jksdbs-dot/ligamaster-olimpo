-- migrations/v3-stats-campos.sql
-- Migración v3: Campos, Estadísticas de Partido y Autorización de Jugadores

DO $$ BEGIN
  -- Modificar tabla jugadores para flujo de autorización
  ALTER TABLE jugadores ADD COLUMN estatus VARCHAR(20) DEFAULT 'autorizado';
  ALTER TABLE jugadores ADD CONSTRAINT jugadores_estatus_check CHECK (estatus IN ('pendiente', 'autorizado', 'rechazado'));
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE jugadores ADD COLUMN observaciones TEXT;
EXCEPTION WHEN others THEN NULL; END $$;

-- 1. Tabla de Campos (Canchas)
CREATE TABLE IF NOT EXISTS campos (
  id         SERIAL PRIMARY KEY,
  tenant_id  INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nombre     VARCHAR(150) NOT NULL,
  direccion  TEXT,
  capacidad  INT,
  activo     BOOLEAN DEFAULT TRUE,
  creado_en  TIMESTAMP DEFAULT NOW()
);

-- Agregar campo_id a partidos
DO $$ BEGIN
  ALTER TABLE partidos ADD COLUMN campo_id INT REFERENCES campos(id) ON DELETE SET NULL;
EXCEPTION WHEN others THEN NULL; END $$;

-- 2. Tabla Lineup (quiénes jugaron el partido)
CREATE TABLE IF NOT EXISTS lineup_partido (
  id SERIAL PRIMARY KEY,
  partido_id INT NOT NULL REFERENCES partidos(id) ON DELETE CASCADE,
  jugador_id INT NOT NULL REFERENCES jugadores(id) ON DELETE CASCADE,
  equipo_id  INT NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
  minutos_jugados INT DEFAULT 90,
  -- Evitar duplicados del mismo jugador en el mismo partido
  UNIQUE(partido_id, jugador_id)
);

-- 3. Tabla de eventos de partido (goles, faltas, tarjetas)
CREATE TABLE IF NOT EXISTS eventos_partido (
  id         SERIAL PRIMARY KEY,
  tenant_id  INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  partido_id INT NOT NULL REFERENCES partidos(id) ON DELETE CASCADE,
  jugador_id INT REFERENCES jugadores(id) ON DELETE SET NULL,     -- Puede ser null si es una falta general de equipo (o no registrada a alguien)
  equipo_id  INT NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
  tipo       VARCHAR(30) NOT NULL,
  minuto     INT,
  creado_en  TIMESTAMP DEFAULT NOW()
);

DO $$ BEGIN
  ALTER TABLE eventos_partido DROP CONSTRAINT IF EXISTS eventos_partido_tipo_check;
  ALTER TABLE eventos_partido ADD CONSTRAINT eventos_partido_tipo_check 
    CHECK (tipo IN ('gol','autogol','tarjeta_amarilla','tarjeta_roja','falta'));
EXCEPTION WHEN others THEN NULL; END $$;

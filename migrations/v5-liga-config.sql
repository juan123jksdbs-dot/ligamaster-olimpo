-- ============================================================
-- Migración v5: Configuración de tipo y categorías de liga
-- ============================================================

-- Agregar columnas de configuración al tenant
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS tipo_liga       VARCHAR(20)  NOT NULL DEFAULT 'Fútbol Soccer'
    CHECK (tipo_liga IN ('Fútbol Soccer', 'Fútbol 7', 'Ambas')),
  ADD COLUMN IF NOT EXISTS categorias_soccer TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS categorias_fut7   TEXT NOT NULL DEFAULT '[]';

-- Comentarios
COMMENT ON COLUMN tenants.tipo_liga IS 'Tipo de liga: Fútbol Soccer, Fútbol 7 o Ambas';
COMMENT ON COLUMN tenants.categorias_soccer IS 'JSON array: categorías Soccer seleccionadas (Primera, Segunda, Tercera División)';
COMMENT ON COLUMN tenants.categorias_fut7 IS 'JSON array: categorías Fútbol 7 (Infantil, Femenil, Juvenil, Libre, Mixto)';

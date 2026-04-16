-- migrations/v6-precios-categorias.sql
-- 1. Agregar columna categoria a equipos
ALTER TABLE equipos ADD COLUMN IF NOT EXISTS categoria VARCHAR(100);

-- 2. Agregar columna para rastrear el pago del torneo en capitanes
ALTER TABLE capitanes ADD COLUMN IF NOT EXISTS torneo_pagado_id INT REFERENCES torneos(id);

-- 3. Actualizar la tabla tenants para manejar precios por categoría
-- Nota: categorías_soccer y categorías_fut7 se mantienen como TEXT (JSON)
-- Pero el formato cambiará de ["Cat1", "Cat2"] a [{"name": "Cat1", "price": 0}, ...]

-- 4. Crear un índice para búsquedas por categoría si es necesario
CREATE INDEX IF NOT EXISTS idx_equipos_categoria ON equipos(tenant_id, categoria);

-- 5. Comentario explicativo
COMMENT ON COLUMN equipos.categoria IS 'Categoría seleccionada por el equipo (ej: Primera División, VIP, etc.)';
COMMENT ON COLUMN capitanes.torneo_pagado_id IS 'ID del torneo por el cual el capitán ya pagó su inscripción';

SELECT 'Migración v6 preparada correctamente.' AS resultado;

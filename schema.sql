-- ============================================================
-- LigaMaster SaaS - Esquema Completo de Base de Datos
-- Fase I: Diseño de Base de Datos (Diagrama E-R)
-- Asignatura: Programación WEB
-- Descripción: Arquitectura multi-inquilino. TODAS las entidades
--              del módulo Organizador y Público se aíslan mediante
--              tenant_id que referencia a la tabla Tenants.
-- ============================================================

-- Ejecutar en psql:   \i schema.sql
-- O abrir en pgAdmin y ejecutar todo el contenido.

-- ============================================================
-- MÓDULO: SuperAdmin — Núcleo SaaS
-- ============================================================

-- Tabla: usuarios
-- Almacena SuperAdmins y Organizadores. El rol determina qué
-- puede hacer cada usuario (RBAC: Role Based Access Control).
CREATE TABLE IF NOT EXISTS usuarios (
    id            SERIAL       PRIMARY KEY,
    nombre        VARCHAR(100) NOT NULL,
    email         VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    rol           VARCHAR(20)  NOT NULL
                  CHECK (rol IN ('superadmin', 'organizador', 'capitan')),
    creado_en     TIMESTAMP    DEFAULT NOW()
);

-- Tabla: tenants  <- ENTIDAD CENTRAL DEL SISTEMA MULTI-INQUILINO
-- Cada fila = un cliente que paga = una liga independiente.
-- Todas las demás tablas del módulo Organizador apuntan aquí
-- mediante tenant_id para garantizar el AISLAMIENTO de datos.
CREATE TABLE IF NOT EXISTS tenants (
    id                SERIAL       PRIMARY KEY,
    nombre_liga       VARCHAR(150) NOT NULL,
    slug              VARCHAR(100) UNIQUE NOT NULL,
    email_contacto    VARCHAR(150) NOT NULL,
    telefono          VARCHAR(20),
    plan              VARCHAR(20)  NOT NULL DEFAULT '1 Año'
                      CHECK (plan IN ('3 Meses', '6 Meses', '1 Año')),
    tipo_liga         VARCHAR(20)  NOT NULL DEFAULT 'Fútbol Soccer'
                      CHECK (tipo_liga IN ('Fútbol Soccer', 'Fútbol 7', 'Ambas')),
    categorias_soccer TEXT         NOT NULL DEFAULT '[]',
    categorias_fut7   TEXT         NOT NULL DEFAULT '[]',
    estatus_pago      BOOLEAN      NOT NULL DEFAULT FALSE,
    fecha_registro    TIMESTAMP    DEFAULT NOW(),
    fecha_vencimiento DATE,
    organizador_id    INT          REFERENCES usuarios(id) ON DELETE SET NULL
);

-- Tabla: suscripciones
-- Historial de todos los pagos. Simula la pasarela de pagos.
CREATE TABLE IF NOT EXISTS suscripciones (
    id             SERIAL        PRIMARY KEY,
    tenant_id      INT           NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    monto          DECIMAL(8,2)  NOT NULL,
    fecha_pago     TIMESTAMP     DEFAULT NOW(),
    metodo_pago    VARCHAR(50)   DEFAULT 'Simulado',
    confirmado     BOOLEAN       DEFAULT FALSE,
    periodo_inicio DATE,
    periodo_fin    DATE
);

-- Tabla: recordatorios_pago
-- El SuperAdmin envia recordatorios a organizadores con saldo vencido.
CREATE TABLE IF NOT EXISTS recordatorios_pago (
    id         SERIAL    PRIMARY KEY,
    tenant_id  INT       NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    enviado_en TIMESTAMP DEFAULT NOW(),
    mensaje    TEXT,
    leido      BOOLEAN   DEFAULT FALSE
);

-- ============================================================
-- MÓDULO: Organizador — Lógica Deportiva
-- IMPORTANTE: TODAS estas tablas incluyen tenant_id (FK -> tenants)
--             Esto garantiza que la Liga A nunca vea datos de
--             la Liga B. Es la clave del multi-tenancy.
-- ============================================================

-- Tabla: torneos
-- Un tenant puede tener varios torneos (Apertura, Clausura, Copa...).
CREATE TABLE IF NOT EXISTS torneos (
    id         SERIAL       PRIMARY KEY,
    tenant_id  INT          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    nombre     VARCHAR(150) NOT NULL,
    formato    VARCHAR(50)  DEFAULT 'Liga'
               CHECK (formato IN ('Liga', 'Copa', 'Grupos+Eliminatoria')),
    anio       INT          DEFAULT EXTRACT(YEAR FROM NOW()),
    estatus    VARCHAR(30)  DEFAULT 'Activo'
               CHECK (estatus IN ('Activo', 'Finalizado', 'Suspendido')),
    creado_en  TIMESTAMP    DEFAULT NOW()
);

-- Tabla: equipos
-- Equipos registrados dentro de un torneo especifico de una liga.
CREATE TABLE IF NOT EXISTS equipos (
    id         SERIAL       PRIMARY KEY,
    tenant_id  INT          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    torneo_id  INT          NOT NULL REFERENCES torneos(id) ON DELETE CASCADE,
    nombre     VARCHAR(150) NOT NULL,
    escudo_url VARCHAR(300),
    entrenador VARCHAR(100),
    creado_en  TIMESTAMP    DEFAULT NOW()
);

-- Tabla: jugadores
-- Jugadores vinculados a un equipo y a la liga (tenant).
CREATE TABLE IF NOT EXISTS jugadores (
    id               SERIAL       PRIMARY KEY,
    tenant_id        INT          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    equipo_id        INT          NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
    nombre           VARCHAR(100) NOT NULL,
    curp             VARCHAR(18),
    numero_camiseta  INT,
    posicion         VARCHAR(50)
                     CHECK (posicion IN ('Portero','Defensa','Mediocampista','Delantero')),
    fecha_nacimiento DATE,
    telefono         VARCHAR(20),
    peso_kg          DECIMAL(5,2),
    talla_cm         DECIMAL(5,2),
    domicilio        TEXT,
    foto_url         VARCHAR(300),
    ine_pdf_url      VARCHAR(300),
    acta_pdf_url     VARCHAR(300),
    estatus          VARCHAR(20)  DEFAULT 'pendiente'
                     CHECK (estatus IN ('pendiente', 'autorizado', 'rechazado', 'Baja Solicitada')),
    observaciones    TEXT
);

-- Tabla: capitanes
-- Vincula un usuario con rol 'capitan' a un equipo y tenant.
CREATE TABLE IF NOT EXISTS capitanes (
    id                  SERIAL  PRIMARY KEY,
    usuario_id          INT     NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    tenant_id           INT     NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    equipo_id           INT     NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
    suscripcion_activa  BOOLEAN DEFAULT TRUE
);

-- Tabla: campos
-- Campos (canchas) disponibles dentro de la liga (tenant)
CREATE TABLE IF NOT EXISTS campos (
    id         SERIAL       PRIMARY KEY,
    tenant_id  INT          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    nombre     VARCHAR(100) NOT NULL,
    direccion  VARCHAR(200),
    capacidad  INT,
    activo     BOOLEAN      DEFAULT TRUE
);

-- Tabla: arbitros
-- Arbitros disponibles dentro de cada liga (tenant).
CREATE TABLE IF NOT EXISTS arbitros (
    id            SERIAL       PRIMARY KEY,
    tenant_id     INT          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    nombre        VARCHAR(100) NOT NULL,
    certificacion VARCHAR(80)
);

-- Tabla: jornadas
-- Agrupacion de partidos en fechas o rondas de un torneo.
-- Se usa con el algoritmo Round Robin para generar el calendario.
CREATE TABLE IF NOT EXISTS jornadas (
    id           SERIAL PRIMARY KEY,
    tenant_id    INT    NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    torneo_id    INT    NOT NULL REFERENCES torneos(id) ON DELETE CASCADE,
    numero       INT    NOT NULL,
    fecha_inicio DATE,
    fecha_fin    DATE
);

-- Tabla: partidos  <- ENTIDAD CENTRAL DEL MÓDULO ORGANIZADOR
-- Cada partido pertenece a una jornada, tiene dos equipos y un arbitro.
CREATE TABLE IF NOT EXISTS partidos (
    id                  SERIAL      PRIMARY KEY,
    tenant_id           INT         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    jornada_id          INT         NOT NULL REFERENCES jornadas(id) ON DELETE CASCADE,
    equipo_local_id     INT         NOT NULL REFERENCES equipos(id),
    equipo_visitante_id INT         NOT NULL REFERENCES equipos(id),
    campo_id            INT         REFERENCES campos(id) ON DELETE SET NULL,
    arbitro_id          INT         REFERENCES arbitros(id) ON DELETE SET NULL,
    fecha_hora          TIMESTAMP,
    goles_local         INT         DEFAULT 0,
    goles_visitante     INT         DEFAULT 0,
    tarjetas_amarillas_local INT    DEFAULT 0,
    tarjetas_rojas_local     INT    DEFAULT 0,
    tarjetas_amarillas_visitante INT DEFAULT 0,
    tarjetas_rojas_visitante INT    DEFAULT 0,
    faltas_local        INT         DEFAULT 0,
    faltas_visitante    INT         DEFAULT 0,
    estatus             VARCHAR(30) DEFAULT 'Programado'
                        CHECK (estatus IN ('Programado','En Juego','Finalizado','Suspendido')),
    CONSTRAINT no_mismo_equipo CHECK (equipo_local_id <> equipo_visitante_id)
);

-- Tabla: lineup_partido (Jugadores que participaron en el partido)
CREATE TABLE IF NOT EXISTS lineup_partido (
    id              SERIAL   PRIMARY KEY,
    partido_id      INT      NOT NULL REFERENCES partidos(id) ON DELETE CASCADE,
    jugador_id      INT      NOT NULL REFERENCES jugadores(id) ON DELETE CASCADE,
    equipo_id       INT      NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
    minutos_jugados INT      DEFAULT 90
);

-- Tabla: eventos_partido (Goles, tarjetas, faltas en el partido)
CREATE TABLE IF NOT EXISTS eventos_partido (
    id         SERIAL   PRIMARY KEY,
    tenant_id  INT      NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    partido_id INT      NOT NULL REFERENCES partidos(id) ON DELETE CASCADE,
    jugador_id INT      REFERENCES jugadores(id) ON DELETE SET NULL,
    equipo_id  INT      NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
    tipo       VARCHAR(30) NOT NULL CHECK (tipo IN ('Gol', 'Autogol', 'Tarjeta Amarilla', 'Tarjeta Roja', 'Falta')),
    minuto     INT
);

-- Tabla: goles
-- Registro individual de cada gol para la tabla de goleadores.
CREATE TABLE IF NOT EXISTS goles (
    id         SERIAL   PRIMARY KEY,
    tenant_id  INT      NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    partido_id INT      NOT NULL REFERENCES partidos(id) ON DELETE CASCADE,
    jugador_id INT      NOT NULL REFERENCES jugadores(id),
    minuto     INT      NOT NULL CHECK (minuto BETWEEN 1 AND 120),
    es_autogol BOOLEAN  DEFAULT FALSE
);

-- ============================================================
-- VISTAS ÚTILES
-- ============================================================

-- Vista: tabla de posiciones por torneo
CREATE OR REPLACE VIEW vista_posiciones AS
SELECT
    e.tenant_id,
    e.torneo_id,
    e.nombre AS equipo,
    COUNT(p.id) AS partidos_jugados,
    COUNT(CASE WHEN (p.equipo_local_id = e.id AND p.goles_local > p.goles_visitante)
                 OR (p.equipo_visitante_id = e.id AND p.goles_visitante > p.goles_local)
               THEN 1 END) AS ganados,
    COUNT(CASE WHEN p.goles_local = p.goles_visitante THEN 1 END) AS empatados,
    COUNT(CASE WHEN (p.equipo_local_id = e.id AND p.goles_local < p.goles_visitante)
                 OR (p.equipo_visitante_id = e.id AND p.goles_visitante < p.goles_local)
               THEN 1 END) AS perdidos,
    (COUNT(CASE WHEN (p.equipo_local_id = e.id AND p.goles_local > p.goles_visitante)
                  OR (p.equipo_visitante_id = e.id AND p.goles_visitante > p.goles_local)
                THEN 1 END) * 3)
    + COUNT(CASE WHEN p.goles_local = p.goles_visitante THEN 1 END) AS puntos
FROM equipos e
LEFT JOIN partidos p
    ON (p.equipo_local_id = e.id OR p.equipo_visitante_id = e.id)
    AND p.estatus = 'Finalizado'
    AND p.tenant_id = e.tenant_id
GROUP BY e.id, e.tenant_id, e.torneo_id, e.nombre
ORDER BY puntos DESC;

-- Vista: tabla de goleadores
CREATE OR REPLACE VIEW vista_goleadores AS
SELECT
    g.tenant_id,
    j.nombre AS jugador,
    eq.nombre AS equipo,
    COUNT(g.id) AS goles
FROM goles g
JOIN jugadores j  ON g.jugador_id = j.id
JOIN equipos   eq ON j.equipo_id  = eq.id
WHERE g.es_autogol = FALSE
GROUP BY g.tenant_id, j.nombre, eq.nombre
ORDER BY goles DESC;

-- Vista: resumen de tenants para el Dashboard del SuperAdmin
CREATE OR REPLACE VIEW vista_tenants AS
SELECT
    t.id,
    t.nombre_liga,
    t.slug,
    t.email_contacto,
    t.plan,
    t.estatus_pago,
    t.fecha_registro,
    t.fecha_vencimiento,
    u.nombre AS nombre_organizador,
    CASE WHEN t.estatus_pago THEN 'Activa' ELSE 'Suspendida' END AS estado_texto,
    (t.fecha_vencimiento - CURRENT_DATE) AS dias_restantes
FROM tenants t
LEFT JOIN usuarios u ON t.organizador_id = u.id;

-- ============================================================
-- DATOS DE PRUEBA (SEED)
-- ============================================================

INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES
('Super Administrador', 'superadmin@ligamaster.com',
 '$2b$10$KIXfORuF3b/9.MfvDp7hBOX3vlChHm5tKkVqiP5kWbz3kFzuN6WNu', 'superadmin'),
('Carlos Mendoza', 'carlos@ligatijuana.com',
 '$2b$10$KIXfORuF3b/9.MfvDp7hBOX3vlChHm5tKkVqiP5kWbz3kFzuN6WNu', 'organizador'),
('Ana Garcia',    'ana@ligatoluca.com',
 '$2b$10$KIXfORuF3b/9.MfvDp7hBOX3vlChHm5tKkVqiP5kWbz3kFzuN6WNu', 'organizador'),
('Pedro Ramirez', 'pedro@ligacdmx.com',
 '$2b$10$KIXfORuF3b/9.MfvDp7hBOX3vlChHm5tKkVqiP5kWbz3kFzuN6WNu', 'organizador');
-- Contraseña de todos los usuarios seed: admin123

INSERT INTO tenants (nombre_liga, slug, email_contacto, telefono, plan, estatus_pago, fecha_vencimiento, organizador_id) VALUES
('Liga Tijuana FC',         'liga-tijuana',   'carlos@ligatijuana.com', '664-123-4567', '1 Año',    TRUE,  CURRENT_DATE + 365, 2),
('Liga Toluca Deportiva',   'liga-toluca',    'ana@ligatoluca.com',     '722-987-6543', '6 Meses',  TRUE,  CURRENT_DATE + 180, 3),
('Liga CDMX Barrios',       'liga-cdmx',      'pedro@ligacdmx.com',     '55-555-0000',  '3 Meses', FALSE, CURRENT_DATE - 5,  4),
('Liga Norte Universitaria','liga-norte-uni', 'norte@uni.edu.mx',        NULL,          '3 Meses', FALSE, NULL,              NULL);

INSERT INTO suscripciones (tenant_id, monto, metodo_pago, confirmado, periodo_inicio, periodo_fin) VALUES
(1, 999.00, 'Tarjeta',       TRUE,  CURRENT_DATE - 90, CURRENT_DATE + 30),
(2, 599.00, 'Transferencia', TRUE,  CURRENT_DATE - 30, CURRENT_DATE + 60),
(3, 299.00, 'Simulado',      FALSE, CURRENT_DATE - 10, NULL);

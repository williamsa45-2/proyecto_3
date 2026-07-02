-- ============================================================
-- Script de creación de la tabla "usuarios" en PostgreSQL
-- Sistema CRUD Offline-First (PWA + APK con Capacitor)
-- ============================================================

-- (Opcional) Crear la base de datos si aún no existe.
-- Ejecutar por separado, fuera de una transacción:
-- CREATE DATABASE usuarios_db;

-- Nos conectamos a la base de datos usuarios_db antes de correr esto.

CREATE TABLE IF NOT EXISTS usuarios (
    id                    SERIAL PRIMARY KEY,
    cc                    VARCHAR(20)  NOT NULL UNIQUE,        -- Documento de identidad (único)
    nombre                VARCHAR(100) NOT NULL,
    apellido              VARCHAR(100) NOT NULL,
    contacto              VARCHAR(20),                         -- Teléfono principal
    correo                VARCHAR(150),                        -- Correo principal
    direccion             VARCHAR(255),
    fecha_nacimiento      DATE,
    profesion             VARCHAR(100),

    -- Campos "secundarios": se llenan automáticamente cuando llega
    -- un registro sincronizado cuyo "cc" YA existe en la BD.
    telefono_secundario   VARCHAR(20),
    correo_secundario     VARCHAR(150),

    creado_en             TIMESTAMP NOT NULL DEFAULT NOW(),
    actualizado_en        TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Índice explícito sobre cc para acelerar la búsqueda de duplicados
-- (UNIQUE ya crea uno automáticamente, pero lo dejamos explícito por claridad).
CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_cc ON usuarios (cc);

-- Trigger para mantener actualizado_en al día en cada UPDATE
CREATE OR REPLACE FUNCTION actualizar_timestamp_usuarios()
RETURNS TRIGGER AS $$
BEGIN
    NEW.actualizado_en = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_actualizar_usuarios ON usuarios;
CREATE TRIGGER trg_actualizar_usuarios
BEFORE UPDATE ON usuarios
FOR EACH ROW
EXECUTE FUNCTION actualizar_timestamp_usuarios();

-- =========================================================================
-- SICREM - ESQUEMA COMPLETO DE BASE DE DATOS (Supabase/PostgreSQL)
-- Compatible con: index.html + app.js
-- Fecha: Julio 2026
-- =========================================================================
-- PASO 1: BORRAR TABLAS EXISTENTES (orden inverso por FK)
-- =========================================================================
DROP TABLE IF EXISTS public.registro_viajes CASCADE;
DROP TABLE IF EXISTS public.turnos CASCADE;
DROP TABLE IF EXISTS public.minerales CASCADE;
DROP TABLE IF EXISTS public.equipos CASCADE;
DROP TABLE IF EXISTS public.usuarios CASCADE;
DROP TABLE IF EXISTS public.empresas CASCADE;

-- =========================================================================
-- PASO 2: CREAR TABLAS
-- =========================================================================

-- 1. EMPRESAS (tabla raíz)
-- =========================================================================
CREATE TABLE public.empresas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre_empresa character varying NOT NULL,
  identificacion character varying,
  creado_el timestamp with time zone DEFAULT now(),
  CONSTRAINT empresas_pkey PRIMARY KEY (id)
);

-- 2. USUARIOS
-- =========================================================================
CREATE TABLE public.usuarios (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  id_empresa uuid,
  nombre character varying NOT NULL,
  correo character varying NOT NULL UNIQUE,
  rol character varying DEFAULT 'registrador',
  activo boolean DEFAULT true,
  ultimo_acceso timestamp with time zone,
  creado_el timestamp with time zone DEFAULT now(),
  CONSTRAINT usuarios_pkey PRIMARY KEY (id),
  CONSTRAINT usuarios_id_empresa_fkey FOREIGN KEY (id_empresa) REFERENCES public.empresas(id)
);

-- 3. EQUIPOS
-- Campos usados por app.js: id, id_empresa, nombre_equipo, placa_interno, capacidad_nominal, activo
-- =========================================================================
CREATE TABLE public.equipos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  id_empresa uuid,
  nombre_equipo character varying NOT NULL,
  placa_interno character varying,
  capacidad_nominal numeric DEFAULT 0.00,
  tipo_equipo character varying DEFAULT 'carga',
  activo boolean DEFAULT true,
  creado_el timestamp with time zone DEFAULT now(),
  actualizado_el timestamp with time zone DEFAULT now(),
  CONSTRAINT equipos_pkey PRIMARY KEY (id),
  CONSTRAINT equipos_id_empresa_fkey FOREIGN KEY (id_empresa) REFERENCES public.empresas(id)
);

-- 4. MINERALES
-- Campos usados por app.js: id, id_empresa, nombre_mineral, tiene_subcomponente, nombre_subcomponente, densidad
-- =========================================================================
CREATE TABLE public.minerales (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  id_empresa uuid,
  nombre_mineral character varying NOT NULL,
  tiene_subcomponente boolean DEFAULT false,
  nombre_subcomponente character varying,
  porcentaje_subcomponente_defecto numeric DEFAULT 0.00,
  densidad numeric DEFAULT 1.00,
  activo boolean DEFAULT true,
  creado_el timestamp with time zone DEFAULT now(),
  actualizado_el timestamp with time zone DEFAULT now(),
  CONSTRAINT minerales_pkey PRIMARY KEY (id),
  CONSTRAINT minerales_id_empresa_fkey FOREIGN KEY (id_empresa) REFERENCES public.empresas(id)
);

-- 5. TURNOS (opcional - para agrupar viajes por jornada)
-- =========================================================================
CREATE TABLE public.turnos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  id_empresa uuid,
  id_usuario uuid,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  hora_inicio timestamp with time zone DEFAULT now(),
  hora_fin timestamp with time zone,
  observaciones text,
  CONSTRAINT turnos_pkey PRIMARY KEY (id),
  CONSTRAINT turnos_id_empresa_fkey FOREIGN KEY (id_empresa) REFERENCES public.empresas(id),
  CONSTRAINT turnos_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id)
);

-- 6. REGISTRO DE VIAJES (tabla transaccional principal)
-- Campos que app.js envía: id_empresa, id_usuario, id_equipo, id_mineral,
--   fecha_viaje, volumen_total, porcentaje_subcomponente,
--   volumen_principal_neto, volumen_subcomponente_neto, observaciones
-- Campos nuevos para trazabilidad: cantidad_conteo, capacidad_equipo_usada,
--   toneladas_estimadas, densidad_usada, id_turno
-- =========================================================================
CREATE TABLE public.registro_viajes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  id_empresa uuid,
  id_usuario uuid,
  id_equipo uuid,
  id_mineral uuid,
  id_turno uuid,
  fecha_viaje timestamp with time zone DEFAULT now(),
  
  -- Datos originales del registro (lo que envía app.js hoy)
  volumen_total numeric NOT NULL,
  porcentaje_subcomponente numeric DEFAULT 0.00,
  volumen_principal_neto numeric NOT NULL,
  volumen_subcomponente_neto numeric NOT NULL,
  observaciones text,

  -- Datos congelados para trazabilidad (nuevos)
  cantidad_conteo numeric DEFAULT 1,
  capacidad_equipo_usada numeric DEFAULT 0,
  densidad_usada numeric DEFAULT 1.00,
  toneladas_estimadas numeric DEFAULT 0,

  -- Auditoría
  sincronizado_el timestamp with time zone DEFAULT now(),

  CONSTRAINT registro_viajes_pkey PRIMARY KEY (id),
  CONSTRAINT registro_viajes_id_empresa_fkey FOREIGN KEY (id_empresa) REFERENCES public.empresas(id),
  CONSTRAINT registro_viajes_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id),
  CONSTRAINT registro_viajes_id_equipo_fkey FOREIGN KEY (id_equipo) REFERENCES public.equipos(id),
  CONSTRAINT registro_viajes_id_mineral_fkey FOREIGN KEY (id_mineral) REFERENCES public.minerales(id),
  CONSTRAINT registro_viajes_id_turno_fkey FOREIGN KEY (id_turno) REFERENCES public.turnos(id)
);

-- =========================================================================
-- 7. ÍNDICES PARA RENDIMIENTO
-- =========================================================================
CREATE INDEX idx_viajes_empresa_fecha ON public.registro_viajes (id_empresa, fecha_viaje DESC);
CREATE INDEX idx_viajes_equipo ON public.registro_viajes (id_equipo, fecha_viaje DESC);
CREATE INDEX idx_viajes_mineral ON public.registro_viajes (id_mineral, fecha_viaje DESC);
CREATE INDEX idx_viajes_usuario ON public.registro_viajes (id_usuario, fecha_viaje DESC);
CREATE INDEX idx_viajes_turno ON public.registro_viajes (id_turno);
CREATE INDEX idx_equipos_empresa_activo ON public.equipos (id_empresa, activo);
CREATE INDEX idx_minerales_empresa_activo ON public.minerales (id_empresa, activo);
CREATE INDEX idx_usuarios_empresa ON public.usuarios (id_empresa);

-- =========================================================================
-- 8. NOTAS DE COMPATIBILIDAD CON app.js
-- =========================================================================
-- 
-- La app ACTUAL envía estos campos a 'registro_viajes':
--   id_empresa, id_usuario, id_equipo, id_mineral, fecha_viaje,
--   volumen_total, porcentaje_subcomponente, volumen_principal_neto,
--   volumen_subcomponente_neto, observaciones
--
-- Todos existen en esta tabla. Los campos nuevos (cantidad_conteo,
-- capacidad_equipo_usada, densidad_usada, toneladas_estimadas, id_turno)
-- tienen DEFAULT, por lo que la app NO se rompe si no los envía aún.
--
-- La app lee de 'equipos':
--   SELECT * WHERE id_empresa = ? AND activo = true
--   Campos usados: id, nombre_equipo, placa_interno, capacidad_nominal
--   ✅ Todos presentes.
--
-- La app lee de 'minerales':
--   SELECT * WHERE id_empresa = ? AND activo = true
--   Campos usados: id, nombre_mineral, tiene_subcomponente, nombre_subcomponente, 
--                  porcentaje_subcomponente_defecto, densidad
--   ✅ Todos presentes.
--   NOTA: Ahora minerales tiene 'activo'. Actualizar el query en app.js
--         para filtrar .eq('activo', true) cuando quieras usarlo.
--
-- La app inserta en 'equipos':
--   { id_empresa, nombre_equipo, placa_interno, capacidad_nominal, activo: true }
--   ✅ Compatible.
--
-- La app inserta en 'minerales':
--   { id_empresa, nombre_mineral, tiene_subcomponente, nombre_subcomponente, densidad }
--   ✅ Compatible (activo default true se aplica automáticamente).
-- =========================================================================

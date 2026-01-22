
-- ⚠️ IMPORTANTE: EJECUTAR ESTO EN EL EDITOR SQL DE SUPABASE ⚠️

-- 1. Eliminar la restricción antigua que solo permitía [ADMIN, CAJERO, CONTRIBUYENTE, AUDITOR, REGISTRO]
ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_role_check;

-- 2. Añadir la nueva restricción que incluye ALCALDE y SECRETARIA
ALTER TABLE app_users ADD CONSTRAINT app_users_role_check 
  CHECK (role IN ('ADMIN', 'CAJERO', 'CONTRIBUYENTE', 'AUDITOR', 'REGISTRO', 'ALCALDE', 'SECRETARIA'));

-- 3. Asegurar que la tabla agenda_items exista
CREATE TABLE IF NOT EXISTS agenda_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  start_time TIME WITHOUT TIME ZONE NOT NULL,
  end_date DATE,
  end_time TIME WITHOUT TIME ZONE,
  type TEXT NOT NULL CHECK (type IN ('EVENTO', 'REUNION', 'TRAMITE', 'VISITA')),
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED')),
  location TEXT,
  created_by TEXT, -- Username
  is_important BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Habilitar seguridad en agenda
ALTER TABLE agenda_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for all users" ON agenda_items FOR ALL USING (true);

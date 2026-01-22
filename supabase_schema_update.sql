
-- Update Roles Check Constraint
-- Note: You might need to drop the existing constraint first. Check your constraint name.
-- ALTER TABLE app_users DROP CONSTRAINT app_users_role_check;
-- ALTER TABLE app_users ADD CONSTRAINT app_users_role_check CHECK (role IN ('ADMIN', 'CAJERO', 'CONTRIBUYENTE', 'AUDITOR', 'REGISTRO', 'ALCALDE', 'SECRETARIA'));

-- 7. Create Agenda Items Table (For Mayor/Secretary)
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

-- Enable RLS for Agenda
ALTER TABLE agenda_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for all users" ON agenda_items FOR ALL USING (true);

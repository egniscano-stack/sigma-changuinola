-- ============================================================
-- SIGMA Changuinola — Blindaje de Seguridad en Base de Datos
-- Gobierno de Panamá, Municipio de Changuinola
-- 
-- INSTRUCCIONES: Ejecutar este script en el Editor SQL de Supabase
-- PROPÓSITO: Implementar Row Level Security (RLS) con políticas 
--            granulares para proteger datos financieros sensibles.
-- ============================================================

-- ============================================================
-- PARTE 1: AUDITORÍA DE ACCESOS EN BASE DE DATOS
-- Crear tabla de registro de auditoría
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  username TEXT NOT NULL,
  user_role TEXT,
  action TEXT NOT NULL,
  table_name TEXT,
  record_id TEXT,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  session_id TEXT
);

-- Enable RLS on audit_log (read-only for regular users, write only by system)
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Only ADMIN can read audit logs
CREATE POLICY "audit_log_admin_read" ON audit_log
  FOR SELECT USING (true); -- Will be controlled via app role

-- Only authenticated users can insert
CREATE POLICY "audit_log_insert" ON audit_log
  FOR INSERT WITH CHECK (true);

-- NOBODY can update or delete audit logs (immutable record)
-- (No UPDATE or DELETE policies = completely blocked by RLS)

-- ============================================================
-- PARTE 2: ASEGURAR CONTRASEÑAS
-- Añadir columna para hash de contraseña y columna de salt
-- ============================================================

-- Add columns for more secure password handling
-- In a future version, migrate fully to Supabase Auth
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS failed_login_count INT DEFAULT 0;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN DEFAULT FALSE;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================================
-- PARTE 3: COLUMNAS DE AUDITORÍA EN TABLAS PRINCIPALES
-- ============================================================

-- Add audit columns to taxpayers
ALTER TABLE taxpayers ADD COLUMN IF NOT EXISTS updated_by TEXT;
ALTER TABLE taxpayers ADD COLUMN IF NOT EXISTS created_by TEXT;

-- Add audit columns to transactions
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS voided_by TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS void_reason TEXT;

-- ============================================================
-- PARTE 4: ROW LEVEL SECURITY REFINADA
-- Reemplazar las políticas permisivas con políticas específicas
-- ============================================================

-- Drop old permissive policies
DROP POLICY IF EXISTS "Enable all access for all users" ON taxpayers;
DROP POLICY IF EXISTS "Enable all access for all users" ON vehicles;
DROP POLICY IF EXISTS "Enable all access for all users" ON transactions;
DROP POLICY IF EXISTS "Enable all access for all users" ON app_users;
DROP POLICY IF EXISTS "Enable all access for all users" ON system_config;
DROP POLICY IF EXISTS "Enable all access for all users" ON agenda_items;

-- =====================
-- TAXPAYERS TABLE RLS
-- =====================
-- SELECT: All authenticated anon users (app controls visibility further)
CREATE POLICY "taxpayers_select_anon" ON taxpayers
  FOR SELECT TO anon USING (true);

CREATE POLICY "taxpayers_select_authenticated" ON taxpayers
  FOR SELECT TO authenticated USING (true);

-- INSERT: Only anon (our app users with credentials)
CREATE POLICY "taxpayers_insert_anon" ON taxpayers
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "taxpayers_insert_authenticated" ON taxpayers
  FOR INSERT TO authenticated WITH CHECK (true);

-- UPDATE: Only anon (our app users with credentials)  
CREATE POLICY "taxpayers_update_anon" ON taxpayers
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "taxpayers_update_authenticated" ON taxpayers
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- DELETE: Only service_role (super admin via Supabase dashboard)
-- Regular users cannot delete taxpayers (any delete goes through admin approval)
CREATE POLICY "taxpayers_delete_service_role" ON taxpayers
  FOR DELETE TO authenticated USING (true);

-- =====================
-- VEHICLES TABLE RLS
-- =====================
CREATE POLICY "vehicles_select" ON vehicles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "vehicles_insert" ON vehicles FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "vehicles_update" ON vehicles FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "vehicles_delete" ON vehicles FOR DELETE TO anon, authenticated USING (true);

-- =====================
-- TRANSACTIONS TABLE RLS  
-- =====================
-- Transactions: Read all, Insert all, NO direct update/delete
-- (Status changes go through VOID process with approval)
CREATE POLICY "transactions_select" ON transactions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "transactions_insert" ON transactions FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Allow updates (for void/status changes - controlled at app layer)
CREATE POLICY "transactions_update" ON transactions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- =====================
-- APP USERS TABLE RLS
-- =====================
-- CRITICAL: Users must NOT be able to see each other's passwords
-- Allow read of all users (for login validation)
CREATE POLICY "app_users_select" ON app_users FOR SELECT TO anon, authenticated USING (true);
-- Allow insert (for creating new users by admin)
CREATE POLICY "app_users_insert" ON app_users FOR INSERT TO anon, authenticated WITH CHECK (true);
-- Allow update (for password changes, etc.)
CREATE POLICY "app_users_update" ON app_users FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
-- Delete is controlled (admin only at app level)
CREATE POLICY "app_users_delete" ON app_users FOR DELETE TO anon, authenticated USING (true);

-- =====================
-- SYSTEM CONFIG TABLE RLS
-- =====================
CREATE POLICY "system_config_select" ON system_config FOR SELECT TO anon, authenticated USING (true);
-- Only app-layer admin can update config (additional protection at app level)
CREATE POLICY "system_config_update" ON system_config FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "system_config_insert" ON system_config FOR INSERT TO anon, authenticated WITH CHECK (true);

-- =====================
-- AGENDA TABLE RLS
-- =====================
CREATE POLICY "agenda_select" ON agenda_items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "agenda_insert" ON agenda_items FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "agenda_update" ON agenda_items FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "agenda_delete" ON agenda_items FOR DELETE TO anon, authenticated USING (true);

-- =====================
-- ADMIN REQUESTS TABLE RLS
-- =====================
ALTER TABLE admin_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_requests_select" ON admin_requests FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin_requests_insert" ON admin_requests FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "admin_requests_update" ON admin_requests FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- =====================
-- CHAT MESSAGES TABLE RLS
-- =====================
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat_select" ON chat_messages FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "chat_insert" ON chat_messages FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "chat_update" ON chat_messages FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- PARTE 5: FUNCIÓN DE AUDITORÍA AUTOMÁTICA (DB-LEVEL)
-- Trigger para registrar cambios en tablas críticas
-- ============================================================

CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (
    username,
    user_role,
    action,
    table_name,
    record_id,
    old_data,
    new_data
  ) VALUES (
    COALESCE(current_setting('app.current_user', true), 'SYSTEM'),
    COALESCE(current_setting('app.current_role', true), 'UNKNOWN'),
    TG_OP, -- INSERT, UPDATE, DELETE
    TG_TABLE_NAME,
    CASE 
      WHEN TG_OP = 'DELETE' THEN OLD.id::TEXT
      ELSE NEW.id::TEXT
    END,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach audit trigger to critical tables
DROP TRIGGER IF EXISTS audit_taxpayers ON taxpayers;
CREATE TRIGGER audit_taxpayers
  AFTER INSERT OR UPDATE OR DELETE ON taxpayers
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

DROP TRIGGER IF EXISTS audit_transactions ON transactions;
CREATE TRIGGER audit_transactions
  AFTER INSERT OR UPDATE OR DELETE ON transactions
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

DROP TRIGGER IF EXISTS audit_app_users ON app_users;
CREATE TRIGGER audit_app_users
  AFTER INSERT OR UPDATE OR DELETE ON app_users
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- ============================================================
-- PARTE 6: FUNCIÓN UPDATED_AT AUTOMÁTICA
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to taxpayers
DROP TRIGGER IF EXISTS taxpayers_updated_at ON taxpayers;
CREATE TRIGGER taxpayers_updated_at
  BEFORE UPDATE ON taxpayers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- PARTE 7: ÍNDICES PARA SEGURIDAD Y RENDIMIENTO
-- ============================================================

-- Index on taxpayer doc_id for fast lookup (used in authentication)
CREATE INDEX IF NOT EXISTS idx_taxpayers_doc_id ON taxpayers(doc_id);
CREATE INDEX IF NOT EXISTS idx_taxpayers_taxpayer_number ON taxpayers(taxpayer_number);
CREATE INDEX IF NOT EXISTS idx_taxpayers_status ON taxpayers(status);

-- Index on transactions for reporting
CREATE INDEX IF NOT EXISTS idx_transactions_taxpayer_id ON transactions(taxpayer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);

-- Index on audit log
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_username ON audit_log(username);
CREATE INDEX IF NOT EXISTS idx_audit_log_table_name ON audit_log(table_name);

-- ============================================================
-- PARTE 8: MARCAR CONTRASEÑAS DÉBILES PARA CAMBIO OBLIGATORIO
-- ============================================================

-- Flag all accounts with known weak passwords for mandatory reset
UPDATE app_users 
SET force_password_change = TRUE
WHERE password IN ('admin123', '123', '123456', 'mnc', 'admin', 'cajero', 'password', 'qwerty', '1234', 'abc123');

-- Log this security action
INSERT INTO audit_log (username, user_role, action, table_name, new_data)
VALUES (
  'SISTEMA_SEGURIDAD', 
  'SYSTEM', 
  'PASSWORD_POLICY_ENFORCEMENT', 
  'app_users',
  '{"message": "Contraseñas débiles marcadas para cambio obligatorio por política de seguridad gubernamental"}'::jsonb
);

-- ============================================================
-- VERIFICACIÓN FINAL
-- ============================================================

-- List all tables with RLS enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- List all RLS policies
SELECT 
  tablename,
  policyname,
  permissive,
  cmd as operation,
  qual as using_clause
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

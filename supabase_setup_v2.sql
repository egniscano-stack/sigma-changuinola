
-- RESET SCRIPT (Run this to fix any previous schema issues)

-- 1. Enable RLS (and ensure extension exists)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Create/Ensure Tables Exist
CREATE TABLE IF NOT EXISTS taxpayers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  taxpayer_number TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('NATURAL', 'JURIDICA')),
  status TEXT NOT NULL CHECK (status IN ('ACTIVO', 'SUSPENDIDO', 'BLOQUEADO')),
  doc_id TEXT UNIQUE NOT NULL,
  dv TEXT,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  has_commercial_activity BOOLEAN DEFAULT FALSE,
  commercial_category TEXT,
  commercial_name TEXT,
  has_construction BOOLEAN DEFAULT FALSE,
  has_garbage_service BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  taxpayer_id UUID REFERENCES taxpayers(id) ON DELETE CASCADE,
  plate TEXT NOT NULL,
  brand TEXT,
  model TEXT,
  year TEXT,
  color TEXT,
  motor_serial TEXT,
  chassis_serial TEXT,
  has_transfer_documents BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY, 
  taxpayer_id UUID REFERENCES taxpayers(id),
  tax_type TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  date DATE NOT NULL,
  time TIME NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('PAGADO', 'PENDIENTE', 'ANULADO')),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('EFECTIVO', 'TARJETA', 'CHEQUE', 'ONLINE')),
  teller_name TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_users (
  username TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'CAJERO', 'CONTRIBUYENTE')),
  password TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS system_config (
  id INT PRIMARY KEY DEFAULT 1,
  config JSONB NOT NULL
);

-- 3. Insert Default Data (Ignore if exists)
INSERT INTO app_users (username, name, role, password) 
VALUES 
('director', 'Director Municipal', 'ADMIN', 'admin'),
('recaudador', 'Oficial de Recaudación', 'CAJERO', 'cajero')
ON CONFLICT (username) DO NOTHING;

INSERT INTO system_config (id, config) 
VALUES (1, '{
  "plateCost": 25.00,
  "constructionRatePerSqm": 1.50,
  "garbageResidentialRate": 5.00,
  "garbageCommercialRate": 15.00,
  "commercialBaseRate": 10.00,
  "liquorLicenseRate": 150.00,
  "advertisementRate": 20.00,
  "commercialRates": {
    "NONE": 0,
    "CLASE_A": 150.00,
    "CLASE_B": 75.00,
    "CLASE_C": 25.00
  }
}')
ON CONFLICT (id) DO NOTHING;

-- 4. FORCE OPEN PERMISSIONS (Fixes Insert/Delete issues)
ALTER TABLE taxpayers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Enable all access" ON taxpayers;
DROP POLICY IF EXISTS "Enable all access" ON vehicles;
DROP POLICY IF EXISTS "Enable all access" ON transactions;
DROP POLICY IF EXISTS "Enable all access" ON app_users;
DROP POLICY IF EXISTS "Enable all access" ON system_config;

-- Create permissive policies for ALL operations (Select, Insert, Update, Delete)
CREATE POLICY "Enable all access" ON taxpayers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access" ON vehicles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access" ON transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access" ON app_users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access" ON system_config FOR ALL USING (true) WITH CHECK (true);

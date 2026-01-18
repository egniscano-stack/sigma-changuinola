
-- Enable RLS
alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;

-- 1. Create Taxpayers Table
CREATE TABLE taxpayers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  taxpayer_number TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('NATURAL', 'JURIDICA')),
  status TEXT NOT NULL CHECK (status IN ('ACTIVO', 'SUSPENDIDO', 'BLOQUEADO')),
  doc_id TEXT UNIQUE NOT NULL, -- Cédula or RUC
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

-- 2. Create Vehicles Table (One-to-Many)
CREATE TABLE vehicles (
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

-- 3. Create Transactions Table
CREATE TABLE transactions (
  id TEXT PRIMARY KEY, -- Using TEXT to keep "TX-..." format for now, or UUID if preferred
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

-- 4. Create App Users Table (for Admin/Teller login)
-- Note: In a real Supabase app, you'd integrate with Supabase Auth (auth.users).
-- For this migration, we'll create a table to match the current 'User' type for simple separation.
CREATE TABLE app_users (
  username TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'CAJERO', 'CONTRIBUYENTE')),
  password TEXT NOT NULL -- PLAIN TEXT for this demo migration. Should be hashed or use Supabase Auth.
);

-- 5. Create Config Table (Single Row)
CREATE TABLE system_config (
  id INT PRIMARY KEY DEFAULT 1,
  config JSONB NOT NULL
);

-- 6. Insert Mock Data
INSERT INTO app_users (username, name, role, password) VALUES
('director', 'Director Municipal', 'ADMIN', 'admin'),
('recaudador', 'Oficial de Recaudación', 'CAJERO', 'cajero');

INSERT INTO system_config (config) VALUES ('{
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
}');

-- Mock Taxpayers & Transactions would be inserted similarly if needed, or created via UI.

-- Enable Row Level Security (RLS) - Permissive for initial setup
ALTER TABLE taxpayers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for all users" ON taxpayers FOR ALL USING (true);
CREATE POLICY "Enable all access for all users" ON vehicles FOR ALL USING (true);
CREATE POLICY "Enable all access for all users" ON transactions FOR ALL USING (true);
CREATE POLICY "Enable all access for all users" ON app_users FOR ALL USING (true);
CREATE POLICY "Enable all access for all users" ON system_config FOR ALL USING (true);


-- SIGMA CHANGUINOLA v0.0.4 - COMPLETE SCHEMA FIX
-- Run this in Supabase SQL Editor to resolve all sync errors related to schema mismatches.

DO $$ 
BEGIN
    -- 1. FIX TAXPAYERS TABLE
    -- Add missing columns
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'taxpayers' AND COLUMN_NAME = 'balance') THEN
        ALTER TABLE taxpayers ADD COLUMN balance DECIMAL(10, 2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'taxpayers' AND COLUMN_NAME = 'corregimiento') THEN
        ALTER TABLE taxpayers ADD COLUMN corregimiento TEXT;
    END IF;

    -- Update status constraint to include 'MOROSO'
    ALTER TABLE taxpayers DROP CONSTRAINT IF EXISTS taxpayers_status_check;
    ALTER TABLE taxpayers ADD CONSTRAINT taxpayers_status_check 
    CHECK (status IN ('ACTIVO', 'SUSPENDIDO', 'BLOQUEADO', 'MOROSO'));

    -- 2. FIX APP_USERS TABLE
    -- Expand role constraints
    ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_role_check;
    ALTER TABLE app_users ADD CONSTRAINT app_users_role_check 
    CHECK (role IN ('ADMIN', 'CAJERO', 'CONTRIBUYENTE', 'AUDITOR', 'REGISTRO', 'ALCALDE', 'SECRETARIA'));

    -- 3. FIX TRANSACTIONS TABLE
    -- Expand payment method constraints
    ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_payment_method_check;
    ALTER TABLE transactions ADD CONSTRAINT transactions_payment_method_check 
    CHECK (payment_method IN ('EFECTIVO', 'TARJETA', 'CHEQUE', 'ONLINE', 'ARREGLO_PAGO'));

    -- 4. ENSURE RLS POLICIES ARE PERMISSIVE (Dev Mode)
    -- This ensures the app can actually write to the tables
    DROP POLICY IF EXISTS "Enable all access" ON taxpayers;
    DROP POLICY IF EXISTS "Enable all access" ON transactions;
    DROP POLICY IF EXISTS "Enable all access" ON app_users;
    DROP POLICY IF EXISTS "Enable all access" ON admin_requests;

    CREATE POLICY "Enable all access" ON taxpayers FOR ALL USING (true) WITH CHECK (true);
    CREATE POLICY "Enable all access" ON transactions FOR ALL USING (true) WITH CHECK (true);
    CREATE POLICY "Enable all access" ON app_users FOR ALL USING (true) WITH CHECK (true);
    
    -- Ensure admin_requests table exists and has RLS
    IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'admin_requests') THEN
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'admin_requests' AND COLUMN_NAME = 'taxpayer_id') THEN
            ALTER TABLE admin_requests ADD COLUMN taxpayer_id TEXT;
        END IF;
        CREATE POLICY "Enable all access" ON admin_requests FOR ALL USING (true) WITH CHECK (true);
    END IF;

    RAISE NOTICE 'Database schema synchronized with SIGMA v0.0.4 requirements.';
END $$;

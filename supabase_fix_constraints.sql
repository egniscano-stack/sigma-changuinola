
-- FIX CONSTRAINTS AND ROLES FOR SIGMA VERSION 0.0.4
-- Run this in your Supabase SQL Editor to allow new user roles and payment methods.

-- 1. Update app_users role constraints
-- The existing table has a check constraint that limits roles to 'ADMIN', 'CAJERO', 'CONTRIBUYENTE'.
-- We need to expand this to include the new roles used in version 0.0.4.

DO $$ 
BEGIN
    -- Drop the constraint if it exists
    ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_role_check;
    
    -- Add the expanded constraint
    ALTER TABLE app_users ADD CONSTRAINT app_users_role_check 
    CHECK (role IN ('ADMIN', 'CAJERO', 'CONTRIBUYENTE', 'AUDITOR', 'REGISTRO', 'ALCALDE', 'SECRETARIA'));
    
    -- Update existing users if necessary (ensure they are in the allowed list)
    -- This is optional but good for safety
    UPDATE app_users SET role = 'ADMIN' WHERE role NOT IN ('ADMIN', 'CAJERO', 'CONTRIBUYENTE', 'AUDITOR', 'REGISTRO', 'ALCALDE', 'SECRETARIA');

    -- 2. Update transactions payment method constraints
    -- We added 'ARREGLO_PAGO' as a new payment method for debt arrangements.
    ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_payment_method_check;
    ALTER TABLE transactions ADD CONSTRAINT transactions_payment_method_check 
    CHECK (payment_method IN ('EFECTIVO', 'TARJETA', 'CHEQUE', 'ONLINE', 'ARREGLO_PAGO'));

    RAISE NOTICE 'Database constraints updated successfully for SIGMA v0.0.4';
END $$;

-- Add corregimiento and balance columns to taxpayers table
ALTER TABLE taxpayers ADD COLUMN IF NOT EXISTS corregimiento TEXT;
ALTER TABLE taxpayers ADD COLUMN IF NOT EXISTS balance NUMERIC DEFAULT 0;

-- Optional: Create constraint for corregimiento values if you want strict validation
-- ALTER TABLE taxpayers ADD CONSTRAINT check_corregimiento CHECK (corregimiento IN ('Finca 4', 'Guabito', ...));

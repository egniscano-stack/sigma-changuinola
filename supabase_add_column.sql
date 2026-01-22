
-- Add rejection_reason column to agenda_items if it doesn't exist
ALTER TABLE agenda_items ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

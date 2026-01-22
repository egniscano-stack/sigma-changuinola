-- Add documents column to taxpayers table for storing URLs of attached files
-- The column is of type JSONB to store a flexible dictionary of document types and their URLs
-- Example: { "cedula": "https://...", "aviso": "https://..." }

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'taxpayers' AND column_name = 'documents') THEN
        ALTER TABLE taxpayers ADD COLUMN documents JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

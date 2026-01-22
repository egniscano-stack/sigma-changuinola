-- Script to setup Storage Bucket and Policies for Taxpayer Documents

-- 1. Create the bucket 'taxpayer-documents' if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('taxpayer-documents', 'taxpayer-documents', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Enable RLS on objects (usually enabled by default, but good to ensure)
-- storage.objects is a system table, so we modify policies on it.

-- 3. Create Policy to Allow Public Access (SELECT) - For viewing images
-- Make sure to drop existing policies to avoid conflicts if re-running
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'taxpayer-documents' );

-- 4. Create Policy to Allow Uploads (INSERT)
-- WARNING: This allows anyone (anon) to upload to this bucket. 
-- In production, you might want to restrict this to authenticated users.
DROP POLICY IF EXISTS "Allow Uploads" ON storage.objects;
CREATE POLICY "Allow Uploads"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'taxpayer-documents' );

-- 5. Create Policy to Allow Updates (UPSERT)
DROP POLICY IF EXISTS "Allow Updates" ON storage.objects;
CREATE POLICY "Allow Updates"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'taxpayer-documents' );

-- 6. Create Policy to Allow Deletes (Optional, if you want users to delete)
DROP POLICY IF EXISTS "Allow Deletes" ON storage.objects;
CREATE POLICY "Allow Deletes"
ON storage.objects FOR DELETE
USING ( bucket_id = 'taxpayer-documents' );

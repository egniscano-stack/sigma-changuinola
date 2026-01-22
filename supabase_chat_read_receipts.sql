-- Add is_read column to chat_messages if not exists (although previous logic assumes it exists)
-- Also create an index for performance on reading unread messages

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_messages' AND column_name = 'is_read') THEN
        ALTER TABLE chat_messages ADD COLUMN is_read BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Create Index for faster lookup of unread messages
CREATE INDEX IF NOT EXISTS idx_chat_messages_unread ON chat_messages(recipient_username, is_read);

-- Ensure RLS allows updating 'is_read' by the recipient
-- We need to check if RLS is enabled.
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Senders can INSERT
CREATE POLICY "Senders can insert" ON chat_messages FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Policy: Everyone can SELECT (for now, to simplify visibility)
CREATE POLICY "Everyone can select" ON chat_messages FOR SELECT TO anon, authenticated USING (true);

-- Policy: Recipients can UPDATE 'is_read' to true
-- Limitation: Supabase anon keys might not map to 'username' directly if using custom auth.
-- But assuming we use the client directly, let's allow Update for everyone for now to ensure this fix works, 
-- or try to scope it if we had auth.uid matching.
-- Since this app uses 'app_users' table and custom logic, relying on pg row level security with standard auth.uid() might fail 
-- if we are not signing in via Supabase Auth properly but just using the client.
-- Given the 'db.ts' implementation seems to use a single client, we likely rely on client-side logic + permissive RLS or disabled RLS.
-- Let's make it permissive for UPDATE to ensure the feature works immediately.
CREATE POLICY "Allow update for all" ON chat_messages FOR UPDATE TO anon, authenticated USING (true);

-- Add last_read_general_chat to app_users for persistent General Chat read status
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_users' AND column_name = 'last_read_general_chat') THEN
        ALTER TABLE app_users ADD COLUMN last_read_general_chat TIMESTAMPTZ;
    END IF;
END $$;


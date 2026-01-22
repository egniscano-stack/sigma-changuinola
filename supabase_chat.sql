
-- Create chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_username TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    recipient_username TEXT, -- NULL for public/general channel
    content TEXT,
    attachment_url TEXT,
    attachment_type TEXT, -- 'image', 'file', etc.
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_read BOOLEAN DEFAULT FALSE
);

-- Enable RLS
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read and write (internal tool)
CREATE POLICY "Enable all access for all users" ON chat_messages
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;

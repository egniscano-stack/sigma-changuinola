
-- Create admin_requests table
CREATE TABLE IF NOT EXISTS admin_requests (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    status TEXT NOT NULL, -- 'PENDING', 'APPROVED', 'REJECTED', 'ARCHIVED'
    requester_name TEXT,
    taxpayer_name TEXT,
    description TEXT,
    transaction_id TEXT, -- Optional (for voids)
    payload JSONB, -- Optional (for taxpayer updates)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    response_note TEXT,
    total_debt NUMERIC,
    approved_amount NUMERIC,
    installments INTEGER,
    approved_total_debt NUMERIC
);

-- Enable RLS
ALTER TABLE admin_requests ENABLE ROW LEVEL SECURITY;

-- Create permissive policy (as per current development mode)
CREATE POLICY "Enable all access for all users" ON admin_requests
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE admin_requests;

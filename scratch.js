import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log("Subscribing to admin_requests...");
const channel = supabase.channel('public:admin_requests');
channel.on('postgres_changes', { event: '*', schema: 'public', table: 'admin_requests' }, (payload) => {
    console.log("REALTIME EVENT RECEIVED:", payload);
}).subscribe((status) => {
    console.log("Subscription status:", status);
    if (status === 'SUBSCRIBED') {
        console.log("Creating a mock request to test...");
        supabase.from('admin_requests').insert({
            id: 'TEST-' + Date.now(),
            type: 'VOID_TRANSACTION',
            status: 'PENDING',
            requester_name: 'System Test',
            taxpayer_name: 'Test',
            description: 'Test Realtime'
        }).then(({error}) => {
            if(error) console.error("Insert Error:", error);
            else console.log("Insert success. Waiting for event...");
            setTimeout(() => process.exit(0), 3000);
        });
    }
});

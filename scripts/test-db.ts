
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Manual env loading for script
const envLocalPath = path.resolve(process.cwd(), '.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envLocalPath));

const supabaseUrl = envConfig.VITE_SUPABASE_URL;
const supabaseKey = envConfig.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env.local');
    process.exit(1);
}

console.log(`🌐 Supabase URL: ${supabaseUrl}`);
console.log(`🔑 Key Found: ${supabaseKey ? 'Yes (Hidden)' : 'No'}`);

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
    console.log('🔄 Testing connection...');
    try {
        const { data, error } = await supabase.from('app_users').select('*').limit(5);
        if (error) {
            console.error('❌ Connection Failed:', error.message);
            if (error.code) console.error('   Code:', error.code);
            if (error.details) console.error('   Details:', error.details);
        } else {
            console.log('✅ Connection Successful!');
            console.log(`📊 Found ${data.length} users.`);
            if (data.length > 0) {
                console.log('   Users:', data.map(u => u.username).join(', '));
            } else {
                console.log('   ⚠️ Table is empty. Auto-seeding logic in app should trigger on next load.');
            }
        }
    } catch (err: any) {
        console.error('❌ Unexpected Error:', err.message);
    }
}

testConnection();


import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load .env.local manually
const envPath = path.resolve(process.cwd(), '.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const url = envConfig.VITE_SUPABASE_URL;
const key = envConfig.VITE_SUPABASE_ANON_KEY;

console.log('--- DIAGNOSTIC ---');
console.log('URL:', url);
console.log('Key length:', key ? key.length : 0);

if (!url || !key) {
    console.error('Missing credentials');
    process.exit(1);
}

const supabase = createClient(url, key);

async function check() {
    console.log('Querying app_users...');
    const { data, error } = await supabase.from('app_users').select('*');

    if (error) {
        console.error('ERROR:', error);
    } else {
        console.log('SUCCESS. Users found:', data.length);
        console.log(data);
    }
}

check();

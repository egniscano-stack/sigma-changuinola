
import { createClient } from '@supabase/supabase-js';

const url = 'https://qxmugkwcsxwxrwjshumg.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4bXVna3djc3h3eHJ3anNodW1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MzkzOTksImV4cCI6MjA3MjQxNTM5OX0.Pu-0O7HjUqdO3quZeuIMTWi2Nxtbd0DGxT_cAYr1DjA';

const supabase = createClient(url, key);

async function createAlcalde() {
    console.log('Creating Alcalde user...');

    // 1. Try to fetch to see if exists
    const { data: existing, error: fetchError } = await supabase.from('app_users').select('*').eq('username', 'alcalde').single();

    if (existing) {
        console.log('Alcalde user ALREADY exists:', existing);
        console.log('Password should be:', existing.password);
        return;
    }

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "Relation not found" or "No rows" usually, but single() returns error if no rows
        // If it's not "row not found", it's a real error
        // console.error("Fetch error (might just be not found):", fetchError);
    }

    // 2. Try to Create
    const { data, error } = await supabase.from('app_users').insert({
        username: 'alcalde',
        password: 'mnc',
        name: 'Alcalde Municipal',
        role: 'ALCALDE'
    }).select().single();

    if (error) {
        console.error('FAILED to create Alcalde:', error);
        console.log('\n--- DIAGNOSIS ---');
        if (error.message.includes('violates check constraint')) {
            console.log('CRITICAL: The database is blocking the "ALCALDE" role.');
            console.log('You MUST run the SQL command to update the allowed roles in Supabase.');
        } else {
            console.log('Unknown error. Check Supabase logs.');
        }
    } else {
        console.log('SUCCESS: Created Alcalde User:', data);
    }
}

createAlcalde();

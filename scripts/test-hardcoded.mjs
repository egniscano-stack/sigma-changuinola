
import { createClient } from '@supabase/supabase-js';

const url = 'https://qxmugkwcsxwxrwjshumg.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4bXVna3djc3h3eHJ3anNodW1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MzkzOTksImV4cCI6MjA3MjQxNTM5OX0.Pu-0O7HjUqdO3quZeuIMTWi2Nxtbd0DGxT_cAYr1DjA';

console.log('Connecting to:', url);
const supabase = createClient(url, key);

async function test() {
    try {
        const { data, error } = await supabase.from('app_users').select('*');
        if (error) {
            console.error('ERROR:', error);
        } else {
            console.log('Valid Connection!');
            console.log('User count:', data.length);
            console.log('Users:', JSON.stringify(data, null, 2));
        }
    } catch (e) {
        console.error('EXCEPTION:', e);
    }
}

test();


import { createClient } from '@supabase/supabase-js';

const url = 'https://qxmugkwcsxwxrwjshumg.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4bXVna3djc3h3eHJ3anNodW1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MzkzOTksImV4cCI6MjA3MjQxNTM5OX0.Pu-0O7HjUqdO3quZeuIMTWi2Nxtbd0DGxT_cAYr1DjA';

const supabase = createClient(url, key);

async function createAdmin() {
    console.log('Creating admin user...');

    // Check if exists first
    const { data: existing } = await supabase.from('app_users').select('*').eq('username', 'admin').single();

    if (existing) {
        console.log('Admin user already exists:', existing);
        return;
    }

    const { data, error } = await supabase.from('app_users').insert({
        username: 'admin',
        password: 'admin123',
        name: 'Administrador Principal',
        role: 'ADMIN'
    }).select().single();

    if (error) {
        console.error('Error creating admin:', error);
    } else {
        console.log('Created Admin User:', data);
    }
}

createAdmin();

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://qxmugkwcsxwxrwjshumg.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4bXVna3djc3h3eHJ3anNodW1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MzkzOTksImV4cCI6MjA3MjQxNTM5OX0.Pu-0O7HjUqdO3quZeuIMTWi2Nxtbd0DGxT_cAYr1DjA'
);

const { data, error } = await supabase
    .from('app_users')
    .select('username, name, role, password');

if (error) {
    console.error('Error:', error.message);
} else {
    console.log('\n===== USUARIOS EN SUPABASE =====');
    data.forEach(u => {
        console.log(`Usuario: ${u.username} | Contraseña: ${u.password} | Nombre: ${u.name} | Rol: ${u.role}`);
    });
    console.log('================================\n');
}

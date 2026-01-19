
import { createClient } from '@supabase/supabase-js';

// Hardcoded credentials for immediate stability
const supabaseUrl = 'https://qxmugkwcsxwxrwjshumg.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4bXVna3djc3h3eHJ3anNodW1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MzkzOTksImV4cCI6MjA3MjQxNTM5OX0.Pu-0O7HjUqdO3quZeuIMTWi2Nxtbd0DGxT_cAYr1DjA';

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("Supabase keys are missing.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

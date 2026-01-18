
import { createClient } from '@supabase/supabase-js';

// Load env vars
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    // If keys are missing, we'll log a warning but the app might fail if it tries to use them.
    console.warn("Supabase keys are missing in environment variables. Check .env.local");
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

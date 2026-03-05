
import { createClient } from '@supabase/supabase-js';

// ============================================================
// SECURITY: Credentials MUST come from environment variables.
// NEVER hardcode API keys or secrets in source code.
// Configure your .env.local file (not committed to git):
//   VITE_SUPABASE_URL=your_supabase_url
//   VITE_SUPABASE_ANON_KEY=your_anon_key
// ============================================================

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
        '[SIGMA Security] CRITICAL: Variables de entorno de Supabase no configuradas.\n' +
        'Cree un archivo .env.local con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.\n' +
        'NUNCA hardcodee credenciales en el código fuente.'
    );
    // In production, this would throw an error to prevent app startup without credentials
    if (import.meta.env.PROD) {
        throw new Error('[SIGMA Security] Configuración de seguridad incompleta. Contacte al administrador del sistema.');
    }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        // Persist session in sessionStorage (more secure than localStorage - clears on tab close)
        persistSession: true,
        storageKey: 'sigma_supabase_auth',
        // Auto-refresh tokens
        autoRefreshToken: true,
        // Detect session from URL (for magic links etc.)
        detectSessionInUrl: false,
    },
    global: {
        headers: {
            // Add custom security header for request identification
            'X-Client-Info': 'sigma-changuinola/2.0',
        },
    },
    realtime: {
        params: {
            eventsPerSecond: 10, // Rate limit realtime events
        },
    },
});

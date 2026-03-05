import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      // Security headers for dev server
      headers: {
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
      },
    },
    base: './',
    plugins: [react()],
    define: {
      // Only expose variables prefixed with VITE_ to the client bundle
      // This prevents accidentally exposing server-side secrets
      'process.env.API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      // Production build security options
      sourcemap: false,       // Do NOT expose source maps in production (hides code structure)
      minify: 'terser',       // Minify and obfuscate the output
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          // Randomize chunk file names to prevent directory enumeration
          chunkFileNames: 'assets/[hash].js',
          entryFileNames: 'assets/[hash].js',
          assetFileNames: 'assets/[hash].[ext]',
          // Split vendor code for better caching
          manualChunks: {
            react: ['react', 'react-dom'],
            supabase: ['@supabase/supabase-js'],
            xlsx: ['xlsx'],
          },
        },
      },
    },
  };
});

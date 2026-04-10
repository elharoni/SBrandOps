import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import tailwindConfig from './tailwind.config.js';

export default defineConfig(({ mode }) => {
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react(), basicSsl()],
    // NOTE: Do NOT inject secrets via define{} — they get embedded in the client bundle.
    // Use import.meta.env.VITE_* for public vars, and keep secrets in Edge Function env only.
    css: {
      postcss: {
        plugins: [
          tailwindcss(tailwindConfig),
          autoprefixer(),
        ],
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      sourcemap: mode !== 'production',
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;

            if (id.includes('react') || id.includes('scheduler')) return 'react-vendor';
            if (id.includes('react-router')) return 'router-vendor';
            if (id.includes('@supabase')) return 'supabase-vendor';
            if (id.includes('@tanstack/react-query')) return 'query-vendor';
            if (id.includes('recharts')) return 'charts-vendor';
            if (id.includes('@google/genai')) return 'ai-vendor';

            return 'vendor';
          },
        },
      },
    },
  };
});

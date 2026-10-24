import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
    test: {
      exclude: ['tests/**', 'node_modules', 'clive_web_fixer/**', 'test-results/**'],
    },
    server: {
      proxy: {
        '/api/': {
          target: env.VITE_SUPABASE_URL || 'https://fleoxzauuvfbdysvadev.supabase.co/functions/v1',
          changeOrigin: true,
          secure: mode !== 'development',
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
              return 'react-vendor';
            }
            if (id.includes('node_modules/react-router')) {
              return 'router-vendor';
            }
            if (id.includes('node_modules/@supabase/')) {
              return 'supabase-vendor';
            }
            if (id.includes('node_modules/lamejs/')) {
              return 'audio-encoder';
            }
          },
        },
      },
    },
  };
});

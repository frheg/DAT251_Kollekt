import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  if (mode === 'mobile') {
    const env = loadEnv(mode, '.', 'VITE_');
    for (const key of ['VITE_API_URL', 'VITE_GAMES_API_URL'] as const) {
      if (!env[key]?.startsWith('https://')) {
        throw new Error(`${key} must be an absolute HTTPS URL in .env.mobile`);
      }
    }
  }

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      proxy: {
        '/api': 'http://localhost:8080',
      },
    },
  };
});

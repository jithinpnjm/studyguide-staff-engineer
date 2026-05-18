import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // Use VITE_BASE_PATH from env (set during CI build), fallback to '/' for local dev
  base: process.env.VITE_BASE_PATH || '/',
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8765',
        changeOrigin: true,
      },
    },
  },
}));

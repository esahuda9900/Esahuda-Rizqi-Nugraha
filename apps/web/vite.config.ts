import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// GitHub Project Pages: https://esahuda9900.github.io/Esahuda-Rizqi-Nugraha/
// Override with VITE_BASE=/ for local root or custom host.
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || '/Esahuda-Rizqi-Nugraha/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});

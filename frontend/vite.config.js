import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@engine': path.resolve(__dirname, '../eclipse-engine/src'),
      '@pricing': path.resolve(__dirname, '../eclipse-pricing/src'),
      // Stub Node-only modules for browser build (engine-3d.js uses these)
      'child_process': path.resolve(__dirname, 'src/lib/node-stubs.js'),
      'url': path.resolve(__dirname, 'src/lib/node-stubs.js'),
      'path': path.resolve(__dirname, 'src/lib/node-stubs.js'),
    }
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8888'
    },
    fs: {
      // Allow serving files from parent directories (engine + pricing modules)
      allow: ['..']
    }
  },
  base: './',
  build: {
    outDir: '../dist',
    rollupOptions: {
      // Mark Node.js built-ins as external stubs
      external: [],
    }
  }
});

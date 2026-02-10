import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Fix for WSL2: Enable polling to detect changes on Windows
export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@lib': path.resolve(__dirname, './lib'),
    },
  },

  server: {
    host: true,
    port: 5173,
    strictPort: true,
    watch: {
      useFsEvents: false,  // Disable native FS events on WSL2
      usePolling: true,        // Enable polling to detect changes
    },
    // Proxy API requests to WhatsApp Server
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        secure: false,
      }
    }
  },

  build: {
    outDir: 'dist',
    sourcemap: false
  },
});

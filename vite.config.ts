import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

// Fix for WSL2: Enable polling to detect changes on Windows
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'MyFleet Pro - مدير الأسطول',
        short_name: 'مدير الأسطول',
        description: 'نظام إدارة الأسطول الذكي للمؤسسات',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        dir: 'rtl',
        lang: 'ar',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],

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

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        maximumFileSizeToCacheInBytes: 3500000
      },
      includeAssets: ['pwa.png', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'MessMeal | Campus Dining',
        short_name: 'MessMeal',
        description: 'Manage and view campus dining menus, notices, and feedback instantly.',
        theme_color: '#F9FAFB',
        background_color: '#F9FAFB',
        display: 'standalone',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  build: {
    chunkSizeWarningLimit: 3000,
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          'firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/messaging', 'firebase/storage'],
          'react-vendor': ['react', 'react-dom'],
          'ui': ['lucide-react', 'react-hot-toast'],
        }
      }
    }
  }
})

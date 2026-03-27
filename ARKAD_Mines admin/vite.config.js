import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      axios: path.resolve(__dirname, 'node_modules/axios'),
    },
    dedupe: ['react', 'react-dom'],
  },
  build: {
    // Ensure proper cache busting
    rollupOptions: {
      output: {
        // Add hash to filenames for cache busting
        entryFileNames: `assets/[name].[hash].js`,
        chunkFileNames: `assets/[name].[hash].js`,
        assetFileNames: `assets/[name].[hash].[ext]`
      }
    },
    // Increase chunk size warning limit if needed
    chunkSizeWarningLimit: 1000
  }
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5174,
    allowedHosts: true,
    hmr: {
      clientPort: 443,   
    },
    proxy: {
      '/api':    { target: 'http://localhost:4000', changeOrigin: true, secure: false },
      '/images': { target: 'http://localhost:4000', changeOrigin: true, secure: false },
    },
  },
  resolve: {
    alias: {
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      axios: path.resolve(__dirname, 'node_modules/axios'),
      'react-toastify': path.resolve(__dirname, 'node_modules/react-toastify'),
      'react-google-recaptcha': path.resolve(__dirname, 'node_modules/react-google-recaptcha'),
      'react-icons': path.resolve(__dirname, 'node_modules/react-icons'),
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
    
    chunkSizeWarningLimit: 1000
  }
})

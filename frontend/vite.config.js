import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../public',
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:5002',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            // Increase body limit for large backup files
            if (req.method === 'POST' && req.url.includes('/backup/import')) {
              req.headers['content-length'] = req.headers['content-length'] || '0';
            }
          });
        },
      }
    }
  }
})

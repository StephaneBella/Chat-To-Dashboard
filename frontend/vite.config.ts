import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// The dashboard reaches Django through this dev proxy instead of calling
// http://localhost:8000 directly. Every request therefore stays same-origin:
// no CORS preflight, and the app keeps working whatever host the page is
// served from (localhost, 127.0.0.1, ...). Set VITE_API_PROXY_TARGET to
// point at a different backend.
const API_TARGET = process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:8000'

const apiProxy = {
  '/api': {
    target: API_TARGET,
    changeOrigin: true,
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react() , tailwindcss()],
  server: {
    proxy: apiProxy,
  },
  preview: {
    proxy: apiProxy,
  },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  publicDir: '../../../packages/shared/public',
  resolve: {
    alias: {
      '@ui': path.resolve(__dirname, '../../../packages/ui')
    }
  },
  server: { port: 5176, host: true }
})

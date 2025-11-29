import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { locidPlugin } from '@locid/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    locidPlugin({
      dir: 'locid', // where your server actions live
      endpoint: '/locid',
    }),
  ],
})


import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Electronの file:// プロトコルで正しく動作させるために `base` を設定
  base: './',
  build: {
    rollupOptions: {
      // No longer externalizing any modules. All will be bundled.
    },
  },
})
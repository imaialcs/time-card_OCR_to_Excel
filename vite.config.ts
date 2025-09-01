<<<<<<< HEAD
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Electronの file:// プロトコルで正しく動作させるために `base` を設定
  base: './',
  build: {
    rollupOptions: {
      // importmapで読み込まれるモジュールはバンドル対象外とする
      external: [
        'xlsx',
        'pdfjs-dist'
      ],
    },
  },
})
=======
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
>>>>>>> 7b386db226a4259bb4a04124e710d90651f0b88d

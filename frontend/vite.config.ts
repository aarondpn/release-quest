import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig({
  root: path.resolve(__dirname),
  plugins: [vue()],
  publicDir: false,
  build: {
    outDir: path.resolve(__dirname, '../public/dist'),
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/': {
        target: 'http://localhost:3000',
        ws: true,
        bypass(req) {
          // Let Vite handle its own HMR and module requests
          if (req.url?.startsWith('/@') || req.url?.startsWith('/node_modules') || req.url?.startsWith('/frontend/') || req.url?.startsWith('/main.ts') || req.url?.endsWith('.vue') || req.url?.endsWith('.ts')) {
            return req.url;
          }
          // Let Vite handle the root HTML
          if (req.url === '/' || req.url === '/index.html') {
            return req.url;
          }
        },
      },
    },
  },
});

import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    host:'127.0.0.1',
    port:Number(process.env.PORT||15133),
    strictPort:true,
    proxy: { '/api': { target: process.env.API_BASE_URL || 'http://127.0.0.1:3000', changeOrigin: true } },
  },
});

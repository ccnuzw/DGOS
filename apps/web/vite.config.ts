import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { host:'127.0.0.1', port:Number(process.env.PORT||15133), strictPort:true, proxy: process.env.API_BASE_URL ? { '/api': { target: process.env.API_BASE_URL, changeOrigin: true } } : undefined },
});

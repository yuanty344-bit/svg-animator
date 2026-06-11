import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [viteSingleFile()],
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString().slice(0, 19).replace('T', ' ')),
  },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 100000000,
  },
  server: {
    open: true,
  },
  test: {
    environment: 'jsdom',
  },
});

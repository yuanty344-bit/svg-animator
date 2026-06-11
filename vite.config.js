import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [viteSingleFile()],
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

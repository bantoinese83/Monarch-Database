import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'Monarch',
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'es' ? 'js' : 'cjs'}`
    },
    rollupOptions: {
      external: (id) => {
        // Externalize Node.js built-ins
        return id.startsWith('node:') || 
               ['fs', 'path', 'http', 'crypto', 'util', 'stream'].includes(id);
      },
      output: {
        globals: {},
        // Manual chunks for better code splitting (commented for now - can enable later)
        // manualChunks: (id) => {
        //   if (id.includes('optimized-data-structures')) return 'data-structures';
        //   if (id.includes('durability-manager') || id.includes('security-manager') || id.includes('clustering-manager')) return 'enterprise';
        //   if (id.includes('ai-ml-integration')) return 'ai-ml';
        //   if (id.includes('scripting-engine')) return 'scripting';
        //   if (id.includes('http-server')) return 'server';
        // }
      }
    },
    sourcemap: true,
    minify: 'esbuild', // Enable minification for production
    // Build for Node.js environment to support fs module
    target: 'node18',
    // Reduce chunk size warnings
    chunkSizeWarningLimit: 1000
  },
  plugins: [
    dts({
      insertTypesEntry: true,
      rollupTypes: true
    })
  ],
  test: {
    environment: 'node',
    globals: true,
    include: ['test/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}']
  }
});

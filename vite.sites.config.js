import { defineConfig } from 'vite';
import { sites } from '@openai/sites-vite-plugin';

// Keep the offline app's stable asset URLs; only bundle its small API Worker.
export default defineConfig({
  plugins: [sites()],
  publicDir: false,
  build: {
    ssr: 'worker/index.js',
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    rolldownOptions: {
      output: { format: 'es', entryFileNames: 'server/index.js' },
    },
  },
});

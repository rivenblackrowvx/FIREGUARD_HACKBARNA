import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// maplibre-gl 6 builds its worker URL at runtime, so Vite never sees it.
// Ship the worker (and the shared chunk it imports) as fixed-name assets;
// main.tsx points setWorkerUrl at them in production.
function maplibreWorker(): Plugin {
  const dist = dirname(createRequire(import.meta.url).resolve('maplibre-gl/dist/maplibre-gl.mjs'));
  return {
    name: 'maplibre-worker',
    apply: 'build',
    generateBundle() {
      for (const f of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) {
        this.emitFile({ type: 'asset', fileName: `maplibre/${f}`, source: readFileSync(join(dist, f)) });
      }
    },
  };
}

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react(), maplibreWorker()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:8787' } },
  // maplibre-gl 6 spawns its worker from a sibling module; pre-bundling breaks that path.
  optimizeDeps: { exclude: ['maplibre-gl'] },
  build: { outDir: 'dist', chunkSizeWarningLimit: 2500 },
});

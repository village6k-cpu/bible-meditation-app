import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { fileURLToPath } from 'node:url';

// 로직은 네이티브 앱과 한 벌을 쓴다 — core는 손대지 않고, db는 브라우저용 껍데기만 갈아 끼운다.
const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@core': r('../mitjul/src/core'),
      '@db': r('../mitjul/src/db'),
    },
  },
  server: { fs: { allow: ['..'] } },
  // sqlite-wasm은 자기 옆의 .wasm을 스스로 찾는다 — 사전 번들링에서 빼 둔다
  optimizeDeps: { exclude: ['@sqlite.org/sqlite-wasm'] },
  worker: { format: 'es' },
  build: { target: 'es2022', sourcemap: true },
});

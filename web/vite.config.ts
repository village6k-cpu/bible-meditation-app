import { defineConfig, type Plugin } from 'vite';
import preact from '@preact/preset-vite';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// 로직은 네이티브 앱과 한 벌을 쓴다 — core는 손대지 않고, db는 브라우저용 껍데기만 갈아 끼운다.
const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// 서비스 워커가 캐시할 자산 목록을 빌드가 박아 준다.
// HTML만 새로 캐시하고 그것이 부르는 해시 붙은 자산을 빠뜨리면, 다음 오프라인 실행에서 빈 화면이 된다.
function precache(): Plugin {
  return {
    name: 'mitjul-precache',
    apply: 'build',
    closeBundle() {
      const out = r('./dist');
      // 빌드가 실패해도 이 훅은 불린다. 그때 dist가 없다고 여기서 ENOENT를 던지면
      // 진짜 오류가 이 오류에 가려진다 — 실제로 그렇게 한 번 속았다.
      if (!existsSync(out)) return;
      const files: string[] = [];
      const walk = (dir: string) => {
        for (const name of readdirSync(dir)) {
          const full = join(dir, name);
          if (statSync(full).isDirectory()) walk(full);
          else files.push('./' + relative(out, full).split('\\').join('/'));
        }
      };
      walk(out);
      const assets = files.filter(
        (f) => !f.endsWith('.map') && !f.endsWith('/sw.js') && !f.endsWith('index.html')
      );
      const swPath = join(out, 'sw.js');
      const src = readFileSync(swPath, 'utf8');
      const build = createHash('sha256').update(assets.sort().join('|')).digest('hex').slice(0, 12);
      writeFileSync(
        swPath,
        src.replace('__PRECACHE__', JSON.stringify(assets.sort())).replace('__BUILD_ID__', build),
        'utf8'
      );
      this.info?.(`precache: ${assets.length} files · build ${build}`);
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [preact(), precache()],
  resolve: {
    alias: {
      '@core': r('../mitjul/src/core'),
      '@db': r('../mitjul/src/db'),
      '@ex': r('../mitjul/src/export'),
    },
  },
  server: { fs: { allow: ['..'] } },
  // esbuild는 변환하는 파일마다 가장 가까운 tsconfig을 찾아 위로 올라간다. mitjul/src/**를 변환할 때
  // 걸리는 mitjul/tsconfig.json은 expo/tsconfig.base를 extends 하는데, 네이티브 의존성이 없으면
  // 거기서 빌드가 죽는다 — 저장소를 갓 받은 상태와 CI가 정확히 그렇다.
  // 문자열로 주어야 탐색 자체를 건너뛴다. 객체로 주면 찾아 올라간 뒤 합치므로 같은 곳에서 죽는다.
  esbuild: {
    tsconfigRaw:
      '{"compilerOptions":{"target":"es2022","jsx":"react-jsx","jsxImportSource":"preact","useDefineForClassFields":true}}',
  },
  // sqlite-wasm은 자기 옆의 .wasm을 스스로 찾는다 — 사전 번들링에서 빼 둔다
  optimizeDeps: { exclude: ['@sqlite.org/sqlite-wasm'] },
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    sourcemap: true,
    // 자체 점검 페이지도 함께 빌드한다 — 기기에서 정말 도는지 확인하는 건 배포된 판이어야 한다
    rollupOptions: { input: { main: r('./index.html'), selftest: r('./selftest.html') } },
  },
});

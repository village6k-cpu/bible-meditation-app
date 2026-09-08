import { MIGRATIONS } from '@db/migrations';
import { createEntry, queryLibrary, tagsOf, unfiledCount } from '@db/entryRepo';
import { createSource, recentSources } from '@db/sourceRepo';
import { parseCapture } from '@core/parse';
import { buildDailyNote } from '@core/markdown';
import { todayKey } from '@core/dates';
import { db, asSqlite } from './db';

// 이 브라우저에서 정말 돌아가는지 — 저장 엔진, 마이그레이션, 리포지토리, 파서, 내보내기까지.
const out = document.getElementById('out')!;
const lines: string[] = [];
const say = (ok: boolean, msg: string) => {
  lines.push(`${ok ? '  OK  ' : ' FAIL '} ${msg}`);
  out.innerHTML = lines
    .map(
      (l) =>
        `<span class="${l.startsWith('  OK') ? 'ok' : l.startsWith(' FAIL') ? 'bad' : ''}">${l}</span>`
    )
    .join('\n');
};
const note = (msg: string) => {
  lines.push(msg);
  out.textContent = lines.join('\n');
};

async function run() {
  const t0 = performance.now();
  const d = await db();
  note(`저장 엔진: ${d.engine === 'opfs' ? 'OPFS (기기 안 파일)' : '메모리 + IndexedDB 스냅숏'}`);
  note(`열기 ${Math.round(performance.now() - t0)}ms`);
  if (d.opfsError) note(`OPFS 실패 사유: ${d.opfsError}`);
  note(
    `crossOriginIsolated=${crossOriginIsolated} · getDirectory=${typeof navigator.storage?.getDirectory}`
  );

  const sq = asSqlite(d);
  const v = await d.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  say(
    v?.user_version === MIGRATIONS[MIGRATIONS.length - 1].version,
    `마이그레이션 v${v?.user_version} 까지 올라감`
  );

  const tables = await d.getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
  );
  say(tables.length >= 6, `표 ${tables.length}개: ${tables.map((t) => t.name).join(', ')}`);

  // 파서 → 저장 → 조회 한 바퀴
  const cap = parseCapture('시간은 삶이며 삶은 마음속에 깃들여 있다 p.57 #자체점검');
  say(
    cap.type === 'book' && cap.page === 57,
    `파서: ${cap.type} p.${cap.page} #${cap.tags.join(' #')}`
  );

  const src = await createSource(sq, 'book', '모모', '미하엘 엔데');
  const id = await createEntry(sq, {
    type: 'book',
    day: todayKey(),
    source_id: src.id,
    title: src.title,
    subtitle: src.creator,
    quote: cap.rest,
    page: cap.page,
    tags: cap.tags,
  });
  say(!!id, `기록 저장 ${id}`);

  const rows = await queryLibrary(sq, {
    sort: 'recent',
    q: '마음속',
    limit: 10,
  });
  say(rows.length === 1, `검색(LIKE ESCAPE) ${rows.length}건`);

  const tags = await tagsOf(sq, [id]);
  say((tags.get(id) ?? []).includes('자체점검'), `갈피 ${(tags.get(id) ?? []).join(', ')}`);

  const srcs = await recentSources(sq, ['book']);
  say(srcs.length >= 1, `출처 ${srcs.length}개`);

  const unf = await unfiledCount(sq);
  say(typeof unf === 'number', `미분류 ${unf}건`);

  const md = buildDailyNote(todayKey(), [{ ...rows[0], tags: ['자체점검'] }]);
  say(md.includes('## 책'), `마크다운 ${md.length}자`);

  // 트랜잭션 롤백
  let rolled = false;
  try {
    await d.withTransactionAsync(async () => {
      await d.runAsync("INSERT INTO tags (id,name,created_at) VALUES ('rb','롤백',1)");
      throw new Error('일부러');
    });
  } catch {
    rolled = true;
  }
  const gone = await d.getFirstAsync("SELECT 1 FROM tags WHERE id='rb'");
  say(rolled && gone === null, '트랜잭션 롤백');

  // 백업 왕복
  const bytes = await d.serialize();
  say(
    bytes.byteLength > 0 && String.fromCharCode(...bytes.slice(0, 6)) === 'SQLite',
    `백업 ${(bytes.byteLength / 1024).toFixed(1)}KB`
  );

  await d.flush();
  note(`\n총 ${Math.round(performance.now() - t0)}ms`);
  note(lines.some((l) => l.startsWith(' FAIL')) ? '\n실패 있음' : '\n전부 통과');
}

run().catch((e) => {
  note('\n터짐: ' + (e?.message ?? String(e)));
  console.error(e);
});

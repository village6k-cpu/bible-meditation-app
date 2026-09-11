import test from 'node:test';
import assert from 'node:assert/strict';
import * as scheduler from '../src/sync/scheduler';

const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

test('저장 직후 자동 동기화하며 동기화 도중 새 저장도 빠뜨리지 않는다', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const win = new EventTarget();
  const doc = new EventTarget();
  let runs = 0;
  let release!: () => void;
  const stop = scheduler.startSyncScheduler({
    window: win, document: doc, canRun: () => true, isVisible: () => true,
    sync: async () => { runs++; if (runs === 1) await new Promise<void>(r => { release = r; }); },
    onApplied() {},
  });
  win.dispatchEvent(new Event('ledger:local-change'));
  t.mock.timers.tick(500);
  await settle();
  assert.equal(runs, 1, '30초를 기다리거나 버튼을 누르지 않는다');
  win.dispatchEvent(new Event('ledger:local-change'));
  win.dispatchEvent(new Event('ledger:local-change'));
  release(); await settle(); t.mock.timers.tick(500); await settle();
  assert.equal(runs, 2, '전송 중 새 변경은 한 번 더 전송한다');
  stop();
  win.dispatchEvent(new Event('ledger:local-change'));
  t.mock.timers.tick(30_000); await settle();
  assert.equal(runs, 2);
});

test('오프라인 저장은 서버를 호출하지 않고 연결 복귀 시 자동으로 전송한다', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const win = new EventTarget();
  let online = false;
  let runs = 0;
  const stop = scheduler.startSyncScheduler({
    window: win, document: new EventTarget(), canRun: () => online, isVisible: () => true,
    sync: async () => { runs++; }, onApplied() {},
  });
  win.dispatchEvent(new Event('ledger:local-change'));
  t.mock.timers.tick(1000); await settle();
  assert.equal(runs, 0);
  online = true;
  win.dispatchEvent(new Event('online'));
  t.mock.timers.tick(500); await settle();
  assert.equal(runs, 1);
  stop();
});

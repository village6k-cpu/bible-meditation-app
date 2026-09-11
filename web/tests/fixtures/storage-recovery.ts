// Vite 개발 서버에서만 직접 여는 재현 도구. 배포 빌드의 입력이 아니다.
import { openDb } from '../../src/db/sqlite';
import { migrate } from '../../../mitjul/src/db/migrations';
import { todayKey } from '../../../mitjul/src/core/dates';
import { photoRef } from '../../src/platform/photos';
import type { SQLiteDatabase } from 'expo-sqlite';

const button = document.querySelector<HTMLButtonElement>('#prepare')!;
const result = document.querySelector('#result')!;
button.onclick = async () => {
  button.disabled = true;
  try {
    if (!['http://127.0.0.1:5193', 'http://localhost:5193'].includes(location.origin)) throw new Error('전용 로컬 origin에서만 실행합니다.');
    const root = await navigator.storage.getDirectory();
    for await (const _ of (root as any).entries()) throw new Error('기존 파일이 있으므로 준비를 중단합니다.');
    if ((await indexedDB.databases()).length) throw new Error('기존 IndexedDB가 있으므로 준비를 중단합니다.');
    const db = await openDb();
    await migrate(db as unknown as SQLiteDatabase);
    await db.runAsync('INSERT INTO entries(id,type,day,created_at,updated_at,body,image_uri) VALUES (?,?,?,?,?,?,?)',
      ['recovery-local', 'moment', todayKey(), Date.now(), Date.now(), '대체 기록함에 남은 테스트 글', photoRef('recovery-test.png')]);
    await db.writePhoto('recovery-test.png', new Uint8Array(await (await fetch('/icon-180.png')).arrayBuffer()));
    const snapshot = await db.serialize();
    await db.runAsync('UPDATE entries SET body=? WHERE id=?', ['건드리면 안 되는 OPFS 테스트 원본', 'recovery-local']);
    const idb = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('mitjul-store', 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = idb.transaction('db', 'readwrite');
      tx.objectStore('db').put(snapshot, 'snapshot');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    idb.close();
    result.textContent = '준비 완료. 렛저 열기를 누르면 두 저장소 감지 화면이 나옵니다.';
  } catch (error) {
    result.textContent = String(error);
  }
};

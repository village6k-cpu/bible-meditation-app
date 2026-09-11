import { processPhotoJobs, type PhotoStore, type PhotoSyncResult } from '@db/photoSync';
import { asSqlite } from '../db';
import type { WebDb } from '../db/sqlite';
import { isPhotoRef, photoBlob } from '../platform/photos';
import { requireSyncClient } from './client';
import { createGooglePhotosRemote, invokeLedgerPhotos } from './googlePhotosApi';

function browserPhotoStore(handle: WebDb): PhotoStore {
  return {
    async read(ref) {
      const file = await photoBlob(ref);
      return file ? new Uint8Array(await file.arrayBuffer()) : null;
    },
    async write(ref, bytes) {
      if (!isPhotoRef(ref)) throw new Error('잘못된 사진 경로입니다.');
      await handle.writePhoto(ref.slice('photos/'.length), bytes);
      window.dispatchEvent(new CustomEvent('ledger:photo-stored', { detail: ref }));
    },
  };
}

export async function googlePhotosStatus(): Promise<boolean> {
  const result = await invokeLedgerPhotos<{ connected: boolean }>(requireSyncClient(), { action: 'status' });
  return result.connected;
}

export async function connectGooglePhotos(): Promise<void> {
  const result = await invokeLedgerPhotos<{ url: string }>(requireSyncClient(), { action: 'connect' });
  location.assign(result.url);
}

export async function disconnectGooglePhotos(): Promise<void> {
  await invokeLedgerPhotos(requireSyncClient(), { action: 'disconnect' });
}

export async function processPendingPhotos(handle: WebDb): Promise<PhotoSyncResult | null> {
  const sqlite = asSqlite(handle);
  // 사진이 없으면 사진 서버 장애가 이미 끝난 본문 동기화를 오류로 바꾸지 않는다.
  // 재시도 한도에 걸린 실패 작업도 남아 있는 한 이 검사를 건너뛰지 않는다.
  if (!(await sqlite.getFirstAsync('SELECT 1 FROM photo_jobs LIMIT 1'))) return null;
  if (!(await googlePhotosStatus())) throw new Error('사진을 보내려면 Google Photos 연결을 확인해 주세요.');
  // 연속 실패는 잠시 쉬었다 자동 재시도한다. 수동 버튼이 필수인 막다른 큐로 남기지 않는다.
  await sqlite.runAsync("UPDATE photo_jobs SET attempts=0 WHERE state='failed' AND attempts>=5 AND updated_at<=?", [Date.now() - 300_000]);
  const result: PhotoSyncResult = { completed: 0, failed: 0 };
  const store = browserPhotoStore(handle);
  const remote = createGooglePhotosRemote(requireSyncClient());
  do {
    const batch = await processPhotoJobs(sqlite, store, remote);
    result.completed += batch.completed;
    result.failed += batch.failed;
    if (batch.failed || !batch.completed) break;
  } while (await sqlite.getFirstAsync('SELECT 1 FROM photo_jobs LIMIT 1'));
  const failed = await sqlite.getFirstAsync<{last_error:string}>(
    "SELECT last_error FROM photo_jobs WHERE state='failed' ORDER BY updated_at DESC LIMIT 1"
  );
  if (failed) throw new Error(`기록은 맞췄지만 사진 전송에 실패했습니다: ${failed.last_error}`);
  return result;
}

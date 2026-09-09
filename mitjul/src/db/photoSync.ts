import { type SQLiteDatabase } from 'expo-sqlite';

export interface PhotoStore {
  read(ref: string): Promise<Uint8Array<ArrayBuffer> | null>;
  write(ref: string, bytes: Uint8Array<ArrayBuffer>): Promise<void>;
}

export interface PhotoRemote {
  upload(input: {
    photoRef: string;
    month: string;
    bytes: Uint8Array<ArrayBuffer>;
  }): Promise<{ mediaItemId: string; albumId: string }>;
  download(mediaItemId: string): Promise<Uint8Array<ArrayBuffer>>;
}

export interface PhotoSyncResult {
  completed: number;
  failed: number;
}

interface Job {
  photo_uri: string;
  action: 'upload' | 'download';
  attempts: number;
}

export async function processPhotoJobs(
  db: SQLiteDatabase,
  store: PhotoStore,
  remote: PhotoRemote,
  limit: number = 3
): Promise<PhotoSyncResult> {
  const jobs = await db.getAllAsync<Job>(
    `SELECT photo_uri, action, attempts FROM photo_jobs
     WHERE state IN ('pending', 'failed') AND attempts < 5
     ORDER BY updated_at, photo_uri LIMIT ?`,
    [limit]
  );
  let completed = 0;
  let failed = 0;

  for (const job of jobs) {
    await db.runAsync(
      "UPDATE photo_jobs SET state='running', updated_at=? WHERE photo_uri=?",
      [Date.now(), job.photo_uri]
    );
    try {
      if (job.action === 'upload') {
        const bytes = await store.read(job.photo_uri);
        if (!bytes) throw new Error('이 기기에서 사진 파일을 찾지 못했습니다.');
        const entry = await db.getFirstAsync<{ day: string }>(
          'SELECT day FROM entries WHERE image_uri = ? AND deleted_at IS NULL ORDER BY day LIMIT 1',
          [job.photo_uri]
        );
        const month = entry?.day.slice(0, 7) ?? new Date().toISOString().slice(0, 7);
        const uploaded = await remote.upload({ photoRef: job.photo_uri, month, bytes });
        const now = Date.now();
        await db.runAsync(
          `INSERT INTO photo_links (photo_uri, media_item_id, album_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(photo_uri) DO UPDATE SET media_item_id=excluded.media_item_id,
             album_id=excluded.album_id, updated_at=excluded.updated_at`,
          [job.photo_uri, uploaded.mediaItemId, uploaded.albumId, now, now]
        );
      } else {
        const alreadyHere = await store.read(job.photo_uri);
        if (!alreadyHere) {
          const link = await db.getFirstAsync<{ media_item_id: string }>(
            'SELECT media_item_id FROM photo_links WHERE photo_uri = ?',
            [job.photo_uri]
          );
          if (!link) throw new Error('사진의 Google Photos 식별자를 찾지 못했습니다.');
          await store.write(job.photo_uri, await remote.download(link.media_item_id));
        }
      }
      await db.runAsync('DELETE FROM photo_jobs WHERE photo_uri = ?', [job.photo_uri]);
      completed += 1;
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason);
      await db.runAsync(
        "UPDATE photo_jobs SET state='failed', attempts=attempts+1, last_error=?, updated_at=? WHERE photo_uri=?",
        [message, Date.now(), job.photo_uri]
      );
      failed += 1;
    }
  }
  return { completed, failed };
}

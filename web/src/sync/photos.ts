import { processPhotoJobs, type PhotoStore, type PhotoSyncResult } from '@db/photoSync';
import { asSqlite } from '../db';
import type { WebDb } from '../db/sqlite';
import { isPhotoRef, photoBlob } from '../platform/photos';
import { supabase } from './client';
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
    },
  };
}

export async function googlePhotosStatus(): Promise<boolean> {
  const result = await invokeLedgerPhotos<{ connected: boolean }>(supabase, { action: 'status' });
  return result.connected;
}

export async function connectGooglePhotos(): Promise<void> {
  const result = await invokeLedgerPhotos<{ url: string }>(supabase, { action: 'connect' });
  location.assign(result.url);
}

export async function disconnectGooglePhotos(): Promise<void> {
  await invokeLedgerPhotos(supabase, { action: 'disconnect' });
}

export async function processPendingPhotos(handle: WebDb): Promise<PhotoSyncResult | null> {
  if (!(await googlePhotosStatus())) return null;
  return processPhotoJobs(asSqlite(handle), browserPhotoStore(handle), createGooglePhotosRemote(supabase));
}

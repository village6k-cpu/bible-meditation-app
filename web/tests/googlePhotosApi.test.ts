import test from 'node:test';
import assert from 'node:assert/strict';
import { createGooglePhotosRemote, invokeLedgerPhotos } from '../src/sync/googlePhotosApi';

test('Google Photos 어댑터는 사진 바이트를 안전한 base64url로 왕복한다', async () => {
  const bodies: Record<string, unknown>[] = [];
  const client = {
    functions: {
      async invoke(_name: string, options: { body: Record<string, unknown> }) {
        bodies.push(options.body);
        if (options.body.action === 'upload') {
          return { data: { mediaItemId: 'media-1', albumId: 'album-1' }, error: null };
        }
        return { data: { bytes: 'BAU' }, error: null };
      },
    },
  };
  const remote = createGooglePhotosRemote(client as never);

  const uploaded = await remote.upload({
    photoRef: 'photos/a.jpg', month: '2026-09', bytes: new Uint8Array([251, 255, 0]),
  });
  const downloaded = await remote.download('media-1');

  assert.equal(bodies[0].bytes, '-_8A');
  assert.deepEqual(uploaded, { mediaItemId: 'media-1', albumId: 'album-1' });
  assert.deepEqual(Array.from(downloaded), [4, 5]);
});

test('Edge Function의 사용자용 오류 문구를 그대로 보여준다', async () => {
  const client = {
    functions: {
      async invoke() {
        return {
          data: null,
          error: {
            message: 'Edge Function returned a non-2xx status code',
            context: new Response(JSON.stringify({ error: 'Google OAuth 설정이 없습니다.' }), {
              status: 500,
              headers: { 'content-type': 'application/json' },
            }),
          },
        };
      },
    },
  };

  await assert.rejects(
    () => invokeLedgerPhotos(client as never, { action: 'connect' }),
    /Google OAuth 설정이 없습니다/
  );
});

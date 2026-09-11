import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { StorageHealth, WebDb } from '../../db/sqlite';
import { backupNow, lastBackupAt, restoreFrom } from '../../platform/backup';
import {
  formatBytes,
  isIOS,
  isStandalone,
  persisted,
  requestPersistence,
  storageUsed,
} from '../../platform/install';
import { exportRange, RANGE_LABEL, type ExportRange } from '../../export/obsidian';
import { photoStat, sharePhotoBatch, sweepOrphans, type PhotoStat } from '../../export/photos';
import { Icon } from '../icons';
import { SectionRow } from '../parts/entry';
import { SyncLogin } from '../parts/SyncLogin';
import { syncConfigError } from '../../sync/client';
import { bump } from '../store';
import {
  getSyncState,
  signInForSync,
  signOutFromSync,
  subscribeSyncState,
  syncNow,
  moveLegacySyncWithBackup,
} from '../../sync';
import {
  connectGooglePhotos,
  disconnectGooglePhotos,
  googlePhotosStatus,
} from '../../sync/photos';

// 이 화면의 주제는 하나다 — 이 기록을 잃지 않는 방법.

const ENGINE_LABEL: Record<string, string> = {
  opfs: 'OPFS (기기 안 파일)',
  memory: '임시 메모리 (저장되지 않음)',
};

function fmtDate(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function SettingsSheet({
  handle,
  onClose,
  toast,
}: {
  handle: WebDb;
  onClose: () => void;
  toast: (m: string) => void;
}): JSX.Element {
  const [busy, setBusy] = useState<string | null>(null);
  const [last, setLast] = useState<number | null>(null);
  const [used, setUsed] = useState<number | null>(null);
  const [keeps, setKeeps] = useState(false);
  const [photos, setPhotos] = useState<PhotoStat>({ count: 0, bytes: 0, orphans: 0 });
  // 사진은 묶음으로 나가므로, 어디까지 보냈는지 기억한다
  const [cursor, setCursor] = useState<string | null>(null);
  const [syncState, setSyncState] = useState(getSyncState);
  const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);
  const [health, setHealth] = useState<StorageHealth | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = (): void => {
    void lastBackupAt(handle).then(setLast);
    void storageUsed().then(setUsed);
    void persisted().then(setKeeps);
    void photoStat(handle).then(setPhotos);
  };
  useEffect(refresh, [handle]);
  useEffect(() => subscribeSyncState(setSyncState), []);
  useEffect(() => {
    if (syncState.phase === 'signed-out') {
      setGoogleConnected(null);
      return;
    }
    let alive = true;
    void googlePhotosStatus()
      .then((connected) => { if (alive) setGoogleConnected(connected); })
      .catch(() => { if (alive) setGoogleConnected(false); });
    return () => { alive = false; };
  }, [syncState.phase]);

  async function guard<T>(key: string, run: () => Promise<T>): Promise<T | null> {
    setBusy(key);
    try {
      return await run();
    } catch (e) {
      toast(e instanceof Error ? e.message : '실패했습니다');
      return null;
    } finally {
      setBusy(null);
      refresh();
    }
  }

  return (
    <div class="sheet">
      <div class="sheet-head">
        <button class="quiet" onClick={onClose}>
          <Icon name="chevronLeft" />
          뒤로
        </button>
        <span class="mono dim">보관</span>
        <span style="width:44px" />
      </div>

      <div class="sheet-body" style="padding:0 0 var(--safe-b)">
        <SectionRow label="기기 간 동기화" first />
        {syncState.phase === 'signed-out' ? (
          <SyncLogin
            busy={busy !== null}
            unavailable={syncConfigError !== null}
            error={syncConfigError ?? syncState.error}
            onSignIn={() => void guard('login', signInForSync)}
          />
        ) : (
          <>
            <div class="row">
              <span class="grow label">계정</span>
              <span class="mono dim">{syncState.email}</span>
            </div>
            <button
              class="row"
              disabled={busy !== null || syncState.phase === 'syncing'}
              onClick={() =>
                void guard('sync', async () => {
                  const result = await syncNow(handle, true).finally(bump);
                  toast(`${result.pushed + result.pulled}건 맞췄습니다`);
                })
              }
            >
              <span class="grow label">지금 맞추기</span>
              <span class="mono dim">
                {syncState.phase === 'syncing'
                  ? '맞추는 중…'
                  : syncState.phase === 'error'
                    ? '오류'
                    : syncState.lastSyncedAt
                      ? fmtDate(syncState.lastSyncedAt)
                      : '대기'}
              </span>
            </button>
            {syncState.phase === 'error' && (
              <div class="cap" style="padding:10px 16px;color:var(--danger)">{syncState.error}</div>
            )}
            {syncState.phase === 'error' && syncState.legacyAccountId && syncState.accountId && (
              <button class="row" disabled={busy !== null} onClick={() => {
                const { legacyAccountId, accountId, email } = syncState;
                if (!confirm(`이 기기의 기존 기록을 ${email} 계정으로 옮깁니다. 먼저 백업 파일을 받고, 렛저 전용 서버에 전송합니다. 이 기록이 본인 것인지 확인했나요?`)) return;
                void guard('migrate-sync', async () => {
                  const moved = await moveLegacySyncWithBackup(handle, legacyAccountId!, accountId!);
                  if (!moved) { toast('백업을 취소해 서버 연결을 바꾸지 않았습니다'); return; }
                  await syncNow(handle, true).finally(bump);
                  toast('기록을 보존하고 렛저 전용 서버로 옮겼습니다');
                });
              }}>
                <span class="grow label">백업 후 전용 서버로 전환</span>
              </button>
            )}
            <button
              class="row"
              disabled={busy !== null}
              onClick={() => void guard('logout', signOutFromSync)}
            >
              <span class="grow label">이 기기 연결 끊기</span>
            </button>
            <div class="cap dim" style="padding:10px 16px 14px">
              연결을 끊어도 이 기기의 기록은 남습니다. 한 기록함을 다른 계정에 섞어 올리지는 않습니다.
            </div>
          </>
        )}

        <SectionRow label="백업" />
        <button
          class="row"
          disabled={busy !== null}
          onClick={() =>
            void guard('backup', async () => {
              const { how, bytes } = await backupNow(handle);
              bump();
              toast(
                how === 'cancelled'
                  ? '백업을 취소했습니다 — 파일은 만들어지지 않았습니다'
                  : how === 'shared'
                    ? '백업 파일을 공유했습니다'
                    : `백업 파일을 내려받았습니다 (${formatBytes(bytes)})`
              );
            })
          }
        >
          <span style="width:16px;flex:none">
            <Icon name="download" />
          </span>
          <span class="grow label">지금 백업 (.sqlite3)</span>
          <span class="mono dim">{last === null ? '없음' : fmtDate(last)}</span>
        </button>

        <button class="row" disabled={busy !== null} onClick={() => fileRef.current?.click()}>
          <span style="width:16px;flex:none">
            <Icon name="upload" />
          </span>
          <span class="grow label">백업에서 되돌리기</span>
          <Icon name="chevronRight" />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".sqlite3,.sqlite,.db,application/x-sqlite3"
          hidden
          onChange={(ev) => {
            const input = ev.currentTarget as HTMLInputElement;
            const file = input.files?.[0];
            input.value = '';
            if (!file) return;
            if (!confirm('지금의 기록을 백업 파일의 내용으로 덮어씁니다. 계속할까요?')) return;
            void guard('restore', async () => {
              await restoreFrom(handle, file);
              bump();
              toast('백업에서 되돌렸습니다');
            });
          }}
        />
        <div class="cap dim" style="padding:10px 16px 14px">
          백업은 SQLite 파일 하나입니다. 이 파일만 있으면 어느 기기에서든 그대로 되돌릴 수 있습니다.
        </div>

        <SectionRow label="옵시디언 내보내기" />
        {(['week', 'month', 'all'] as ExportRange[]).map((r) => (
          <button
            key={r}
            class="row"
            disabled={busy !== null}
            onClick={() =>
              void guard(`ex-${r}`, async () => {
                const res = await exportRange(handle, r);
                toast(
                  res.result === 'empty'
                    ? '내보낼 기록이 없습니다'
                    : res.how === 'cancelled'
                      ? '내보내기를 취소했습니다'
                      : `${res.days}일치 마크다운을 ${res.how === 'shared' ? '공유했습니다' : '내려받았습니다'}`
                );
              })
            }
          >
            <span class="grow label">{RANGE_LABEL[r]}</span>
            <span class="mono dim">.md</span>
          </button>
        ))}

        <SectionRow label="사진" />
        {syncState.phase === 'signed-out' ? (
          <div class="row">
            <span class="grow label">Google Photos</span>
            <span class="mono dim">계정 연결 후 사용</span>
          </div>
        ) : googleConnected === null ? (
          <div class="row">
            <span class="grow label">Google Photos</span>
            <span class="mono dim">확인 중…</span>
          </div>
        ) : googleConnected ? (
          <button
            class="row"
            disabled={busy !== null}
            onClick={() =>
              void guard('google-out', async () => {
                await disconnectGooglePhotos();
                setGoogleConnected(false);
                toast('Google Photos 연결을 끊었습니다');
              })
            }
          >
            <span class="grow label">Google Photos</span>
            <span class="mono dim">연결됨 · 끊기</span>
          </button>
        ) : (
          <button
            class="row"
            disabled={busy !== null}
            onClick={() => void guard('google-in', connectGooglePhotos)}
          >
            <span class="grow label">Google Photos 연결</span>
            <Icon name="chevronRight" />
          </button>
        )}
        {googleConnected && syncState.phase !== 'signed-out' && (
          <button
            class="row"
            disabled={busy !== null}
            onClick={() => void guard('google-reconnect', connectGooglePhotos)}
          >
            <span class="grow label">Google Photos 다시 연결</span>
            <Icon name="chevronRight" />
          </button>
        )}
        <div class="cap dim" style="padding:10px 16px 14px">
          사진은 월별 Ledger 앨범에 저장하고, 이 앱에는 사진 ID만 맞춥니다. 기록에서 사진을 빼도
          Google Photos 원본은 남습니다.
        </div>
        <button
          class="row"
          disabled={busy !== null || photos.count === 0}
          onClick={() =>
            void guard('photos', async () => {
              const res = await sharePhotoBatch(handle, cursor);
              if (res.result === 'empty') {
                setCursor(null);
                toast('내보낼 사진이 없습니다');
                return;
              }
              if (res.how === 'cancelled') {
                toast('사진 내보내기를 취소했습니다');
                return;
              }
              setCursor(res.next);
              toast(
                res.remaining > 0
                  ? `${res.count}장 내보냈습니다 — ${res.remaining}장 남았습니다. 한 번 더 누르세요`
                  : `${res.count}장 내보냈습니다. 전부 끝났습니다`
              );
            })
          }
        >
          <span style="width:16px;flex:none">
            <Icon name="camera" />
          </span>
          <span class="grow label">{cursor === null ? '사진 내보내기' : '이어서 내보내기'}</span>
          <span class="mono dim">
            {photos.count}장 · {formatBytes(photos.bytes)}
          </span>
        </button>
        {photos.orphans > 0 && (
          <button
            class="row"
            disabled={busy !== null}
            onClick={() =>
              void guard('sweep', async () => {
                const gone = await sweepOrphans(handle);
                toast(`기록 없는 사진 ${gone}장을 지웠습니다`);
              })
            }
          >
            <span class="grow label">기록 없는 사진 정리</span>
            <span class="mono dim">{photos.orphans}장</span>
          </button>
        )}
        <div class="cap dim" style="padding:10px 16px 14px">
          사진은 .sqlite3 백업에 들어가지 않습니다. 아이폰에서는 큰 파일 하나를 내보내다 앱이 죽기
          때문에, 40MB씩 묶어 공유 시트로 내보냅니다. 남으면 한 번 더 누르면 됩니다.
        </div>

        <SectionRow label="저장소" />
        <div class="row">
          <span class="grow label">엔진</span>
          <span class="mono dim">{ENGINE_LABEL[handle.engine] ?? handle.engine}</span>
        </div>
        <div class="row">
          <span class="grow label">쓴 용량</span>
          <span class="mono dim">{used === null ? '—' : formatBytes(used)}</span>
        </div>
        <button
          class="row"
          onClick={() =>
            void guard('persist', async () => {
              const ok = await requestPersistence();
              toast(ok ? '저장소를 지키도록 요청했습니다' : '브라우저가 아직 허락하지 않았습니다');
            })
          }
        >
          <span class="grow label">저장소 지키기</span>
          <span class="mono dim">{keeps ? '켜짐' : '꺼짐'}</span>
        </button>
        <div class="row">
          <span class="grow label">설치</span>
          <span class="mono dim">{isStandalone() ? '홈 화면 앱' : '브라우저 탭'}</span>
        </div>
        <button
          class="row"
          disabled={busy !== null}
          onClick={() => void guard('storage-check', async () => {
            setHealth(null);
            setHealth(await handle.storageHealth());
          })}
        >
          <span class="grow label">{busy === 'storage-check' ? '점검 중…' : '저장 상태 점검'}</span>
          <Icon name="chevronRight" />
        </button>
        {health && (
          <div role="status" aria-label="저장 상태 점검 결과" class="cap" style="padding:12px 16px;overflow-wrap:anywhere">
            <div>현재 엔진: {health.engine === 'memory' ? '대체 저장소 (IndexedDB 스냅숏)' : ENGINE_LABEL[health.engine] ?? health.engine}</div>
            <div>파일 저장소: {{
              present: '폴더 확인됨 (파일 잠금·쓰기 가능 여부는 별도)',
              missing: 'OPFS 접근 가능 · 기록함 폴더 없음',
              unknown: '접근 실패 · 기존 기록 유무 확인 불가',
              unavailable: '이 브라우저에 OPFS API 없음',
            }[health.directory.state]}</div>
            <div>대체 저장소 스냅숏: {health.snapshot.bytes === null ? '읽기 실패' : health.snapshot.bytes === 0 ? '없음' : `${formatBytes(health.snapshot.bytes)} 읽힘`}</div>
            <div>처음 열기 오류: {health.openingError ?? '없음'}</div>
            {health.directory.error && <div>현재 파일 접근 오류: {health.directory.error}</div>}
            {health.snapshot.error && <div>스냅숏 읽기 오류: {health.snapshot.error}</div>}
            <div class="dim" style="margin-top:8px">읽기 점검입니다. 기록을 옮기거나 지우지 않으며, 재실행 후 보존까지 확인한 결과는 아닙니다.</div>
          </div>
        )}

        {isIOS() && (
          <>
            <SectionRow label="아이폰에서 빠르게 담기" />
            <div style="padding:12px 16px 20px">
              <div class="cap">
                아이폰에서는 공유 시트가 웹앱을 직접 열 수 없습니다(웹 공유 대상 API가 WebKit에
                없습니다). 대신 단축어가 클립보드에 담고, Ledger에서 붙여넣기를 한 번 누릅니다.
              </div>
              <ol class="recipe">
                <li>단축어 앱 → 새 단축어 → 이름 ‘Ledger에 담기’</li>
                <li>
                  동작 <code>클립보드에 복사</code> 하나만 넣고, 입력은 <code>단축어 입력</code>으로
                  둡니다
                </li>
                <li>세부사항에서 ‘공유 시트에 표시’를 켜고, 종류는 URL·텍스트만 남깁니다</li>
                <li>유튜브·사파리에서 공유 → ‘Ledger에 담기’ → 홈 화면의 Ledger를 열어 붙여넣기</li>
              </ol>
              <div class="cap dim" style="margin-top:10px">
                단축어가 주소를 여는 방식(<code>?add=</code>)도 동작하지만, 그 주소는 Safari에서
                열리고 Safari의 저장소는 설치한 앱과 다른 통입니다 — 거기 적은 기록은 앱에서 보이지
                않습니다. 그래서 클립보드 쪽을 권합니다.
              </div>
            </div>
          </>
        )}

        <div class="note">
          계정을 연결하지 않으면 기록은 이 기기에만 남습니다. 연결하면 본문은 사용자별 비공개 서버와 맞춥니다.
          {' '}<a href="./privacy.html" target="_blank" rel="noopener noreferrer">개인정보 안내</a>
        </div>
        <div class="gap-lg" />
      </div>
    </div>
  );
}

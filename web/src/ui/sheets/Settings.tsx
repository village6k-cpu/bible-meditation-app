import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { WebDb } from '../../db/sqlite';
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
import { Icon } from '../icons';
import { SectionRow } from '../parts/entry';
import { bump } from '../store';

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
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = (): void => {
    void lastBackupAt(handle).then(setLast);
    void storageUsed().then(setUsed);
    void persisted().then(setKeeps);
  };
  useEffect(refresh, [handle]);

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

      <div class="sheet-body" style="padding:0">
        <SectionRow label="백업" first />
        <button
          class="row"
          disabled={busy !== null}
          onClick={() =>
            void guard('backup', async () => {
              const { how, bytes } = await backupNow(handle);
              bump();
              toast(
                how === 'shared'
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
                    : `${res.days}일치 마크다운을 ${res.how === 'shared' ? '공유했습니다' : '내려받았습니다'}`
                );
              })
            }
          >
            <span class="grow label">{RANGE_LABEL[r]}</span>
            <span class="mono dim">.md</span>
          </button>
        ))}

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

        {isIOS() && (
          <>
            <SectionRow label="아이폰에서 빠르게 담기" />
            <div style="padding:12px 16px 20px">
              <div class="cap">
                아이폰에서는 공유 시트가 웹앱을 직접 열 수 없습니다(웹 공유 대상 API가 WebKit에
                없습니다). 대신 단축어가 클립보드에 담고, 밑줄에서 붙여넣기를 한 번 누릅니다.
              </div>
              <ol class="recipe">
                <li>단축어 앱 → 새 단축어 → 이름 ‘밑줄에 담기’</li>
                <li>
                  동작 <code>클립보드에 복사</code> 하나만 넣고, 입력은 <code>단축어 입력</code>으로
                  둡니다
                </li>
                <li>세부사항에서 ‘공유 시트에 표시’를 켜고, 종류는 URL·텍스트만 남깁니다</li>
                <li>유튜브·사파리에서 공유 → ‘밑줄에 담기’ → 홈 화면의 밑줄을 열어 붙여넣기</li>
              </ol>
              <div class="cap dim" style="margin-top:10px">
                단축어가 주소를 여는 방식(<code>?add=</code>)도 동작하지만, 그 주소는 Safari에서
                열리고 Safari의 저장소는 설치한 앱과 다른 통입니다 — 거기 적은 기록은 앱에서 보이지
                않습니다. 그래서 클립보드 쪽을 권합니다.
              </div>
            </div>
          </>
        )}

        <div class="note">기록은 이 기기를 떠나지 않습니다. 서버도 계정도 없습니다.</div>
        <div class="gap-lg" />
      </div>
    </div>
  );
}

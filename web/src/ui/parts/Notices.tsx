import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { asSqlite } from '../../db';
import type { WebDb } from '../../db/sqlite';
import { unfiledCount } from '@db/entryRepo';
import { backupNow, daysSinceBackup, NAG_AFTER_DAYS } from '../../platform/backup';
import { isIOS, isStandalone } from '../../platform/install';
import { Icon } from '../icons';
import { bump, useLoad } from '../store';

// 앱이 사용자에게 먼저 말을 거는 유일한 자리. 세 가지만 말한다.
// 1) 설치 전이면 — 지금 적으면 그 기록은 설치한 앱에서 보이지 않는다
// 2) 파일로 저장되지 않고 있으면 — 이건 사고다
// 3) 오래 백업하지 않았으면 — 브라우저 저장소는 보관소가 아니다

const SESSION_KEY = 'mitjul.notice.dismissed';

function dismissed(key: string): boolean {
  try {
    return sessionStorage.getItem(`${SESSION_KEY}.${key}`) === '1';
  } catch {
    return false;
  }
}
function dismiss(key: string): void {
  try {
    sessionStorage.setItem(`${SESSION_KEY}.${key}`, '1');
  } catch {
    /* 프라이빗 창 — 다음에 또 말해 준다 */
  }
}

interface Health {
  sinceBackup: number | null;
  entries: number;
}

export function Notices({
  handle,
  toast,
}: {
  handle: WebDb;
  toast: (m: string) => void;
}): JSX.Element | null {
  const [tick, setTick] = useState(0);
  const [guide, setGuide] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data } = useLoad<Health>(
    handle,
    async (d) => {
      const db = asSqlite(d);
      const row = await db.getFirstAsync<{ n: number }>(
        'SELECT COUNT(*) AS n FROM entries WHERE deleted_at IS NULL'
      );
      void unfiledCount; // 검토 줄은 수집함이 따로 센다
      return { sinceBackup: await daysSinceBackup(d), entries: row?.n ?? 0 };
    },
    [tick],
    { sinceBackup: null, entries: 0 }
  );

  const standalone = isStandalone();
  const ios = isIOS();
  const notes: JSX.Element[] = [];

  // 1) 저장 엔진이 물러섰다 — 가장 급한 소식
  if (handle.engine === 'memory') {
    notes.push(
      <div class="notice" key="engine">
        <span style="color:var(--ink)">
          <Icon name="alert" />
        </span>
        <div>
          <div class="body-t">기록이 파일로 저장되지 않고 있습니다</div>
          <div class="cap" style="margin-top:2px">
            이 브라우저에서 OPFS를 열지 못해 임시 저장소로 돌아갔습니다
            {handle.opfsError ? ` (${handle.opfsError})` : ''}. 지금 적은 것은 브라우저가 저장소를
            비우면 사라집니다. 자주 백업하세요.
          </div>
        </div>
      </div>
    );
  }

  // 2) 설치 전 — iOS에서는 이게 데이터 문제다
  if (!standalone && !dismissed('install')) {
    notes.push(
      <div class="notice" key="install">
        <span style="color:var(--ink)">
          <Icon name="home" />
        </span>
        <div style="min-width:0">
          <div class="body-t">
            {ios ? '홈 화면에 추가한 다음 쓰세요' : '이 브라우저에만 저장됩니다'}
          </div>
          <div class="cap" style="margin-top:2px">
            {ios
              ? '아이폰에서 홈 화면 웹앱은 Safari와 다른 저장소를 씁니다. 지금 이 창에 적은 기록은 설치한 앱에서 보이지 않고, Safari를 쓴 지 7일이 지나면 지워집니다.'
              : '기록은 서버가 아니라 이 브라우저 안에 있습니다. 다른 기기·다른 브라우저에서는 보이지 않습니다.'}
          </div>
          <div class="notice-actions">
            {ios && (
              <button class="chip" onClick={() => setGuide((v) => !v)}>
                설치 방법
              </button>
            )}
            <button
              class="chip"
              onClick={() => {
                dismiss('install');
                setTick((n) => n + 1);
              }}
            >
              나중에
            </button>
          </div>
          {guide && (
            <ol class="recipe">
              <li>Safari 아래쪽 공유 버튼을 누릅니다</li>
              <li>‘홈 화면에 추가’를 고릅니다</li>
              <li>홈 화면의 Ledger 아이콘으로 엽니다 — 여기서부터 적으세요</li>
              <li>
                이 창에 이미 적은 것이 있다면, 아래 ‘지금 백업’으로 파일을 만든 뒤 설치한 앱의
                ‘백업에서 되돌리기’로 옮기세요
              </li>
            </ol>
          )}
        </div>
      </div>
    );
  }

  // 3) 오래 백업하지 않음
  const stale =
    data.entries > 0 &&
    (data.sinceBackup === null ? data.entries >= 20 : data.sinceBackup >= NAG_AFTER_DAYS);
  if (stale && !dismissed('backup')) {
    notes.push(
      <div class="notice" key="backup">
        <span style="color:var(--ink)">
          <Icon name="download" />
        </span>
        <div>
          <div class="body-t">
            {data.sinceBackup === null
              ? `기록 ${data.entries}건, 아직 한 번도 백업하지 않았습니다`
              : `${data.sinceBackup}일째 백업하지 않았습니다`}
          </div>
          <div class="cap" style="margin-top:2px">
            브라우저 저장소는 보관소가 아닙니다. 파일 하나로 꺼내 두면 무슨 일이 있어도 되돌릴 수
            있습니다.
          </div>
          <div class="notice-actions">
            <button
              class="chip on"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                backupNow(handle)
                  .then(({ how, bytes }) =>
                    toast(
                      how === 'cancelled'
                        ? '백업을 취소했습니다 — 파일은 만들어지지 않았습니다'
                        : how === 'shared'
                          ? '백업 파일을 공유했습니다'
                          : `백업 파일을 내려받았습니다 (${Math.round(bytes / 1024)}KB)`
                    )
                  )
                  .catch(() => toast('백업하지 못했습니다'))
                  .finally(() => {
                    setBusy(false);
                    setTick((n) => n + 1);
                    bump();
                  });
              }}
            >
              지금 백업
            </button>
            <button
              class="chip"
              onClick={() => {
                dismiss('backup');
                setTick((n) => n + 1);
              }}
            >
              나중에
            </button>
          </div>
        </div>
      </div>
    );
  }

  return notes.length > 0 ? <>{notes}</> : null;
}

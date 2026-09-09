import type { JSX } from 'preact';

export interface SyncLoginProps {
  busy: boolean;
  error: string | null;
  onSignIn: () => void;
}

export function SyncLogin({ busy, error, onSignIn }: SyncLoginProps): JSX.Element {
  return (
    <div style="padding:12px 16px 16px;display:grid;gap:10px">
      <button class="chip on" type="button" disabled={busy} onClick={onSignIn} style="justify-self:start">
        {busy ? 'Google로 이동 중…' : 'Google로 연결'}
      </button>
      <div class="cap dim">
        두 기기에서 같은 Google 계정으로 연결하세요. Google 화면에서 계정만 선택하며,
        Ledger에서는 비밀번호를 입력하지 않습니다. 이 기기의 기존 기록도 첫 연결 때 올라갑니다.
      </div>
      <div class="cap dim">사진은 로그인 뒤 Google Photos를 별도로 연결합니다.</div>
      {error && <div class="cap" role="alert" style="color:var(--danger)">{error}</div>}
    </div>
  );
}

# Google Photos 재연결 브라우저 회귀 검사

잡는 결함: 연결 토큰을 갱신하려면 먼저 기존 연결을 해제해야 하거나, 재연결 버튼이 연결 해제를 호출하는 경우.
토큰이 만료된 경우에도 기존 연결 행이 남아 있으므로 연결 상태에서 다시 인증할 수 있어야 한다.

전제: 허용된 브라우저 제어 도구로 Ledger 전용 계정에 로그인하고 사진 연결을 완료한 테스트 기록함의
보관 화면을 연다. 사진 원본이나 연결을 삭제하지 않는다. 사용자 인증 경고는 직접 넘기지 않는다.

1. 변경 전에는 아래 첫 검사가 실패해야 한다. 버튼 존재 확인 후 실제 클릭 결과까지 검사한다.
2. 버튼을 누르면 Google 동의 흐름으로 이동해야 하며 권한 세 개와 전용 반환 주소를 유지한다.
3. 다른 로그인된 기록함에서 사진 연결 및 기존 사진을 계속 읽을 수 있어야 한다.
   사용자가 동의를 취소해도 기존 연결을 끊거나 월별 앨범 정보를 삭제하지 않는다.

```js
const reconnect = tab.playwright.getByRole('button', { name: 'Google Photos 다시 연결', exact: true });
if (await reconnect.count() !== 1) throw new Error('기존 연결을 보존하는 재연결 버튼이 없다');
await reconnect.click();
// Google 페이지가 나타난 뒤 실행한다. 전체 인증 URL·state는 출력하지 않는다.
const url = new URL(await tab.url());
if (url.origin !== 'https://accounts.google.com') throw new Error('동의 흐름으로 이동하지 않았다');
if (url.searchParams.get('redirect_uri') !== 'https://mbypanaxjuliucxsujea.supabase.co/functions/v1/ledger-photos?callback=1') {
  throw new Error('Ledger 전용 반환 주소가 아니다');
}
const expected = [
  'https://www.googleapis.com/auth/photoslibrary.appendonly',
  'https://www.googleapis.com/auth/photoslibrary.edit.appcreateddata',
  'https://www.googleapis.com/auth/photoslibrary.readonly.appcreateddata',
].sort();
const actual = (url.searchParams.get('scope') || '').split(/\s+/).sort();
if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('사진 권한 범위가 바뀌었다');
```

이는 실제 브라우저 연동 검사이며 Node 단위 테스트 수에 포함하지 않는다.

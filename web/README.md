# 밑줄 — 웹

> 같은 앱, 다른 껍데기. 로직은 `mitjul/src`에서 그대로 가져온다.

혼자 쓰는 기록함이라 앱 스토어를 거칠 이유가 없습니다. 브라우저에서 열고 홈 화면에 얹으면
그게 앱입니다. 대신 브라우저의 저장소는 앱 샌드박스만큼 안전하지 않으므로, 그 차이를 감추지
않고 화면에 드러냅니다.

## 무엇을 공유하는가

```
mitjul/src/core   1,349줄   expo·react-native import 0개 — 파서·날짜·덱·링크·마크다운
mitjul/src/db       958줄   expo-sqlite 메서드 5개만 사용 — 마이그레이션·리포지토리
```

`web/src/db/sqlite.ts`가 그 다섯 개(`execAsync`·`getFirstAsync`·`getAllAsync`·`runAsync`·
`withTransactionAsync`)를 브라우저에서 구현합니다. 그래서 마이그레이션 v1–v6과 리포지토리
전부가 한 줄도 고치지 않고 돕니다. 별칭은 `@core`·`@db`·`@ex`.

## 저장

SQLite를 **전용 워커** 안에서 돌리고, **OPFS SAHPool VFS**로 기기 안 파일에 씁니다.

- 워커여야 하는 이유: `FileSystemSyncAccessHandle`은 `[Exposed=DedicatedWorker]`입니다.
  메인 스레드에서는 OPFS VFS가 열리지 않습니다.
- SAHPool이어야 하는 이유: 기본 `opfs` VFS는 SharedArrayBuffer가 필요해 COOP/COEP 헤더를
  요구합니다. GitHub Pages는 응답 헤더를 설정할 수 없습니다. SAHPool은 헤더 없이 돕니다.
- OPFS가 열리지 않는 브라우저에서는 메모리 DB + IndexedDB 스냅숏으로 물러서고,
  **그 사실을 첫 화면에 적습니다**. 조용히 물러서지 않습니다.

`web/selftest.html`을 열면 그 기기에서 마이그레이션·검색·트랜잭션·백업이 실제로 도는지
확인합니다.

## 아이폰에서 알아야 할 것 세 가지

1. **설치하고 나서 적으세요.** 홈 화면 웹앱은 Safari와 **다른 저장 통**을 씁니다
   (WWDC23 10120: "separate cookies and storage from the browser"). Safari 탭에 적은 기록은
   설치한 앱에서 보이지 않습니다. 앱은 설치 전이면 첫 화면에서 이 말을 합니다.
2. **설치하면 7일 규칙에서 벗어납니다.** ITP는 Safari를 쓴 지 7일이 지난 사이트의
   script-writable 저장소(OPFS 포함)를 지웁니다. 홈 화면 웹앱은 그 규칙에서 면제입니다.
   그래도 계약이 아니라 휴리스틱이라, 앱은 `navigator.storage.persist()`를 요청하고
   오래 백업하지 않으면 말을 겁니다.
3. **공유 시트로는 앱에 바로 담기지 않습니다.** Web Share Target은 WebKit에 없습니다
   (bug 194593, 2019년부터 NEW). 단축어가 여는 `https://` 주소는 설치한 앱이 아니라 Safari에서
   열립니다 — 즉 다른 통입니다. 그래서 권하는 길은 **단축어 → 클립보드 → 앱에서 붙여넣기**이고,
   앱의 캡처 칸은 비어 있을 때 붙여넣기 칩을 내밉니다. 자세한 조리법은 앱의 보관 화면에 있습니다.
   (`?add=`·`#add=` 주소로 여는 길도 열려 있지만, 설치한 앱 안이 아니면 저장하지 않고
   경고만 합니다.)

## 백업

기록은 서버로 가지 않습니다. 그래서 보관 정책은 하나뿐입니다 — **파일로 꺼내 두기.**

- 보관 화면의 `지금 백업`은 SQLite 파일 하나를 만듭니다. iOS에서는 공유 시트로 넘겨
  ‘파일에 저장’·아이클라우드로 보낼 수 있고, 데스크톱에서는 내려받습니다.
- `백업에서 되돌리기`는 그 파일을 그대로 되돌립니다. 다른 기기로 옮길 때도 같은 길입니다.
- 14일 넘게 백업하지 않으면 수집함에서 한 줄로 알려 줍니다.
- 옵시디언 내보내기(이번 주 / 이번 달 / 전체)는 `core/markdown`이 만드는 그 마크다운입니다.

## 개발

```bash
npm install
npm run dev        # 개발 서버
npm run typecheck  # tsc --noEmit
npm run build      # 타입 검사 + 빌드
npm run icons      # public/*.png 다시 만들기 (아이콘은 코드다)
```

## 배포

`.github/workflows/deploy-web.yml`이 `main`의 `web/`·`mitjul/src/` 변경에 반응해
GitHub Pages로 올립니다. 저장소 설정 → Pages → Source를 `GitHub Actions`로 한 번 바꿔 두면
됩니다.

무료 플랜의 Pages는 공개 저장소에서만 동작하고, 사이트도 공개입니다. 그래도 주소를 아는
사람이 얻는 것은 **빈 껍데기**뿐입니다 — 기록은 그 사람의 브라우저가 아니라 내 기기 안에
있으니까요. 진짜 자물쇠가 필요해지면(예: 나중에 동기화 서버를 붙인다면) 응답 헤더와 무료
접근 제어가 되는 Cloudflare Pages + Access가 다음 자리입니다.

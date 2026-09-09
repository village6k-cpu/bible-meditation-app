# Ledger — 인계 문서

이 문서 하나만 읽고 이어서 작업할 수 있게 정리했다. 대화 맥락은 없다고 가정한다.

- 저장소: `village6k-cpu/bible-meditation-app`
- 작업 브랜치: `claude/personal-daily-log-app-raeet6` (**이 브랜치에만** 커밋·푸시할 것)
- 현재 작업: 기기 간 동기화 구현. 새 PR을 만들어 검증 뒤 `main`에 합칠 것.
- 이 저장소에는 원래 다른 앱(성경 묵상 앱)이 있다. 그 코드는 `main`과 동일하게 두고 건드리지 않는다.
  Ledger는 `mitjul/`과 `web/` 두 디렉터리에만 있다.
- 앱 이름은 **Ledger**다. 다만 코드와 UI 문구의 「밑줄」은 대부분 *책에 긋는 하이라이트*라는
  보통명사이므로 그대로 둔다(`아껴둔 밑줄`, `밑줄 그은 문장을 옮겨 적어보세요`). 제품 이름만 Ledger다.

---

## 1. 이 앱이 무엇인가

개인용 기록함이다. 사용자 한 명(INFP, 한국어)이 몇 년을 쓸 목적으로 만든다.

기록하려는 것: **식단·운동 인증 사진**, 좋았던 순간, 읽고/보고/들은 것(책 밑줄 + 메모,
유튜브 링크 + 메모), 쓴 것, 일정·할 일, 말씀 묵상, 그리고 운동·식단 실천 여부의 추이.

### 문제의식 (이걸 잃으면 이 앱은 노션이 된다)

사용자의 원래 고통은 "그릇이 없다"가 아니라 **"메모는 하는데 정리가 안 되고 다 묻혀버린다"**였다.
Drafts에 전부 쏟아붓고 다시는 안 읽는다는 것.

그래서 이 앱의 전제는 하나다:

> **구조는 기록의 부산물이어야 하고, 정리는 사람이 아니라 앱이 내미는 줄이어야 한다.**

이 전제에서 나온 설계 결정들 — 바꾸기 전에 반드시 이 문단을 다시 읽을 것:

| 결정 | 이유 |
|---|---|
| 한 칸에 자유롭게 적으면 파서가 유형·필드를 정한다 | 유형 고르고 필드 채우는 순간 "정리라는 별도의 일"이 생기고, 그 일은 영원히 안 일어난다 |
| 출처(책·채널)는 **한 번만** 등록 | 하루에 밑줄 수십~수백 개를 긋는 사람에게 매번 제목·저자·쪽수를 묻는 건 말이 안 된다 |
| 저장해도 시트가 안 닫히고 칸만 비워진다 | 연속 캡처가 기본 동작이다 |
| 구조가 안 붙은 기록을 앱이 세서 검토 탭으로 내민다 | 정리를 사용자가 결심하게 두지 않는다 |
| 하루 동안 얼어 있는 회상 카드 3장 | 기록이 돌아와야 묻히지 않는다 |
| **식사·운동은 콘텐츠가 아니라 실천이다** — 기록 탭·검토·회상에 섞이지 않고 날짜 × 칸 격자로만 산다 | 단위가 기록 하나가 아니라 하루이고, 매일 같은 것이 반복되며, 중요한 것은 내용이 아니라 추이다. 목록에 섞으면 세 끼가 1년에 천 줄로 밑줄 사이에 낀다 |

디자인 언어도 명시적 요구였다: **차갑고 시스티메틱하고 모던하게. 감성적인 것 금지.**
IBM Plex Sans KR 한 벌 + 수치는 IBM Plex Mono, 무채색 하나(`#FFFFFF`/`#0E1116`, 밤 `#0B0D10`/`#E8EBF0`),
선택은 색조가 아니라 **반전**, 구획은 헤어라인, 모서리 6px, 행 높이 44px.

화면 구성: 수집함 · 기록 · **[적기]** · 검토 · 지표.

---

## 2. 구조

```
mitjul/          Expo SDK 54 네이티브 앱 (남겨둔 것. 주력 아님)
  src/core/      순수 로직 — expo·react-native를 하나도 부르지 않는다  ← 웹과 공유
  src/db/        SQLite 리포지토리 — expo-sqlite 메서드 5개만 쓴다      ← 웹과 공유
  src/export/    마크다운 내보내기
  app/           expo-router 화면
  tests/         node:test 유닛 테스트 (102개)

web/             Vite 7 + Preact 10 웹앱 (주력)
  src/db/        worker.ts(SQLite 워커) · sqlite.ts(expo-sqlite 인터페이스 구현) · index.ts
  src/platform/  photos · backup · install · intake · viewport
  src/export/    obsidian · photos
  src/sync/      Supabase 본문 동기화 · Google Photos 연결/전송
  src/ui/        App.tsx(뷰 스택) · screens/ · sheets/ · parts/
  public/sw.js   서비스 워커 (빌드 시 프리캐시 목록이 주입된다)
  selftest.html  실기기에서 마이그레이션·검색·트랜잭션·백업이 도는지 확인하는 페이지

supabase/
  migrations/    사용자별 동기화 표 · 잠긴 Google OAuth/앨범 표
  functions/     ledger-photos Edge Function
```

`web/tsconfig.json`의 경로 별칭: `@core` → `../mitjul/src/core`, `@db` → `../mitjul/src/db`,
`@ex` → `../mitjul/src/export`. **웹이 공유 코어를 그대로 가져다 쓴다.** 마이그레이션 v1–v7과
리포지토리 전부가 한 줄도 안 고치고 브라우저에서 돈다.

### 명령

```bash
cd web    && npm install && npm run dev        # 웹 개발 서버
cd web    && npm test && npm run build          # 웹 어댑터 테스트 + tsc + Vite
cd mitjul && npm install && npm test           # 공유 코어/DB 테스트 102개
cd mitjul && npm run typecheck                 # 네이티브 타입 검사
```

두 쪽 모두 `tsc --noEmit` strict 클린이어야 한다. 테스트는 전부 통과여야 한다.

---

## 3. 반드시 알아야 할 것 (모르면 반드시 깨진다)

### 실천 유형(식사·운동)을 건드릴 때

`registry.ts`의 `practice: true`가 정의다. `PRACTICE_TYPES`·`CONTENT_TYPES`·`isPractice`를 쓰고,
쿼리에는 `entryRepo`의 `CONTENT`/`PRACTICE` 상수를 쓴다. **`type != 'task'`를 새로 쓰지 말 것** —
그 자리에서 식사가 밑줄 사이에 다시 새어 들어온다. 실천은 `createEntry`에서 태어날 때부터 `filed_at`이
찍힌다(정리할 것이 없다). 화면은 `web/src/ui/parts/practice.tsx`가 그린다 — 수집함 맨 위의
오늘 한 줄(`layoutDay`/`Cell`)과, 지표의 12주 히트맵(`weeksOf`/`mealLevel`/`workoutLevel`/`slotTally`).
지난 날의 빈 칸은 채우지 못하게 둔다(꾸밈이 된다). 캡처는 실천이면 저장 뒤 시트를 닫는다.

실천은 낱말 하나가 곧 기록이다 — `아침`, `저녁 치팅`. 파서가 그 낱말을 전부 신호로 먹어 남는 글이
없으므로, `canSave`는 실천일 때 `slot`·`practiced`·`minutes` 중 하나만 있어도 통과시킨다
(`Capture.tsx`의 `practiceOnly`). 이걸 지우면 '저녁 치팅'이 저장되지 않는다.

### 레이아웃 — 같은 실수를 두 번 했다

**폭에 맡기면 부푼다.** 정사각형 칸을 `flex:1`이나 `1fr`로 두고 `aspect-ratio:1`을 주면, 넓은 화면에서
한 칸이 80px로 자란다. 실천 줄에서 한 번, 히트맵에서 또 한 번 그랬다. **칸 크기는 px로 못 박을 것**
(`--strip-cell`, `--hc`). 폭이 남으면 칸을 키우지 말고 여백으로 두거나 옆에 다른 것을 놓는다.

**그렇다고 폰을 가운데 박지도 말 것.** `.app`에 `max-width:440px`를 걸어 데스크톱을 "안 무너지게"만
한 적이 있는데, 그건 데스크톱을 만든 게 아니다. 900px부터는 넓게 쓴다 — 탭바가 왼쪽 기둥이 되고,
수집함은 두 단(`.cols`), 기록은 두 열(`.records-flow`), 시트는 가운데 판, 히트맵 둘은 나란히.
좁은 화면에서 `.cols`는 `display:contents`라 그냥 위아래로 이어진다.

**바꿨으면 두 폭에서 찍어 볼 것.** 390px와 1280px. 이 실수는 코드를 읽어서는 안 보이고 그림으로만 보인다.

### 히트맵 — 농도와 '어김'은 다른 축이다

`mealMark`/`workoutMark`가 `{level, broke}`를 돌려주고, 화면은 농도 위에 빗금을 덧씌운다.
농도 하나로 합치면 **'아침 지키고 저녁 치팅'과 '아침만 기록'이 같은 회색이 되어 어긴 날이 사라진다** —
정작 사용자가 보려는 것이 그건데. 한 번 그렇게 만들었다가 잡았다. 둘을 다시 합치지 말 것.

### 한글 Enter는 두 번 온다

조합을 끝내는 keydown(`isComposing`)과 진짜 Enter. `web/src/ui/keys.ts`의 `isEnter`만 쓸 것.
`ev.key === 'Enter'`를 직접 검사하면 출처·할 일이 둘씩 생긴다 — 실제로 그랬다. 저장소 층에서도
`createSource`가 겹친 동일 호출을 하나로 합친다(`inflight`).

### 출처(sources)를 건드릴 때

기록이 출처의 제목·저자를 **복사해** 들고 있다(`entries.title`/`subtitle`). 그래서 출처 하나를
고치면 거기 매달린 기록 전부의 얼굴이 함께 바뀐다. 화면은 항상 개수를 먼저 보여줘야 한다.

- `renameSource`는 고친 제목이 다른 출처와 겹치면 **조용히 합치고, 사용자가 친 제목을 버린다**
  (살아남는 쪽이 이긴다). 되돌리는 코드는 저장소 전체에 없다. 그래서 화면은 저장 전에
  `findMergeTarget`으로 먼저 물어본다. **이 사전 확인을 걷어내지 말 것.**
- 합치기는 `mergeSources(from, to)`가 따로 있다. 사용자가 상대를 지목하는 길이다.
- 병합 판정 조건은 `findMergeTarget` 한 군데에만 둔다. `renameSource`도 그것을 부른다 —
  둘이 갈라지면 화면이 "안 겹친다"고 판단한 뒤 리포지토리가 합쳐 버린다.
- `deleteSource`는 출처를 내리고 기록의 `source_id`를 비운다. 비우지 않으면 그 기록은
  목록·상세에는 보이면서 형식(책·영상·글) 필터에서만 사라진다 — 그 필터가 살아 있는 출처를
  거쳐 kind를 얻기 때문이다(`entryRepo`의 `sourceKind`, 웹 `Records.tsx`가 실제로 쓴다).
- **`source_id`를 비울 때는 `filed_at`도 함께 비워야 한다.** `createEntry`는 출처가 있으면
  구조가 붙었다고 보고 그 칸을 찍는데(`entryRepo.ts`), 남겨 두면 출처도 없고 검토에도 안 뜨는
  미아가 된다. 단, 갈피가 붙은 기록은 그것이 구조이므로 찍힌 채로 둔다.
- 검토 큐의 진짜 조건은 `deleted_at IS NULL AND filed_at IS NULL AND source_id IS NULL
  AND type != 'task' AND 갈피 없음`이다. 테스트에서 `source_id IS NULL`만 세면 통과해 버린다 —
  실제로 그렇게 한 번 놓쳤다.

### 웹 빌드는 `web/` 안에서 완결되어야 한다

이 저장소는 루트에 다른 앱(성경 묵상 앱)의 `node_modules`가 있어서, 로컬에서는 웹 빌드가
거기에 몰래 기대도 통과한다. CI는 `web/`만 설치하므로 그대로 죽는다. 실제로 두 번 그랬다.

- `@types/node`는 **`web`의 devDependency**여야 한다 — `vite.config.ts`가 `node:*`를 쓴다.
- `vite.config.ts`의 `esbuild.tsconfigRaw`는 **문자열**이어야 한다. 객체로 주면 Vite가 파일마다
  가장 가까운 tsconfig을 찾아 올라간 뒤 합치는데, `mitjul/src/**`에서 걸리는
  `mitjul/tsconfig.json`이 `expo/tsconfig.base`를 extends 해서 네이티브 의존성 없이는 죽는다.

고쳤는지 확인하는 법 — 루트와 `mitjul`의 `node_modules` 없이 돌려 본다:

```bash
git archive HEAD | tar -x -C /tmp/ci && cd /tmp/ci/web && npm ci && npm run build
```

### 저장 — OPFS SAHPool VFS

- SQLite는 **전용 모듈 워커** 안에서 돈다. `FileSystemSyncAccessHandle`이 `[Exposed=DedicatedWorker]`라서 메인 스레드에서는 안 된다.
- VFS는 반드시 **SAHPool** (`installOpfsSAHPoolVfs({name:'mitjul-vfs', initialCapacity:4})`).
  기본 `opfs` VFS는 SharedArrayBuffer가 필요해 COOP/COEP 응답 헤더를 요구하는데, GitHub Pages는 헤더를 못 준다.
- `worker.ts`의 `open()`은 SAHPool을 한 번 재시도한 뒤, 실패하면 OPFS에 `.mitjul-vfs`가 있는지 본다.
  **있는데 못 열었으면 `engine='blocked'`로 두고 DB를 아예 열지 않는다.** 빈 기록함을 새로 열어 주는 건
  물러서기가 아니라 조용한 데이터 분실이기 때문이다. 이 분기를 없애지 말 것.

### 사진

- `web/src/platform/photos.ts`. 붙이는 즉시 긴 변 1600px · JPEG 0.8로 줄인다 (12MP 5MB → 200KB대).
- **출력 타입은 반드시 `image/jpeg`.** iOS 캔버스는 WebP를 못 만들면서 오류도 안 내고 조용히 PNG를 뱉는다.
  WebP로 바꾸면 사진 한 장이 2MB가 된다.
- 사진은 DB 밖 OPFS 별도 파일(`photos/`)에 둔다. DB가 작아야 백업 파일 하나로 계속 나간다.
  SAHPool VFS가 자기 디렉터리를 독점하므로 그 바깥이어야 한다.
- blob URL은 **화면에 가까워질 때만** 만들고 떠날 때 되돌려준다(`web/src/ui/parts/photo.tsx`,
  IntersectionObserver `rootMargin:'400px'`). 기록 탭은 300줄까지 그리는데 거기서 URL 300개를
  동시에 여는 것이 iOS에서 웹 콘텐츠 프로세스가 죽는 경로다.
- 사진 선택기는 **취소와 조용한 실패를 구분할 수 없다**. WebKit 318572(미해결): 선택기가 '준비 중'
  단계에서 만든 임시 파일이 영구히 남아, 기기 여유 공간이 바닥나면 `change` 대신 `cancel`을 쏜다.
  그래서 `Capture.tsx`가 연속 빈손 횟수를 세서 두 번째에 사용자에게 알린다.
- 동기화에서는 사진 바이트를 Supabase Storage에 넣지 않는다. 축소된 JPEG를 Google Photos의 월별
  `Ledger YYYY-MM` 앨범에 두고, SQLite/Supabase에는 `mediaItemId`와 앨범 ID만 둔다.
- Google Photos `baseUrl`은 만료되므로 저장하지 않는다. 다른 기기는 안정적인 `mediaItemId`로 Edge
  Function에 요청해 OPFS 캐시를 다시 만든다.
- 사용자가 확정한 삭제 의미: Ledger에서 사진을 빼면 로컬 표시와 동기화 연결만 지우고,
  **Google Photos 원본은 남긴다.** 앱이 사진 보관함 전체의 삭제 권한을 갖지 않게 한 선택이다.

### iOS 규칙 (조사로 확인된 것들)

- 홈 화면 웹앱과 Safari는 **저장 통이 다르다.** 설치 전에 첫 화면이 그 사실을 말하고,
  `?add=` 주소로 들어온 글은 설치한 앱 안에서만 받는다.
- ITP는 7일 안 쓴 사이트의 script-writable 저장소(OPFS 포함)를 지운다. **설치한 웹앱은 면제.**
  그래서 `navigator.storage.persist()`를 열자마자 요청하고, 14일 넘게 백업이 없으면 수집함에서 알린다.
- iOS `navigator.share`는 파일을 통째로 메모리에 올리고, 메모리를 안 쓰는 `<a download>`는
  설치한 웹앱에서 깨져 있다(애플이 의도된 동작이라고 밝힘). → 큰 아카이브 하나를 안 만들고
  **사진은 40MB씩 묶어** 내보낸다.
- Web Share Target은 WebKit에 없다. `interactive-widget=resizes-content`도 없다(Visual Viewport API로 대체).
- `beforeunload`/`pagehide`는 앱을 쓸어 닫을 때 안 온다 → `visibilitychange → hidden`에서 flush.

### 백업

- 백업은 `.sqlite3` 파일 하나. **공유 시트를 닫으면(AbortError) `'cancelled'`로 세고 마지막 백업 시각을
  갱신하지 않는다.** 없는 백업을 있다고 믿게 하면 안 된다.
- 되돌리기는 `SQLite format 3` 헤더 + 페이지 크기·길이 정합성을 먼저 검증한 뒤에만 import 한다.

---

## 4. 지금까지 된 것

- 캡처 파서 (`mitjul/src/core/parse.ts`, 순수 함수): 링크 · `p.57` · `시 23:1` · `#갈피` ·
  `1시간 20분` · `14:00` · `- [ ]` · 따옴표를 읽어 유형과 필드를 정한다. 읽어낸 건 칩으로 보이고
  칩을 누르면 그 신호만 되돌아간다.
- 유형 8종: `book` `link` `verse` `meal` `workout` `moment` `writing` `task`
- 출처 1회 등록 + 캡처 칸을 안 떠나는 인라인 등록. 링크는 oEmbed로 스스로 출처가 된다(키 없음).
- 사진: 붙이기 · 축소 · 저장 · 표시 · 기록 삭제 시 연동 삭제 · 고아 사진 정리 · 40MB 묶음 내보내기
- 검색(LIKE 기반) · 유형 필터 · **형식 필터**(책/영상/글 = 출처 종류) · 갈피 필터 · 고정
- 검토 탭: 구조가 안 붙은 기록을 세서 내민다
- 출처 관리(지표 → 출처): 목록·검색·형식 필터, 출처마다 고치기·합치기·지우기. 개수를 먼저 보여주고,
  합쳐질 상황이면 저장 전에 무엇이 몇 개 움직이는지 말하고 묻는다
- 실천(식사·운동)이 콘텐츠와 갈라져 있다 — 수집함 맨 위 오늘 한 줄, 지표의 12주 히트맵 둘 +
  끼니별 준수 막대 셋. 기록·검토·회상에는 안 섞인다
- 데스크톱 레이아웃(900px~): 왼쪽 기둥 네비, 두 단 수집함, 두 열 기록, 가운데 판 시트
- 서비스 워커가 실제로 갱신된다 — 빌드 아이디를 파일 '내용'으로 짓고, `updateViaCache:'none'`,
  `controllerchange`에서 한 번 새로고침. 이 셋 중 하나만 빠져도 고친 것이 기기에 안 닿는다
- 회상 카드 3장, 날짜 시드(FNV-1a + mulberry32) 결정적 선정, 하루 동안 고정
- 지표: 운동·식사 연속일수와 주간 막대
- 옵시디언 마크다운 내보내기(주/월/전체)
- PWA: 서비스 워커 프리캐시(빌드 시 asset 목록 + sha256 빌드 ID 주입), 설치 안내, 아이콘은 코드로 생성
- `.github/workflows/deploy-web.yml` — `main`의 `web/`·`mitjul/src/` 변경에 반응해 Pages로 배포
- 기기 간 본문 동기화: HeyBilly와 같은 Supabase Auth, 사용자별 RLS 변경 로그, OPFS 로컬 우선,
  앱 열기·온라인 복귀·화면 복귀·30초 주기 자동 맞춤. 첫 연결 전 로컬 기록도 전부 올린다
- 충돌은 행 단위 마지막 서버 반영 우선이다. 아직 보내지 않은 로컬 변경은 수신 값으로 덮지 않고,
  참조 데이터 순서와 500건 페이지 경계도 처리한다. 다른 계정에 같은 로컬 기록함을 섞지 않는다
- 사진 동기화 큐: 실패해도 기록은 남고 최대 5번 재시도한다. Google Photos에는 월별 앨범으로 올리고
  다른 기기의 OPFS 캐시를 내려받아 만든다
- Supabase `village-ai`(`tedffwpijiylklfuzkua`)에 Ledger 표 마이그레이션 3개와
  `ledger-photos` Edge Function v1이 적용됐다. 본문 표는 RLS 사용자별 4개 정책, 토큰 표는
  `anon`/`authenticated` 권한 없음 + service role 전용이다
- Supabase 대시보드에는 조직의 사용량 유예 기간이 끝났고 할당량 소진 시 서비스가 멈춘다는 경고가
  떠 있다. Ledger 코드와 별개인 운영 위험이므로 배포 전에 결제/사용량을 확인할 것
- 보안 Advisor의 기존 경고 중 `public.notice_cleanup_work_sources_v2`는 Ledger와 무관한 표지만 RLS가
  꺼져 있다. 기존 호출자를 확인하지 않고 자동 수정하지 않았다. 비공개 표라면
  `ALTER TABLE public.notice_cleanup_work_sources_v2 ENABLE ROW LEVEL SECURITY;` 뒤 필요한 정책을 만들 것
- 전용 Google Cloud 프로젝트 `ledger-village6k-2026`에 Ledger OAuth 앱과 `Ledger Web` 클라이언트를
  만들고 Google Photos Library API를 활성화했다. Supabase의 OAuth client ID/secret도 이 전용
  자격증명으로 교체했다
- 마이그레이션 v1–v7, 코어/DB 테스트 102개와 웹 동기화 테스트 4개 통과, 양쪽 strict 타입 클린
- 적대적 리뷰 여러 차례(웹앱만 114 에이전트 → 확인 31건 전건 수정)

---

## 5. 남은 일

### (A) 배포 전에 한 번 해야 하는 Google 설정

Pages 설정과 홈 화면 추가는 완료됐다. 앱은
https://village6k-cpu.github.io/bible-meditation-app/ 에서 돌고 있고, `main`에 푸시하면 자동 배포된다.

Google Cloud 콘솔 계정은 `village.6k@gmail.com`, 전용 프로젝트는 `ledger-village6k-2026`다.
Google Photos Library API, Ledger 브랜딩, 웹 OAuth 클라이언트 `Ledger Web`은 만들었고 Supabase의
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_STATE_SECRET`,
`GOOGLE_TOKEN_ENCRYPTION_KEY`도 설정했다. 승인된 리디렉션 URI는 다음과 같다.
   `https://tedffwpijiylklfuzkua.supabase.co/functions/v1/ledger-photos?callback=1`

배포 전에 남은 설정과 검증:

1. 동의 화면이 테스트 모드이므로 사용할 Google 계정을 테스트 사용자로 넣는다. 요청 범위는
   `photoslibrary.appendonly`, `photoslibrary.readonly.appcreateddata`,
   `photoslibrary.edit.appcreateddata` 세 개다. 2025년 이후 API 규칙상 Ledger가 만든 사진만 읽는다.
2. Ledger의 보관 → 기기 간 동기화에서 HeyBilly 계정으로 로그인하고 Google Photos를 연결한다.
   연결 뒤 데스크톱/390px 모바일에서 글 1건과 사진 1장을 왕복해 직접 확인한다.

기존 `savvy-range-417607`은 `book-ocr` OAuth 브랜딩을 쓰므로 건드리지 않았다. 그 프로젝트에 처음
잘못 만든 미사용 `Ledger` 웹 클라이언트 하나가 남아 있다. 삭제는 별도 승인 뒤 할 것.

OAuth 콜백은 JWT가 없으므로 Edge Function의 플랫폼 `verify_jwt=false`가 의도된 값이다. 대신 콜백은
10분짜리 HMAC state를 검증하고, 나머지 모든 동작은 함수 안에서 Supabase bearer 사용자 인증을 한다.
refresh token은 AES-GCM 암호문으로만 저장한다.

### (B) 코드로 남은 것

#### B-1. 기기 간 동기화 — 구현 완료, 설정·실기기 검증 남음

사용자 결정은 끝났다. 이미 가진 HeyBilly Supabase를 본문/계정에 재사용하고, 사진 바이트는 비용이
커지지 않도록 Google Photos에 둔다. `mitjul/src/db/sync*.ts`, `photoSync.ts`, `web/src/sync/`,
`supabase/`가 구현이다. 설정 화면은 HeyBilly 이메일/비밀번호로 로그인한다.

남은 것은 위 (A)의 테스트 사용자/범위 설정, 새 PR CI, 그리고 **실제 계정으로 로그인해 두 기기에서
글 1건과 사진 1장을 왕복하는 것**이다. 390px와 1280px 설정 화면은 로컬 브라우저에서 직접 확인했다.
본문 동기화는 Supabase에 이미 적용됐지만 `main`에 웹 코드가 아직 배포되지 않았다. 실계정 왕복까지
끝내기 전에는 “라이브 동기화 완료”라고 말하지 말 것.

중요한 의미론:

- OPFS가 로컬 원본이고 서버는 행 단위 변경 로그다. 설정(`settings`)과 사진 작업 큐는 기기 전용이다.
- 서버는 `(owner_id, entity_type, entity_id)`당 최신 상태 한 줄을 보관한다. 삭제도 tombstone으로 남긴다.
- 전송은 부모(`sources`, `tags`)부터, 삭제는 자식부터다. 이 순서를 시각 순으로 되돌리면 첫 대량
  동기화가 페이지 경계에서 FK 오류로 멈춘다.
- Google Photos 업로드는 Google 계정 저장용량에 포함된다. 과거의 “무제한” 전제를 UI나 문서에 쓰지 말 것.
- Ledger에서 사진 연결을 지워도 Google Photos 원본은 남긴다. 사용자가 명시적으로 고른 규칙이다.

#### B-2. 그 외 — 요청받은 적 없고 만든 적도 없는 것들

우선순위 순. 사용자가 원하는지 먼저 물어볼 것.

- **Drafts 임포트.** 사용자의 원래 고통이 "Drafts에 다 쌓여 있는데 못 읽는다"였다.
  기존 Drafts 내용을 끌어오는 경로가 지금 전혀 없다. 아마 이게 실사용에서 제일 크게 아쉬울 것.
- **주제 자동 태깅.** 지금 갈피(태그)는 `#`를 직접 쓸 때만 붙는다.
- **알림/리마인더.** 할 일 유형에 `due_time`은 있는데 알리지는 않는다.
  (iOS 웹앱의 Web Push는 설치한 홈 화면 앱에서만 되고 제약이 많다 — 조사 필요.)
- **검색이 LIKE 기반**이다. 기록이 수만 건으로 늘면 FTS5로 바꿔야 할 수 있다. 지금은 이르다.

---

## 6. 작업 규칙

- 브랜치 `claude/personal-daily-log-app-raeet6`에만 커밋·푸시. 다른 브랜치로 푸시 금지.
- 푸시는 `git push -u origin claude/personal-daily-log-app-raeet6`.
- 푸시 후 PR을 새로 연다. 지금까지의 PR(#1~#7)은 전부 머지·종료됐다.
- CI는 `pull_request`와 `main` 푸시 양쪽에서 돈다. PR이 초록이어야 머지한다.
- 이 저장소에는 Codex PR 리뷰 봇이 붙어 있다(draft를 ready로 바꾸거나 PR을 열면 자동으로 돈다).
- 커밋 메시지·PR 본문·코드 주석 등 **저장소에 들어가는 어떤 산출물에도 AI 모델 이름을 넣지 않는다.**
- 코드 주석은 한국어로, "무엇을"이 아니라 "왜"를 적는다 — 기존 주석 톤을 그대로 따를 것.
- 푸시 전에 반드시: `cd web && npm test && npm run build` 와
  `cd mitjul && npm test && npm run typecheck`.

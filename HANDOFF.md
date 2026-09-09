# 밑줄 — 인계 문서

이 문서 하나만 읽고 이어서 작업할 수 있게 정리했다. 대화 맥락은 없다고 가정한다.

- 저장소: `village6k-cpu/bible-meditation-app`
- 작업 브랜치: `claude/personal-daily-log-app-raeet6` (**이 브랜치에만** 커밋·푸시할 것)
- PR: [#1](https://github.com/village6k-cpu/bible-meditation-app/pull/1) — draft, `mergeable_state: clean`, CI 없음
- 이 저장소에는 원래 다른 앱(성경 묵상 앱)이 있다. 그 코드는 `main`과 동일하게 두고 건드리지 않는다.
  「밑줄」은 `mitjul/`과 `web/` 두 디렉터리에만 있다.

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
  tests/         node:test 유닛 테스트 (73개)

web/             Vite 7 + Preact 10 웹앱 (주력)
  src/db/        worker.ts(SQLite 워커) · sqlite.ts(expo-sqlite 인터페이스 구현) · index.ts
  src/platform/  photos · backup · install · intake · viewport
  src/export/    obsidian · photos
  src/ui/        App.tsx(뷰 스택) · screens/ · sheets/ · parts/
  public/sw.js   서비스 워커 (빌드 시 프리캐시 목록이 주입된다)
  selftest.html  실기기에서 마이그레이션·검색·트랜잭션·백업이 도는지 확인하는 페이지
```

`web/tsconfig.json`의 경로 별칭: `@core` → `../mitjul/src/core`, `@db` → `../mitjul/src/db`,
`@ex` → `../mitjul/src/export`. **웹이 공유 코어를 그대로 가져다 쓴다.** 마이그레이션 v1–v6과
리포지토리 전부가 한 줄도 안 고치고 브라우저에서 돈다.

### 명령

```bash
cd web    && npm install && npm run dev        # 웹 개발 서버
cd web    && npm run build                     # tsc --noEmit + vite build
cd mitjul && npm install && npm test           # 공유 코어 테스트 73개
cd mitjul && npm run typecheck                 # 네이티브 타입 검사
```

두 쪽 모두 `tsc --noEmit` strict 클린이어야 한다. 테스트는 전부 통과여야 한다.

---

## 3. 반드시 알아야 할 것 (모르면 반드시 깨진다)

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
- 회상 카드 3장, 날짜 시드(FNV-1a + mulberry32) 결정적 선정, 하루 동안 고정
- 지표: 운동·식사 연속일수와 주간 막대
- 옵시디언 마크다운 내보내기(주/월/전체)
- PWA: 서비스 워커 프리캐시(빌드 시 asset 목록 + sha256 빌드 ID 주입), 설치 안내, 아이콘은 코드로 생성
- `.github/workflows/deploy-web.yml` — `main`의 `web/`·`mitjul/src/` 변경에 반응해 Pages로 배포
- 마이그레이션 v1–v6, 유닛 테스트 73개 통과, 양쪽 strict 타입 클린
- 적대적 리뷰 여러 차례(웹앱만 114 에이전트 → 확인 31건 전건 수정)

---

## 5. 남은 일

### (A) 사용자가 해야 하는 것 — 코드 아님

1. **저장소 Settings → Pages → Source를 `GitHub Actions`로** 한 번 바꾼다.
   안 바꾸면 배포 워크플로가 마지막 단계에서 실패한다.
2. PR #1을 `Ready for review` → 머지. `main`에 들어가면 자동 배포된다.
   주소는 `https://village6k-cpu.github.io/bible-meditation-app/`.
3. 아이폰 Safari로 열고 **공유 → 홈 화면에 추가**. 탭으로 쓰면 저장 통이 달라서 기록이 갈리고
   ITP가 7일 뒤 지운다. 그다음 보관 화면에서 '저장소 지키기'를 한 번 누른다.

### (B) 코드로 남은 것

#### B-1. 식단 실천 여부 — 유일하게 원래 요구사항에서 비어 있는 칸 (우선순위 1)

**증상.** `web/src/ui/sheets/Capture.tsx:277`:

```ts
practiced: entryType === 'meal' || entryType === 'workout' ? 1 : null,
```

식사를 적으면 무조건 실천(1)으로 들어간다. 운동은 안 하면 기록 자체가 없으니 문제가 없는데,
식사는 **어긴 날에도 먹은 걸 적게 되므로 어긴 날이 지킨 날로 셈된다.** 그래서 지표 탭의 식사 줄이
"식단을 지켰나"가 아니라 "식사를 기록했나"를 세고 있다. 사용자가 원래 말한
"식단 실천 여부와 추이"가 사실상 구현되지 않은 상태다.

`mitjul/app/new.tsx:211`에도 같은 하드코딩이 있다. (네이티브 `app/compose.tsx:729`에는
제대로 된 토글이 있으니 그 화면은 정상이다.)

**고칠 방향 — 반드시 파서 쪽으로.** 토글 스위치를 캡처 시트에 다는 건 이 앱의 전제를 어긴다
("적기 전에 결정하게 만들지 않는다"). 대신 적은 글에서 신호를 읽는다.

1. `mitjul/src/core/parse.ts`
   - `SignalKind`에 `'practiced'` 추가 (9행)
   - `Capture`에 `practiced: boolean | null` 추가 (27행 인터페이스)
   - `치팅` `과식` `폭식` `어김` `실패` `망함` `#치팅` 같은 말을 잡아 `practiced=false`로,
     `잘 챙김` `클린` 같은 말은 `true`로. 아무 신호도 없으면 `null`(= 기존처럼 실천으로 간주).
     읽어낸 구간은 다른 신호와 동일하게 `signals`에 넣어 칩으로 되돌릴 수 있게 한다.
2. `mitjul/tests/parse.test.ts`에 케이스 추가. `npm test`가 통과해야 한다.
3. `web/src/ui/sheets/Capture.tsx:277`을
   `practiced: entryType === 'meal' ? (live.practiced === false ? 0 : 1) : entryType === 'workout' ? 1 : null,`
   같은 형태로 바꾸고, 칩이 화면에 뜨는지 확인.
4. `mitjul/app/new.tsx:211`도 동일하게.
5. `web/src/ui/sheets/Detail.tsx`에서 고칠 때 뒤집을 수 있는지 확인 (지금은 `e.practiced`를 그대로 넘긴다).
6. `mitjul/src/core/markdown.ts:53`이 `practiced === 1`일 때 `✓`를 붙인다 — 0일 때 표시를
   어떻게 할지 정할 것.

**지표 쪽은 손댈 필요가 없다.** 집계 SQL(`mitjul/src/db/entryRepo.ts:306`)이 이미
`practiced = 1`만 세고, `mitjul/src/core/trends.ts`의 `dotLevel`이 이미
`mealCount`와 `mealPracticed`를 비교해 0/1/2/3으로 나눈다 — 전부 지켰으면 3, 일부면 2,
기록은 했는데 하나도 못 지켰으면 1, 그리고 `practicedOn`은 2 이상만 실천으로 센다.
즉 `practiced`에 0이 들어오기 시작하는 순간 연속일수와 주간 집계가 저절로 맞아떨어진다.
**파서와 캡처 화면만 고치면 끝난다.**

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
- 푸시 후 PR #1이 이미 열려 있으므로 새 PR을 만들지 말고 그 PR을 갱신할 것.
- 커밋 메시지·PR 본문·코드 주석 등 **저장소에 들어가는 어떤 산출물에도 AI 모델 이름을 넣지 않는다.**
- 코드 주석은 한국어로, "무엇을"이 아니라 "왜"를 적는다 — 기존 주석 톤을 그대로 따를 것.
- 푸시 전에 반드시: `cd web && npm run build` 와 `cd mitjul && npm test && npm run typecheck`.

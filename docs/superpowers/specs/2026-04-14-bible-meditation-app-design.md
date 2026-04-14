# 성경 묵상 앱 — Phase 1 MVP 설계 문서

## 개요

성경 묵상을 위한 모바일 앱. Apple Books + Claude.ai 감성의 미니멀하고 따뜻한 디자인.
텍스트가 주인공이고 나머지는 전부 배경.

- **프레임워크**: React Native Expo (managed workflow, TypeScript)
- **네비게이션**: expo-router (파일 기반)
- **상태관리**: Zustand
- **로컬DB**: expo-sqlite
- **스타일링**: React Native StyleSheet (외부 UI 라이브러리 없음)
- **폰트**: Noto Serif KR (본문), Pretendard (UI)

---

## 디자인 시스템

원본 스펙(`bible-app-claude-code-instructions.md`) 그대로 적용:

- 배경: `#FAFAF8`, 텍스트: `#1A1A1A`, 보조: `#999999`
- Accent Green: `#7D8B75`, Accent Red: `#B8564F`
- Surface: `#F0EDE7`, Divider: `rgba(0,0,0,0.05)`
- 화면 좌우 패딩 28px, 섹션 간 간격 28px
- 성경 본문: Noto Serif KR 300, 16.5px, line-height 2.05
- 절 번호: Pretendard 700, 12px, `#B8564F`
- 섹션 라벨: Pretendard 600, 10.5px, letter-spacing 0.1em, `#7D8B75`

---

## 아키텍처

### 데이터 레이어

DB를 두 개로 분리:

1. **bible.db** (읽기 전용, 앱 번들에 프리로드)
   - `books`: 66권 메타데이터 (id, name_ko, name_abbr, testament, chapter_count)
   - `verses`: 전체 절 텍스트 (book_id, chapter, verse, text)
   - `sections`: 소제목/페리코프 (book_id, chapter, start_verse, end_verse, title)

2. **user.db** (읽기/쓰기, 런타임 생성)
   - `user_profile`: name TEXT
   - `daily_readings`: date TEXT, book_id INTEGER, start_chapter INTEGER, end_chapter INTEGER, completed INTEGER DEFAULT 0
   - `notes`: id, created_at, updated_at, book_id, chapter, verse, content
   - `highlights`: id, book_id, chapter, verse, color DEFAULT '#7D8B75'
   - `reading_history`: date TEXT, completed INTEGER (주간 도트용 — 해당 날짜에 하나라도 완료했는지)

### 빌드 파이프라인

```
scripts/build-bible-db.ts
  ├─ GitHub에서 개역개정 JSON 다운로드/참조
  ├─ JSON → SQLite 변환 (books, verses, sections)
  └─ assets/bible/bible.db 생성
```

앱 첫 실행 시 `bible.db`를 앱 문서 디렉토리로 복사. `user.db`는 첫 실행 시 스키마 생성.

### 상태관리 (Zustand)

```typescript
interface AppStore {
  // 사용자
  userName: string;
  
  // 오늘의 읽기
  todayReadings: DailyReading[];
  
  // 성경 뷰어 현재 위치
  currentBookId: number;
  currentChapter: number;
  
  // 음악 플레이어 (UI 상태만, MVP)
  isPlaying: boolean;
  currentTrack: string;
}
```

---

## 화면 구성

### 온보딩 (`app/onboarding.tsx`)

- 조건: `user_profile` 테이블에 이름이 없으면 표시
- 단일 화면: 배경 `#FAFAF8`
- "이름을 알려주세요" (Noto Serif KR 21px, 가운데)
- 밑줄 스타일 텍스트 입력
- "시작하기" 버튼 → user.db에 저장 → 홈 탭으로 이동

### Tab 1: 홈 (`app/(tabs)/index.tsx`)

위→아래 스크롤 단일 화면:

1. **헤더**: 날짜(Pretendard 11.5px, #AAA) + 시간대별 인사말 + 사용자 이름(bold)
2. **오늘의 말씀**: 섹션라벨 + 랜덤 구절(Noto Serif KR) + 출처 + 탭 시 아코디언(샘플 데이터)
3. **읽기표**:
   - 원형 프로그레스 140px: 오늘 설정 분량 대비 완료율
   - 내부: 퍼센트(32px) + "오늘의 읽기"(10px)
   - 주간 도트(월~일): 해당 날짜에 읽기 완료 여부
   - 오늘 읽을 말씀 체크리스트: "+" 버튼으로 사용자가 직접 추가 (책/장 선택 피커)
   - 체크 시 취소선 + opacity 0.4, 오른쪽 책 아이콘으로 해당 본문 이동
   - 전부 완료 시: "오늘의 읽기를 완료했어요"
4. **묵상 노트**: 텍스트 에리어, placeholder "오늘의 묵상을 기록해 보세요...", 자동 저장
5. **미니 플레이어**: 카드형, 재생 버튼 + 트랙명 + 상태. MVP에서는 UI만.

### Tab 2: 성경 (`app/(tabs)/bible.tsx`)

1. **헤더**: 햄버거 → 책/장 선택 네비게이터 | 중앙 "요한복음 1장" | 오른쪽 설정
2. **책/장 선택 네비게이터**: 드로어 또는 바텀시트. 구약/신약 토글 → 책 목록 → 장 번호 그리드
3. **본문**:
   - 장 번호: Pretendard 64px, weight 200, rgba(0,0,0,0.06)
   - 소제목: Noto Serif KR 19px, weight 600
   - 절: 단락(페리코프) 그룹핑, 그룹 간 margin-bottom 32px
   - 절 번호: Pretendard 12px, 700, `#B8564F`, margin-right 6px
   - 본문: Noto Serif KR 16.5px, 300, line-height 2.05, word-break keep-all
4. **롱프레스 인터랙션**:
   - 500ms+ 누르면 해당 절 하이라이트(rgba(125,139,117,0.12)) + 바텀시트(60%)
   - 바텀시트: 핸들바 + 선택 구절 카드 + 주석(placeholder) + 관련구절(샘플 칩) + 원어(샘플)
   - 오버레이 rgba(0,0,0,0.25), 탭으로 닫기
5. **스크롤 투 탑**: 300px 이상 스크롤 시 하단 중앙 ↑ 버튼(40px 원형, blur)

### Tab 3: 음악 (`app/(tabs)/music.tsx`)

MVP에서는 UI 껍데기만:
- 풀스크린: 그라데이션 배경(#F5F0E8 → #EDE6DA)
- 추상 오브 (SVG 또는 그라데이션 원)
- 재생/이전/다음 버튼, 타임라인, 볼륨 — 비활성 상태
- "음악이 곧 추가됩니다" 안내

### Tab 4: 노트 (`app/(tabs)/notes.tsx`)

- 날짜순 역순 리스트: 날짜 + 관련 구절 + 본문 미리보기(2줄)
- 구분선: rgba(0,0,0,0.04)
- 탭 → `app/note/[id].tsx` 상세/편집 화면

### 탭 바

- 4탭: 홈(house), 성경(book), 음악(music note), 노트(document)
- 선형 아이콘 stroke 1.5px
- 활성 #1A1A1A, 비활성 #CCCCCC
- 라벨 Pretendard 10px
- 배경 rgba(250,250,248,0.88) + blur(24px)

---

## 프로젝트 구조

```
app/
├── (tabs)/
│   ├── _layout.tsx          # 탭 네비게이터
│   ├── index.tsx            # 홈
│   ├── bible.tsx            # 성경 읽기
│   ├── music.tsx            # 음악 플레이어
│   └── notes.tsx            # 노트 리스트
├── _layout.tsx              # 루트 레이아웃 (폰트 로딩, DB 초기화)
├── onboarding.tsx           # 온보딩 (이름 입력)
├── bible/
│   └── [book]/[chapter].tsx # 성경 상세 (동적 라우트)
└── note/
    └── [id].tsx             # 노트 상세/편집

components/
├── CircleProgress.tsx       # 원형 프로그레스
├── WeekDots.tsx             # 주간 완료 도트
├── ReadingChecklist.tsx     # 오늘 읽기 체크리스트
├── VerseText.tsx            # 롱프레스 지원 구절
├── BottomSheet.tsx          # 주석 바텀시트
├── MiniPlayer.tsx           # 미니 플레이어 (UI only)
├── NoteCard.tsx             # 노트 리스트 항목
├── SectionLabel.tsx         # 섹션 라벨
├── BookChapterPicker.tsx    # 책/장 선택 네비게이터
└── AddReadingModal.tsx      # 읽기 분량 추가 모달

lib/
├── db.ts                    # SQLite 초기화 (bible.db 복사 + user.db 생성)
├── bible-data.ts            # 성경 데이터 쿼리 함수들
├── store.ts                 # Zustand 스토어
├── theme.ts                 # 디자인 토큰 (컬러, 타이포, 간격)
└── utils.ts                 # 날짜 포맷, 인사말 생성

assets/
├── fonts/
│   ├── NotoSerifKR-Light.otf
│   ├── NotoSerifKR-SemiBold.otf
│   ├── Pretendard-Regular.otf
│   ├── Pretendard-Medium.otf
│   ├── Pretendard-SemiBold.otf
│   └── Pretendard-Bold.otf
└── bible/
    └── bible.db             # 프리빌드된 SQLite DB

scripts/
└── build-bible-db.ts        # JSON → SQLite 변환 스크립트
```

---

## 성경 데이터 소싱

GitHub에서 개역개정 JSON 오픈소스 데이터를 찾아서 사용. `scripts/build-bible-db.ts`로 변환.
정식 배포 시 대한성서공회 저작권 라이선스 취득 필요.

---

## MVP 범위 요약

| 포함 | 제외 (Phase 2) |
|------|----------------|
| 온보딩 (이름 입력) | RAG 주석 시스템 |
| 홈 화면 전체 | 실제 음악 재생 |
| 성경 읽기 + 책/장 네비게이션 | 커스텀 읽기 플랜 |
| 롱프레스 바텀시트 (샘플 데이터) | 커뮤니티/모임 |
| 자유 읽기표 + 체크 | 원어 사전 DB |
| 묵상 노트 작성/리스트 | 관련 구절 cross-reference DB |
| 음악 플레이어 UI | 성경 텍스트 검색 |
| 주간 도트 + 원형 프로그레스 | 폰트 크기/줄간격 설정 |

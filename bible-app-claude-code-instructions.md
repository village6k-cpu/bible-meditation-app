# 성경 묵상 앱 — Claude Code 프로젝트 인스트럭션

## 프로젝트 개요

성경 묵상을 위한 모바일 앱. 단순한 성경 읽기 도구가 아니라, **영적 독서를 위한 몰입 환경**을 설계한다. 앰비언트 음악이 흐르고, 구절을 꾹 누르면 주석과 관련 자료가 뜨고, 묵상 노트를 기록할 수 있는 개인 서재 같은 앱.

디자인 레퍼런스: **Apple Books + Claude.ai**. 극도로 미니멀하고 따뜻하며, 텍스트 중심. 게이미피케이션 최소화.

---

## 기술 스택

- **프레임워크**: React Native (Expo managed workflow)
- **언어**: TypeScript
- **상태관리**: Zustand
- **로컬DB**: SQLite (expo-sqlite) — 성경 데이터 및 사용자 데이터 저장
- **오디오**: expo-av — 앰비언트 음악 백그라운드 재생
- **네비게이션**: expo-router (파일 기반 라우팅)
- **스타일링**: StyleSheet (React Native 기본) — 외부 UI 라이브러리 사용하지 않음
- **폰트**: Noto Serif KR (본문), Pretendard (UI)

---

## 디자인 시스템

### 컬러

```
Background:     #FAFAF8   (warm off-white, 모든 화면의 기본 배경)
Text Primary:   #1A1A1A   (본문 텍스트)
Text Secondary: #999999   (보조 텍스트, 날짜, 안내문)
Text Tertiary:  #CCCCCC   (힌트 텍스트, 비활성)
Accent Green:   #7D8B75   (sage green — 프로그레스, 체크, 섹션 라벨)
Accent Red:     #B8564F   (coral red — 성경 절 번호 전용)
Surface:        #F0EDE7   (카드 배경, 바텀시트 내 섹션)
Divider:        rgba(0,0,0,0.05)
```

### 타이포그래피

```
성경 본문:      Noto Serif KR, weight 300, size 16.5px, line-height 2.05
소제목:         Noto Serif KR, weight 600, size 19px, line-height 1.5
절 번호:        Pretendard, weight 700, size 12px, color #B8564F
섹션 라벨:      Pretendard, weight 600, size 10.5px, letter-spacing 0.1em, color #7D8B75
UI 본문:        Pretendard, weight 400-500, size 13-15px
날짜/보조:      Pretendard, weight 400, size 11-12px, color #999
```

### 간격 & 레이아웃

```
화면 좌우 패딩:  28px
섹션 간 구분선:  1px solid rgba(0,0,0,0.05), 상하 margin 28px
카드 border-radius: 12-14px
버튼 border-radius: 둥근사각 9px (체크박스), 원형 50% (플레이 버튼)
바텀시트 radius:  20px 20px 0 0
```

### 애니메이션

```
페이드인:        opacity 0→1, translateY 14→0, duration 0.7s, stagger 0.15s
바텀시트:        translateY(100%)→0, duration 0.4s, cubic-bezier(0.25,0.46,0.45,0.94)
프로그레스:      stroke-dashoffset transition 1.5s
체크박스:        scale + color transition 0.25s
```

---

## 화면 구조 (4 탭)

### Tab 1: 홈

**경로**: `/(tabs)/index`

위에서 아래로 스크롤되는 단일 화면. 구성:

1. **헤더**
   - 날짜: "4월 14일 월요일" (Pretendard 11.5px, #AAA)
   - 인사: 시간대별 자동 변경 + 사용자 이름
     - 06시 이전: "고요한 새벽입니다"
     - 06-12시: "좋은 아침이에요"
     - 12-17시: "평안한 오후예요"
     - 17-21시: "편안한 저녁이에요"
     - 21시 이후: "고요한 밤이에요"
   - 이름은 볼드(weight 500), 나머지는 light(weight 300), size 21px

2. **오늘의 말씀**
   - 섹션 라벨: "오늘의 말씀" (Pretendard, #7D8B75, 대문자 스타일)
   - 성경 구절 1개 무작위 표시 (Noto Serif KR 300, 15px, line-height 2.0)
   - 출처: "— 시편 46:10" (Pretendard 11.5px, #AAA)
   - **탭 인터랙션**: 구절 영역 탭 시 관련 자료 패널이 아코디언으로 펼쳐짐
     - 관련 말씀 (다른 성경 구절)
     - 주석 출처 + 해설 인용 (이탤릭)
     - 배경색: #F0EDE7, border-radius 14px
   - 안내 텍스트: "탭하여 관련 자료 보기" (10.5px, #CCC, 가운데 정렬)

3. **묵상 읽기표**
   - 섹션 라벨: "묵상 읽기표"
   - **원형 프로그레스**: 중앙 배치, size 140px, stroke 4px, color #7D8B75
     - 내부: 퍼센트(Pretendard 32px, weight 300) + "DAY 47 OF 365"(10px, #AAA)
   - **주간 도트**: 월~일 7개. 라벨(요일) + 도트(32x32px, border-radius 9px)
     - 완료: bg #7D8B75 + 흰색 체크마크
     - 오늘: 테두리 #7D8B75 + 중앙 원형 도트
     - 미래: 테두리 rgba(0,0,0,0.1)
   - **오늘 읽을 말씀**: "오늘 읽을 말씀" 제목(Noto Serif KR 16px, weight 500)
     - 체크박스 + 본문명 + 장 (예: "창세기 47-48장")
     - 체크 시: 취소선 + opacity 0.4
     - 오른쪽: 책 아이콘 (해당 본문으로 이동 링크)
     - 전부 체크 시: "오늘의 읽기를 완료했어요" (Pretendard 12px, #7D8B75)

4. **묵상 노트**
   - 섹션 라벨: "묵상 노트" + 오른쪽에 오늘 날짜
   - 텍스트 에리어: placeholder "오늘의 묵상을 기록해 보세요..."
   - bg rgba(0,0,0,0.015), border 1px solid rgba(0,0,0,0.06), radius 12px
   - focus 시 border-color #7D8B75

5. **앰비언트 음악 미니 플레이어**
   - 카드형: 재생 버튼(원형 38px, bg #7D8B75) + 트랙명 + 상태 텍스트
   - 재생 중: 배경 rgba(125,139,117,0.05), 오른쪽에 이퀄라이저 바 애니메이션
   - border-radius 14px

---

### Tab 2: 성경

**경로**: `/(tabs)/bible`

성경 읽기 전용 화면. **텍스트만. 장식 없이.**

1. **헤더**
   - 왼쪽: 햄버거 메뉴 아이콘 → 성경 책/장 선택 네비게이터
   - 중앙: "요한복음 1장" (Pretendard 15px, weight 600)
   - 오른쪽: 설정 아이콘 (폰트 크기, 줄간격 조절)

2. **본문 영역**
   - 장 번호: 매우 크고 연한 숫자 (Pretendard 64px, weight 200, rgba(0,0,0,0.06))
   - 소제목: Noto Serif KR 19px, weight 600 (예: "말씀이 육신이 되시다")
   - 구절: 단락(페리코프) 단위로 그룹핑, 그룹 간 margin-bottom 32px
     - 절 번호: Pretendard 12px, weight 700, color #B8564F, margin-right 6px
     - 본문: Noto Serif KR 16.5px, weight 300, line-height 2.05
     - 단어 단위 줄바꿈(word-break: keep-all)

3. **롱프레스 인터랙션**
   - 아무 구절이나 500ms 이상 꾹 누르면:
     - 해당 구절 배경 하이라이트: rgba(125,139,117,0.12)
     - 바텀시트 올라옴 (화면 60% 높이)
   - 바텀시트 내용:
     - 상단 핸들바 (36x4px, radius 2, 가운데)
     - 선택된 구절 (하이라이트 배경 카드)
     - **주석** 섹션: 해설 텍스트 (추후 RAG 시스템 연결)
     - **관련 구절** 섹션: 칩 형태로 나열 (예: "창 1:1", "골 1:17")
     - **원어** 섹션: 그리스어/히브리어 원문 + 음역 + 의미
   - 오버레이: rgba(0,0,0,0.25), 탭하면 시트 닫힘

4. **스크롤 투 탑**
   - 300px 이상 스크롤 시 하단 중앙에 ↑ 버튼 표시
   - 40x40px, 원형, blur 배경, border rgba(0,0,0,0.08)

---

### Tab 3: 음악

**경로**: `/(tabs)/music`

앰비언트 묵상 음악 플레이어.

1. **풀스크린 플레이어**
   - 배경: 은은한 그라데이션 (#F5F0E8 → #EDE6DA)
   - 중앙: 추상적 형태 또는 그라데이션 오브 (앨범아트 대신)
   - 트랙명 + 아티스트 (가운데 정렬, 산세리프)
   - 큰 재생/일시정지 버튼 (원형, 테두리)
   - 이전/다음 (작게, 양옆)
   - 타임라인 스크러버 (가로선)
   - 볼륨 슬라이더 (하단, 얇게)

2. **트랙 리스트**
   - "Up Next" 섹션: 2-3곡 리스트
   - "성경 읽으며 듣기" 토글 → 활성화 시 홈과 성경 화면에 미니 플레이어 고정

---

### Tab 4: 노트

**경로**: `/(tabs)/notes`

묵상 노트 모아보기.

1. **노트 리스트**
   - 날짜순 역순 정렬
   - 각 항목: 날짜 + 관련 구절 + 본문 미리보기(2줄)
   - 구분선: rgba(0,0,0,0.04)

2. **노트 상세/편집**
   - 상단: 날짜 + 관련 구절 레퍼런스
   - 본문: 자유 텍스트 에디터
   - 하이라이트된 구절이 있으면 상단에 인용 카드로 표시

---

## 데이터 구조

### 성경 데이터 (SQLite)

```sql
CREATE TABLE books (
  id INTEGER PRIMARY KEY,
  name_ko TEXT NOT NULL,        -- "창세기"
  name_abbr TEXT NOT NULL,      -- "창"
  testament TEXT NOT NULL,       -- "old" | "new"
  chapter_count INTEGER NOT NULL
);

CREATE TABLE verses (
  id INTEGER PRIMARY KEY,
  book_id INTEGER REFERENCES books(id),
  chapter INTEGER NOT NULL,
  verse INTEGER NOT NULL,
  text TEXT NOT NULL
);

CREATE TABLE sections (
  id INTEGER PRIMARY KEY,
  book_id INTEGER REFERENCES books(id),
  chapter INTEGER NOT NULL,
  start_verse INTEGER NOT NULL,
  end_verse INTEGER NOT NULL,
  title TEXT                     -- 소제목, nullable
);
```

### 사용자 데이터 (SQLite)

```sql
CREATE TABLE reading_plans (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,            -- "1년 통독"
  total_days INTEGER NOT NULL,
  start_date TEXT NOT NULL       -- ISO date
);

CREATE TABLE daily_readings (
  id INTEGER PRIMARY KEY,
  plan_id INTEGER REFERENCES reading_plans(id),
  day_number INTEGER NOT NULL,
  book_id INTEGER REFERENCES books(id),
  start_chapter INTEGER NOT NULL,
  end_chapter INTEGER NOT NULL,
  completed INTEGER DEFAULT 0    -- boolean
);

CREATE TABLE notes (
  id INTEGER PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  book_id INTEGER REFERENCES books(id),
  chapter INTEGER,
  verse INTEGER,
  content TEXT NOT NULL
);

CREATE TABLE highlights (
  id INTEGER PRIMARY KEY,
  book_id INTEGER REFERENCES books(id),
  chapter INTEGER NOT NULL,
  verse INTEGER NOT NULL,
  color TEXT DEFAULT '#7D8B75'
);
```

---

## 성경 데이터 소싱

개역개정 전문 데이터는 개발/테스트 단계에서 GitHub 오픈소스 JSON 활용. 정식 배포 시 대한성서공회 저작권 라이선스 취득 (연 100만원 기본).

JSON 구조 예시:
```json
{
  "book": "요한복음",
  "chapter": 1,
  "verses": [
    { "verse": 1, "text": "태초에 말씀이 계시니라..." },
    { "verse": 2, "text": "그가 태초에 하나님과 함께 계셨고" }
  ]
}
```

---

## 음악 데이터

초기에는 로열티프리 앰비언트 트랙 5-10곡을 앱 번들에 포함.
Suno AI로 생성한 워십 앰비언트 트랙 사용 (상업적 사용 가능 플랜).

키워드: soaking worship, ambient piano pad, contemplative, peaceful, 60-70bpm

파일 형식: .mp3 또는 .m4a, 각 트랙 10-30분 길이

---

## 프로젝트 구조

```
app/
├── (tabs)/
│   ├── _layout.tsx          # 탭 네비게이터 (홈, 성경, 음악, 노트)
│   ├── index.tsx            # 홈 화면
│   ├── bible.tsx            # 성경 읽기 화면
│   ├── music.tsx            # 음악 플레이어
│   └── notes.tsx            # 묵상 노트
├── _layout.tsx              # 루트 레이아웃
├── bible/
│   └── [book]/[chapter].tsx # 성경 상세 읽기 (동적 라우트)
└── note/
    └── [id].tsx             # 노트 상세/편집

components/
├── CircleProgress.tsx
├── WeekDots.tsx
├── ReadingChecklist.tsx
├── VerseText.tsx            # 롱프레스 지원 구절 컴포넌트
├── BottomSheet.tsx          # 주석 바텀시트
├── MiniPlayer.tsx           # 하단 고정 미니 플레이어
├── NoteCard.tsx
└── SectionLabel.tsx         # "오늘의 말씀" 같은 섹션 라벨

lib/
├── db.ts                    # SQLite 초기화 및 쿼리
├── bible-data.ts            # 성경 데이터 로딩/파싱
├── store.ts                 # Zustand 스토어 (읽기 진행, 설정 등)
└── utils.ts                 # 날짜 포맷, 인사말 생성 등

assets/
├── fonts/
│   ├── NotoSerifKR-*.otf
│   └── Pretendard-*.otf
├── music/
│   ├── peaceful-dwelling.mp3
│   └── ...
└── bible/
    └── krv-revised.json     # 개역개정 전문 JSON
```

---

## 탭 바 설정

```
아이콘: 선형 아이콘 (stroke 1.5px), SF Symbols 스타일
활성 색상: #1A1A1A
비활성 색상: #CCCCCC
라벨 폰트: Pretendard 10px
배경: rgba(250,250,248,0.88) + backdrop-filter blur(24px)
하단 safe area 패딩 포함
```

4개 탭:
1. 홈 (house 아이콘)
2. 성경 (book 아이콘)
3. 음악 (music note 아이콘)
4. 노트 (document 아이콘)

---

## 핵심 원칙

1. **텍스트 퍼스트**: 성경 본문은 어떤 UI 요소보다 우선한다. 장식적 요소를 최소화하고 타이포그래피로 승부한다.
2. **따뜻한 미니멀리즘**: 차가운 흰색(#FFF) 대신 따뜻한 오프화이트(#FAFAF8). 날카로운 그림자 대신 은은한 divider.
3. **게이미피케이션 자제**: 스트릭, 불꽃 이모지, 레벨업 같은 요소 없음. 조용한 프로그레스 트래킹만.
4. **사적 공간**: 이 앱은 소셜 미디어가 아니라 개인 서재다. 모든 인터랙션은 개인적이고 조용해야 한다.
5. **호흡 있는 UI**: 여백을 아끼지 않는다. 섹션 간 28px 이상의 간격. line-height 2.0 이상.

---

## 우선순위 (MVP)

Phase 1으로 아래만 구현:
1. ✅ 홈 화면 (인사 + 오늘의 말씀 + 읽기표 + 노트 + 미니플레이어)
2. ✅ 성경 읽기 화면 (전문 텍스트 + 소제목 + 단락 구분 + 책/장 네비게이션)
3. ✅ 앰비언트 음악 플레이어 (5곡, 백그라운드 재생)
4. ✅ 묵상 노트 (작성 + 리스트)
5. ✅ 읽기표 (1년 통독 프리셋 + 일별 체크)

Phase 2 (이후):
- 롱프레스 주석 시스템 (RAG 연결)
- 읽기표 커스텀 플랜 생성
- 커뮤니티/모임 기능

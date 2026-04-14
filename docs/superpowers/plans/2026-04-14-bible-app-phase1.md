# 성경 묵상 앱 Phase 1 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 성경 묵상 앱 MVP — 홈, 성경 읽기, 음악(UI), 노트 4개 탭을 갖춘 Expo 앱

**Architecture:** Expo managed workflow + expo-router 파일 기반 라우팅. 성경 데이터는 빌드 타임에 JSON→SQLite 변환 후 프리로드. 사용자 데이터는 별도 SQLite DB에 런타임 저장. Zustand으로 세션 상태 관리.

**Tech Stack:** React Native Expo, TypeScript, expo-router, expo-sqlite, Zustand, expo-font

**성경 데이터:** 개역한글(KRV 1961, public domain)을 `scrollmapper/bible_databases` 에서 가져옴. 개역개정은 저작권 문제로 배포 시 대한성서공회 라이선스 필요. 소제목(페리코프) 데이터는 별도 JSON으로 직접 작성.

---

## File Map

### New Files — Foundation

| File | Responsibility |
|------|----------------|
| `app.json` | Expo 설정 |
| `tsconfig.json` | TypeScript 설정 |
| `lib/theme.ts` | 디자인 토큰 (컬러, 타이포, 간격) |
| `lib/utils.ts` | 날짜 포맷, 인사말 생성 |
| `lib/db.ts` | SQLite 초기화 (bible.db 복사 + user.db 스키마) |
| `lib/bible-data.ts` | 성경 데이터 쿼리 함수 |
| `lib/store.ts` | Zustand 스토어 |
| `scripts/build-bible-db.ts` | JSON→SQLite 변환 스크립트 |
| `scripts/sections-ko.json` | 소제목/페리코프 데이터 (수동 작성, 주요 책만) |

### New Files — Navigation & Screens

| File | Responsibility |
|------|----------------|
| `app/_layout.tsx` | 루트 레이아웃 (폰트 로딩, DB 초기화, 온보딩 분기) |
| `app/onboarding.tsx` | 온보딩 (이름 입력) |
| `app/(tabs)/_layout.tsx` | 탭 네비게이터 4개 |
| `app/(tabs)/index.tsx` | 홈 화면 |
| `app/(tabs)/bible.tsx` | 성경 읽기 화면 |
| `app/(tabs)/music.tsx` | 음악 플레이어 (UI only) |
| `app/(tabs)/notes.tsx` | 노트 리스트 |
| `app/note/[id].tsx` | 노트 상세/편집 |

### New Files — Components

| File | Responsibility |
|------|----------------|
| `components/SectionLabel.tsx` | "오늘의 말씀" 같은 섹션 라벨 |
| `components/CircleProgress.tsx` | SVG 원형 프로그레스 |
| `components/WeekDots.tsx` | 주간 완료 도트 (월~일) |
| `components/ReadingChecklist.tsx` | 오늘 읽기 체크리스트 |
| `components/AddReadingModal.tsx` | 읽기 분량 추가 (책/장 선택) |
| `components/VerseText.tsx` | 롱프레스 지원 구절 |
| `components/BottomSheet.tsx` | 주석/관련구절/원어 바텀시트 |
| `components/BookChapterPicker.tsx` | 책/장 선택 네비게이터 |
| `components/MiniPlayer.tsx` | 미니 플레이어 (UI only) |
| `components/NoteCard.tsx` | 노트 리스트 항목 |

---

## Task 1: Expo 프로젝트 초기화

**Files:**
- Create: `package.json`, `app.json`, `tsconfig.json`, `app/_layout.tsx`

- [ ] **Step 1: Expo 프로젝트 생성**

```bash
cd ~/Desktop/묵상\ 앱
npx create-expo-app@latest bible-app --template blank-typescript
```

이 명령은 `bible-app/` 서브디렉토리를 생성한다. 생성 후 내용물을 루트로 옮긴다:

```bash
mv bible-app/* bible-app/.* . 2>/dev/null
rmdir bible-app
```

- [ ] **Step 2: 필요 패키지 설치**

```bash
npx expo install expo-router expo-sqlite expo-font expo-splash-screen expo-status-bar react-native-safe-area-context react-native-screens react-native-gesture-handler react-native-reanimated react-native-svg zustand @expo/vector-icons
```

- [ ] **Step 3: app.json에 expo-router 설정**

`app.json`의 `expo` 객체에 scheme과 plugins 추가:

```json
{
  "expo": {
    "name": "묵상",
    "slug": "bible-meditation",
    "scheme": "bible-meditation",
    "version": "1.0.0",
    "orientation": "portrait",
    "userInterfaceStyle": "light",
    "newArchEnabled": true,
    "plugins": [
      "expo-router",
      "expo-font",
      "expo-sqlite"
    ],
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.village6k.biblemeditation"
    },
    "android": {
      "adaptiveIcon": {
        "backgroundColor": "#FAFAF8"
      },
      "package": "com.village6k.biblemeditation"
    },
    "web": {
      "bundler": "metro"
    }
  }
}
```

- [ ] **Step 4: tsconfig.json 확인**

`tsconfig.json`에 `compilerOptions.paths`가 있는지 확인. expo-router가 자동 생성한 설정 사용.

- [ ] **Step 5: 최소 루트 레이아웃 생성**

`app/_layout.tsx`:

```tsx
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
```

- [ ] **Step 6: 최소 홈 화면으로 앱 실행 확인**

`app/(tabs)/index.tsx`:

```tsx
import { View, Text, StyleSheet } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text>묵상</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAFAF8' },
});
```

`app/(tabs)/_layout.tsx` (임시 — Task 7에서 완성):

```tsx
import { Tabs } from 'expo-router';

export default function TabLayout() {
  return <Tabs screenOptions={{ headerShown: false }} />;
}
```

```bash
npx expo start
```

시뮬레이터에서 "묵상" 텍스트가 오프화이트 배경 위에 표시되면 성공.

- [ ] **Step 7: 커밋**

```bash
git add -A
git commit -m "feat: initialize Expo project with expo-router and TypeScript"
```

---

## Task 2: 폰트 세팅

**Files:**
- Create: `assets/fonts/` (폰트 파일들)
- Modify: `app/_layout.tsx`

- [ ] **Step 1: 폰트 파일 다운로드**

Noto Serif KR (Light 300, SemiBold 600):

```bash
mkdir -p assets/fonts
# Noto Serif KR — Google Fonts에서 직접 다운로드
curl -L "https://fonts.google.com/download?family=Noto+Serif+KR" -o /tmp/noto-serif-kr.zip
unzip -o /tmp/noto-serif-kr.zip -d /tmp/noto-serif-kr
cp /tmp/noto-serif-kr/static/NotoSerifKR-Light.ttf assets/fonts/
cp /tmp/noto-serif-kr/static/NotoSerifKR-SemiBold.ttf assets/fonts/
```

Pretendard (Regular 400, Medium 500, SemiBold 600, Bold 700):

```bash
curl -L "https://github.com/orioncactus/pretendard/releases/latest/download/Pretendard-1.3.9.zip" -o /tmp/pretendard.zip
unzip -o /tmp/pretendard.zip -d /tmp/pretendard
cp /tmp/pretendard/public/static/Pretendard-Regular.otf assets/fonts/
cp /tmp/pretendard/public/static/Pretendard-Medium.otf assets/fonts/
cp /tmp/pretendard/public/static/Pretendard-SemiBold.otf assets/fonts/
cp /tmp/pretendard/public/static/Pretendard-Bold.otf assets/fonts/
```

> 다운로드 URL이 변경되었을 수 있음. 실패 시 Google Fonts와 GitHub releases 페이지에서 직접 다운로드.

- [ ] **Step 2: 루트 레이아웃에서 폰트 로딩**

`app/_layout.tsx`:

```tsx
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'NotoSerifKR-Light': require('../assets/fonts/NotoSerifKR-Light.ttf'),
    'NotoSerifKR-SemiBold': require('../assets/fonts/NotoSerifKR-SemiBold.ttf'),
    'Pretendard-Regular': require('../assets/fonts/Pretendard-Regular.otf'),
    'Pretendard-Medium': require('../assets/fonts/Pretendard-Medium.otf'),
    'Pretendard-SemiBold': require('../assets/fonts/Pretendard-SemiBold.otf'),
    'Pretendard-Bold': require('../assets/fonts/Pretendard-Bold.otf'),
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
```

- [ ] **Step 3: 폰트 렌더링 확인**

`app/(tabs)/index.tsx`를 수정하여 폰트가 적용되는지 확인:

```tsx
import { View, Text, StyleSheet } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={{ fontFamily: 'NotoSerifKR-Light', fontSize: 16.5, lineHeight: 34 }}>
        태초에 말씀이 계시니라 이 말씀이 하나님과 함께 계셨으니 이 말씀은 곧 하나님이시니라
      </Text>
      <Text style={{ fontFamily: 'Pretendard-Bold', fontSize: 12, color: '#B8564F', marginTop: 20 }}>
        1
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 28, backgroundColor: '#FAFAF8' },
});
```

시뮬레이터에서 세리프체와 절 번호 스타일이 올바르게 표시되면 성공.

- [ ] **Step 4: 커밋**

```bash
git add assets/fonts/ app/_layout.tsx app/\(tabs\)/index.tsx
git commit -m "feat: add Noto Serif KR and Pretendard fonts"
```

---

## Task 3: 디자인 토큰 & 유틸리티

**Files:**
- Create: `lib/theme.ts`, `lib/utils.ts`

- [ ] **Step 1: 디자인 토큰 파일 생성**

`lib/theme.ts`:

```tsx
import { TextStyle } from 'react-native';

export const colors = {
  background: '#FAFAF8',
  textPrimary: '#1A1A1A',
  textSecondary: '#999999',
  textTertiary: '#CCCCCC',
  accentGreen: '#7D8B75',
  accentRed: '#B8564F',
  surface: '#F0EDE7',
  divider: 'rgba(0,0,0,0.05)',
  tabBarBg: 'rgba(250,250,248,0.88)',
} as const;

export const fonts = {
  serifLight: 'NotoSerifKR-Light',
  serifSemiBold: 'NotoSerifKR-SemiBold',
  sansRegular: 'Pretendard-Regular',
  sansMedium: 'Pretendard-Medium',
  sansSemiBold: 'Pretendard-SemiBold',
  sansBold: 'Pretendard-Bold',
} as const;

export const typography: Record<string, TextStyle> = {
  bibleText: {
    fontFamily: fonts.serifLight,
    fontSize: 16.5,
    lineHeight: 16.5 * 2.05,
    color: colors.textPrimary,
  },
  sectionTitle: {
    fontFamily: fonts.serifSemiBold,
    fontSize: 19,
    lineHeight: 19 * 1.5,
    color: colors.textPrimary,
  },
  verseNumber: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    color: colors.accentRed,
  },
  sectionLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 10.5,
    letterSpacing: 10.5 * 0.1,
    color: colors.accentGreen,
    textTransform: 'uppercase',
  },
  greeting: {
    fontFamily: fonts.serifLight,
    fontSize: 21,
    color: colors.textPrimary,
  },
  greetingBold: {
    fontFamily: fonts.sansMedium,
    fontSize: 21,
    color: colors.textPrimary,
  },
  dateText: {
    fontFamily: fonts.sansRegular,
    fontSize: 11.5,
    color: '#AAAAAA',
  },
  bodyUI: {
    fontFamily: fonts.sansRegular,
    fontSize: 14,
    color: colors.textPrimary,
  },
} as const;

export const spacing = {
  screenPadding: 28,
  sectionGap: 28,
  cardRadius: 14,
  buttonRadius: 9,
  bottomSheetRadius: 20,
} as const;
```

- [ ] **Step 2: 유틸리티 함수 생성**

`lib/utils.ts`:

```tsx
export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return '고요한 새벽입니다';
  if (hour < 12) return '좋은 아침이에요';
  if (hour < 17) return '평안한 오후예요';
  if (hour < 21) return '편안한 저녁이에요';
  return '고요한 밤이에요';
}

export function formatDateKo(date: Date = new Date()): string {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  const dayName = dayNames[date.getDay()];
  return `${month}월 ${day}일 ${dayName}`;
}

export function getISODate(date: Date = new Date()): string {
  return date.toISOString().split('T')[0];
}

export function getWeekDates(): Date[] {
  const today = new Date();
  const day = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((day + 6) % 7));

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}
```

- [ ] **Step 3: 커밋**

```bash
git add lib/
git commit -m "feat: add design tokens and utility functions"
```

---

## Task 4: 성경 데이터 준비 (JSON → SQLite)

**Files:**
- Create: `scripts/build-bible-db.ts`, `scripts/sections-ko.json`, `assets/bible/bible.db`

- [ ] **Step 1: 성경 JSON 데이터 다운로드**

```bash
mkdir -p scripts
curl -L "https://raw.githubusercontent.com/scrollmapper/bible_databases/master/json/KorRV.json" -o scripts/KorRV.json
```

> 이 데이터는 개역한글(1961, public domain). 개역개정은 저작권 보호 대상이므로 개발/테스트 단계에서 이것을 사용.

- [ ] **Step 2: 한국어 책 이름 매핑 + 소제목 데이터 생성**

`scripts/book-names-ko.json`:

```json
[
  { "id": 1, "name_ko": "창세기", "name_abbr": "창", "testament": "old", "chapter_count": 50 },
  { "id": 2, "name_ko": "출애굽기", "name_abbr": "출", "testament": "old", "chapter_count": 40 },
  { "id": 3, "name_ko": "레위기", "name_abbr": "레", "testament": "old", "chapter_count": 27 },
  { "id": 4, "name_ko": "민수기", "name_abbr": "민", "testament": "old", "chapter_count": 36 },
  { "id": 5, "name_ko": "신명기", "name_abbr": "신", "testament": "old", "chapter_count": 34 },
  { "id": 6, "name_ko": "여호수아", "name_abbr": "수", "testament": "old", "chapter_count": 24 },
  { "id": 7, "name_ko": "사사기", "name_abbr": "삿", "testament": "old", "chapter_count": 21 },
  { "id": 8, "name_ko": "룻기", "name_abbr": "룻", "testament": "old", "chapter_count": 4 },
  { "id": 9, "name_ko": "사무엘상", "name_abbr": "삼상", "testament": "old", "chapter_count": 31 },
  { "id": 10, "name_ko": "사무엘하", "name_abbr": "삼하", "testament": "old", "chapter_count": 24 },
  { "id": 11, "name_ko": "열왕기상", "name_abbr": "왕상", "testament": "old", "chapter_count": 22 },
  { "id": 12, "name_ko": "열왕기하", "name_abbr": "왕하", "testament": "old", "chapter_count": 25 },
  { "id": 13, "name_ko": "역대상", "name_abbr": "대상", "testament": "old", "chapter_count": 29 },
  { "id": 14, "name_ko": "역대하", "name_abbr": "대하", "testament": "old", "chapter_count": 36 },
  { "id": 15, "name_ko": "에스라", "name_abbr": "스", "testament": "old", "chapter_count": 10 },
  { "id": 16, "name_ko": "느헤미야", "name_abbr": "느", "testament": "old", "chapter_count": 13 },
  { "id": 17, "name_ko": "에스더", "name_abbr": "에", "testament": "old", "chapter_count": 10 },
  { "id": 18, "name_ko": "욥기", "name_abbr": "욥", "testament": "old", "chapter_count": 42 },
  { "id": 19, "name_ko": "시편", "name_abbr": "시", "testament": "old", "chapter_count": 150 },
  { "id": 20, "name_ko": "잠언", "name_abbr": "잠", "testament": "old", "chapter_count": 31 },
  { "id": 21, "name_ko": "전도서", "name_abbr": "전", "testament": "old", "chapter_count": 12 },
  { "id": 22, "name_ko": "아가", "name_abbr": "아", "testament": "old", "chapter_count": 8 },
  { "id": 23, "name_ko": "이사야", "name_abbr": "사", "testament": "old", "chapter_count": 66 },
  { "id": 24, "name_ko": "예레미야", "name_abbr": "렘", "testament": "old", "chapter_count": 52 },
  { "id": 25, "name_ko": "예레미야애가", "name_abbr": "애", "testament": "old", "chapter_count": 5 },
  { "id": 26, "name_ko": "에스겔", "name_abbr": "겔", "testament": "old", "chapter_count": 48 },
  { "id": 27, "name_ko": "다니엘", "name_abbr": "단", "testament": "old", "chapter_count": 12 },
  { "id": 28, "name_ko": "호세아", "name_abbr": "호", "testament": "old", "chapter_count": 14 },
  { "id": 29, "name_ko": "요엘", "name_abbr": "욜", "testament": "old", "chapter_count": 3 },
  { "id": 30, "name_ko": "아모스", "name_abbr": "암", "testament": "old", "chapter_count": 9 },
  { "id": 31, "name_ko": "오바댜", "name_abbr": "옵", "testament": "old", "chapter_count": 1 },
  { "id": 32, "name_ko": "요나", "name_abbr": "욘", "testament": "old", "chapter_count": 4 },
  { "id": 33, "name_ko": "미가", "name_abbr": "미", "testament": "old", "chapter_count": 7 },
  { "id": 34, "name_ko": "나훔", "name_abbr": "나", "testament": "old", "chapter_count": 3 },
  { "id": 35, "name_ko": "하박국", "name_abbr": "합", "testament": "old", "chapter_count": 3 },
  { "id": 36, "name_ko": "스바냐", "name_abbr": "습", "testament": "old", "chapter_count": 3 },
  { "id": 37, "name_ko": "학개", "name_abbr": "학", "testament": "old", "chapter_count": 2 },
  { "id": 38, "name_ko": "스가랴", "name_abbr": "슥", "testament": "old", "chapter_count": 14 },
  { "id": 39, "name_ko": "말라기", "name_abbr": "말", "testament": "old", "chapter_count": 4 },
  { "id": 40, "name_ko": "마태복음", "name_abbr": "마", "testament": "new", "chapter_count": 28 },
  { "id": 41, "name_ko": "마가복음", "name_abbr": "막", "testament": "new", "chapter_count": 16 },
  { "id": 42, "name_ko": "누가복음", "name_abbr": "눅", "testament": "new", "chapter_count": 24 },
  { "id": 43, "name_ko": "요한복음", "name_abbr": "요", "testament": "new", "chapter_count": 21 },
  { "id": 44, "name_ko": "사도행전", "name_abbr": "행", "testament": "new", "chapter_count": 28 },
  { "id": 45, "name_ko": "로마서", "name_abbr": "롬", "testament": "new", "chapter_count": 16 },
  { "id": 46, "name_ko": "고린도전서", "name_abbr": "고전", "testament": "new", "chapter_count": 16 },
  { "id": 47, "name_ko": "고린도후서", "name_abbr": "고후", "testament": "new", "chapter_count": 13 },
  { "id": 48, "name_ko": "갈라디아서", "name_abbr": "갈", "testament": "new", "chapter_count": 6 },
  { "id": 49, "name_ko": "에베소서", "name_abbr": "엡", "testament": "new", "chapter_count": 6 },
  { "id": 50, "name_ko": "빌립보서", "name_abbr": "빌", "testament": "new", "chapter_count": 4 },
  { "id": 51, "name_ko": "골로새서", "name_abbr": "골", "testament": "new", "chapter_count": 4 },
  { "id": 52, "name_ko": "데살로니가전서", "name_abbr": "살전", "testament": "new", "chapter_count": 5 },
  { "id": 53, "name_ko": "데살로니가후서", "name_abbr": "살후", "testament": "new", "chapter_count": 3 },
  { "id": 54, "name_ko": "디모데전서", "name_abbr": "딤전", "testament": "new", "chapter_count": 6 },
  { "id": 55, "name_ko": "디모데후서", "name_abbr": "딤후", "testament": "new", "chapter_count": 4 },
  { "id": 56, "name_ko": "디도서", "name_abbr": "딛", "testament": "new", "chapter_count": 3 },
  { "id": 57, "name_ko": "빌레몬서", "name_abbr": "몬", "testament": "new", "chapter_count": 1 },
  { "id": 58, "name_ko": "히브리서", "name_abbr": "히", "testament": "new", "chapter_count": 13 },
  { "id": 59, "name_ko": "야고보서", "name_abbr": "약", "testament": "new", "chapter_count": 5 },
  { "id": 60, "name_ko": "베드로전서", "name_abbr": "벧전", "testament": "new", "chapter_count": 5 },
  { "id": 61, "name_ko": "베드로후서", "name_abbr": "벧후", "testament": "new", "chapter_count": 3 },
  { "id": 62, "name_ko": "요한일서", "name_abbr": "요일", "testament": "new", "chapter_count": 5 },
  { "id": 63, "name_ko": "요한이서", "name_abbr": "요이", "testament": "new", "chapter_count": 1 },
  { "id": 64, "name_ko": "요한삼서", "name_abbr": "요삼", "testament": "new", "chapter_count": 1 },
  { "id": 65, "name_ko": "유다서", "name_abbr": "유", "testament": "new", "chapter_count": 1 },
  { "id": 66, "name_ko": "요한계시록", "name_abbr": "계", "testament": "new", "chapter_count": 22 }
]
```

`scripts/sections-ko.json` — 요한복음 1장 샘플 (나머지는 점진적으로 추가):

```json
[
  { "book_id": 43, "chapter": 1, "start_verse": 1, "end_verse": 5, "title": "말씀이 육신이 되시다" },
  { "book_id": 43, "chapter": 1, "start_verse": 6, "end_verse": 8, "title": "세례 요한의 증언" },
  { "book_id": 43, "chapter": 1, "start_verse": 9, "end_verse": 13, "title": "참 빛이 세상에 오시다" },
  { "book_id": 43, "chapter": 1, "start_verse": 14, "end_verse": 18, "title": "말씀이 육신이 되어" },
  { "book_id": 43, "chapter": 1, "start_verse": 19, "end_verse": 28, "title": "요한의 증언" },
  { "book_id": 43, "chapter": 1, "start_verse": 29, "end_verse": 34, "title": "하나님의 어린 양" },
  { "book_id": 43, "chapter": 1, "start_verse": 35, "end_verse": 42, "title": "첫 제자들" },
  { "book_id": 43, "chapter": 1, "start_verse": 43, "end_verse": 51, "title": "빌립과 나다나엘을 부르시다" },
  { "book_id": 1, "chapter": 1, "start_verse": 1, "end_verse": 5, "title": "천지 창조" },
  { "book_id": 1, "chapter": 1, "start_verse": 6, "end_verse": 8, "title": "둘째 날" },
  { "book_id": 1, "chapter": 1, "start_verse": 9, "end_verse": 13, "title": "셋째 날" },
  { "book_id": 1, "chapter": 1, "start_verse": 14, "end_verse": 19, "title": "넷째 날" },
  { "book_id": 1, "chapter": 1, "start_verse": 20, "end_verse": 23, "title": "다섯째 날" },
  { "book_id": 1, "chapter": 1, "start_verse": 24, "end_verse": 31, "title": "여섯째 날" }
]
```

- [ ] **Step 3: JSON → SQLite 변환 스크립트 작성**

```bash
npm install --save-dev better-sqlite3 @types/better-sqlite3 tsx
```

`scripts/build-bible-db.ts`:

```typescript
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

const DB_PATH = path.join(__dirname, '..', 'assets', 'bible', 'bible.db');
const BIBLE_JSON_PATH = path.join(__dirname, 'KorRV.json');
const BOOKS_PATH = path.join(__dirname, 'book-names-ko.json');
const SECTIONS_PATH = path.join(__dirname, 'sections-ko.json');

// Ensure output directory exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

// Remove existing DB
if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);

const db = new Database(DB_PATH);

// Create tables
db.exec(`
  CREATE TABLE books (
    id INTEGER PRIMARY KEY,
    name_ko TEXT NOT NULL,
    name_abbr TEXT NOT NULL,
    testament TEXT NOT NULL,
    chapter_count INTEGER NOT NULL
  );

  CREATE TABLE verses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id INTEGER NOT NULL REFERENCES books(id),
    chapter INTEGER NOT NULL,
    verse INTEGER NOT NULL,
    text TEXT NOT NULL
  );

  CREATE TABLE sections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id INTEGER NOT NULL REFERENCES books(id),
    chapter INTEGER NOT NULL,
    start_verse INTEGER NOT NULL,
    end_verse INTEGER NOT NULL,
    title TEXT
  );

  CREATE INDEX idx_verses_book_chapter ON verses(book_id, chapter);
  CREATE INDEX idx_sections_book_chapter ON sections(book_id, chapter);
`);

// Insert books
const books: Array<{ id: number; name_ko: string; name_abbr: string; testament: string; chapter_count: number }> =
  JSON.parse(fs.readFileSync(BOOKS_PATH, 'utf-8'));

const insertBook = db.prepare('INSERT INTO books (id, name_ko, name_abbr, testament, chapter_count) VALUES (?, ?, ?, ?, ?)');
for (const book of books) {
  insertBook.run(book.id, book.name_ko, book.name_abbr, book.testament, book.chapter_count);
}
console.log(`Inserted ${books.length} books`);

// Insert verses from KorRV.json
const bibleData = JSON.parse(fs.readFileSync(BIBLE_JSON_PATH, 'utf-8'));
const insertVerse = db.prepare('INSERT INTO verses (book_id, chapter, verse, text) VALUES (?, ?, ?, ?)');

let verseCount = 0;
const insertVerses = db.transaction(() => {
  // KorRV.json structure: { resultset: [{ book: num, chapter: num, verse: num, text: str }] }
  // OR: array of objects. We need to inspect the actual structure.
  // scrollmapper format: flat array of { book_nr, chapter_nr, verse_nr, verse }
  // Let's handle both common formats:

  let verses: Array<{ book_id: number; chapter: number; verse: number; text: string }>;

  if (Array.isArray(bibleData)) {
    // Flat array format
    verses = bibleData.map((v: any) => ({
      book_id: v.book_nr || v.book,
      chapter: v.chapter_nr || v.chapter,
      verse: v.verse_nr || v.verse,
      text: v.verse_text || v.text || v.verse,
    }));
  } else if (bibleData.books) {
    // Nested format: { books: [{ chapters: [{ verses: [...] }] }] }
    verses = [];
    bibleData.books.forEach((book: any, bookIdx: number) => {
      book.chapters.forEach((ch: any) => {
        ch.verses.forEach((v: any) => {
          verses.push({
            book_id: bookIdx + 1,
            chapter: ch.chapter,
            verse: v.verse,
            text: v.text,
          });
        });
      });
    });
  } else if (bibleData.resultset) {
    verses = bibleData.resultset.map((v: any) => ({
      book_id: v.book,
      chapter: v.chapter,
      verse: v.verse,
      text: v.text,
    }));
  } else {
    throw new Error('Unknown Bible JSON format. Check the downloaded file structure.');
  }

  for (const v of verses) {
    insertVerse.run(v.book_id, v.chapter, v.verse, v.text);
    verseCount++;
  }
});
insertVerses();
console.log(`Inserted ${verseCount} verses`);

// Insert sections
const sections: Array<{ book_id: number; chapter: number; start_verse: number; end_verse: number; title: string }> =
  JSON.parse(fs.readFileSync(SECTIONS_PATH, 'utf-8'));

const insertSection = db.prepare('INSERT INTO sections (book_id, chapter, start_verse, end_verse, title) VALUES (?, ?, ?, ?, ?)');
for (const s of sections) {
  insertSection.run(s.book_id, s.chapter, s.start_verse, s.end_verse, s.title);
}
console.log(`Inserted ${sections.length} sections`);

db.close();
console.log(`Bible DB created at ${DB_PATH}`);
```

- [ ] **Step 4: 스크립트 실행하여 bible.db 생성**

```bash
npx tsx scripts/build-bible-db.ts
```

Expected: `Inserted 66 books`, `Inserted ~31102 verses`, `Inserted 14 sections`, `Bible DB created at ...`

> JSON 구조가 예상과 다를 경우 스크립트를 수정. 다운로드한 KorRV.json을 먼저 `head -c 500 scripts/KorRV.json`으로 구조 확인.

- [ ] **Step 5: 커밋**

```bash
git add scripts/ assets/bible/
git commit -m "feat: add Bible data build pipeline (KorRV JSON → SQLite)"
```

---

## Task 5: SQLite 초기화 & 데이터 쿼리 레이어

**Files:**
- Create: `lib/db.ts`, `lib/bible-data.ts`

- [ ] **Step 1: DB 초기화 모듈 생성**

`lib/db.ts`:

```tsx
import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';

let bibleDb: SQLite.SQLiteDatabase | null = null;
let userDb: SQLite.SQLiteDatabase | null = null;

export async function initDatabases(): Promise<void> {
  // Copy bible.db from assets to document directory
  const bibleDbPath = `${FileSystem.documentDirectory}bible.db`;
  const fileInfo = await FileSystem.getInfoAsync(bibleDbPath);

  if (!fileInfo.exists) {
    const asset = Asset.fromModule(require('../assets/bible/bible.db'));
    await asset.downloadAsync();
    if (asset.localUri) {
      await FileSystem.copyAsync({ from: asset.localUri, to: bibleDbPath });
    }
  }

  bibleDb = await SQLite.openDatabaseAsync('bible.db');
  userDb = await SQLite.openDatabaseAsync('user.db');

  // Create user tables
  await userDb.execAsync(`
    CREATE TABLE IF NOT EXISTS user_profile (
      id INTEGER PRIMARY KEY DEFAULT 1,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      book_id INTEGER NOT NULL,
      start_chapter INTEGER NOT NULL,
      end_chapter INTEGER NOT NULL,
      completed INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      book_id INTEGER,
      chapter INTEGER,
      verse INTEGER,
      content TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS highlights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      chapter INTEGER NOT NULL,
      verse INTEGER NOT NULL,
      color TEXT DEFAULT '#7D8B75'
    );

    CREATE TABLE IF NOT EXISTS reading_history (
      date TEXT PRIMARY KEY,
      completed INTEGER DEFAULT 0
    );
  `);
}

export function getBibleDb(): SQLite.SQLiteDatabase {
  if (!bibleDb) throw new Error('Bible DB not initialized');
  return bibleDb;
}

export function getUserDb(): SQLite.SQLiteDatabase {
  if (!userDb) throw new Error('User DB not initialized');
  return userDb;
}
```

- [ ] **Step 2: 성경 데이터 쿼리 함수 생성**

`lib/bible-data.ts`:

```tsx
import { getBibleDb, getUserDb } from './db';

export interface Book {
  id: number;
  name_ko: string;
  name_abbr: string;
  testament: 'old' | 'new';
  chapter_count: number;
}

export interface Verse {
  book_id: number;
  chapter: number;
  verse: number;
  text: string;
}

export interface Section {
  book_id: number;
  chapter: number;
  start_verse: number;
  end_verse: number;
  title: string | null;
}

export interface DailyReading {
  id: number;
  date: string;
  book_id: number;
  start_chapter: number;
  end_chapter: number;
  completed: number;
  book_name?: string;
}

export interface Note {
  id: number;
  created_at: string;
  updated_at: string;
  book_id: number | null;
  chapter: number | null;
  verse: number | null;
  content: string;
  book_name?: string;
}

// === Bible queries ===

export async function getAllBooks(): Promise<Book[]> {
  return getBibleDb().getAllAsync<Book>('SELECT * FROM books ORDER BY id');
}

export async function getBooksByTestament(testament: 'old' | 'new'): Promise<Book[]> {
  return getBibleDb().getAllAsync<Book>('SELECT * FROM books WHERE testament = ? ORDER BY id', [testament]);
}

export async function getVerses(bookId: number, chapter: number): Promise<Verse[]> {
  return getBibleDb().getAllAsync<Verse>(
    'SELECT * FROM verses WHERE book_id = ? AND chapter = ? ORDER BY verse',
    [bookId, chapter]
  );
}

export async function getSections(bookId: number, chapter: number): Promise<Section[]> {
  return getBibleDb().getAllAsync<Section>(
    'SELECT * FROM sections WHERE book_id = ? AND chapter = ? ORDER BY start_verse',
    [bookId, chapter]
  );
}

export async function getRandomVerse(): Promise<Verse & { book_name: string }> {
  const result = await getBibleDb().getFirstAsync<Verse & { book_name: string }>(
    `SELECT v.*, b.name_ko as book_name
     FROM verses v JOIN books b ON v.book_id = b.id
     ORDER BY RANDOM() LIMIT 1`
  );
  return result!;
}

export async function getBook(bookId: number): Promise<Book | null> {
  return getBibleDb().getFirstAsync<Book>('SELECT * FROM books WHERE id = ?', [bookId]);
}

// === User data queries ===

export async function getUserName(): Promise<string | null> {
  const result = await getUserDb().getFirstAsync<{ name: string }>('SELECT name FROM user_profile WHERE id = 1');
  return result?.name ?? null;
}

export async function setUserName(name: string): Promise<void> {
  await getUserDb().runAsync(
    'INSERT OR REPLACE INTO user_profile (id, name) VALUES (1, ?)',
    [name]
  );
}

export async function getDailyReadings(date: string): Promise<DailyReading[]> {
  return getUserDb().getAllAsync<DailyReading>(
    `SELECT dr.*, b.name_ko as book_name
     FROM daily_readings dr
     LEFT JOIN (SELECT * FROM books) b ON dr.book_id = b.id
     WHERE dr.date = ? ORDER BY dr.id`,
    [date]
  );
}

export async function addDailyReading(date: string, bookId: number, startChapter: number, endChapter: number): Promise<void> {
  await getUserDb().runAsync(
    'INSERT INTO daily_readings (date, book_id, start_chapter, end_chapter) VALUES (?, ?, ?, ?)',
    [date, bookId, startChapter, endChapter]
  );
}

export async function toggleDailyReading(id: number): Promise<void> {
  await getUserDb().runAsync(
    'UPDATE daily_readings SET completed = CASE WHEN completed = 0 THEN 1 ELSE 0 END WHERE id = ?',
    [id]
  );
}

export async function deleteDailyReading(id: number): Promise<void> {
  await getUserDb().runAsync('DELETE FROM daily_readings WHERE id = ?', [id]);
}

export async function getReadingHistory(dates: string[]): Promise<Record<string, boolean>> {
  if (dates.length === 0) return {};
  const placeholders = dates.map(() => '?').join(',');
  const rows = await getUserDb().getAllAsync<{ date: string; completed: number }>(
    `SELECT date, completed FROM reading_history WHERE date IN (${placeholders})`,
    dates
  );
  const result: Record<string, boolean> = {};
  for (const row of rows) {
    result[row.date] = row.completed === 1;
  }
  return result;
}

export async function markDayCompleted(date: string): Promise<void> {
  await getUserDb().runAsync(
    'INSERT OR REPLACE INTO reading_history (date, completed) VALUES (?, 1)',
    [date]
  );
}

// === Notes ===

export async function getAllNotes(): Promise<Note[]> {
  return getUserDb().getAllAsync<Note>(
    'SELECT * FROM notes ORDER BY created_at DESC'
  );
}

export async function getNote(id: number): Promise<Note | null> {
  return getUserDb().getFirstAsync<Note>('SELECT * FROM notes WHERE id = ?', [id]);
}

export async function saveNote(content: string, bookId?: number, chapter?: number, verse?: number): Promise<number> {
  const result = await getUserDb().runAsync(
    'INSERT INTO notes (content, book_id, chapter, verse) VALUES (?, ?, ?, ?)',
    [content, bookId ?? null, chapter ?? null, verse ?? null]
  );
  return result.lastInsertRowId;
}

export async function updateNote(id: number, content: string): Promise<void> {
  await getUserDb().runAsync(
    "UPDATE notes SET content = ?, updated_at = datetime('now') WHERE id = ?",
    [content, id]
  );
}

export async function deleteNote(id: number): Promise<void> {
  await getUserDb().runAsync('DELETE FROM notes WHERE id = ?', [id]);
}
```

> 주의: `getDailyReadings`에서 `books` 테이블 JOIN은 bible.db와 user.db가 분리되어 있으므로 실제로는 동작하지 않음. 구현 시 book_name을 별도로 조회하거나, ATTACH DATABASE를 사용해야 함. 이 부분은 Task 실행 시 확인하여 수정.

- [ ] **Step 3: 커밋**

```bash
git add lib/db.ts lib/bible-data.ts
git commit -m "feat: add SQLite initialization and data query layer"
```

---

## Task 6: Zustand 스토어

**Files:**
- Create: `lib/store.ts`

- [ ] **Step 1: 스토어 생성**

`lib/store.ts`:

```tsx
import { create } from 'zustand';
import { DailyReading } from './bible-data';

interface AppState {
  // User
  userName: string;
  setUserName: (name: string) => void;

  // Bible viewer
  currentBookId: number;
  currentChapter: number;
  setCurrentPosition: (bookId: number, chapter: number) => void;

  // Today's readings
  todayReadings: DailyReading[];
  setTodayReadings: (readings: DailyReading[]) => void;

  // Music player (UI state only for MVP)
  isPlaying: boolean;
  currentTrack: string;
  togglePlaying: () => void;

  // DB initialized flag
  dbReady: boolean;
  setDbReady: (ready: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  userName: '',
  setUserName: (name) => set({ userName: name }),

  currentBookId: 43, // 요한복음
  currentChapter: 1,
  setCurrentPosition: (bookId, chapter) => set({ currentBookId: bookId, currentChapter: chapter }),

  todayReadings: [],
  setTodayReadings: (readings) => set({ todayReadings: readings }),

  isPlaying: false,
  currentTrack: 'Peaceful Dwelling',
  togglePlaying: () => set((s) => ({ isPlaying: !s.isPlaying })),

  dbReady: false,
  setDbReady: (ready) => set({ dbReady: ready }),
}));
```

- [ ] **Step 2: 커밋**

```bash
git add lib/store.ts
git commit -m "feat: add Zustand app store"
```

---

## Task 7: 탭 네비게이터

**Files:**
- Modify: `app/(tabs)/_layout.tsx`

- [ ] **Step 1: 탭 레이아웃 구현**

`app/(tabs)/_layout.tsx`:

```tsx
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, fonts } from '../../lib/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.textPrimary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: {
          fontFamily: fonts.sansRegular,
          fontSize: 10,
        },
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: colors.tabBarBg,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.divider,
          elevation: 0,
        },
        ...(Platform.OS === 'ios' && {
          tabBarBackground: () => (
            <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
          ),
        }),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '홈',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="bible"
        options={{
          title: '성경',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="book-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="music"
        options={{
          title: '음악',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="musical-note-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="notes"
        options={{
          title: '노트',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="document-text-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
```

> `expo-blur` 설치 필요: `npx expo install expo-blur`

- [ ] **Step 2: 나머지 탭 화면 placeholder 생성**

`app/(tabs)/bible.tsx`:

```tsx
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography } from '../../lib/theme';

export default function BibleScreen() {
  return (
    <View style={styles.container}>
      <Text style={typography.bodyUI}>성경</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
});
```

`app/(tabs)/music.tsx`:

```tsx
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography } from '../../lib/theme';

export default function MusicScreen() {
  return (
    <View style={styles.container}>
      <Text style={typography.bodyUI}>음악</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
});
```

`app/(tabs)/notes.tsx`:

```tsx
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography } from '../../lib/theme';

export default function NotesScreen() {
  return (
    <View style={styles.container}>
      <Text style={typography.bodyUI}>노트</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
});
```

- [ ] **Step 3: 시뮬레이터에서 4개 탭 전환 확인**

```bash
npx expo start
```

하단에 홈/성경/음악/노트 4탭이 표시되고, 각 탭 전환이 동작하면 성공.

- [ ] **Step 4: 커밋**

```bash
git add app/
git commit -m "feat: add 4-tab navigator with custom styling"
```

---

## Task 8: 루트 레이아웃 완성 (DB 초기화 + 온보딩 분기)

**Files:**
- Modify: `app/_layout.tsx`
- Create: `app/onboarding.tsx`

- [ ] **Step 1: 루트 레이아웃에 DB 초기화 추가**

`app/_layout.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { initDatabases } from '../lib/db';
import { getUserName } from '../lib/bible-data';
import { useAppStore } from '../lib/store';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'NotoSerifKR-Light': require('../assets/fonts/NotoSerifKR-Light.ttf'),
    'NotoSerifKR-SemiBold': require('../assets/fonts/NotoSerifKR-SemiBold.ttf'),
    'Pretendard-Regular': require('../assets/fonts/Pretendard-Regular.otf'),
    'Pretendard-Medium': require('../assets/fonts/Pretendard-Medium.otf'),
    'Pretendard-SemiBold': require('../assets/fonts/Pretendard-SemiBold.otf'),
    'Pretendard-Bold': require('../assets/fonts/Pretendard-Bold.otf'),
  });

  const setDbReady = useAppStore((s) => s.setDbReady);
  const setUserName = useAppStore((s) => s.setUserName);
  const dbReady = useAppStore((s) => s.dbReady);
  const userName = useAppStore((s) => s.userName);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    async function init() {
      await initDatabases();
      const name = await getUserName();
      if (name) setUserName(name);
      setDbReady(true);
    }
    init();
  }, []);

  useEffect(() => {
    if (fontsLoaded && dbReady) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, dbReady]);

  useEffect(() => {
    if (!dbReady || !fontsLoaded) return;

    const inOnboarding = segments[0] === 'onboarding';
    if (!userName && !inOnboarding) {
      router.replace('/onboarding');
    } else if (userName && inOnboarding) {
      router.replace('/');
    }
  }, [dbReady, fontsLoaded, userName, segments]);

  if (!fontsLoaded || !dbReady) return null;

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
        <Stack.Screen name="note/[id]" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}
```

- [ ] **Step 2: 온보딩 화면 생성**

`app/onboarding.tsx`:

```tsx
import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, spacing } from '../lib/theme';
import { setUserName } from '../lib/bible-data';
import { useAppStore } from '../lib/store';

export default function OnboardingScreen() {
  const [name, setName] = useState('');
  const router = useRouter();
  const setStoreName = useAppStore((s) => s.setUserName);

  async function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    await setUserName(trimmed);
    setStoreName(trimmed);
    router.replace('/');
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Text style={styles.title}>이름을 알려주세요</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="이름"
          placeholderTextColor={colors.textTertiary}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
        />
        <TouchableOpacity
          style={[styles.button, !name.trim() && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={!name.trim()}
        >
          <Text style={[styles.buttonText, !name.trim() && styles.buttonTextDisabled]}>
            시작하기
          </Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.screenPadding,
  },
  title: {
    fontFamily: fonts.serifLight,
    fontSize: 21,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 40,
  },
  input: {
    fontFamily: fonts.sansRegular,
    fontSize: 18,
    color: colors.textPrimary,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    paddingVertical: 12,
    textAlign: 'center',
    marginBottom: 40,
  },
  button: {
    backgroundColor: colors.accentGreen,
    paddingVertical: 14,
    borderRadius: spacing.buttonRadius,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: colors.surface,
  },
  buttonText: {
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    color: '#FFFFFF',
  },
  buttonTextDisabled: {
    color: colors.textTertiary,
  },
});
```

- [ ] **Step 3: 시뮬레이터에서 온보딩 → 홈 전환 확인**

앱을 처음 실행하면 온보딩 화면이 뜨고, 이름 입력 후 "시작하기" 누르면 홈 탭으로 이동해야 함.

- [ ] **Step 4: 커밋**

```bash
git add app/
git commit -m "feat: add root layout with DB init and onboarding flow"
```

---

## Task 9: 공통 컴포넌트 (SectionLabel, CircleProgress, WeekDots)

**Files:**
- Create: `components/SectionLabel.tsx`, `components/CircleProgress.tsx`, `components/WeekDots.tsx`

- [ ] **Step 1: SectionLabel 컴포넌트**

`components/SectionLabel.tsx`:

```tsx
import { Text, View, StyleSheet } from 'react-native';
import { typography } from '../lib/theme';

interface Props {
  label: string;
  right?: React.ReactNode;
}

export function SectionLabel({ label, right }: Props) {
  return (
    <View style={styles.container}>
      <Text style={typography.sectionLabel}>{label}</Text>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
});
```

- [ ] **Step 2: CircleProgress 컴포넌트**

`components/CircleProgress.tsx`:

```tsx
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, fonts } from '../lib/theme';

interface Props {
  percent: number; // 0-100
  size?: number;
  strokeWidth?: number;
}

export function CircleProgress({ percent, size = 140, strokeWidth = 4 }: Props) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - Math.min(percent, 100) / 100);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(0,0,0,0.05)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.accentGreen}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.labelContainer}>
        <Text style={styles.percentText}>{Math.round(percent)}</Text>
        <Text style={styles.subText}>오늘의 읽기</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  labelContainer: {
    position: 'absolute',
    alignItems: 'center',
  },
  percentText: {
    fontFamily: fonts.sansRegular,
    fontSize: 32,
    fontWeight: '300',
    color: colors.textPrimary,
  },
  subText: {
    fontFamily: fonts.sansRegular,
    fontSize: 10,
    color: '#AAAAAA',
    marginTop: 2,
  },
});
```

- [ ] **Step 3: WeekDots 컴포넌트**

`components/WeekDots.tsx`:

```tsx
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../lib/theme';
import { getWeekDates, getISODate } from '../lib/utils';

interface Props {
  completedDates: Record<string, boolean>;
}

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

export function WeekDots({ completedDates }: Props) {
  const weekDates = getWeekDates();
  const todayStr = getISODate();

  return (
    <View style={styles.container}>
      {weekDates.map((date, i) => {
        const dateStr = getISODate(date);
        const isToday = dateStr === todayStr;
        const isCompleted = completedDates[dateStr] === true;
        const isFuture = date > new Date();

        return (
          <View key={dateStr} style={styles.dayColumn}>
            <Text style={styles.dayLabel}>{DAY_LABELS[i]}</Text>
            <View
              style={[
                styles.dot,
                isCompleted && styles.dotCompleted,
                isToday && !isCompleted && styles.dotToday,
                isFuture && !isToday && styles.dotFuture,
              ]}
            >
              {isCompleted && (
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              )}
              {isToday && !isCompleted && <View style={styles.todayInner} />}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 24,
  },
  dayColumn: {
    alignItems: 'center',
    gap: 6,
  },
  dayLabel: {
    fontFamily: fonts.sansRegular,
    fontSize: 11,
    color: colors.textSecondary,
  },
  dot: {
    width: 32,
    height: 32,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotCompleted: {
    backgroundColor: colors.accentGreen,
    borderColor: colors.accentGreen,
  },
  dotToday: {
    borderColor: colors.accentGreen,
  },
  todayInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accentGreen,
  },
  dotFuture: {
    borderColor: 'rgba(0,0,0,0.1)',
  },
});
```

- [ ] **Step 4: 커밋**

```bash
git add components/
git commit -m "feat: add SectionLabel, CircleProgress, WeekDots components"
```

---

## Task 10: 홈 화면 — 읽기 체크리스트 & 읽기 추가 모달

**Files:**
- Create: `components/ReadingChecklist.tsx`, `components/AddReadingModal.tsx`

- [ ] **Step 1: ReadingChecklist 컴포넌트**

`components/ReadingChecklist.tsx`:

```tsx
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, fonts, spacing } from '../lib/theme';
import { DailyReading } from '../lib/bible-data';

interface Props {
  readings: DailyReading[];
  onToggle: (id: number) => void;
  onAdd: () => void;
}

export function ReadingChecklist({ readings, onToggle, onAdd }: Props) {
  const router = useRouter();
  const allDone = readings.length > 0 && readings.every((r) => r.completed);

  return (
    <View>
      <Text style={styles.title}>오늘 읽을 말씀</Text>

      {readings.map((reading) => {
        const label = reading.start_chapter === reading.end_chapter
          ? `${reading.book_name} ${reading.start_chapter}장`
          : `${reading.book_name} ${reading.start_chapter}-${reading.end_chapter}장`;

        return (
          <View key={reading.id} style={styles.row}>
            <TouchableOpacity
              style={[styles.checkbox, reading.completed && styles.checkboxDone]}
              onPress={() => onToggle(reading.id)}
            >
              {reading.completed ? (
                <Ionicons name="checkmark" size={14} color="#FFFFFF" />
              ) : null}
            </TouchableOpacity>
            <Text
              style={[
                styles.readingText,
                reading.completed && styles.readingTextDone,
              ]}
            >
              {label}
            </Text>
            <TouchableOpacity
              style={styles.goButton}
              onPress={() => router.push(`/bible/${reading.book_id}/${reading.start_chapter}`)}
            >
              <Ionicons name="book-outline" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        );
      })}

      {allDone && readings.length > 0 && (
        <Text style={styles.doneText}>오늘의 읽기를 완료했어요</Text>
      )}

      <TouchableOpacity style={styles.addButton} onPress={onAdd}>
        <Ionicons name="add" size={18} color={colors.accentGreen} />
        <Text style={styles.addText}>읽을 말씀 추가</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fonts.serifLight,
    fontSize: 16,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: spacing.buttonRadius,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxDone: {
    backgroundColor: colors.accentGreen,
    borderColor: colors.accentGreen,
  },
  readingText: {
    flex: 1,
    fontFamily: fonts.sansRegular,
    fontSize: 14,
    color: colors.textPrimary,
  },
  readingTextDone: {
    textDecorationLine: 'line-through',
    opacity: 0.4,
  },
  goButton: {
    padding: 6,
  },
  doneText: {
    fontFamily: fonts.sansRegular,
    fontSize: 12,
    color: colors.accentGreen,
    textAlign: 'center',
    marginTop: 12,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 8,
    gap: 6,
  },
  addText: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.accentGreen,
  },
});
```

- [ ] **Step 2: AddReadingModal 컴포넌트**

`components/AddReadingModal.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, StyleSheet } from 'react-native';
import { colors, fonts, spacing } from '../lib/theme';
import { Book, getAllBooks } from '../lib/bible-data';

interface Props {
  visible: boolean;
  onClose: () => void;
  onAdd: (bookId: number, startChapter: number, endChapter: number) => void;
}

type Step = 'testament' | 'book' | 'chapter';

export function AddReadingModal({ visible, onClose, onAdd }: Props) {
  const [step, setStep] = useState<Step>('testament');
  const [testament, setTestament] = useState<'old' | 'new'>('old');
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  useEffect(() => {
    if (visible) {
      setStep('testament');
      setSelectedBook(null);
      getAllBooks().then(setBooks);
    }
  }, [visible]);

  const filteredBooks = books.filter((b) => b.testament === testament);

  function handleSelectBook(book: Book) {
    setSelectedBook(book);
    setStep('chapter');
  }

  function handleSelectChapter(chapter: number) {
    if (!selectedBook) return;
    onAdd(selectedBook.id, chapter, chapter);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={step === 'testament' ? onClose : () => setStep(step === 'chapter' ? 'book' : 'testament')}>
            <Text style={styles.headerButton}>{step === 'testament' ? '닫기' : '뒤로'}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {step === 'testament' ? '읽을 말씀 추가' : step === 'book' ? (testament === 'old' ? '구약' : '신약') : selectedBook?.name_ko}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {step === 'testament' && (
          <View style={styles.testamentRow}>
            <TouchableOpacity
              style={[styles.testamentButton, testament === 'old' && styles.testamentActive]}
              onPress={() => { setTestament('old'); setStep('book'); }}
            >
              <Text style={[styles.testamentText, testament === 'old' && styles.testamentTextActive]}>구약</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.testamentButton, testament === 'new' && styles.testamentActive]}
              onPress={() => { setTestament('new'); setStep('book'); }}
            >
              <Text style={[styles.testamentText, testament === 'new' && styles.testamentTextActive]}>신약</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 'book' && (
          <ScrollView style={styles.list}>
            {filteredBooks.map((book) => (
              <TouchableOpacity key={book.id} style={styles.listItem} onPress={() => handleSelectBook(book)}>
                <Text style={styles.listItemText}>{book.name_ko}</Text>
                <Text style={styles.listItemSub}>{book.chapter_count}장</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {step === 'chapter' && selectedBook && (
          <ScrollView contentContainerStyle={styles.chapterGrid}>
            {Array.from({ length: selectedBook.chapter_count }, (_, i) => i + 1).map((ch) => (
              <TouchableOpacity key={ch} style={styles.chapterCell} onPress={() => handleSelectChapter(ch)}>
                <Text style={styles.chapterText}>{ch}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  headerButton: {
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    color: colors.accentGreen,
  },
  headerTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  testamentRow: {
    flexDirection: 'row',
    padding: spacing.screenPadding,
    gap: 12,
  },
  testamentButton: {
    flex: 1,
    paddingVertical: 40,
    borderRadius: spacing.cardRadius,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  testamentActive: {
    backgroundColor: colors.accentGreen,
  },
  testamentText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  testamentTextActive: {
    color: '#FFFFFF',
  },
  list: {
    flex: 1,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  listItemText: {
    fontFamily: fonts.sansRegular,
    fontSize: 15,
    color: colors.textPrimary,
  },
  listItemSub: {
    fontFamily: fonts.sansRegular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  chapterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.screenPadding,
    gap: 10,
  },
  chapterCell: {
    width: 52,
    height: 52,
    borderRadius: spacing.buttonRadius,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterText: {
    fontFamily: fonts.sansRegular,
    fontSize: 15,
    color: colors.textPrimary,
  },
});
```

- [ ] **Step 3: 커밋**

```bash
git add components/ReadingChecklist.tsx components/AddReadingModal.tsx
git commit -m "feat: add ReadingChecklist and AddReadingModal components"
```

---

## Task 11: 홈 화면 — MiniPlayer & 전체 조립

**Files:**
- Create: `components/MiniPlayer.tsx`
- Modify: `app/(tabs)/index.tsx`

- [ ] **Step 1: MiniPlayer 컴포넌트 (UI only)**

`components/MiniPlayer.tsx`:

```tsx
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing } from '../lib/theme';
import { useAppStore } from '../lib/store';

export function MiniPlayer() {
  const { isPlaying, currentTrack, togglePlaying } = useAppStore();

  return (
    <View style={[styles.container, isPlaying && styles.containerPlaying]}>
      <TouchableOpacity style={styles.playButton} onPress={togglePlaying}>
        <Ionicons
          name={isPlaying ? 'pause' : 'play'}
          size={18}
          color="#FFFFFF"
        />
      </TouchableOpacity>
      <View style={styles.info}>
        <Text style={styles.trackName}>{currentTrack}</Text>
        <Text style={styles.status}>
          {isPlaying ? '재생 중' : '일시정지'}
        </Text>
      </View>
      {isPlaying && (
        <View style={styles.equalizer}>
          {[12, 18, 10, 16].map((h, i) => (
            <View key={i} style={[styles.bar, { height: h }]} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: spacing.cardRadius,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.background,
  },
  containerPlaying: {
    backgroundColor: 'rgba(125,139,117,0.05)',
  },
  playButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.accentGreen,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  info: {
    flex: 1,
  },
  trackName: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.textPrimary,
  },
  status: {
    fontFamily: fonts.sansRegular,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  equalizer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  bar: {
    width: 3,
    backgroundColor: colors.accentGreen,
    borderRadius: 1.5,
  },
});
```

- [ ] **Step 2: 홈 화면 전체 조립**

`app/(tabs)/index.tsx`:

```tsx
import { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { colors, fonts, spacing, typography } from '../../lib/theme';
import { formatDateKo, getGreeting, getISODate, getWeekDates } from '../../lib/utils';
import { useAppStore } from '../../lib/store';
import {
  getRandomVerse,
  getDailyReadings,
  addDailyReading,
  toggleDailyReading,
  getReadingHistory,
  markDayCompleted,
  saveNote,
  getBook,
  DailyReading,
  Verse,
} from '../../lib/bible-data';
import { SectionLabel } from '../../components/SectionLabel';
import { CircleProgress } from '../../components/CircleProgress';
import { WeekDots } from '../../components/WeekDots';
import { ReadingChecklist } from '../../components/ReadingChecklist';
import { AddReadingModal } from '../../components/AddReadingModal';
import { MiniPlayer } from '../../components/MiniPlayer';

export default function HomeScreen() {
  const userName = useAppStore((s) => s.userName);
  const [dailyVerse, setDailyVerse] = useState<(Verse & { book_name: string }) | null>(null);
  const [showVerseDetails, setShowVerseDetails] = useState(false);
  const [readings, setReadings] = useState<DailyReading[]>([]);
  const [weekHistory, setWeekHistory] = useState<Record<string, boolean>>({});
  const [noteText, setNoteText] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const today = getISODate();

  async function loadData() {
    const verse = await getRandomVerse();
    setDailyVerse(verse);

    await loadReadings();
    await loadWeekHistory();
  }

  async function loadReadings() {
    const r = await getDailyReadings(today);
    // Resolve book names (since DBs are separate)
    const withNames = await Promise.all(
      r.map(async (reading) => {
        const book = await getBook(reading.book_id);
        return { ...reading, book_name: book?.name_ko ?? '' };
      })
    );
    setReadings(withNames);
  }

  async function loadWeekHistory() {
    const dates = getWeekDates().map(getISODate);
    const history = await getReadingHistory(dates);
    setWeekHistory(history);
  }

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  async function handleToggle(id: number) {
    await toggleDailyReading(id);
    await loadReadings();

    // Check if all done → mark day completed
    const updated = await getDailyReadings(today);
    if (updated.length > 0 && updated.every((r) => r.completed)) {
      await markDayCompleted(today);
      await loadWeekHistory();
    }
  }

  async function handleAddReading(bookId: number, startChapter: number, endChapter: number) {
    await addDailyReading(today, bookId, startChapter, endChapter);
    await loadReadings();
  }

  const completedCount = readings.filter((r) => r.completed).length;
  const progressPercent = readings.length > 0 ? (completedCount / readings.length) * 100 : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={typography.dateText}>{formatDateKo()}</Text>
        <Text style={styles.greeting}>
          <Text style={{ fontFamily: fonts.sansMedium }}>{userName}</Text>
          {'님, '}
          {getGreeting()}
        </Text>

        {/* Divider */}
        <View style={styles.divider} />

        {/* 오늘의 말씀 */}
        <SectionLabel label="오늘의 말씀" />
        {dailyVerse && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setShowVerseDetails(!showVerseDetails)}
          >
            <Text style={styles.verseText}>{dailyVerse.text}</Text>
            <Text style={styles.verseSource}>
              — {dailyVerse.book_name} {dailyVerse.chapter}:{dailyVerse.verse}
            </Text>
            {showVerseDetails && (
              <View style={styles.verseDetails}>
                <Text style={styles.verseDetailText}>
                  관련 자료가 곧 추가됩니다.
                </Text>
              </View>
            )}
            <Text style={styles.tapHint}>탭하여 관련 자료 보기</Text>
          </TouchableOpacity>
        )}

        {/* Divider */}
        <View style={styles.divider} />

        {/* 묵상 읽기표 */}
        <SectionLabel label="묵상 읽기표" />
        <CircleProgress percent={progressPercent} />
        <WeekDots completedDates={weekHistory} />
        <ReadingChecklist
          readings={readings}
          onToggle={handleToggle}
          onAdd={() => setShowAddModal(true)}
        />

        {/* Divider */}
        <View style={styles.divider} />

        {/* 묵상 노트 */}
        <SectionLabel
          label="묵상 노트"
          right={<Text style={typography.dateText}>{formatDateKo()}</Text>}
        />
        <TextInput
          style={styles.noteInput}
          placeholder="오늘의 묵상을 기록해 보세요..."
          placeholderTextColor={colors.textTertiary}
          multiline
          value={noteText}
          onChangeText={setNoteText}
          onBlur={async () => {
            if (noteText.trim()) {
              await saveNote(noteText.trim());
              setNoteText('');
            }
          }}
        />

        {/* Divider */}
        <View style={styles.divider} />

        {/* 미니 플레이어 */}
        <SectionLabel label="앰비언트" />
        <MiniPlayer />

        <View style={{ height: 100 }} />
      </ScrollView>

      <AddReadingModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddReading}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 12,
  },
  greeting: {
    fontFamily: fonts.serifLight,
    fontSize: 21,
    color: colors.textPrimary,
    marginTop: 6,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: spacing.sectionGap,
  },
  verseText: {
    fontFamily: fonts.serifLight,
    fontSize: 15,
    lineHeight: 30,
    color: colors.textPrimary,
  },
  verseSource: {
    fontFamily: fonts.sansRegular,
    fontSize: 11.5,
    color: '#AAAAAA',
    marginTop: 10,
  },
  verseDetails: {
    backgroundColor: colors.surface,
    borderRadius: spacing.cardRadius,
    padding: 16,
    marginTop: 14,
  },
  verseDetailText: {
    fontFamily: fonts.sansRegular,
    fontSize: 13,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  tapHint: {
    fontFamily: fonts.sansRegular,
    fontSize: 10.5,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: 10,
  },
  noteInput: {
    fontFamily: fonts.sansRegular,
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: 'rgba(0,0,0,0.015)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    borderRadius: 12,
    padding: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
});
```

- [ ] **Step 3: 시뮬레이터에서 홈 화면 전체 동작 확인**

모든 섹션(인사말, 오늘의 말씀, 읽기표, 노트, 미니 플레이어)이 표시되고, 읽기 추가 → 체크 → 프로그레스 업데이트가 동작하면 성공.

- [ ] **Step 4: 커밋**

```bash
git add components/MiniPlayer.tsx app/\(tabs\)/index.tsx
git commit -m "feat: implement complete home screen with all sections"
```

---

## Task 12: 성경 읽기 화면 — 본문 표시

**Files:**
- Create: `components/VerseText.tsx`
- Modify: `app/(tabs)/bible.tsx`

- [ ] **Step 1: VerseText 컴포넌트 (롱프레스 지원)**

`components/VerseText.tsx`:

```tsx
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, fonts } from '../lib/theme';
import { Verse } from '../lib/bible-data';

interface Props {
  verse: Verse;
  highlighted?: boolean;
  onLongPress?: (verse: Verse) => void;
}

export function VerseText({ verse, highlighted, onLongPress }: Props) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      delayLongPress={500}
      onLongPress={() => onLongPress?.(verse)}
      style={[styles.container, highlighted && styles.highlighted]}
    >
      <Text style={styles.text}>
        <Text style={styles.verseNumber}>{verse.verse} </Text>
        {verse.text}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 1,
  },
  highlighted: {
    backgroundColor: 'rgba(125,139,117,0.12)',
    borderRadius: 4,
    marginHorizontal: -4,
    paddingHorizontal: 4,
  },
  text: {
    fontFamily: fonts.serifLight,
    fontSize: 16.5,
    lineHeight: 16.5 * 2.05,
    color: colors.textPrimary,
  },
  verseNumber: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    color: colors.accentRed,
  },
});
```

- [ ] **Step 2: 성경 읽기 화면 구현**

`app/(tabs)/bible.tsx`:

```tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { colors, fonts, spacing, typography } from '../../lib/theme';
import { useAppStore } from '../../lib/store';
import { getVerses, getSections, getBook, Verse, Section, Book } from '../../lib/bible-data';
import { VerseText } from '../../components/VerseText';

export default function BibleScreen() {
  const { currentBookId, currentChapter, setCurrentPosition } = useAppStore();
  const [book, setBook] = useState<Book | null>(null);
  const [verses, setVerses] = useState<Verse[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [highlightedVerse, setHighlightedVerse] = useState<number | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  async function loadChapter() {
    const [b, v, s] = await Promise.all([
      getBook(currentBookId),
      getVerses(currentBookId, currentChapter),
      getSections(currentBookId, currentChapter),
    ]);
    setBook(b);
    setVerses(v);
    setSections(s);
    setHighlightedVerse(null);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }

  useFocusEffect(
    useCallback(() => {
      loadChapter();
    }, [currentBookId, currentChapter])
  );

  function handleScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setShowScrollTop(e.nativeEvent.contentOffset.y > 300);
  }

  function handleLongPress(verse: Verse) {
    setHighlightedVerse(verse.verse);
    // Bottom sheet will be added in Task 13
  }

  function goToChapter(delta: number) {
    if (!book) return;
    const next = currentChapter + delta;
    if (next >= 1 && next <= book.chapter_count) {
      setCurrentPosition(currentBookId, next);
    }
  }

  // Group verses by sections (pericope)
  function renderVerses() {
    if (sections.length === 0) {
      return verses.map((v) => (
        <VerseText
          key={v.verse}
          verse={v}
          highlighted={highlightedVerse === v.verse}
          onLongPress={handleLongPress}
        />
      ));
    }

    const elements: React.ReactNode[] = [];
    let verseIdx = 0;

    for (const section of sections) {
      if (section.title) {
        elements.push(
          <Text key={`title-${section.start_verse}`} style={styles.sectionTitle}>
            {section.title}
          </Text>
        );
      }

      // Render verses in this section
      while (verseIdx < verses.length && verses[verseIdx].verse <= section.end_verse) {
        const v = verses[verseIdx];
        elements.push(
          <VerseText
            key={v.verse}
            verse={v}
            highlighted={highlightedVerse === v.verse}
            onLongPress={handleLongPress}
          />
        );
        verseIdx++;
      }

      elements.push(<View key={`gap-${section.end_verse}`} style={{ height: 32 }} />);
    }

    // Remaining verses not in any section
    while (verseIdx < verses.length) {
      const v = verses[verseIdx];
      elements.push(
        <VerseText
          key={v.verse}
          verse={v}
          highlighted={highlightedVerse === v.verse}
          onLongPress={handleLongPress}
        />
      );
      verseIdx++;
    }

    return elements;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setShowPicker(true)} style={styles.headerButton}>
          <Ionicons name="menu-outline" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {book?.name_ko} {currentChapter}장
        </Text>
        <TouchableOpacity style={styles.headerButton}>
          <Ionicons name="settings-outline" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Body */}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={100}
      >
        {/* Chapter number watermark */}
        <Text style={styles.chapterNumber}>{currentChapter}</Text>

        {renderVerses()}

        {/* Chapter navigation */}
        <View style={styles.chapterNav}>
          {currentChapter > 1 && (
            <TouchableOpacity onPress={() => goToChapter(-1)} style={styles.chapterNavButton}>
              <Ionicons name="chevron-back" size={16} color={colors.textSecondary} />
              <Text style={styles.chapterNavText}>{currentChapter - 1}장</Text>
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }} />
          {book && currentChapter < book.chapter_count && (
            <TouchableOpacity onPress={() => goToChapter(1)} style={styles.chapterNavButton}>
              <Text style={styles.chapterNavText}>{currentChapter + 1}장</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Scroll to top */}
      {showScrollTop && (
        <TouchableOpacity
          style={styles.scrollTopButton}
          onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
        >
          <Ionicons name="chevron-up" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  headerButton: {
    padding: 4,
  },
  headerTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  scrollContent: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 16,
  },
  chapterNumber: {
    fontFamily: fonts.sansRegular,
    fontSize: 64,
    fontWeight: '200',
    color: 'rgba(0,0,0,0.06)',
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: fonts.serifSemiBold,
    fontSize: 19,
    lineHeight: 19 * 1.5,
    color: colors.textPrimary,
    marginTop: 8,
    marginBottom: 12,
  },
  chapterNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 32,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    marginTop: 24,
  },
  chapterNavButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chapterNavText: {
    fontFamily: fonts.sansRegular,
    fontSize: 14,
    color: colors.textSecondary,
  },
  scrollTopButton: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(250,250,248,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```

- [ ] **Step 3: 시뮬레이터에서 성경 본문 표시 확인**

요한복음 1장이 표시되고, 소제목/단락 그룹핑, 절 번호 코랄레드, 장 이동 버튼이 동작하면 성공.

- [ ] **Step 4: 커밋**

```bash
git add components/VerseText.tsx app/\(tabs\)/bible.tsx
git commit -m "feat: implement Bible reading screen with verse display"
```

---

## Task 13: 성경 화면 — 바텀시트 & 책/장 선택 피커

**Files:**
- Create: `components/BottomSheet.tsx`, `components/BookChapterPicker.tsx`
- Modify: `app/(tabs)/bible.tsx`

- [ ] **Step 1: BottomSheet 컴포넌트**

`components/BottomSheet.tsx`:

```tsx
import { View, Text, TouchableOpacity, ScrollView, Modal, StyleSheet, Dimensions } from 'react-native';
import { colors, fonts, spacing } from '../lib/theme';
import { Verse } from '../lib/bible-data';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Props {
  visible: boolean;
  verse: Verse | null;
  bookName: string;
  onClose: () => void;
}

export function VerseBottomSheet({ visible, verse, bookName, onClose }: Props) {
  if (!verse) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.sheet}>
          {/* Handle bar */}
          <View style={styles.handleBar} />

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Selected verse */}
            <View style={styles.verseCard}>
              <Text style={styles.verseRef}>
                {bookName} {verse.chapter}:{verse.verse}
              </Text>
              <Text style={styles.verseText}>{verse.text}</Text>
            </View>

            {/* 주석 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>주석</Text>
              <Text style={styles.sectionContent}>
                주석 데이터가 곧 추가됩니다. Phase 2에서 RAG 시스템과 연결하여 해설을 제공합니다.
              </Text>
            </View>

            {/* 관련 구절 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>관련 구절</Text>
              <View style={styles.chipRow}>
                {['창 1:1', '골 1:17', '히 1:2'].map((ref) => (
                  <View key={ref} style={styles.chip}>
                    <Text style={styles.chipText}>{ref}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* 원어 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>원어</Text>
              <Text style={styles.sectionContent}>
                원어 데이터가 곧 추가됩니다.
              </Text>
            </View>
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'flex-end',
  },
  sheet: {
    height: SCREEN_HEIGHT * 0.6,
    backgroundColor: colors.background,
    borderTopLeftRadius: spacing.bottomSheetRadius,
    borderTopRightRadius: spacing.bottomSheetRadius,
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 12,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.15)',
    alignSelf: 'center',
    marginBottom: 20,
  },
  verseCard: {
    backgroundColor: 'rgba(125,139,117,0.12)',
    borderRadius: spacing.cardRadius,
    padding: 16,
    marginBottom: 24,
  },
  verseRef: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    color: colors.accentGreen,
    marginBottom: 8,
  },
  verseText: {
    fontFamily: fonts.serifLight,
    fontSize: 15,
    lineHeight: 30,
    color: colors.textPrimary,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    color: colors.accentGreen,
    letterSpacing: 1,
    marginBottom: 10,
  },
  sectionContent: {
    fontFamily: fonts.sansRegular,
    fontSize: 13,
    lineHeight: 22,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  chipText: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.textPrimary,
  },
});
```

- [ ] **Step 2: BookChapterPicker 컴포넌트**

`components/BookChapterPicker.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, StyleSheet } from 'react-native';
import { colors, fonts, spacing } from '../lib/theme';
import { Book, getAllBooks } from '../lib/bible-data';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (bookId: number, chapter: number) => void;
}

export function BookChapterPicker({ visible, onClose, onSelect }: Props) {
  const [testament, setTestament] = useState<'old' | 'new'>('old');
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  useEffect(() => {
    if (visible) {
      setSelectedBook(null);
      getAllBooks().then(setBooks);
    }
  }, [visible]);

  const filteredBooks = books.filter((b) => b.testament === testament);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={selectedBook ? () => setSelectedBook(null) : onClose}>
            <Text style={styles.headerButton}>{selectedBook ? '뒤로' : '닫기'}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{selectedBook?.name_ko ?? '성경'}</Text>
          <View style={{ width: 40 }} />
        </View>

        {!selectedBook ? (
          <>
            <View style={styles.toggleRow}>
              {(['old', 'new'] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.toggle, testament === t && styles.toggleActive]}
                  onPress={() => setTestament(t)}
                >
                  <Text style={[styles.toggleText, testament === t && styles.toggleTextActive]}>
                    {t === 'old' ? '구약' : '신약'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <ScrollView>
              {filteredBooks.map((book) => (
                <TouchableOpacity
                  key={book.id}
                  style={styles.bookItem}
                  onPress={() => setSelectedBook(book)}
                >
                  <Text style={styles.bookName}>{book.name_ko}</Text>
                  <Text style={styles.bookChapters}>{book.chapter_count}장</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        ) : (
          <ScrollView contentContainerStyle={styles.chapterGrid}>
            {Array.from({ length: selectedBook.chapter_count }, (_, i) => i + 1).map((ch) => (
              <TouchableOpacity
                key={ch}
                style={styles.chapterCell}
                onPress={() => {
                  onSelect(selectedBook.id, ch);
                  onClose();
                }}
              >
                <Text style={styles.chapterText}>{ch}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  headerButton: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.accentGreen },
  headerTitle: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.textPrimary },
  toggleRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: 12,
    gap: 8,
  },
  toggle: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: spacing.buttonRadius,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  toggleActive: { backgroundColor: colors.accentGreen },
  toggleText: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.textPrimary },
  toggleTextActive: { color: '#FFFFFF' },
  bookItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  bookName: { fontFamily: fonts.sansRegular, fontSize: 15, color: colors.textPrimary },
  bookChapters: { fontFamily: fonts.sansRegular, fontSize: 12, color: colors.textSecondary },
  chapterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.screenPadding,
    gap: 10,
  },
  chapterCell: {
    width: 52,
    height: 52,
    borderRadius: spacing.buttonRadius,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterText: { fontFamily: fonts.sansRegular, fontSize: 15, color: colors.textPrimary },
});
```

- [ ] **Step 3: 성경 화면에 바텀시트 & 피커 연결**

`app/(tabs)/bible.tsx`에 import 추가 및 상태 연결:

파일 상단 import에 추가:

```tsx
import { VerseBottomSheet } from '../../components/BottomSheet';
import { BookChapterPicker } from '../../components/BookChapterPicker';
```

컴포넌트 내부에 상태 추가 (기존 `showPicker` 상태는 이미 있음):

```tsx
const [selectedVerse, setSelectedVerse] = useState<Verse | null>(null);
const [showBottomSheet, setShowBottomSheet] = useState(false);
```

`handleLongPress` 함수 수정:

```tsx
function handleLongPress(verse: Verse) {
  setHighlightedVerse(verse.verse);
  setSelectedVerse(verse);
  setShowBottomSheet(true);
}
```

return JSX의 닫는 `</SafeAreaView>` 직전에 추가:

```tsx
<VerseBottomSheet
  visible={showBottomSheet}
  verse={selectedVerse}
  bookName={book?.name_ko ?? ''}
  onClose={() => {
    setShowBottomSheet(false);
    setHighlightedVerse(null);
  }}
/>

<BookChapterPicker
  visible={showPicker}
  onClose={() => setShowPicker(false)}
  onSelect={(bookId, chapter) => setCurrentPosition(bookId, chapter)}
/>
```

- [ ] **Step 4: 시뮬레이터에서 확인**

- 햄버거 메뉴 → 책/장 선택 → 본문 이동
- 구절 롱프레스 → 하이라이트 + 바텀시트 표시
- 오버레이 탭 → 시트 닫기

- [ ] **Step 5: 커밋**

```bash
git add components/BottomSheet.tsx components/BookChapterPicker.tsx app/\(tabs\)/bible.tsx
git commit -m "feat: add verse bottom sheet and book/chapter picker"
```

---

## Task 14: 음악 화면 (UI only)

**Files:**
- Modify: `app/(tabs)/music.tsx`

- [ ] **Step 1: 음악 플레이어 UI 구현**

`app/(tabs)/music.tsx`:

```tsx
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../../lib/theme';

export default function MusicScreen() {
  return (
    <LinearGradient colors={['#F5F0E8', '#EDE6DA']} style={styles.container}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* Abstract orb */}
        <View style={styles.orbContainer}>
          <View style={styles.orb} />
        </View>

        {/* Track info */}
        <Text style={styles.trackName}>Peaceful Dwelling</Text>
        <Text style={styles.artist}>Ambient Worship</Text>

        {/* Timeline (placeholder) */}
        <View style={styles.timeline}>
          <View style={styles.timelineTrack}>
            <View style={[styles.timelineProgress, { width: '30%' }]} />
          </View>
          <View style={styles.timeLabels}>
            <Text style={styles.timeText}>0:00</Text>
            <Text style={styles.timeText}>15:00</Text>
          </View>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <TouchableOpacity>
            <Ionicons name="play-skip-back" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.playButton}>
            <Ionicons name="play" size={32} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity>
            <Ionicons name="play-skip-forward" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Volume (placeholder) */}
        <View style={styles.volume}>
          <Ionicons name="volume-low" size={16} color={colors.textTertiary} />
          <View style={styles.volumeTrack}>
            <View style={[styles.volumeProgress, { width: '60%' }]} />
          </View>
          <Ionicons name="volume-high" size={16} color={colors.textTertiary} />
        </View>

        {/* Coming soon */}
        <Text style={styles.comingSoon}>음악이 곧 추가됩니다</Text>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  orbContainer: { marginBottom: 48 },
  orb: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(125,139,117,0.15)',
  },
  trackName: {
    fontFamily: fonts.sansMedium,
    fontSize: 18,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  artist: {
    fontFamily: fonts.sansRegular,
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 32,
  },
  timeline: { width: '100%', marginBottom: 32 },
  timelineTrack: {
    height: 3,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 1.5,
  },
  timelineProgress: {
    height: 3,
    backgroundColor: colors.textSecondary,
    borderRadius: 1.5,
  },
  timeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  timeText: {
    fontFamily: fonts.sansRegular,
    fontSize: 11,
    color: colors.textTertiary,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 36,
    marginBottom: 36,
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    borderColor: colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  volume: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 10,
    marginBottom: 24,
  },
  volumeTrack: {
    flex: 1,
    height: 2,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 1,
  },
  volumeProgress: {
    height: 2,
    backgroundColor: colors.textTertiary,
    borderRadius: 1,
  },
  comingSoon: {
    fontFamily: fonts.sansRegular,
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 8,
  },
});
```

> `expo-linear-gradient` 설치 필요: `npx expo install expo-linear-gradient`

- [ ] **Step 2: 커밋**

```bash
git add app/\(tabs\)/music.tsx
git commit -m "feat: add music player UI (placeholder)"
```

---

## Task 15: 노트 화면 (리스트 + 상세)

**Files:**
- Create: `components/NoteCard.tsx`, `app/note/[id].tsx`
- Modify: `app/(tabs)/notes.tsx`

- [ ] **Step 1: NoteCard 컴포넌트**

`components/NoteCard.tsx`:

```tsx
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, fonts } from '../lib/theme';
import { Note } from '../lib/bible-data';

interface Props {
  note: Note;
  onPress: () => void;
}

export function NoteCard({ note, onPress }: Props) {
  const date = new Date(note.created_at);
  const dateStr = `${date.getMonth() + 1}월 ${date.getDate()}일`;

  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <Text style={styles.date}>{dateStr}</Text>
      {note.book_id && (
        <Text style={styles.ref}>
          {note.book_name ?? ''} {note.chapter}:{note.verse}
        </Text>
      )}
      <Text style={styles.preview} numberOfLines={2}>
        {note.content}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  date: {
    fontFamily: fonts.sansRegular,
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  ref: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.accentGreen,
    marginBottom: 6,
  },
  preview: {
    fontFamily: fonts.sansRegular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textPrimary,
  },
});
```

- [ ] **Step 2: 노트 리스트 화면**

`app/(tabs)/notes.tsx`:

```tsx
import { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { colors, fonts, spacing, typography } from '../../lib/theme';
import { getAllNotes, Note } from '../../lib/bible-data';
import { NoteCard } from '../../components/NoteCard';

export default function NotesScreen() {
  const [notes, setNotes] = useState<Note[]>([]);
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      getAllNotes().then(setNotes);
    }, [])
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>묵상 노트</Text>
      {notes.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>아직 작성된 노트가 없습니다</Text>
        </View>
      ) : (
        <FlatList
          data={notes}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <NoteCard
              note={item}
              onPress={() => router.push(`/note/${item.id}`)}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  title: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 17,
    color: colors.textPrimary,
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: 14,
  },
  list: {
    paddingHorizontal: spacing.screenPadding,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: fonts.sansRegular,
    fontSize: 14,
    color: colors.textTertiary,
  },
});
```

- [ ] **Step 3: 노트 상세/편집 화면**

```bash
mkdir -p app/note
```

`app/note/[id].tsx`:

```tsx
import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, fonts, spacing } from '../../lib/theme';
import { getNote, updateNote, deleteNote, Note } from '../../lib/bible-data';

export default function NoteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [note, setNote] = useState<Note | null>(null);
  const [content, setContent] = useState('');

  useEffect(() => {
    if (id) {
      getNote(Number(id)).then((n) => {
        if (n) {
          setNote(n);
          setContent(n.content);
        }
      });
    }
  }, [id]);

  async function handleSave() {
    if (note && content.trim()) {
      await updateNote(note.id, content.trim());
      router.back();
    }
  }

  async function handleDelete() {
    if (note) {
      await deleteNote(note.id);
      router.back();
    }
  }

  if (!note) return null;

  const date = new Date(note.created_at);
  const dateStr = `${date.getMonth() + 1}월 ${date.getDate()}일`;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.headerButton}>닫기</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSave}>
          <Text style={styles.headerButton}>저장</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.meta}>
        <Text style={styles.date}>{dateStr}</Text>
      </View>

      <TextInput
        style={styles.input}
        value={content}
        onChangeText={setContent}
        multiline
        autoFocus
      />

      <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
        <Text style={styles.deleteText}>노트 삭제</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  headerButton: {
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    color: colors.accentGreen,
  },
  meta: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 16,
  },
  date: {
    fontFamily: fonts.sansRegular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  input: {
    flex: 1,
    fontFamily: fonts.sansRegular,
    fontSize: 15,
    lineHeight: 26,
    color: colors.textPrimary,
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 16,
    textAlignVertical: 'top',
  },
  deleteButton: {
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  deleteText: {
    fontFamily: fonts.sansRegular,
    fontSize: 13,
    color: colors.accentRed,
    textAlign: 'center',
  },
});
```

- [ ] **Step 4: 시뮬레이터에서 노트 작성 → 리스트 → 상세 편집 확인**

- [ ] **Step 5: 커밋**

```bash
git add components/NoteCard.tsx app/\(tabs\)/notes.tsx app/note/
git commit -m "feat: add notes list and detail/edit screens"
```

---

## Task 16: 최종 연결 & 정리

**Files:**
- Modify: 여러 파일 마이너 수정

- [ ] **Step 1: expo-asset 설치 (bible.db 로딩용)**

```bash
npx expo install expo-asset expo-file-system
```

- [ ] **Step 2: metro.config.js에 .db 확장자 추가**

`metro.config.js` (파일이 없으면 생성):

```javascript
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('db');

module.exports = config;
```

- [ ] **Step 3: app.json plugins에 expo-asset 추가**

`app.json`의 plugins 배열에 추가:

```json
"plugins": [
  "expo-router",
  "expo-font",
  "expo-sqlite",
  [
    "expo-asset",
    {
      "assets": ["./assets/bible/bible.db"]
    }
  ]
]
```

- [ ] **Step 4: 전체 앱 실행 테스트**

```bash
npx expo start --clear
```

확인 사항:
- 첫 실행 → 온보딩 → 이름 입력 → 홈
- 홈: 인사말, 오늘의 말씀, 읽기표(추가/체크), 노트, 미니 플레이어
- 성경: 본문 표시, 장 이동, 롱프레스 바텀시트, 책/장 선택
- 음악: UI 표시
- 노트: 리스트 + 상세 편집

- [ ] **Step 5: 커밋**

```bash
git add metro.config.js app.json package.json
git commit -m "feat: configure asset loading and finalize Phase 1 MVP"
```

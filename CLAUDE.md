# CLAUDE.md — 프로젝트 규칙 및 교훈

## 절대 반복하지 말 것

### 1. Ionicons 아이콘 이름
- 존재하지 않는 아이콘 이름 쓰지 말 것 (예: `pen-outline` 없음)
- 불확실하면 `Ionicons` 목록 확인 후 사용
- 현재 사용 중: `create-outline` (펜 모양, 하이라이트 컬렉션)

### 2. SQLite 마이그레이션
- `CREATE TABLE IF NOT EXISTS`는 기존 테이블에 컬럼을 추가하지 않음
- 새 컬럼 추가 시 반드시 `ALTER TABLE ... ADD COLUMN` 마이그레이션 포함
- try/catch로 감싸서 이미 존재하는 경우 무시

### 3. LinearGradient 위치
- `position: absolute`인 LinearGradient는 **절대 ScrollView 안에 넣지 말 것**
- 반드시 ScrollView의 **형제(sibling)** 또는 **부모** 레벨에 배치
- 스타일: `{ position: 'absolute', top: 0, left: 0, right: 0, height: ... }`

### 4. 그라데이션 텍스트 색상
- 그라데이션이 불투명하면 그 위의 텍스트도 반드시 대비 확인
- 아침/오후 등 밝은 그라데이션: 텍스트는 기본 다크 유지, 날짜만 살짝 진하게
- 새벽/밤 어두운 그라데이션: 텍스트는 밝은 크림색

### 5. 수정 후 반드시 안내
- 코드 수정 + 커밋 + 푸시 완료 후 항상 아래 형식으로 안내:
```
변경 요약 (번호 리스트)

git pull origin claude/initial-setup-wvT0J

Metro r 리로드.
```

## 프로젝트 구조

### 브랜치
- 작업 브랜치: `claude/initial-setup-wvT0J`

### 탭 순서
홈 | 성경 | 경건생활 | 가족 | 음악

### 디자인 시스템
- 배경: `#F4F3EE`
- 주요 텍스트: `#1A1A1A`
- 보조 텍스트: `#B1ADA1`
- 비활성: `#CDC8BE`
- 액센트: `#C15F3C` (테라코타)
- 폰트: Noto Serif KR (본문), Pretendard (UI)

### 기술 스택
- Expo (managed), TypeScript, expo-router, SQLite, Zustand
- 오디오: expo-av (SDK 54부터 expo-audio로 전환 필요)

## 작업 원칙
1. **한 번에 제대로** — 불확실하면 먼저 확인하고 코드 작성
2. **처음부터 전부** — 관련 파일 수정 사항이 있으면 한꺼번에 처리
3. **테스트 먼저 생각** — DB 스키마 변경 시 마이그레이션 필수
4. **작은 커밋** — 한 가지 변경만 하고 바로 안내

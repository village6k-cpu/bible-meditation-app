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

### 6. 실행 전 전제조건 확인
- 스크립트를 실행하라고 안내하기 전에, **필요한 데이터/파일/설정이 준비됐는지** 반드시 확인
- 예: RAG 파이프라인에서 참고 자료(TXT) 없이 맥락 생성하면 Claude 자체 지식만 사용됨 → 실행 전에 반드시 알려야 함
- "이거 돌리면 이런 결과가 나온다" 를 먼저 설명하고, 사용자가 OK 하면 실행

### 7. Python 버전 호환성
- Mac 기본 Python은 3.9임
- `int | None`, `list[str]` 등 3.10+ 문법 사용 금지
- `from typing import Optional, List, Tuple, Dict` 사용

## 작업 원칙
1. **한 번에 제대로** — 불확실하면 먼저 확인하고 코드 작성
2. **처음부터 전부** — 관련 파일 수정 사항이 있으면 한꺼번에 처리
3. **테스트 먼저 생각** — DB 스키마 변경 시 마이그레이션 필수
4. **작은 커밋** — 한 가지 변경만 하고 바로 안내
5. **실행 전 설명** — 사용자에게 "이 명령을 실행하면 무슨 일이 일어나는지" 먼저 설명. 비용이 발생하거나, 데이터가 없는 상태에서 돌리면 의미 없는 경우 반드시 경고

### 8. API 비용 추정은 반드시 실측 기반
- 비용 예측할 때 절대 대충 추정하지 말 것
- `response.usage` 토큰 수를 실측하고, Anthropic console 실제 단가로 계산
- 시스템 프롬프트가 길면 **매 호출마다 입력 토큰에 포함**되므로 비용 폭증
- 대량 호출 전에 반드시: (1) 5~10청크 실측 → (2) 전체 비용 추정 → (3) 사용자 확인
- `--max-cost` 등 비용 안전장치를 코드에 포함

### 9. Advisor Tool (advisor_20260301) 주의사항
- Anthropic 2026년 4월 9일 발표. SDK 0.93.0+, 베타 `advisor-tool-2026-03-01`
- 이 도구는 실존하지만, 신학 텍스트에서는 Haiku가 **매 청크마다** Opus 호출 → 비용 폭탄
- 도메인별 비용 특성 반드시 검증 후 사용

### 10. 기존 코드/브랜치 먼저 확인
- 작업 전에 반드시 `git branch -a`, `git log`, 기존 파일 확인
- 다른 브랜치에 이미 구현된 코드 없는지 확인 후 작업 시작
- 처음부터 새로 만들기 금지 — 기존 인프라 위에 수정

## 현재 상태 (2026-04-17)

### RAG 파이프라인
- **바빙크 1-4권**: 태깅 완료, Supabase 업로드 완료
- **기독교강요**: supervised 모드로 태깅 진행 중/완료 (3단계)
  - 1단계 Haiku 태깅 → 2단계 Sonnet 검증 → 3단계 type/topics 재태깅
- 원본 텍스트: `scripts/rag/raw/` (gitignore됨)
- 출력: `output/`

### 다음 할 일
1. **process_books.py 비용 방어** 적용 (토큰 사용량 로깅, --max-cost, 프롬프트 캐싱)
2. **generate_contexts.py**, **generate_keywords.py** 검토 및 필요 시 모델 옵션 추가
3. **기독교강요 Supabase 업로드 확인** (이번 실행에서 자동)

### 주요 파일
- `scripts/rag/process_books.py` — 3단계 감시형 태깅 (supervised 기본값)
- `scripts/rag/generate_contexts.py` — 성경 맥락 설명 생성
- `scripts/rag/generate_keywords.py` — 신학 키워드 전처리
- `scripts/rag/test_advisor.py` — advisor tool 테스트
- `rag-pipeline-complete.md` — 전체 RAG 설계 문서
- `.env` — SUPABASE_URL, SUPABASE_KEY, ANTHROPIC_API_KEY

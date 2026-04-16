# 성경 묵상 앱 RAG 파이프라인 — Claude Code 지시서 (완전판)

이 문서는 성경 묵상 앱의 RAG 시스템을 구축하기 위한 전처리 스크립트 3개와 앱 연동 코드를 포함한다. 기존 book-rag MCP 시스템(hnswlib, multilingual-e5-large, 1024차원)의 아키텍처를 참고하되, 앱용 데이터는 Supabase pgvector에 별도 구축한다.

---

## 전체 아키텍처

```
[전처리 — Mac/시놀로지에서 1회 실행]

1. process_books.py
   TXT 파일 → 청킹 → Claude API 메타데이터 태깅 → 임베딩 → Supabase 업로드

2. generate_contexts.py
   성경 66권 + 1,189장 + 단락별 맥락 설명 생성 → Supabase 업로드

3. generate_keywords.py
   성경 31,102절의 신학 키워드 전처리 → Supabase 업로드


[런타임 — 앱에서 사용자 요청 시]

사용자가 구절 롱프레스
    → 맥락 데이터 로드 (Supabase, API 호출 0)
    → 쿼리 확장 키워드 로드 (Supabase, API 호출 0)
    → 이중 검색: 메타필터 + 벡터 유사도 (Supabase)
    → Claude API 큐레이션 1회 호출
    → 결과 캐싱 + 바텀시트 표시
```

---

## Supabase 셋업

### 프로젝트 생성

1. https://supabase.com 가입 (GitHub 계정으로 가능)
2. New Project 생성
3. 대시보드 → Settings → API에서 URL과 anon key 복사
4. SQL Editor에서 아래 테이블 생성

### 테이블 스키마

```sql
-- pgvector 확장 활성화
CREATE EXTENSION IF NOT EXISTS vector;

-- ═══════════════════════════════════
-- 1. 책 청크 (process_books.py 결과)
-- ═══════════════════════════════════

CREATE TABLE book_chunks (
  id BIGSERIAL PRIMARY KEY,
  text TEXT NOT NULL,
  embedding VECTOR(1024),         -- multilingual-e5-large 차원
  book_title TEXT NOT NULL,
  author TEXT NOT NULL,
  bible_refs TEXT[],               -- ARRAY ['요 1:1', '요 1:2-3']
  chunk_type TEXT,                 -- 'commentary' | 'sermon' | 'theology' | 'devotional' | 'lexical'
  topics TEXT[],                   -- ARRAY ['로고스', '선재성', '삼위일체']
  tradition TEXT DEFAULT 'reformed', -- 'reformed' | 'evangelical' | 'patristic'
  page_or_section TEXT,            -- 출처 위치 (페이지, 챕터 등)
  chunk_index INTEGER,             -- 해당 책 내에서의 순서
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 벡터 검색 인덱스
CREATE INDEX book_chunks_embedding_idx ON book_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- 성경 구절 필터 인덱스
CREATE INDEX book_chunks_bible_refs_idx ON book_chunks
  USING gin (bible_refs);

-- 책 제목 인덱스
CREATE INDEX book_chunks_title_idx ON book_chunks (book_title);

-- ═══════════════════════════════════
-- 2. 성경 맥락 데이터 (generate_contexts.py 결과)
-- ═══════════════════════════════════

-- 66권 맥락
CREATE TABLE book_contexts (
  id SERIAL PRIMARY KEY,
  book_name TEXT NOT NULL UNIQUE,   -- '창세기', '요한복음' 등
  testament TEXT NOT NULL,           -- 'old' | 'new'
  context TEXT NOT NULL              -- 800-1,500자
);

-- 약 1,189장 맥락
CREATE TABLE chapter_contexts (
  id SERIAL PRIMARY KEY,
  book_name TEXT NOT NULL,
  chapter INTEGER NOT NULL,
  context TEXT NOT NULL,             -- 400-800자
  UNIQUE(book_name, chapter)
);

-- 단락(페리코프) 맥락
CREATE TABLE pericope_contexts (
  id SERIAL PRIMARY KEY,
  book_name TEXT NOT NULL,
  chapter INTEGER NOT NULL,
  start_verse INTEGER NOT NULL,
  end_verse INTEGER NOT NULL,
  context TEXT NOT NULL              -- 200-400자
);

-- ═══════════════════════════════════
-- 3. 쿼리 확장 키워드 (generate_keywords.py 결과)
-- ═══════════════════════════════════

CREATE TABLE verse_keywords (
  id SERIAL PRIMARY KEY,
  book_name TEXT NOT NULL,
  chapter INTEGER NOT NULL,
  verse INTEGER NOT NULL,
  keywords TEXT[] NOT NULL,          -- ['로고스', '선재성', 'ἐν ἀρχῇ', ...]
  UNIQUE(book_name, chapter, verse)
);

-- ═══════════════════════════════════
-- 4. 큐레이션 결과 캐시
-- ═══════════════════════════════════

CREATE TABLE curation_cache (
  id SERIAL PRIMARY KEY,
  verse_ref TEXT NOT NULL UNIQUE,    -- '요 1:1'
  result JSONB NOT NULL,             -- 큐레이션 결과 전체
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════
-- 5. 벡터 검색 RPC 함수
-- ═══════════════════════════════════

CREATE OR REPLACE FUNCTION search_chunks(
  query_embedding VECTOR(1024),
  filter_refs TEXT[] DEFAULT NULL,
  match_count INT DEFAULT 15
)
RETURNS TABLE (
  id BIGINT,
  text TEXT,
  book_title TEXT,
  author TEXT,
  bible_refs TEXT[],
  chunk_type TEXT,
  topics TEXT[],
  page_or_section TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  IF filter_refs IS NOT NULL THEN
    -- Layer A: 메타데이터 필터 + 벡터 유사도
    RETURN QUERY
    SELECT
      bc.id, bc.text, bc.book_title, bc.author,
      bc.bible_refs, bc.chunk_type, bc.topics, bc.page_or_section,
      1 - (bc.embedding <=> query_embedding) AS similarity
    FROM book_chunks bc
    WHERE bc.bible_refs && filter_refs  -- 배열 겹침 연산자
    ORDER BY bc.embedding <=> query_embedding
    LIMIT match_count;
  ELSE
    -- Layer B: 벡터 유사도만
    RETURN QUERY
    SELECT
      bc.id, bc.text, bc.book_title, bc.author,
      bc.bible_refs, bc.chunk_type, bc.topics, bc.page_or_section,
      1 - (bc.embedding <=> query_embedding) AS similarity
    FROM book_chunks bc
    ORDER BY bc.embedding <=> query_embedding
    LIMIT match_count;
  END IF;
END;
$$;
```

---

## 스크립트 1: process_books.py

TXT 파일을 읽어서 청킹 → 메타데이터 태깅 → 임베딩 → Supabase 업로드.

### 사용법

```bash
# 단일 파일
python process_books.py --file raw/칼빈_요한복음주석.txt

# 폴더 전체
python process_books.py --dir raw/

# 테스트 (업로드 안 하고 JSONL만 생성)
python process_books.py --dir raw/ --dry-run
```

### 파일명 규칙

TXT 파일명에서 저자와 제목을 자동 파싱:
```
칼빈_요한복음주석.txt     → 저자: "칼빈", 제목: "요한복음주석"
매튜헨리_창세기주석.txt    → 저자: "매튜헨리", 제목: "창세기주석"
스펄전_시편강해.txt       → 저자: "스펄전", 제목: "시편강해"
```
언더스코어(_)가 없으면 전체를 제목으로, 저자는 "미상"으로.

### 청킹 규칙

```python
from langchain.text_splitter import RecursiveCharacterTextSplitter

splitter = RecursiveCharacterTextSplitter(
    chunk_size=800,
    chunk_overlap=100,
    separators=["\n\n\n", "\n\n", "\n", ". ", " "],
    # 빈 줄 2개 > 빈 줄 1개 > 줄바꿈 > 문장 > 띄어쓰기 순으로 자름
    # 단락 경계를 최대한 존중
)
```

- 빈 청크(공백만 있는 것), 50자 미만 청크는 제거
- 각 청크에 chunk_index 순번 부여 (해당 책 내 순서)

### 메타데이터 태깅 (Claude API)

각 청크를 Claude API에 보내서 메타데이터 자동 추출.

```python
import anthropic

client = anthropic.Anthropic()

def tag_chunk(text: str) -> dict:
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=300,
        system="""
이 텍스트 조각을 분석하여 아래 JSON 형식으로 메타데이터를 추출하라.

{
  "bible_refs": ["요 1:1", "요 1:2-3"],
  "type": "commentary",
  "topics": ["로고스", "선재성", "삼위일체"],
  "tradition": "reformed"
}

규칙:
- bible_refs: 이 텍스트가 직접 다루거나 인용하는 성경 구절. 
  한글 약어 사용 (창, 출, 레, 민, 신, 수, 삿, 룻, 삼상, 삼하, 
  왕상, 왕하, 대상, 대하, 스, 느, 에, 욥, 시, 잠, 전, 아, 사, 렘, 
  애, 겔, 단, 호, 욜, 암, 옵, 욘, 미, 나, 합, 습, 학, 슥, 말,
  마, 막, 눅, 요, 행, 롬, 고전, 고후, 갈, 엡, 빌, 골, 살전, 살후,
  딤전, 딤후, 딛, 몬, 히, 약, 벧전, 벧후, 요일, 요이, 요삼, 유, 계)
  형식: "요 1:1" 또는 "요 1:1-3" 또는 "요 1:1-2:5"
- type: commentary(주석) | sermon(설교) | theology(조직/성경신학) | 
        devotional(경건서적) | lexical(원어분석)
- topics: 핵심 신학 주제 키워드 3-5개. 한글로.
- tradition: reformed(개혁주의) | evangelical(복음주의) | 
            patristic(초대교회) | other

성경 구절 레퍼런스가 없으면 bible_refs는 빈 배열 [].
확실하지 않으면 추측하지 마.
JSON만 출력. 다른 텍스트 없이.
""",
        messages=[{"role": "user", "content": text}]
    )
    return json.loads(response.content[0].text)
```

주의사항:
- API 호출 실패 시 3회 재시도 (exponential backoff)
- 응답이 JSON이 아니면 해당 청크 스킵하고 로그 남기기
- 진행률 표시: "처리 중: 142/500 (28%) — 칼빈_요한복음주석.txt"
- 중간 결과를 JSONL로 저장해서, 중단 후 재시작 시 이어서 처리 가능

### 임베딩

기존 book-rag와 동일한 모델, 동일한 쿼리 프리픽스 사용:

```python
from sentence_transformers import SentenceTransformer

model = SentenceTransformer("intfloat/multilingual-e5-large")

def embed_chunk(text: str) -> list:
    # 기존 book-rag의 vector_worker.py와 동일하게 "query: " 프리픽스 사용
    embedding = model.encode(f"query: {text}", normalize_embeddings=True)
    return embedding.tolist()
```

### Supabase 업로드

```python
from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def upload_chunk(chunk: dict):
    supabase.table("book_chunks").insert({
        "text": chunk["text"],
        "embedding": chunk["embedding"],
        "book_title": chunk["book_title"],
        "author": chunk["author"],
        "bible_refs": chunk["bible_refs"],
        "chunk_type": chunk["type"],
        "topics": chunk["topics"],
        "tradition": chunk["tradition"],
        "page_or_section": chunk.get("page_or_section"),
        "chunk_index": chunk["chunk_index"],
    }).execute()
```

배치 업로드: 50개씩 묶어서 insert (Supabase 제한 고려)

### --dry-run 모드

업로드 안 하고 output/processed.jsonl에만 저장.
이걸로 먼저 결과 확인 후 본 업로드.

---

## 스크립트 2: generate_contexts.py

성경 66권 + 1,189장 + 단락별 맥락 설명을 Claude API로 생성.
**book-rag에서 성경개론/성경신학 자료가 있으면 참고 입력으로 넣어서 품질 확보.**

### 사용법

```bash
# 전체 생성
python generate_contexts.py --all

# 특정 권만
python generate_contexts.py --book 요한복음

# 특정 장만
python generate_contexts.py --book 요한복음 --chapter 1
```

### 생성 프롬프트

#### book_contexts (66권)

```python
def generate_book_context(book_name: str, rag_references: str = "") -> str:
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2000,
        system="""
성경 묵상 앱의 맥락 데이터를 생성한다.
개혁주의 성경신학 관점에서 아래 항목을 포함하여 해당 권을 설명하라:

- 저자, 기록 시기, 원독자
- 이 권의 핵심 목적과 주제
- 전체 구속사(redemptive history)에서의 위치
- 구조 개요 (주요 단락 구분)
- 다른 성경 권과의 연결

800-1,500자. 설교 톤 금지. 학술적이되 읽기 쉬운 문체.
참고 자료가 제공되면 반드시 그 내용을 기반으로 작성하고,
제공된 자료에 없는 내용은 최소화하라.
""",
        messages=[{"role": "user", "content": f"""
{book_name}의 권 맥락(book context)을 작성해줘.

{f'참고 자료:{chr(10)}{rag_references}' if rag_references else ''}
"""}]
    )
    return response.content[0].text
```

#### chapter_contexts (약 1,189장)

```python
def generate_chapter_context(book_name: str, chapter: int, rag_references: str = "") -> str:
    # 시스템 프롬프트에 포함할 내용:
    # - 이 장이 해당 권 전체에서 어디에 위치하는지
    # - 앞 장과의 연결, 뒤 장으로의 흐름
    # - 이 장의 핵심 내용과 구조
    # - 400-800자
    pass
```

#### pericope_contexts (단락 단위)

단락 구분은 기존 앱 DB의 sections 테이블(소제목+구절 범위)을 기준으로.

```python
def generate_pericope_context(book_name: str, chapter: int,
                               start_verse: int, end_verse: int,
                               rag_references: str = "") -> str:
    # - 이 단락이 해당 장에서 어떤 역할을 하는지
    # - 앞뒤 단락과의 흐름
    # - 핵심 신학적 포인트
    # - 200-400자
    pass
```

### book-rag 참고 자료 연동

기존 book-rag MCP 서버의 search_books 함수를 활용하여
해당 권/장에 대한 참고 자료를 가져와서 프롬프트에 포함:

```python
# book-rag에서 참고 자료 검색
def get_rag_references(query: str, top_k: int = 5) -> str:
    """기존 book-rag 시스템에서 관련 자료 검색"""
    # mcp_server.py의 search_books를 직접 임포트하거나
    # subprocess로 호출
    results = search_books(query, top_k=top_k)
    return "\n\n".join([
        f"[{r['title']} — {r['author']}]\n{r['text']}"
        for r in results
    ])
```

이렇게 하면 맥락 데이터가 book-rag의 신학 자료를 기반으로 생성되어 품질이 올라감.

### 중단/재시작 지원

- 이미 DB에 있는 항목은 스킵 (UNIQUE 제약 활용)
- 진행률 표시: "book_contexts: 34/66 (51%)"

---

## 스크립트 3: generate_keywords.py

성경 전체 31,102절에 대한 신학 키워드를 미리 생성.
이 키워드는 런타임에 벡터 검색 쿼리를 확장하는 데 사용.

### 사용법

```bash
# 전체
python generate_keywords.py --all

# 특정 권만
python generate_keywords.py --book 요한복음
```

### 생성 방식

구절을 하나씩 보내면 31,102번 호출이라 비효율적.
**장 단위로 묶어서 한 번에 처리**:

```python
def generate_chapter_keywords(book_name: str, chapter: int, verses: list) -> list:
    """한 장의 모든 절에 대한 키워드를 한 번에 생성"""
    
    verses_text = "\n".join([
        f"{v['verse']}절: {v['text']}" for v in verses
    ])
    
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4000,
        system="""
성경 묵상 앱의 검색 키워드 데이터를 생성한다.
각 절에 대해 신학적 검색에 사용할 키워드 3-7개를 추출하라.

출력 형식 (JSON array):
[
  {"verse": 1, "keywords": ["로고스", "선재성", "삼위일체", "ἐν ἀρχῇ", "창조"]},
  {"verse": 2, "keywords": ["하나님과의 교제", "위격적 구별", "영원성"]},
  ...
]

규칙:
- 한글 키워드 위주, 핵심 원어(히브리어/그리스어)가 있으면 1-2개 포함
- 해당 절의 직접적 주제뿐 아니라, 관련 교리/신학 주제도 포함
- 개혁주의 조직신학 범주를 반영 (신론, 기독론, 구원론, 교회론 등)
- JSON만 출력
""",
        messages=[{"role": "user", "content": f"""
{book_name} {chapter}장의 각 절에 대한 검색 키워드를 생성해줘.

{verses_text}
"""}]
    )
    return json.loads(response.content[0].text)
```

이렇게 하면 31,102절이 아니라 **약 1,189번 호출**(장 단위)로 줄어듦.
Sonnet 기준 약 $30-40.

---

## 앱 연동: 런타임 검색 + 큐레이션

### 검색 함수 (앱 → Supabase)

```typescript
// lib/rag.ts

import { supabase } from './supabase';

export async function searchForVerse(
  verseRef: string,    // "요 1:1"
  verseText: string,   // "태초에 말씀이 계시니라..."
): Promise<ChunkResult[]> {

  // 1. 쿼리 확장 키워드 로드 (전처리 캐시)
  const { data: kw } = await supabase
    .from('verse_keywords')
    .select('keywords')
    .eq('book_name', parseBook(verseRef))
    .eq('chapter', parseChapter(verseRef))
    .eq('verse', parseVerse(verseRef))
    .single();

  const expandedQuery = kw
    ? `${verseText} ${kw.keywords.join(' ')}`
    : verseText;

  // 2. 쿼리 임베딩 (Edge Function 호출)
  const embedding = await getEmbedding(expandedQuery);

  // 3. 이중 검색
  //    Layer A: bible_refs 메타필터 + 벡터 유사도
  const { data: filtered } = await supabase.rpc('search_chunks', {
    query_embedding: embedding,
    filter_refs: [verseRef],
    match_count: 10,
  });

  //    Layer B: 벡터 유사도만 (의미 확장)
  const { data: semantic } = await supabase.rpc('search_chunks', {
    query_embedding: embedding,
    filter_refs: null,
    match_count: 10,
  });

  // 4. 합산 + 중복 제거
  const merged = deduplicateById([...(filtered || []), ...(semantic || [])]);
  return merged.slice(0, 15);
}
```

### 큐레이션 함수 (앱 → Claude API)

```typescript
// lib/curate.ts

export async function curateVerse(
  verseRef: string,
  verseText: string,
  pericopeContext: string,
  chunks: ChunkResult[],
): Promise<CurationResult> {

  // 캐시 확인
  const { data: cached } = await supabase
    .from('curation_cache')
    .select('result')
    .eq('verse_ref', verseRef)
    .single();

  if (cached) return cached.result;

  // Claude API 호출
  const chunksText = chunks.map(c =>
    `[${c.book_title} — ${c.author}${c.page_or_section ? `, ${c.page_or_section}` : ''}]\n${c.text}`
  ).join('\n\n---\n\n');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: CURATION_SYSTEM_PROMPT,  // 아래 정의
      messages: [{
        role: 'user',
        content: `
선택된 구절: ${verseRef} — "${verseText}"

단락 맥락:
${pericopeContext}

검색된 참고 자료:
${chunksText}
`
      }],
    }),
  });

  const data = await response.json();
  const result = parseCurationResponse(data.content[0].text);

  // 캐시 저장
  await supabase
    .from('curation_cache')
    .upsert({ verse_ref: verseRef, result });

  return result;
}
```

### 큐레이션 시스템 프롬프트 (확정본)

```typescript
const CURATION_SYSTEM_PROMPT = `
너는 성경 묵상 앱의 자료 큐레이터다.

── 역할 ──
사용자가 선택한 성경 구절에 대해, 검색 시스템이 반환한
참고 자료를 정리하여 묵상에 도움이 되는 해설을 제공한다.

── 출력 형식 ──

## 주석
여러 자료를 종합한 해설을 자연어 문단으로 작성한다. (200-500자)
핵심 통찰이 담긴 원문은 직접 인용할 수 있다.

## 관련 구절
- 구절 레퍼런스 | 이 구절과의 연결 이유 한 줄
(3-5개)

## 원어
핵심 단어의 원어, 음역, 의미 범위. (해당 시에만)

## 더 읽어볼 자료
- 출처명 | 한 줄 설명
(2-3건)

── 인용 규칙 ──
- 한 출처당 원문 인용 최대 1,000자.
- 반드시 따옴표로 감싸고 출처를 명시한다.
  예: "인용문" (저자, 책 제목, p.XX)
- 한 응답에 인용 출처 최대 3개.
- 전체 응답에서 원문 인용 비중이 40%를 넘지 않는다.
  나머지는 재구성된 요약이어야 한다.
- 원문을 길게 통째로 가져오지 않는다.
  핵심적인 부분을 선별하여 인용한다.

── 신학적 기준 ──
- 웨스트민스터 신앙고백에 부합하는 관점을 우선 배치한다.
- 다른 관점이 있을 경우 "다른 해석으로는" 형태로 병기 가능.
- 자료 간 관점이 충돌하면, 개혁주의 정통 입장을 주된 해설로 제시.

── 톤 ──
- 학술 논문이 아니라, 신학적으로 깊은 친구가 옆에서 설명해주는 톤.
- 문장은 짧게, 호흡은 여유 있게.
- 원어 분석은 학문적 과시가 아니라 "이 단어가 왜 중요한지"에 집중.
- 독자가 더 깊이 묵상하고 싶게 만드는 것이 목표.
- 적용이나 기도를 유도하지 않는다.
  묵상은 사용자의 영역이고, AI가 침범할 자리가 아니다.

── 금지 ──
- 제공된 참고 자료 외의 지식으로 답하지 않는다.
  자료에서 근거를 찾을 수 없는 주장은 하지 않는다.
- 자료가 부족하면 솔직하게:
  "이 구절에 대한 추가 자료가 아직 준비되지 않았습니다."
- 설교 톤으로 감정적으로 말하지 않는다.
- "~일 수 있습니다"를 남발하지 않는다.
`;
```

---

## 임베딩 Edge Function (Supabase)

앱에서 검색 쿼리를 임베딩하려면 서버사이드에서 모델을 돌려야 함.
Supabase Edge Function으로 구현:

```typescript
// supabase/functions/embed/index.ts
// multilingual-e5-large를 직접 돌리기엔 무거우므로
// 대안: OpenAI text-embedding-3-large 또는
//       Voyage AI voyage-multilingual-2 사용

// 주의: 기존 book-rag가 multilingual-e5-large를 쓰므로
// 동일 모델을 써야 벡터 호환이 됨.
// Supabase Edge Function에서는 sentence-transformers를
// 직접 돌릴 수 없으므로, 아래 두 가지 방안 중 선택:

// 방안 A: 별도 임베딩 서버 (시놀로지/Mac에 FastAPI)
// 방안 B: 전처리 시 모든 구절의 임베딩도 미리 생성하여 DB에 캐싱
//         → verse_keywords 테이블에 embedding 컬럼 추가

// 방안 B 추천 — 성경은 31,102절로 고정이니까
// 전처리 시 각 절의 확장 쿼리 임베딩을 미리 생성해두면
// 런타임에 임베딩 서버 호출이 필요 없음
```

---

## 비용 추정

### 전처리 (1회)

| 항목 | 호출 수 | 추정 비용 |
|---|---|---|
| 책 5권 메타데이터 태깅 | ~2,500 청크 | ~$5 |
| 맥락 데이터 (66권+1,189장+단락) | ~1,500 호출 | ~$30 |
| 쿼리 키워드 (1,189장) | ~1,189 호출 | ~$35 |
| **전처리 합계** | | **~$70** |

### 런타임 (사용자당)

| 항목 | 비용 |
|---|---|
| 큐레이션 1회 (Sonnet) | ~$0.004 |
| 하루 20절 조회 | ~$0.08 |
| 캐시 히트 시 | $0 |
| **월 추정 (캐시 감안)** | **<$1/인** |

### Supabase 무료 티어

- 500MB DB — 책 5권이면 충분
- 월 2GB 대역폭
- 50,000 월간 활성 사용자까지

---

## 실행 순서 요약

```
1. Supabase 프로젝트 생성 + 테이블 생성 (SQL 복붙)
2. .env 파일에 SUPABASE_URL, SUPABASE_KEY, ANTHROPIC_API_KEY 세팅
3. TXT 파일 5권을 raw/ 폴더에 넣기
4. python process_books.py --dir raw/ --dry-run  (결과 확인)
5. python process_books.py --dir raw/             (본 업로드)
6. python generate_contexts.py --all              (맥락 데이터)
7. python generate_keywords.py --all              (검색 키워드)
8. 앱에서 Supabase 연결 + 큐레이션 코드 통합
```

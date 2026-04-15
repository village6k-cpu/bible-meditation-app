#!/usr/bin/env python3
"""
process_books.py — TXT 파일 → 청킹 → Claude 메타데이터 태깅 → 임베딩 → Supabase 업로드

사용법:
  python process_books.py --file raw/칼빈_요한복음주석.txt
  python process_books.py --dir raw/
  python process_books.py --dir raw/ --dry-run
"""

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path

import anthropic
from dotenv import load_dotenv
from langchain_text_splitters import RecursiveCharacterTextSplitter
from sentence_transformers import SentenceTransformer
from supabase import create_client

# 프로젝트 루트의 .env 로드
_project_root = Path(__file__).resolve().parent.parent.parent
load_dotenv(_project_root / ".env")

# ─── 설정 ───────────────────────────────────────────────

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]

CHUNK_SIZE = 800
CHUNK_OVERLAP = 100
MIN_CHUNK_LENGTH = 50
BATCH_SIZE = 50          # Supabase 배치 업로드 크기
TAG_MAX_RETRIES = 3      # Claude API 재시도 횟수
EMBED_MODEL = "intfloat/multilingual-e5-large"

# ─── 클라이언트 초기화 ──────────────────────────────────

claude = anthropic.Anthropic()
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

TAG_SYSTEM_PROMPT = """
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
""".strip()


# ─── 1. 파일명 파싱 ─────────────────────────────────────

def parse_filename(filepath: str) -> tuple[str, str]:
    """파일명에서 저자와 제목 추출. 언더스코어로 구분."""
    stem = Path(filepath).stem
    if "_" in stem:
        parts = stem.split("_", 1)
        return parts[0], parts[1]
    return "미상", stem


# ─── 2. 청킹 ───────────────────────────────────────────

splitter = RecursiveCharacterTextSplitter(
    chunk_size=CHUNK_SIZE,
    chunk_overlap=CHUNK_OVERLAP,
    separators=["\n\n\n", "\n\n", "\n", ". ", " "],
)


def chunk_text(text: str) -> list[str]:
    """텍스트를 청크로 분할. 빈 청크, 50자 미만 제거."""
    chunks = splitter.split_text(text)
    return [c.strip() for c in chunks if c.strip() and len(c.strip()) >= MIN_CHUNK_LENGTH]


# ─── 3. Claude 메타데이터 태깅 ──────────────────────────

def tag_chunk(text: str) -> dict | None:
    """Claude API로 메타데이터 추출. 실패 시 3회 재시도."""
    for attempt in range(TAG_MAX_RETRIES):
        try:
            response = claude.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=300,
                system=TAG_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": text}],
            )
            raw = response.content[0].text.strip()
            # 코드블록(```json ... ```) 안의 JSON 추출
            try:
                return json.loads(raw)
            except json.JSONDecodeError:
                m = re.search(r"\{.*\}", raw, re.DOTALL)
                if m:
                    return json.loads(m.group())
                raise
        except json.JSONDecodeError:
            print(f"  ⚠ JSON 파싱 실패 (시도 {attempt + 1}/{TAG_MAX_RETRIES})")
        except Exception as e:
            print(f"  ⚠ API 오류 (시도 {attempt + 1}/{TAG_MAX_RETRIES}): {e}")

        if attempt < TAG_MAX_RETRIES - 1:
            wait = 2 ** (attempt + 1)
            time.sleep(wait)

    print("  ✗ 태깅 실패 — 기본값 사용")
    return {"bible_refs": [], "type": "other", "topics": [], "tradition": "other"}


# ─── 4. 임베딩 ─────────────────────────────────────────

_embed_model = None


def _get_embed_model():
    """임베딩 모델 lazy 로딩. 실제 임베딩 필요 시에만 로드."""
    global _embed_model
    if _embed_model is None:
        print(f"임베딩 모델 로딩: {EMBED_MODEL} ...")
        _embed_model = SentenceTransformer(EMBED_MODEL)
        print("임베딩 모델 로딩 완료.")
    return _embed_model


def embed_chunk(text: str) -> list[float]:
    """multilingual-e5-large 임베딩. query: 프리픽스 사용."""
    model = _get_embed_model()
    embedding = model.encode(f"query: {text}", normalize_embeddings=True)
    return embedding.tolist()


def dummy_embedding() -> list[float]:
    """dry-run용 더미 임베딩 (1024차원 영벡터)."""
    return [0.0] * 1024


# ─── 5. Supabase 업로드 ─────────────────────────────────

def upload_batch(records: list[dict]):
    """배치 단위로 Supabase에 업로드."""
    supabase.table("book_chunks").insert(records).execute()


# ─── 6. 중간 결과 저장/로드 (JSONL) ─────────────────────

PROGRESS_DIR = Path("output")
PROGRESS_DIR.mkdir(exist_ok=True)


def get_progress_path(filepath: str) -> Path:
    return PROGRESS_DIR / f"{Path(filepath).stem}.jsonl"


def load_progress(filepath: str) -> list[dict]:
    """이미 처리된 청크 로드."""
    path = get_progress_path(filepath)
    if not path.exists():
        return []
    results = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                results.append(json.loads(line))
    return results


def save_chunk_progress(filepath: str, record: dict):
    """청크 하나 처리 완료 시 즉시 JSONL에 추가."""
    path = get_progress_path(filepath)
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")


# ─── 7. 메인 파이프라인 ─────────────────────────────────

def process_file(filepath: str, dry_run: bool = False):
    author, title = parse_filename(filepath)
    print(f"\n{'='*60}")
    print(f"📖 {title} (저자: {author})")
    print(f"   파일: {filepath}")
    print(f"{'='*60}")

    # 텍스트 읽기
    with open(filepath, "r", encoding="utf-8") as f:
        text = f.read()
    print(f"   원문 길이: {len(text):,}자")

    # 청킹
    chunks = chunk_text(text)
    print(f"   청크 수: {len(chunks)}개")

    # 이미 처리된 진행 상황 로드
    existing = load_progress(filepath)
    start_idx = len(existing)
    if start_idx > 0:
        print(f"   ↳ 이전 진행분 {start_idx}개 발견, 이어서 처리")

    # 업로드할 레코드 배치
    batch = []

    for i in range(start_idx, len(chunks)):
        chunk = chunks[i]
        pct = (i + 1) / len(chunks) * 100
        print(f"   처리 중: {i + 1}/{len(chunks)} ({pct:.0f}%) — {title}", end="\r")

        # 태깅
        meta = tag_chunk(chunk)

        # 임베딩 (dry-run이면 더미)
        embedding = dummy_embedding() if dry_run else embed_chunk(chunk)

        record = {
            "text": chunk,
            "embedding": embedding,
            "book_title": title,
            "author": author,
            "bible_refs": meta.get("bible_refs", []),
            "chunk_type": meta.get("type", "other"),
            "topics": meta.get("topics", []),
            "tradition": meta.get("tradition", "other"),
            "page_or_section": None,
            "chunk_index": i,
        }

        # 진행 상황 저장
        save_chunk_progress(filepath, record)

        if not dry_run:
            batch.append(record)
            if len(batch) >= BATCH_SIZE:
                upload_batch(batch)
                batch = []

    # 남은 배치 업로드
    if batch and not dry_run:
        upload_batch(batch)

    print(f"\n   ✓ 완료! ({len(chunks)}개 청크)")
    if dry_run:
        print(f"   ↳ dry-run: {get_progress_path(filepath)}")


def main():
    parser = argparse.ArgumentParser(description="TXT → 청킹 → 태깅 → 임베딩 → Supabase")
    parser.add_argument("--file", help="단일 TXT 파일 경로")
    parser.add_argument("--dir", help="TXT 파일이 있는 디렉토리")
    parser.add_argument("--dry-run", action="store_true", help="업로드 없이 JSONL만 생성")
    args = parser.parse_args()

    if not args.file and not args.dir:
        parser.print_help()
        sys.exit(1)

    files = []
    if args.file:
        files.append(args.file)
    elif args.dir:
        dir_path = Path(args.dir)
        files = sorted([str(f) for f in dir_path.glob("*.txt")])

    if not files:
        print("처리할 TXT 파일이 없습니다.")
        sys.exit(1)

    print(f"\n총 {len(files)}개 파일")
    if args.dry_run:
        print("⚡ DRY-RUN 모드: Supabase 업로드 안 함")

    for filepath in files:
        process_file(filepath, dry_run=args.dry_run)

    print(f"\n{'='*60}")
    print("✅ 전체 완료!")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()

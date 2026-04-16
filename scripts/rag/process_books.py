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
from typing import Optional, Tuple

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
  "topics": [],
  "tradition": "reformed",
  "doctrine_category": ""
}

── bible_refs ──
이 텍스트가 직접 다루거나 인용하는 성경 구절.
한글 약어 사용 (창, 출, 레, 민, 신, 수, 삿, 룻, 삼상, 삼하,
왕상, 왕하, 대상, 대하, 스, 느, 에, 욥, 시, 잠, 전, 아, 사, 렘,
애, 겔, 단, 호, 욜, 암, 옵, 욘, 미, 나, 합, 습, 학, 슥, 말,
마, 막, 눅, 요, 행, 롬, 고전, 고후, 갈, 엡, 빌, 골, 살전, 살후,
딤전, 딤후, 딛, 몬, 히, 약, 벧전, 벧후, 요일, 요이, 요삼, 유, 계)
형식: "요 1:1" 또는 "요 1:1-3"
없으면 빈 배열 [].

── type ──
commentary: 성경 본문을 직접 해설하는 주석
sermon: 설교/강해
systematic_theology: 조직신학적 논의
biblical_theology: 성경신학적 논의 (구속사, 언약, 유형론 등)
devotional: 경건/묵상 서적
lexical: 원어 분석
confessional: 신조/신앙고백 해설
historical: 교회사/역사적 맥락
apologetics: 변증

── topics (3-7개) ──
아래 범주에서 해당하는 것을 선택. 목록에 없는 주제도 가능하되 구체적으로.

조직신학 범주:
  신론, 삼위일체, 기독론, 성령론, 인간론, 죄론,
  구원론, 칭의, 성화, 견인, 예정론, 선택, 언약,
  교회론, 성례, 종말론, 율법과 복음, 성경론, 영감

성경신학 범주:
  구속사, 하나님 나라, 언약신학, 유형론, 성취,
  메시아 예언, 신구약 연결

바빙크 특유 개념 (해당 시):
  유기적 영감, 일반은총, 특별은총, 자연신학,
  하나님의 소통가능성/소통불가능성 속성,
  원죄와 실죄, 은혜언약, 행위언약,
  중보자의 삼중직분, 교회의 표지,
  종말의 이미/아직, 일반계시, 특별계시,
  신학의 원리, 외적 부르심/내적 부르심

칼빈 특유 개념 (해당 시):
  이중지식, 성령의 내적 증거, 그리스도와의 연합,
  하나님의 적응, 섭리,
  하나님의 형상, 전적타락, 불가항력적 은혜,
  그리스도의 삼중직분, 성례의 표지와 인,
  이중예정, 교회의 참된 표지,
  기독교적 자유, 시민정부

── doctrine_category ──
이 텍스트가 가장 밀접하게 관련된 교리 대분류 하나만 선택:
신론 | 기독론 | 성령론 | 인간론 | 구원론 |
교회론 | 종말론 | 성경론 | 언약신학 | 해당없음

── tradition ──
reformed | evangelical | patristic | other

── 규칙 ──
확실하지 않으면 추측하지 마.
JSON만 출력. 다른 텍스트 없이.
""".strip()


# ─── 1. 파일명 파싱 ─────────────────────────────────────

def parse_filename(filepath: str) -> Tuple[str, str]:
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

def tag_chunk(text: str) -> Optional[dict]:
    """Claude API로 메타데이터 추출. 실패 시 3회 재시도."""
    for attempt in range(TAG_MAX_RETRIES):
        try:
            response = claude.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=500,
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
    return {"bible_refs": [], "type": "other", "topics": [], "tradition": "other", "doctrine_category": "해당없음"}


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
            "doctrine_category": meta.get("doctrine_category", "해당없음"),
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

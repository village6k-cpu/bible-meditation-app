#!/usr/bin/env python3
"""
process_books.py — 3단계 감시형 태깅 시스템

[1단계] Haiku + Opus Advisor로 전체 태깅
[2단계] Sonnet이 랜덤 샘플 검증
[3단계] 불일치율 높은 카테고리만 Sonnet으로 재태깅

사용법:
  python process_books.py --dir raw/                          # 기본값: supervised
  python process_books.py --dir raw/ --model sonnet           # 기존 방식
  python process_books.py --dir raw/ --validation-rate 0.2    # 검증 20%
  python process_books.py --dir raw/ --dry-run
  python process_books.py --file raw/칼빈_기독교강요.txt
"""

import argparse
import json
import os
import random
import re
import sys
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple

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
BATCH_SIZE = 50
TAG_MAX_RETRIES = 3
EMBED_MODEL = "intfloat/multilingual-e5-large"

# ─── 모델 상수 ──────────────────────────────────────────

MODEL_HAIKU = "claude-haiku-4-5-20251001"
MODEL_SONNET = "claude-sonnet-4-6"
MODEL_OPUS = "claude-opus-4-6"

ADVISOR_TOOL = {
    "type": "advisor_20260301",
    "name": "advisor",
    "model": MODEL_OPUS,
    "max_uses": 1,
}

# ─── 클라이언트 초기화 ──────────────────────────────────

claude = anthropic.Anthropic()
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ─── 태깅 시스템 프롬프트 ────────────────────────────────

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

ADVISOR_EXTRA = """

추가 지침:
- 성경 구절 참조가 애매하거나 신학적 분류가 확실하지 않으면
  advisor에게 자문을 구하라.
- advisor에게는 100단어 이내로 핵심만 물어라.
- 최종 출력은 반드시 JSON만. 다른 텍스트 없이.
"""

DEFAULT_TAGGING = {
    "bible_refs": [],
    "type": "other",
    "topics": [],
    "tradition": "other",
    "doctrine_category": "해당없음",
}

VALIDATED_FIELDS = ["bible_refs", "type", "doctrine_category", "topics"]


# ─── 1. 파일명 파싱 ─────────────────────────────────────

def parse_filename(filepath):
    # type: (str) -> Tuple[str, str]
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


def chunk_text(text):
    # type: (str) -> List[str]
    chunks = splitter.split_text(text)
    return [c.strip() for c in chunks if c.strip() and len(c.strip()) >= MIN_CHUNK_LENGTH]


# ─── 3. JSON 추출 유틸 ─────────────────────────────────

def extract_json(raw):
    # type: (str) -> dict
    raw = raw.strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        if m:
            return json.loads(m.group())
        raise


def extract_json_from_response(response):
    # type: (...) -> dict
    for block in response.content:
        if block.type == "text" and block.text.strip():
            return extract_json(block.text)
    raise ValueError("No valid JSON found in response")


# ─── 4. API 호출 + 재시도 ──────────────────────────────

def api_call_with_retry(fn, max_retries=TAG_MAX_RETRIES):
    # type: (...) -> ...
    for attempt in range(max_retries):
        try:
            return fn()
        except json.JSONDecodeError:
            print(f"  ⚠ JSON 파싱 실패 (시도 {attempt + 1}/{max_retries})")
        except (anthropic.RateLimitError, anthropic.APIConnectionError) as e:
            if attempt == max_retries - 1:
                raise
            print(f"  ⚠ API 오류, 재시도: {e}")
        except anthropic.APIStatusError as e:
            if e.status_code >= 500 and attempt < max_retries - 1:
                print(f"  ⚠ 서버 오류({e.status_code}), 재시도")
            else:
                raise
        except Exception as e:
            print(f"  ⚠ 오류 (시도 {attempt + 1}/{max_retries}): {e}")
            if attempt == max_retries - 1:
                raise

        wait = 2 ** (attempt + 1)
        time.sleep(wait)
    return None


# ─── 5. 태깅 함수 (모델별) ─────────────────────────────

def tag_chunk_sonnet(text):
    # type: (str) -> Optional[dict]
    def _call():
        resp = claude.messages.create(
            model=MODEL_SONNET,
            max_tokens=500,
            system=TAG_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": text}],
        )
        return extract_json_from_response(resp)
    return api_call_with_retry(_call)


def tag_chunk_haiku(text):
    # type: (str) -> Optional[dict]
    def _call():
        resp = claude.messages.create(
            model=MODEL_HAIKU,
            max_tokens=500,
            system=TAG_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": text}],
        )
        return extract_json_from_response(resp)
    return api_call_with_retry(_call)


def tag_chunk_advised(text):
    # type: (str) -> Optional[dict]
    def _call():
        resp = claude.beta.messages.create(
            model=MODEL_HAIKU,
            max_tokens=500,
            system=TAG_SYSTEM_PROMPT + ADVISOR_EXTRA,
            tools=[ADVISOR_TOOL],
            messages=[{"role": "user", "content": text}],
            betas=["advisor-tool-2026-03-01"],
        )
        return extract_json_from_response(resp)
    return api_call_with_retry(_call)


def tag_chunk_sonnet_fields(text, fields):
    # type: (str, List[str]) -> Optional[dict]
    retag_prompt = TAG_SYSTEM_PROMPT + f"""

위 필드 중 아래 필드만 추출하라. 나머지는 출력하지 마.
필요한 필드: {json.dumps(fields, ensure_ascii=False)}
"""
    def _call():
        resp = claude.messages.create(
            model=MODEL_SONNET,
            max_tokens=500,
            system=retag_prompt,
            messages=[{"role": "user", "content": text}],
        )
        return extract_json_from_response(resp)
    return api_call_with_retry(_call)


# ─── 6. 임베딩 ─────────────────────────────────────────

_embed_model = None


def _get_embed_model():
    global _embed_model
    if _embed_model is None:
        print(f"임베딩 모델 로딩: {EMBED_MODEL} ...")
        _embed_model = SentenceTransformer(EMBED_MODEL)
        print("임베딩 모델 로딩 완료.")
    return _embed_model


def embed_chunk(text):
    # type: (str) -> List[float]
    model = _get_embed_model()
    embedding = model.encode(f"query: {text}", normalize_embeddings=True)
    return embedding.tolist()


def dummy_embedding():
    # type: () -> List[float]
    return [0.0] * 1024


# ─── 7. Supabase 업로드 ─────────────────────────────────

def upload_batch(records):
    # type: (List[dict]) -> None
    supabase.table("book_chunks").insert(records).execute()


# ─── 8. 중간 결과 저장/로드 (JSONL) ─────────────────────

PROGRESS_DIR = Path("output")
PROGRESS_DIR.mkdir(exist_ok=True)


def get_progress_path(filepath):
    # type: (str) -> Path
    return PROGRESS_DIR / f"{Path(filepath).stem}.jsonl"


def load_progress(filepath):
    # type: (str) -> List[dict]
    path = get_progress_path(filepath)
    if not path.exists():
        return []
    results = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                results.append(json.loads(line))
    return results


def save_chunk_progress(filepath, record):
    # type: (str, dict) -> None
    path = get_progress_path(filepath)
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")


def save_jsonl(results, filepath):
    # type: (List[dict], str) -> None
    os.makedirs(os.path.dirname(filepath) or ".", exist_ok=True)
    with open(filepath, "w", encoding="utf-8") as f:
        for item in results:
            f.write(json.dumps(item, ensure_ascii=False) + "\n")


# ─── 9. 2단계: Sonnet 검증 ──────────────────────────────

def validate_with_sonnet(tagged_chunks, validation_rate):
    # type: (List[dict], float) -> Dict
    sample_size = max(int(len(tagged_chunks) * validation_rate), 10)
    samples = random.sample(tagged_chunks, min(sample_size, len(tagged_chunks)))

    mismatches = {f: 0 for f in VALIDATED_FIELDS}
    total_checked = len(samples)
    mismatch_details = []  # type: List[dict]

    for idx, item in enumerate(samples):
        sonnet_result = tag_chunk_sonnet(item["text"])
        if sonnet_result is None:
            continue

        haiku_result = item["meta"]
        fields_wrong = []  # type: List[str]

        # bible_refs: 집합 비교
        h_refs = set(haiku_result.get("bible_refs", []))
        s_refs = set(sonnet_result.get("bible_refs", []))
        if h_refs != s_refs:
            mismatches["bible_refs"] += 1
            fields_wrong.append("bible_refs")

        # type: 정확 비교
        if haiku_result.get("type") != sonnet_result.get("type"):
            mismatches["type"] += 1
            fields_wrong.append("type")

        # doctrine_category: 정확 비교
        if haiku_result.get("doctrine_category") != sonnet_result.get("doctrine_category"):
            mismatches["doctrine_category"] += 1
            fields_wrong.append("doctrine_category")

        # topics: 50% 이상 겹치면 OK
        h_topics = set(haiku_result.get("topics", []))
        s_topics = set(sonnet_result.get("topics", []))
        if s_topics and len(h_topics & s_topics) / len(s_topics) < 0.5:
            mismatches["topics"] += 1
            fields_wrong.append("topics")

        if fields_wrong:
            mismatch_details.append({
                "chunk_index": item["chunk_index"],
                "fields": fields_wrong,
                "haiku": haiku_result,
                "sonnet": sonnet_result,
            })

        if (idx + 1) % 20 == 0:
            print(f"    검증 중: {idx + 1}/{total_checked}")

    rates = {}  # type: Dict[str, float]
    for field in VALIDATED_FIELDS:
        rates[field] = mismatches[field] / total_checked if total_checked > 0 else 0.0

    return {
        "rates": rates,
        "total_checked": total_checked,
        "details": mismatch_details,
    }


# ─── 10. 3단계: 문제 필드 재태깅 ────────────────────────

def retag_failed_fields(tagged_chunks, failed_fields):
    # type: (List[dict], List[str]) -> List[dict]
    print(f"  재태깅 대상 필드: {', '.join(failed_fields)}")
    print(f"  전체 {len(tagged_chunks)}개 청크의 해당 필드만 수정")

    for idx, item in enumerate(tagged_chunks):
        partial = tag_chunk_sonnet_fields(item["text"], failed_fields)
        if partial is not None:
            for field in failed_fields:
                if field in partial:
                    item["meta"][field] = partial[field]

        if (idx + 1) % 50 == 0:
            print(f"    재태깅 중: {idx + 1}/{len(tagged_chunks)}")

    return tagged_chunks


# ─── 11. 메인 파이프라인 ─────────────────────────────────

def build_record(chunk, meta, title, author, chunk_index, embedding):
    # type: (str, dict, str, str, int, List[float]) -> dict
    return {
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
        "chunk_index": chunk_index,
    }


def process_file(filepath, args):
    # type: (str, ...) -> None
    author, title = parse_filename(filepath)
    model = args.model
    dry_run = args.dry_run

    print(f"\n{'=' * 60}")
    print(f"  {title} (저자: {author})")
    print(f"   파일: {filepath}")
    print(f"   모드: {model}")
    print(f"{'=' * 60}")

    with open(filepath, "r", encoding="utf-8") as f:
        text = f.read()
    print(f"   원문 길이: {len(text):,}자")

    chunks = chunk_text(text)
    print(f"   청크 수: {len(chunks)}개")

    if model == "supervised":
        _process_supervised(filepath, chunks, title, author, args)
    else:
        _process_single_model(filepath, chunks, title, author, args)


def _process_single_model(filepath, chunks, title, author, args):
    # type: (str, List[str], str, str, ...) -> None
    """sonnet / haiku / advised — 단일 모델 태깅 (기존 방식)"""
    model = args.model
    dry_run = args.dry_run
    tag_fn = {
        "sonnet": tag_chunk_sonnet,
        "haiku": tag_chunk_haiku,
        "advised": tag_chunk_advised,
    }[model]

    existing = load_progress(filepath)
    start_idx = len(existing)
    if start_idx > 0:
        print(f"   ↳ 이전 진행분 {start_idx}개 발견, 이어서 처리")

    batch = []  # type: List[dict]

    for i in range(start_idx, len(chunks)):
        chunk = chunks[i]
        pct = (i + 1) / len(chunks) * 100
        print(f"   처리 중: {i + 1}/{len(chunks)} ({pct:.0f}%) — {title}", end="\r")

        meta = tag_fn(chunk)
        if meta is None:
            meta = dict(DEFAULT_TAGGING)

        embedding = dummy_embedding() if dry_run else embed_chunk(chunk)
        record = build_record(chunk, meta, title, author, i, embedding)

        save_chunk_progress(filepath, record)

        if not dry_run:
            batch.append(record)
            if len(batch) >= BATCH_SIZE:
                upload_batch(batch)
                batch = []

    if batch and not dry_run:
        upload_batch(batch)

    print(f"\n   ✓ 완료! ({len(chunks)}개 청크)")


def _process_supervised(filepath, chunks, title, author, args):
    # type: (str, List[str], str, str, ...) -> None
    """3단계 감시형 태깅 파이프라인"""
    dry_run = args.dry_run
    output_dir = str(PROGRESS_DIR)

    # ── 1단계: Haiku + Opus Advisor ──
    print(f"\n[1단계] Haiku + Opus Advisor 태깅")
    tagged_chunks = []  # type: List[dict]

    for i, chunk in enumerate(chunks):
        meta = tag_chunk_advised(chunk)
        if meta is None:
            meta = dict(DEFAULT_TAGGING)

        tagged_chunks.append({
            "chunk_index": i,
            "text": chunk,
            "meta": meta,
        })

        if (i + 1) % 50 == 0:
            print(f"   처리 중: {i + 1}/{len(chunks)} ({(i + 1) * 100 // len(chunks)}%)")

    step1_path = os.path.join(output_dir, f"step1_{title}.jsonl")
    save_jsonl(tagged_chunks, step1_path)
    print(f"   ✓ 1단계 완료: {len(tagged_chunks)}개 → {step1_path}")

    # ── 2단계: Sonnet 검증 ──
    print(f"\n[2단계] Sonnet 검증 ({args.validation_rate * 100:.0f}% 샘플)")
    validation = validate_with_sonnet(tagged_chunks, args.validation_rate)

    total_checked = validation["total_checked"]
    print(f"\n{'=' * 44}")
    print(f"[2단계] Sonnet 검증 결과 ({total_checked}/{len(tagged_chunks)} 샘플)")
    print()

    failed_fields = []  # type: List[str]
    for field, rate in validation["rates"].items():
        status = "✗ 재태깅 필요!" if rate >= args.mismatch_threshold else "✓ OK"
        print(f"  {field:>22s}: {rate * 100:5.1f}% 불일치  {status}")
        if rate >= args.mismatch_threshold:
            failed_fields.append(field)

    if failed_fields:
        print(f"\n→ {', '.join(failed_fields)} 필드만 Sonnet으로 재태깅합니다.")
    else:
        print(f"\n→ 모든 필드 검증 통과!")
    print(f"{'=' * 44}")

    validation_path = os.path.join(output_dir, f"validation_{title}.json")
    with open(validation_path, "w", encoding="utf-8") as f:
        json.dump(validation, f, ensure_ascii=False, indent=2)

    # ── 3단계: 문제 필드 재태깅 ──
    if failed_fields:
        print(f"\n[3단계] Sonnet 재태깅: {', '.join(failed_fields)}")
        tagged_chunks = retag_failed_fields(tagged_chunks, failed_fields)
        print(f"   ✓ 3단계 완료")
    else:
        print(f"\n[3단계] 스킵 — 모든 필드 검증 통과!")

    # ── 임베딩 + Supabase 업로드 ──
    print(f"\n[업로드] 임베딩 생성 + Supabase 업로드")
    batch = []  # type: List[dict]

    for item in tagged_chunks:
        chunk = item["text"]
        meta = item["meta"]
        i = item["chunk_index"]

        embedding = dummy_embedding() if dry_run else embed_chunk(chunk)
        record = build_record(chunk, meta, title, author, i, embedding)

        save_chunk_progress(filepath, record)

        if not dry_run:
            batch.append(record)
            if len(batch) >= BATCH_SIZE:
                upload_batch(batch)
                batch = []

        if (i + 1) % 50 == 0:
            print(f"   업로드 중: {i + 1}/{len(tagged_chunks)}")

    if batch and not dry_run:
        upload_batch(batch)

    # ── 최종 저장 ──
    final_path = os.path.join(output_dir, f"final_{title}.jsonl")
    save_jsonl(tagged_chunks, final_path)

    # ── 비용 요약 ──
    n = len(chunks)
    haiku_cost = n * 0.0005
    sonnet_val_cost = total_checked * 0.004
    sonnet_retag_cost = n * 0.002 if failed_fields else 0
    total_cost = haiku_cost + sonnet_val_cost + sonnet_retag_cost
    sonnet_only_cost = n * 0.004
    saving = (1 - total_cost / sonnet_only_cost) * 100 if sonnet_only_cost > 0 else 0

    print(f"\n{'─' * 40}")
    print(f"  1단계 (Haiku+Advisor): ~${haiku_cost:.2f}")
    print(f"  2단계 (Sonnet 검증):   ~${sonnet_val_cost:.2f}")
    if failed_fields:
        print(f"  3단계 (Sonnet 재태깅): ~${sonnet_retag_cost:.2f}")
    print(f"  합계:                  ~${total_cost:.2f}")
    print(f"  Sonnet 단독 대비:      ~${sonnet_only_cost:.2f}")
    print(f"  절감:                  ~{saving:.0f}%")
    print(f"{'=' * 60}")

    print(f"\n   ✓ 완료! ({n}개 청크)")


# ─── CLI ─────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="3단계 감시형 태깅: TXT → 청킹 → 태깅 → 임베딩 → Supabase",
    )
    parser.add_argument("--file", help="단일 TXT 파일 경로")
    parser.add_argument("--dir", help="TXT 파일이 있는 디렉토리")
    parser.add_argument("--dry-run", action="store_true", help="업로드 없이 JSONL만 생성")
    parser.add_argument(
        "--model",
        choices=["sonnet", "haiku", "advised", "supervised"],
        default="supervised",
        help="태깅 모델: sonnet(비쌈) | haiku(저렴) | advised(하이쿠+오퍼스) | supervised(3단계 감시형, 기본값)",
    )
    parser.add_argument(
        "--validation-rate",
        type=float,
        default=0.1,
        help="supervised 모드에서 소넷 검증 비율 (기본 10%%)",
    )
    parser.add_argument(
        "--mismatch-threshold",
        type=float,
        default=0.3,
        help="이 비율 이상 불일치하면 해당 카테고리 전체 재태깅 (기본 30%%)",
    )
    args = parser.parse_args()

    if not args.file and not args.dir:
        parser.print_help()
        sys.exit(1)

    files = []  # type: List[str]
    if args.file:
        files.append(args.file)
    elif args.dir:
        dir_path = Path(args.dir)
        files = sorted([str(f) for f in dir_path.glob("*.txt")])

    if not files:
        print("처리할 TXT 파일이 없습니다.")
        sys.exit(1)

    print(f"\n총 {len(files)}개 파일")
    print(f"모드: {args.model}")
    if args.model == "supervised":
        print(f"검증 비율: {args.validation_rate * 100:.0f}%  |  불일치 기준: {args.mismatch_threshold * 100:.0f}%")
    if args.dry_run:
        print("⚡ DRY-RUN 모드: Supabase 업로드 안 함")

    for filepath in files:
        process_file(filepath, args)

    print(f"\n{'=' * 60}")
    print("✅ 전체 완료!")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()

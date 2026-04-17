#!/usr/bin/env python3
"""
process_books.py — 3단계 감시형 태깅 시스템 (비용 방어 포함)

[1단계] Haiku로 전체 태깅
[2단계] Sonnet이 랜덤 샘플 검증
[3단계] 불일치율 높은 카테고리만 Sonnet으로 재태깅

비용 방어:
  - 프롬프트 캐싱 (cache_control: ephemeral)
  - 토큰 사용량 JSONL 로깅
  - 누적 비용 실시간 출력
  - --max-cost 예산 초과 자동 중단
  - 첫 10청크 실측 후 전체 비용 추정 → 사용자 확인

사용법:
  python process_books.py --dir raw/                          # 기본값: supervised
  python process_books.py --dir raw/ --model sonnet           # 기존 방식
  python process_books.py --dir raw/ --validation-rate 0.2    # 검증 20%
  python process_books.py --dir raw/ --dry-run
  python process_books.py --file raw/칼빈_기독교강요.txt
  python process_books.py --dir raw/ --max-cost 10.0          # $10 초과시 중단
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

# ─── 모델별 가격 (USD per 1M tokens) ────────────────────

MODEL_PRICING = {
    MODEL_HAIKU: {
        "input": 1.00,
        "output": 5.00,
        "cache_read": 0.10,
        "cache_creation": 1.25,
    },
    MODEL_SONNET: {
        "input": 3.00,
        "output": 15.00,
        "cache_read": 0.30,
        "cache_creation": 3.75,
    },
    MODEL_OPUS: {
        "input": 15.00,
        "output": 75.00,
        "cache_read": 1.50,
        "cache_creation": 18.75,
    },
}


# ─── 비용 추적 ──────────────────────────────────────────

class BudgetExceededError(Exception):
    pass


class CostTracker(object):
    """API 호출별 토큰 사용량 + 비용 추적."""

    def __init__(self, max_cost=None, log_path=None):
        # type: (Optional[float], Optional[str]) -> None
        self.max_cost = max_cost
        self.log_path = log_path
        self.total_cost = 0.0
        self.call_count = 0
        self.total_input_tokens = 0
        self.total_output_tokens = 0
        self.total_cache_read_tokens = 0
        self.total_cache_creation_tokens = 0
        # 단계별 비용
        self.step_costs = {}  # type: Dict[str, float]
        self._current_step = ""

    def set_step(self, step_name):
        # type: (str) -> None
        self._current_step = step_name
        if step_name not in self.step_costs:
            self.step_costs[step_name] = 0.0

    def track(self, model, usage):
        # type: (str, ...) -> float
        """API 응답의 usage를 기록하고 비용을 반환."""
        pricing = MODEL_PRICING.get(model)
        if not pricing:
            return 0.0

        input_tokens = getattr(usage, "input_tokens", 0) or 0
        output_tokens = getattr(usage, "output_tokens", 0) or 0
        cache_read = getattr(usage, "cache_read_input_tokens", 0) or 0
        cache_creation = getattr(usage, "cache_creation_input_tokens", 0) or 0

        # 캐시되지 않은 입력 토큰 = 전체 - cache_read - cache_creation
        non_cached = max(0, input_tokens - cache_read - cache_creation)

        cost = (
            non_cached * pricing["input"] / 1_000_000
            + output_tokens * pricing["output"] / 1_000_000
            + cache_read * pricing["cache_read"] / 1_000_000
            + cache_creation * pricing["cache_creation"] / 1_000_000
        )

        self.total_cost += cost
        self.call_count += 1
        self.total_input_tokens += input_tokens
        self.total_output_tokens += output_tokens
        self.total_cache_read_tokens += cache_read
        self.total_cache_creation_tokens += cache_creation

        if self._current_step:
            self.step_costs[self._current_step] = (
                self.step_costs.get(self._current_step, 0.0) + cost
            )

        # JSONL 로깅
        if self.log_path:
            entry = {
                "call": self.call_count,
                "model": model,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "cache_read": cache_read,
                "cache_creation": cache_creation,
                "cost": round(cost, 6),
                "cumulative": round(self.total_cost, 4),
                "step": self._current_step,
                "ts": time.strftime("%Y-%m-%dT%H:%M:%S"),
            }
            with open(self.log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps(entry) + "\n")

        return cost

    def check_budget(self):
        # type: () -> None
        """예산 초과시 BudgetExceededError."""
        if self.max_cost is not None and self.total_cost >= self.max_cost:
            raise BudgetExceededError(
                "예산 초과! ${:.4f} >= ${:.2f}".format(self.total_cost, self.max_cost)
            )

    def cost_str(self):
        # type: () -> str
        return "${:.4f}".format(self.total_cost)

    def summary(self):
        # type: () -> str
        lines = []
        cache_pct = 0.0
        total_in = self.total_cache_read_tokens + self.total_cache_creation_tokens + (
            self.total_input_tokens - self.total_cache_read_tokens - self.total_cache_creation_tokens
        )
        if total_in > 0:
            cache_pct = self.total_cache_read_tokens / total_in * 100

        lines.append("─── 비용 실측 요약 ───")
        lines.append("  총 API 호출: {:,}회".format(self.call_count))
        lines.append("  입력 토큰: {:,} (캐시 히트: {:,}, {:.0f}%)".format(
            self.total_input_tokens, self.total_cache_read_tokens, cache_pct
        ))
        lines.append("  출력 토큰: {:,}".format(self.total_output_tokens))
        for step, cost in self.step_costs.items():
            lines.append("  {}: ${:.4f}".format(step, cost))
        lines.append("  합계: ${:.4f}".format(self.total_cost))
        if self.max_cost is not None:
            lines.append("  예산: ${:.2f} (잔여: ${:.4f})".format(
                self.max_cost, self.max_cost - self.total_cost
            ))
        return "\n".join(lines)


# 모듈 레벨 cost tracker (process_file에서 초기화)
_cost_tracker = None  # type: Optional[CostTracker]


# ─── 클라이언트 초기화 ──────────────────────────────────

claude = anthropic.Anthropic()
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ─── 태깅 시스템 프롬프트 ────────────────────────────────

TAG_SYSTEM_PROMPT = """
너는 텍스트 조각에서 메타데이터를 추출하는 JSON 생성기다.

사용자가 주는 텍스트 한 조각(chunk)을 받아서 반드시 JSON 하나만 출력한다.
질문하지 마. 더 많은 텍스트를 요청하지 마. 사용자에게 말을 걸지 마.
주어진 조각이 전부다. 짧든 길든, 신학 내용이 없든 있든, 항상 JSON을 출력한다.

출력 형식:
{
  "bible_refs": ["요 1:1", "요 1:2-3"],
  "type": "commentary",
  "topics": [],
  "tradition": "reformed",
  "doctrine_category": ""
}

내용이 없거나 헤더/서문/목차면:
- bible_refs: []
- topics: []
- type: "historical" (서문/편집자 노트) 또는 "other"
- doctrine_category: "해당없음"
- tradition: "reformed" (개혁주의 저자) 또는 "other"

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
확실한 것만 채우고 나머지는 빈 배열/"해당없음"으로 둔다.
JSON 객체 하나만 출력한다. 코드펜스도, 설명도, 질문도 금지.
첫 글자는 반드시 { 이다.
""".strip()

ADVISOR_EXTRA = """

advisor 사용 규칙:
- 성경 구절 참조가 애매하거나 신학적 분류가 확실하지 않을 때만 advisor에게 자문.
- advisor에게는 100단어 이내로 핵심만 물어라.
- advisor 호출 여부와 상관없이, 최종 답변은 반드시 JSON 객체 하나.
- 질문, 설명, 사과, 추가 요청 금지. 첫 글자 {. 마지막 글자 }.
"""

DEFAULT_TAGGING = {
    "bible_refs": [],
    "type": "other",
    "topics": [],
    "tradition": "other",
    "doctrine_category": "해당없음",
}

VALIDATED_FIELDS = ["bible_refs", "type", "doctrine_category", "topics"]

# 캐싱된 시스템 프롬프트 (cache_control: ephemeral)
CACHED_TAG_SYSTEM = [
    {
        "type": "text",
        "text": TAG_SYSTEM_PROMPT,
        "cache_control": {"type": "ephemeral"},
    }
]

CACHED_TAG_SYSTEM_ADVISOR = [
    {
        "type": "text",
        "text": TAG_SYSTEM_PROMPT + ADVISOR_EXTRA,
        "cache_control": {"type": "ephemeral"},
    }
]


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


DEBUG_JSON_FAIL = os.environ.get("DEBUG_TAGGING", "").lower() in ("1", "true")


def extract_json_from_response(response):
    # type: (...) -> dict
    text_blocks = [b.text for b in response.content if b.type == "text" and b.text.strip()]

    if not text_blocks:
        raise ValueError("No text blocks in response")

    for text in reversed(text_blocks):
        try:
            return extract_json(text)
        except json.JSONDecodeError:
            continue

    if DEBUG_JSON_FAIL:
        print("\n--- JSON 파싱 실패 RAW 응답 ---")
        for i, t in enumerate(text_blocks):
            print("[블록 {}]: {}".format(i, t[:500]))
        print("-------------------------------")
    else:
        last = text_blocks[-1][:200]
        print("    raw: {!r}".format(last))
    raise json.JSONDecodeError("No valid JSON in any text block", text_blocks[-1], 0)


# ─── 4. API 호출 + 재시도 ──────────────────────────────

def api_call_with_retry(fn, max_retries=TAG_MAX_RETRIES):
    # type: (...) -> ...
    for attempt in range(max_retries):
        try:
            return fn()
        except json.JSONDecodeError:
            print("  ! JSON 파싱 실패 (시도 {}/{})".format(attempt + 1, max_retries))
        except (anthropic.RateLimitError, anthropic.APIConnectionError) as e:
            if attempt == max_retries - 1:
                raise
            print("  ! API 오류, 재시도: {}".format(e))
        except anthropic.APIStatusError as e:
            if e.status_code >= 500 and attempt < max_retries - 1:
                print("  ! 서버 오류({}), 재시도".format(e.status_code))
            else:
                raise
        except Exception as e:
            print("  ! 오류 (시도 {}/{}): {}".format(attempt + 1, max_retries, e))
            if attempt == max_retries - 1:
                raise

        wait = 2 ** (attempt + 1)
        time.sleep(wait)
    return None


# ─── 5. 태깅 함수 (모델별, 프롬프트 캐싱 적용) ──────────

def tag_chunk_sonnet(text):
    # type: (str) -> Optional[dict]
    def _call():
        resp = claude.messages.create(
            model=MODEL_SONNET,
            max_tokens=500,
            system=CACHED_TAG_SYSTEM,
            messages=[{"role": "user", "content": text}],
        )
        if _cost_tracker:
            _cost_tracker.track(MODEL_SONNET, resp.usage)
        return extract_json_from_response(resp)
    return api_call_with_retry(_call)


def tag_chunk_haiku(text):
    # type: (str) -> Optional[dict]
    def _call():
        resp = claude.messages.create(
            model=MODEL_HAIKU,
            max_tokens=500,
            system=CACHED_TAG_SYSTEM,
            messages=[{"role": "user", "content": text}],
        )
        if _cost_tracker:
            _cost_tracker.track(MODEL_HAIKU, resp.usage)
        return extract_json_from_response(resp)
    return api_call_with_retry(_call)


def tag_chunk_advised(text):
    # type: (str) -> Optional[dict]
    def _call():
        resp = claude.beta.messages.create(
            model=MODEL_HAIKU,
            max_tokens=500,
            system=CACHED_TAG_SYSTEM_ADVISOR,
            tools=[ADVISOR_TOOL],
            messages=[{"role": "user", "content": text}],
            betas=["advisor-tool-2026-03-01"],
        )
        if _cost_tracker:
            _cost_tracker.track(MODEL_HAIKU, resp.usage)
        return extract_json_from_response(resp)
    return api_call_with_retry(_call)


def tag_chunk_sonnet_fields(text, fields):
    # type: (str, List[str]) -> Optional[dict]
    retag_prompt = TAG_SYSTEM_PROMPT + "\n\n위 필드 중 아래 필드만 추출하라. 나머지는 출력하지 마.\n필요한 필드: {}".format(
        json.dumps(fields, ensure_ascii=False)
    )
    cached_retag_system = [
        {
            "type": "text",
            "text": retag_prompt,
            "cache_control": {"type": "ephemeral"},
        }
    ]

    def _call():
        resp = claude.messages.create(
            model=MODEL_SONNET,
            max_tokens=500,
            system=cached_retag_system,
            messages=[{"role": "user", "content": text}],
        )
        if _cost_tracker:
            _cost_tracker.track(MODEL_SONNET, resp.usage)
        return extract_json_from_response(resp)
    return api_call_with_retry(_call)


# ─── 6. 임베딩 ─────────────────────────────────────────

_embed_model = None


def _get_embed_model():
    global _embed_model
    if _embed_model is None:
        print("임베딩 모델 로딩: {} ...".format(EMBED_MODEL))
        _embed_model = SentenceTransformer(EMBED_MODEL)
        print("임베딩 모델 로딩 완료.")
    return _embed_model


def embed_chunk(text):
    # type: (str) -> List[float]
    model = _get_embed_model()
    embedding = model.encode("query: {}".format(text), normalize_embeddings=True)
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
    return PROGRESS_DIR / "{}.jsonl".format(Path(filepath).stem)


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


# ─── 9. 비용 추정 (첫 N청크 실측 기반) ──────────────────

def estimate_total_cost(tracker, chunks_done, total_chunks, validation_rate):
    # type: (CostTracker, int, int, float) -> Dict[str, float]
    """첫 N청크 Haiku 실측으로 전체 3단계 비용 추정."""
    if chunks_done == 0:
        return {"step1": 0, "step2": 0, "step3_best": 0, "step3_worst": 0,
                "total_best": 0, "total_worst": 0}

    avg_cost_haiku = tracker.total_cost / chunks_done

    # 1단계: Haiku 전체
    step1 = avg_cost_haiku * total_chunks

    # Sonnet은 Haiku 대비 입력 3x, 출력 3x (가격 기준)
    # 실제 토큰 수는 비슷하므로 가격 비율로 추정
    avg_input = tracker.total_input_tokens / chunks_done
    avg_output = tracker.total_output_tokens / chunks_done
    avg_cache_read = tracker.total_cache_read_tokens / chunks_done

    sonnet_p = MODEL_PRICING[MODEL_SONNET]
    # 캐싱 적용 시 Sonnet도 cache hit 기대
    sonnet_per_chunk = (
        avg_cache_read * sonnet_p["cache_read"] / 1_000_000
        + max(0, avg_input - avg_cache_read) * sonnet_p["input"] / 1_000_000
        + avg_output * sonnet_p["output"] / 1_000_000
    )

    # 2단계: Sonnet 검증
    val_chunks = int(total_chunks * validation_rate)
    step2 = sonnet_per_chunk * val_chunks

    # 3단계: best=재태깅 없음, worst=전체 재태깅
    step3_worst = sonnet_per_chunk * total_chunks

    return {
        "step1": step1,
        "step2": step2,
        "step3_best": 0.0,
        "step3_worst": step3_worst,
        "total_best": step1 + step2,
        "total_worst": step1 + step2 + step3_worst,
    }


def print_estimate_and_confirm(est, total_chunks, pilot_chunks):
    # type: (Dict[str, float], int, int) -> bool
    """비용 추정 출력 후 사용자 확인."""
    print("\n{}".format("=" * 50))
    print("  첫 {}청크 실측 기반 전체 비용 추정 ({}청크)".format(pilot_chunks, total_chunks))
    print("{}".format("=" * 50))
    print("  1단계 Haiku 태깅:       ${:.2f}".format(est["step1"]))
    print("  2단계 Sonnet 검증:      ${:.2f}".format(est["step2"]))
    print("  3단계 Sonnet 재태깅:")
    print("    - 검증 통과 (best):   ${:.2f}".format(est["step3_best"]))
    print("    - 전체 재태깅 (worst): ${:.2f}".format(est["step3_worst"]))
    print("  ────────────────────────")
    print("  예상 총 비용: ${:.2f} ~ ${:.2f}".format(est["total_best"], est["total_worst"]))
    print("{}".format("=" * 50))

    try:
        answer = input("\n  계속 진행하시겠습니까? (y/n): ").strip().lower()
    except (EOFError, KeyboardInterrupt):
        print("\n  중단됨.")
        return False
    return answer in ("y", "yes", "예")


# ─── 10. 2단계: Sonnet 검증 ─────────────────────────────

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

        if _cost_tracker:
            _cost_tracker.check_budget()

        haiku_result = item["meta"]
        fields_wrong = []  # type: List[str]

        h_refs = set(haiku_result.get("bible_refs", []))
        s_refs = set(sonnet_result.get("bible_refs", []))
        if h_refs != s_refs:
            mismatches["bible_refs"] += 1
            fields_wrong.append("bible_refs")

        if haiku_result.get("type") != sonnet_result.get("type"):
            mismatches["type"] += 1
            fields_wrong.append("type")

        if haiku_result.get("doctrine_category") != sonnet_result.get("doctrine_category"):
            mismatches["doctrine_category"] += 1
            fields_wrong.append("doctrine_category")

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
            cost_info = " | {}".format(_cost_tracker.cost_str()) if _cost_tracker else ""
            print("    검증 중: {}/{}{}".format(idx + 1, total_checked, cost_info))

    rates = {}  # type: Dict[str, float]
    for field in VALIDATED_FIELDS:
        rates[field] = mismatches[field] / total_checked if total_checked > 0 else 0.0

    return {
        "rates": rates,
        "total_checked": total_checked,
        "details": mismatch_details,
    }


# ─── 11. 3단계: 문제 필드 재태깅 ────────────────────────

def retag_failed_fields(tagged_chunks, failed_fields):
    # type: (List[dict], List[str]) -> List[dict]
    print("  재태깅 대상 필드: {}".format(", ".join(failed_fields)))
    print("  전체 {}개 청크의 해당 필드만 수정".format(len(tagged_chunks)))

    for idx, item in enumerate(tagged_chunks):
        partial = tag_chunk_sonnet_fields(item["text"], failed_fields)
        if partial is not None:
            for field in failed_fields:
                if field in partial:
                    item["meta"][field] = partial[field]

        if _cost_tracker:
            _cost_tracker.check_budget()

        if (idx + 1) % 50 == 0:
            cost_info = " | {}".format(_cost_tracker.cost_str()) if _cost_tracker else ""
            print("    재태깅 중: {}/{}{}".format(idx + 1, len(tagged_chunks), cost_info))

    return tagged_chunks


# ─── 12. 메인 파이프라인 ─────────────────────────────────

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
    global _cost_tracker

    author, title = parse_filename(filepath)
    model = args.model
    dry_run = args.dry_run

    # 비용 추적 초기화
    log_path = str(PROGRESS_DIR / "usage_{}.jsonl".format(title))
    _cost_tracker = CostTracker(
        max_cost=args.max_cost,
        log_path=log_path,
    )

    print("\n{}".format("=" * 60))
    print("  {} (저자: {})".format(title, author))
    print("  파일: {}".format(filepath))
    print("  모드: {}".format(model))
    if args.max_cost is not None:
        print("  예산: ${:.2f}".format(args.max_cost))
    print("  토큰 로그: {}".format(log_path))
    print("{}".format("=" * 60))

    with open(filepath, "r", encoding="utf-8") as f:
        text = f.read()
    print("  원문 길이: {:,}자".format(len(text)))

    chunks = chunk_text(text)
    print("  청크 수: {}개".format(len(chunks)))

    try:
        if model == "supervised":
            _process_supervised(filepath, chunks, title, author, args)
        else:
            _process_single_model(filepath, chunks, title, author, args)
    except BudgetExceededError as e:
        print("\n  !! {}".format(e))
        print("  진행 상황은 저장되어 있으므로 --max-cost를 올려서 재시작 가능합니다.")
    finally:
        print("\n{}".format(_cost_tracker.summary()))


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

    if _cost_tracker:
        _cost_tracker.set_step("태깅({})".format(model))

    existing = load_progress(filepath)
    start_idx = len(existing)
    if start_idx > 0:
        print("   -> 이전 진행분 {}개 발견, 이어서 처리".format(start_idx))

    batch = []  # type: List[dict]
    t_start = time.time()
    pilot_chunks = min(10, len(chunks) - start_idx)

    for i in range(start_idx, len(chunks)):
        chunk = chunks[i]
        t_chunk = time.time()

        meta = tag_fn(chunk)
        if meta is None:
            meta = dict(DEFAULT_TAGGING)

        if _cost_tracker:
            _cost_tracker.check_budget()

        # 첫 10청크 후 비용 추정
        done = i - start_idx + 1
        if done == pilot_chunks and pilot_chunks > 0 and len(chunks) > pilot_chunks + start_idx:
            est = estimate_total_cost(_cost_tracker, done, len(chunks), 0)
            if not print_estimate_and_confirm(est, len(chunks), pilot_chunks):
                print("  사용자 중단.")
                return

        embedding = dummy_embedding() if dry_run else embed_chunk(chunk)
        record = build_record(chunk, meta, title, author, i, embedding)

        save_chunk_progress(filepath, record)

        if not dry_run:
            batch.append(record)
            if len(batch) >= BATCH_SIZE:
                upload_batch(batch)
                batch = []

        elapsed = time.time() - t_chunk
        if done <= 3 or done % 10 == 0:
            total = time.time() - t_start
            avg = total / done
            eta_min = avg * (len(chunks) - i - 1) / 60
            cost_info = " | {}".format(_cost_tracker.cost_str()) if _cost_tracker else ""
            print("   [{}/{}] {:.1f}s (평균 {:.1f}s, ETA {:.0f}분){}".format(
                i + 1, len(chunks), elapsed, avg, eta_min, cost_info
            ))

    if batch and not dry_run:
        upload_batch(batch)

    print("\n   완료! ({}개 청크)".format(len(chunks)))


def _process_supervised(filepath, chunks, title, author, args):
    # type: (str, List[str], str, str, ...) -> None
    """3단계 감시형 태깅 파이프라인.

    1단계: Haiku 단독 (advisor 제거)
    2단계: Sonnet이 랜덤 샘플 검증.
    3단계: 불일치율 높은 필드만 Sonnet으로 재태깅.
    """
    dry_run = args.dry_run
    output_dir = str(PROGRESS_DIR)
    step1_path = os.path.join(output_dir, "step1_{}.jsonl".format(title))

    # 1단계 재개: 이전 step1 결과 있으면 이어서
    tagged_chunks = []  # type: List[dict]
    if os.path.exists(step1_path):
        try:
            with open(step1_path, "r", encoding="utf-8") as f:
                for line in f:
                    if line.strip():
                        tagged_chunks.append(json.loads(line))
            if tagged_chunks:
                print("   -> 이전 1단계 진행분 {}개 발견, 이어서 처리".format(len(tagged_chunks)))
        except Exception as e:
            print("   ! 이전 진행분 로드 실패 ({}), 처음부터 시작".format(e))
            tagged_chunks = []

    start_idx = len(tagged_chunks)

    # ── 1단계: Haiku 단독 태깅 ──
    print("\n[1단계] Haiku 태깅 (프롬프트 캐싱 적용)")
    if _cost_tracker:
        _cost_tracker.set_step("1단계-Haiku")
    t_start = time.time()

    pilot_chunks = min(10, len(chunks) - start_idx)
    pilot_done = False

    for i in range(start_idx, len(chunks)):
        chunk = chunks[i]
        t_chunk = time.time()
        meta = tag_chunk_haiku(chunk)
        elapsed = time.time() - t_chunk
        if meta is None:
            meta = dict(DEFAULT_TAGGING)

        if _cost_tracker:
            _cost_tracker.check_budget()

        record = {
            "chunk_index": i,
            "text": chunk,
            "meta": meta,
        }
        tagged_chunks.append(record)

        with open(step1_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")

        done = i - start_idx + 1

        # 첫 10청크 실측 후 전체 비용 추정 → 사용자 확인
        if (not pilot_done and done == pilot_chunks
                and pilot_chunks > 0 and len(chunks) > pilot_chunks + start_idx):
            pilot_done = True
            est = estimate_total_cost(
                _cost_tracker, done, len(chunks), args.validation_rate
            )
            if not print_estimate_and_confirm(est, len(chunks), pilot_chunks):
                print("  사용자 중단. 1단계 진행분 {}개 저장됨.".format(len(tagged_chunks)))
                return

        if done <= 3 or done % 10 == 0:
            total = time.time() - t_start
            avg = total / done
            eta_sec = avg * (len(chunks) - i - 1)
            eta_min = eta_sec / 60
            cost_info = " | {}".format(_cost_tracker.cost_str()) if _cost_tracker else ""
            print("   [{}/{}] {:.1f}s (평균 {:.1f}s, ETA {:.0f}분){}".format(
                i + 1, len(chunks), elapsed, avg, eta_min, cost_info
            ))

    print("   1단계 완료: {}개 -> {}".format(len(tagged_chunks), step1_path))

    # ── 2단계: Sonnet 검증 ──
    print("\n[2단계] Sonnet 검증 ({:.0f}% 샘플, 프롬프트 캐싱 적용)".format(
        args.validation_rate * 100
    ))
    if _cost_tracker:
        _cost_tracker.set_step("2단계-Sonnet검증")
    validation = validate_with_sonnet(tagged_chunks, args.validation_rate)

    total_checked = validation["total_checked"]
    print("\n{}".format("=" * 44))
    print("[2단계] Sonnet 검증 결과 ({}/{} 샘플)".format(total_checked, len(tagged_chunks)))
    print()

    failed_fields = []  # type: List[str]
    for field, rate in validation["rates"].items():
        status = "! 재태깅 필요!" if rate >= args.mismatch_threshold else "OK"
        print("  {:>22s}: {:5.1f}% 불일치  {}".format(field, rate * 100, status))
        if rate >= args.mismatch_threshold:
            failed_fields.append(field)

    if failed_fields:
        print("\n-> {}, {} 필드만 Sonnet으로 재태깅합니다.".format(
            ", ".join(failed_fields), len(failed_fields)
        ))
    else:
        print("\n-> 모든 필드 검증 통과!")
    print("{}".format("=" * 44))

    validation_path = os.path.join(output_dir, "validation_{}.json".format(title))
    with open(validation_path, "w", encoding="utf-8") as f:
        json.dump(validation, f, ensure_ascii=False, indent=2)

    # ── 3단계: 문제 필드 재태깅 ──
    if failed_fields:
        print("\n[3단계] Sonnet 재태깅: {} (프롬프트 캐싱 적용)".format(", ".join(failed_fields)))
        if _cost_tracker:
            _cost_tracker.set_step("3단계-Sonnet재태깅")
        tagged_chunks = retag_failed_fields(tagged_chunks, failed_fields)
        print("   3단계 완료")
    else:
        print("\n[3단계] 스킵 - 모든 필드 검증 통과!")

    # ── 임베딩 + Supabase 업로드 ──
    print("\n[업로드] 임베딩 생성 + Supabase 업로드")
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
            print("   업로드 중: {}/{}".format(i + 1, len(tagged_chunks)))

    if batch and not dry_run:
        upload_batch(batch)

    # ── 최종 저장 ──
    final_path = os.path.join(output_dir, "final_{}.jsonl".format(title))
    save_jsonl(tagged_chunks, final_path)

    print("\n   완료! ({}개 청크)".format(len(chunks)))


# ─── CLI ─────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="3단계 감시형 태깅: TXT -> 청킹 -> 태깅 -> 임베딩 -> Supabase",
    )
    parser.add_argument("--file", help="단일 TXT 파일 경로")
    parser.add_argument("--dir", help="TXT 파일이 있는 디렉토리")
    parser.add_argument("--dry-run", action="store_true", help="업로드 없이 JSONL만 생성")
    parser.add_argument(
        "--model",
        choices=["sonnet", "haiku", "advised", "supervised"],
        default="supervised",
        help=(
            "태깅 모델: "
            "sonnet(비쌈, 전체 Sonnet) | "
            "haiku(저렴, 전체 Haiku) | "
            "advised(실험: Haiku+Opus 자문, 신학 텍스트에는 비용 폭탄) | "
            "supervised(3단계: Haiku 태깅 -> Sonnet 검증 -> 문제 필드만 Sonnet 재태깅, 기본값)"
        ),
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
    parser.add_argument(
        "--max-cost",
        type=float,
        default=None,
        help="최대 허용 비용 (USD). 초과시 자동 중단. 예: --max-cost 10.0",
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

    print("\n총 {}개 파일".format(len(files)))
    print("모드: {}".format(args.model))
    if args.model == "supervised":
        print("검증 비율: {:.0f}%  |  불일치 기준: {:.0f}%".format(
            args.validation_rate * 100, args.mismatch_threshold * 100
        ))
    if args.max_cost is not None:
        print("예산 한도: ${:.2f}".format(args.max_cost))
    if args.dry_run:
        print("DRY-RUN 모드: Supabase 업로드 안 함")

    for filepath in files:
        process_file(filepath, args)

    print("\n{}".format("=" * 60))
    print("전체 완료!")
    print("{}".format("=" * 60))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
generate_keywords.py — 성경 전체 절에 대한 신학 키워드 생성 → Supabase 업로드

장 단위로 Claude API 호출 (31,102절 → 약 1,189회 호출)

사용법:
  python generate_keywords.py --all
  python generate_keywords.py --book 요한복음
"""

import argparse
import json
import os
import re
import sqlite3
import sys
import time
from pathlib import Path

import anthropic
from dotenv import load_dotenv
from supabase import create_client

# 프로젝트 루트의 .env 로드
_project_root = Path(__file__).resolve().parent.parent.parent
load_dotenv(_project_root / ".env")

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]
BIBLE_DB_PATH = _project_root / "assets" / "bible" / "bible.db"
MODEL = "claude-sonnet-4-6"
MAX_RETRIES = 3
BATCH_SIZE = 50  # Supabase 배치 업로드

claude = anthropic.Anthropic()
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


# ─── DB 헬퍼 ────────────────────────────────────────────

def get_bible_db():
    return sqlite3.connect(str(BIBLE_DB_PATH))


def get_all_books():
    db = get_bible_db()
    rows = db.execute("SELECT id, name_ko, name_abbr, testament, chapter_count FROM books ORDER BY id").fetchall()
    db.close()
    return [{"id": r[0], "name_ko": r[1], "name_abbr": r[2], "testament": r[3], "chapter_count": r[4]} for r in rows]


def get_verses(book_id: int, chapter: int):
    db = get_bible_db()
    rows = db.execute(
        "SELECT verse, text FROM verses WHERE book_id = ? AND chapter = ? ORDER BY verse",
        (book_id, chapter),
    ).fetchall()
    db.close()
    return [{"verse": r[0], "text": r[1]} for r in rows]


# ─── 중복 체크 ──────────────────────────────────────────

def chapter_keywords_exist(book_name: str, chapter: int) -> bool:
    result = (
        supabase.table("verse_keywords")
        .select("id")
        .eq("book_name", book_name)
        .eq("chapter", chapter)
        .limit(1)
        .execute()
    )
    return len(result.data) > 0


# ─── Claude API: 장 단위 키워드 생성 ────────────────────

KEYWORDS_SYSTEM = """
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
""".strip()


def generate_chapter_keywords(book_name: str, chapter: int, verses: list) -> list | None:
    """한 장의 모든 절에 대한 키워드를 한 번에 생성."""
    verses_text = "\n".join([f"{v['verse']}절: {v['text']}" for v in verses])

    for attempt in range(MAX_RETRIES):
        try:
            response = claude.messages.create(
                model=MODEL,
                max_tokens=4000,
                system=KEYWORDS_SYSTEM,
                messages=[{
                    "role": "user",
                    "content": f"{book_name} {chapter}장의 각 절에 대한 검색 키워드를 생성해줘.\n\n{verses_text}",
                }],
            )
            raw = response.content[0].text.strip()

            # JSON 파싱 (코드블록 처리)
            try:
                return json.loads(raw)
            except json.JSONDecodeError:
                m = re.search(r"\[.*\]", raw, re.DOTALL)
                if m:
                    return json.loads(m.group())
                raise

        except json.JSONDecodeError:
            print(f"  ⚠ JSON 파싱 실패 (시도 {attempt + 1}/{MAX_RETRIES})")
        except Exception as e:
            print(f"  ⚠ API 오류 (시도 {attempt + 1}/{MAX_RETRIES}): {e}")

        if attempt < MAX_RETRIES - 1:
            time.sleep(2 ** (attempt + 1))

    return None


# ─── 메인 파이프라인 ─────────────────────────────────────

def process_chapter(book: dict, chapter: int):
    book_name = book["name_ko"]
    book_id = book["id"]

    if chapter_keywords_exist(book_name, chapter):
        return  # 조용히 스킵

    verses = get_verses(book_id, chapter)
    if not verses:
        return

    result = generate_chapter_keywords(book_name, chapter, verses)
    if not result:
        print(f"  ✗ 실패: {book_name} {chapter}장")
        return

    # Supabase 업로드 (배치)
    records = []
    for item in result:
        v = item.get("verse")
        kw = item.get("keywords", [])
        if v is None or not kw:
            continue
        records.append({
            "book_name": book_name,
            "chapter": chapter,
            "verse": v,
            "keywords": kw,
        })

    # 배치 업로드
    for i in range(0, len(records), BATCH_SIZE):
        batch = records[i : i + BATCH_SIZE]
        supabase.table("verse_keywords").insert(batch).execute()


def process_book(book: dict):
    book_name = book["name_ko"]
    total = book["chapter_count"]

    for ch in range(1, total + 1):
        pct = ch / total * 100
        print(f"  {ch}/{total} ({pct:.0f}%) — {book_name}", end="\r")
        process_chapter(book, ch)

    print(f"  ✓ {book_name} — {total}장 완료" + " " * 20)


def main():
    parser = argparse.ArgumentParser(description="성경 절별 키워드 생성 → Supabase")
    parser.add_argument("--all", action="store_true", help="전체 66권")
    parser.add_argument("--book", help="특정 권 이름 (예: 요한복음)")
    args = parser.parse_args()

    if not args.all and not args.book:
        parser.print_help()
        sys.exit(1)

    books = get_all_books()

    if args.book:
        matched = [b for b in books if b["name_ko"] == args.book]
        if not matched:
            print(f"'{args.book}' 권을 찾을 수 없습니다.")
            print("가능한 권:", ", ".join(b["name_ko"] for b in books[:10]), "...")
            sys.exit(1)
        books = matched

    print(f"\n{'='*60}")
    print(f"키워드 생성: {len(books)}권")
    total_chapters = sum(b["chapter_count"] for b in books)
    print(f"총 {total_chapters}장 (약 {total_chapters}회 API 호출)")
    print(f"{'='*60}")

    for i, book in enumerate(books):
        print(f"\n[{i+1}/{len(books)}] {book['name_ko']} ({book['chapter_count']}장)")
        process_book(book)

    print(f"\n{'='*60}")
    print("✅ 완료!")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()

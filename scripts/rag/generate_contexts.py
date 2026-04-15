#!/usr/bin/env python3
"""
generate_contexts.py — 성경 66권 + 1,189장 + 단락별 맥락 설명 생성 → Supabase 업로드

사용법:
  python generate_contexts.py --all
  python generate_contexts.py --book 요한복음
  python generate_contexts.py --book 요한복음 --chapter 1
"""

import argparse
import json
import os
import re
import sqlite3
import sys
import time
from pathlib import Path
from typing import Optional

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


def get_sections(book_id: int, chapter: int):
    db = get_bible_db()
    rows = db.execute(
        "SELECT start_verse, end_verse, title FROM sections WHERE book_id = ? AND chapter = ? ORDER BY start_verse",
        (book_id, chapter),
    ).fetchall()
    db.close()
    return [{"start_verse": r[0], "end_verse": r[1], "title": r[2]} for r in rows]


# ─── Claude API 호출 (재시도 포함) ───────────────────────

def call_claude(system_prompt: str, user_prompt: str) -> str:
    for attempt in range(MAX_RETRIES):
        try:
            response = claude.messages.create(
                model=MODEL,
                max_tokens=2000,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
            )
            return response.content[0].text.strip()
        except Exception as e:
            print(f"  ⚠ API 오류 (시도 {attempt + 1}/{MAX_RETRIES}): {e}")
            if attempt < MAX_RETRIES - 1:
                time.sleep(2 ** (attempt + 1))
    return ""


# ─── Supabase 중복 체크 ─────────────────────────────────

def book_context_exists(book_name: str) -> bool:
    result = supabase.table("book_contexts").select("id").eq("book_name", book_name).execute()
    return len(result.data) > 0


def chapter_context_exists(book_name: str, chapter: int) -> bool:
    result = supabase.table("chapter_contexts").select("id").eq("book_name", book_name).eq("chapter", chapter).execute()
    return len(result.data) > 0


def pericope_context_exists(book_name: str, chapter: int, start_verse: int) -> bool:
    result = (
        supabase.table("pericope_contexts")
        .select("id")
        .eq("book_name", book_name)
        .eq("chapter", chapter)
        .eq("start_verse", start_verse)
        .execute()
    )
    return len(result.data) > 0


# ─── 1. 권 맥락 생성 (66권) ─────────────────────────────

BOOK_SYSTEM = """
성경 묵상 앱의 맥락 데이터를 생성한다.
개혁주의 성경신학 관점에서 아래 항목을 포함하여 해당 권을 설명하라:

- 저자, 기록 시기, 원독자
- 이 권의 핵심 목적과 주제
- 전체 구속사(redemptive history)에서의 위치
- 구조 개요 (주요 단락 구분)
- 다른 성경 권과의 연결

800-1,500자. 설교 톤 금지. 학술적이되 읽기 쉬운 문체.
""".strip()


def generate_book_context(book: dict):
    book_name = book["name_ko"]
    testament = book["testament"]

    if book_context_exists(book_name):
        print(f"  ↳ 이미 존재, 스킵: {book_name}")
        return

    context = call_claude(BOOK_SYSTEM, f"{book_name}의 권 맥락(book context)을 작성해줘.")
    if not context:
        print(f"  ✗ 실패: {book_name}")
        return

    supabase.table("book_contexts").insert({
        "book_name": book_name,
        "testament": "old" if testament == "old" else "new",
        "context": context,
    }).execute()
    print(f"  ✓ {book_name}")


# ─── 2. 장 맥락 생성 (약 1,189장) ───────────────────────

CHAPTER_SYSTEM = """
성경 묵상 앱의 장 맥락 데이터를 생성한다.
개혁주의 성경신학 관점에서:

- 이 장이 해당 권 전체에서 어디에 위치하는지
- 앞 장과의 연결, 뒤 장으로의 흐름
- 이 장의 핵심 내용과 구조

400-800자. 설교 톤 금지. 학술적이되 읽기 쉬운 문체.
""".strip()


def generate_chapter_context(book: dict, chapter: int):
    book_name = book["name_ko"]

    if chapter_context_exists(book_name, chapter):
        return  # 조용히 스킵

    context = call_claude(
        CHAPTER_SYSTEM,
        f"{book_name} {chapter}장의 장 맥락(chapter context)을 작성해줘. (전체 {book['chapter_count']}장 중)",
    )
    if not context:
        return

    supabase.table("chapter_contexts").insert({
        "book_name": book_name,
        "chapter": chapter,
        "context": context,
    }).execute()


# ─── 3. 단락(페리코프) 맥락 생성 ────────────────────────

PERICOPE_SYSTEM = """
성경 묵상 앱의 단락(페리코프) 맥락 데이터를 생성한다.
개혁주의 성경신학 관점에서:

- 이 단락이 해당 장에서 어떤 역할을 하는지
- 앞뒤 단락과의 흐름
- 핵심 신학적 포인트

200-400자. 설교 톤 금지. 학술적이되 읽기 쉬운 문체.
""".strip()


def generate_pericope_context(book: dict, chapter: int, section: dict):
    book_name = book["name_ko"]
    sv, ev = section["start_verse"], section["end_verse"]
    title = section["title"] or ""

    if pericope_context_exists(book_name, chapter, sv):
        return

    context = call_claude(
        PERICOPE_SYSTEM,
        f'{book_name} {chapter}장 {sv}-{ev}절 "{title}" 단락의 맥락을 작성해줘.',
    )
    if not context:
        return

    supabase.table("pericope_contexts").insert({
        "book_name": book_name,
        "chapter": chapter,
        "start_verse": sv,
        "end_verse": ev,
        "context": context,
    }).execute()


# ─── 메인 ───────────────────────────────────────────────

def process_book(book: dict, chapter_filter: Optional[int] = None):
    book_name = book["name_ko"]
    book_id = book["id"]

    # 권 맥락
    if chapter_filter is None:
        generate_book_context(book)

    # 장 + 단락 맥락
    chapters = [chapter_filter] if chapter_filter else range(1, book["chapter_count"] + 1)
    total = len(list(chapters))
    chapters = [chapter_filter] if chapter_filter else range(1, book["chapter_count"] + 1)

    for i, ch in enumerate(chapters):
        pct = (i + 1) / total * 100
        print(f"  장 {ch}/{book['chapter_count']} ({pct:.0f}%) — {book_name}", end="\r")

        generate_chapter_context(book, ch)

        # 단락
        sections = get_sections(book_id, ch)
        for sec in sections:
            generate_pericope_context(book, ch, sec)

    print(f"  ✓ {book_name} — {total}장 완료" + " " * 20)


def main():
    parser = argparse.ArgumentParser(description="성경 맥락 데이터 생성 → Supabase")
    parser.add_argument("--all", action="store_true", help="전체 66권")
    parser.add_argument("--book", help="특정 권 이름 (예: 요한복음)")
    parser.add_argument("--chapter", type=int, help="특정 장 (--book 필요)")
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
    print(f"맥락 데이터 생성: {len(books)}권")
    print(f"{'='*60}")

    for i, book in enumerate(books):
        print(f"\n[{i+1}/{len(books)}] {book['name_ko']} ({book['chapter_count']}장)")
        process_book(book, args.chapter)

    print(f"\n{'='*60}")
    print("✅ 완료!")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()

// 태그 정규화: '#' 제거, 트림, 내부 공백 → 하이픈, 소문자화(라틴만), 중복 제거.
// '#기록 습관' → '기록-습관'
export function normalizeTag(raw: string): string {
  return raw
    .trim()
    .replace(/^#+/, '')
    .replace(/\s+/g, '-')
    .toLowerCase();
}

export function normalizeTags(raws: string[]): string[] {
  const out: string[] = [];
  for (const raw of raws) {
    const t = normalizeTag(raw);
    if (t.length > 0 && !out.includes(t)) out.push(t);
  }
  return out;
}

// 본문 속 #해시태그 추출 — Drafts에서 쓰던 손버릇 그대로.
export function extractHashtags(text: string): string[] {
  const matches = text.matchAll(/#([\p{L}\p{N}_-]+)/gu);
  return normalizeTags(Array.from(matches, (m) => m[1]));
}

// 태그 입력 필드 파싱: 쉼표·공백 구분, '#' 유무 무관
export function parseTagInput(input: string): string[] {
  return normalizeTags(input.split(/[\s,]+/));
}

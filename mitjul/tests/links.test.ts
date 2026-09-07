import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalLinkUrl,
  extractFirstUrl,
  looksCompleteUrl,
  oembedUrl,
  parsePageMeta,
  parseTimestamp,
  parseVideoLink,
} from '../src/core/links';

test('유튜브 — 어떤 형태로 붙여넣어도 같은 영상은 같은 정체', () => {
  const forms = [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ?si=abc123',
    'https://m.youtube.com/watch?v=dQw4w9WgXcQ&feature=share',
    'https://www.youtube.com/shorts/dQw4w9WgXcQ',
    'https://www.youtube.com/embed/dQw4w9WgXcQ',
    'https://music.youtube.com/watch?v=dQw4w9WgXcQ&list=RD',
  ];
  for (const f of forms) {
    const v = parseVideoLink(f);
    assert.ok(v, f);
    assert.equal(v.provider, 'youtube');
    assert.equal(v.id, 'dQw4w9WgXcQ');
    assert.equal(v.canonicalUrl, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    assert.equal(v.thumbnailUrl, 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
    assert.ok(v.embedUrl.startsWith('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?'));
  }
});

test('유튜브 — 시점이 있는 링크는 임베드에 start로 넘어간다', () => {
  const v = parseVideoLink('https://youtu.be/dQw4w9WgXcQ?t=1m30s');
  assert.ok(v);
  assert.equal(v.startSeconds, 90);
  assert.ok(v.embedUrl.includes('start=90'));
  assert.equal(parseVideoLink('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=125')?.startSeconds, 125);
  assert.equal(parseVideoLink('https://www.youtube.com/watch?v=dQw4w9WgXcQ')?.startSeconds, null);
});

test('공유 시트 텍스트 — "제목 https://..." 에서 링크만 집는다', () => {
  const v = parseVideoLink('왜 기록하는가 | 어느 채널 https://youtu.be/dQw4w9WgXcQ 꼭 봐.');
  assert.equal(v?.id, 'dQw4w9WgXcQ');
  assert.equal(extractFirstUrl('링크 없음'), null);
  assert.equal(extractFirstUrl('보기: https://example.com/a?b=1.'), 'https://example.com/a?b=1');
});

test('비메오', () => {
  const v = parseVideoLink('https://vimeo.com/76979871#t=45s');
  assert.ok(v);
  assert.equal(v.provider, 'vimeo');
  assert.equal(v.id, '76979871');
  assert.equal(v.canonicalUrl, 'https://vimeo.com/76979871');
  assert.equal(v.startSeconds, 45);
  assert.equal(v.thumbnailUrl, null);
  assert.equal(parseVideoLink('https://player.vimeo.com/video/76979871')?.id, '76979871');
  assert.ok(oembedUrl(v).startsWith('https://vimeo.com/api/oembed.json?url='));
});

test('영상이 아닌 링크·잘못된 식별자는 null', () => {
  assert.equal(parseVideoLink('https://example.com/watch?v=abc'), null);
  assert.equal(parseVideoLink('https://www.youtube.com/watch?v=tooshort'), null);
  assert.equal(parseVideoLink('https://www.youtube.com/@RickAstleyYT'), null);
  assert.equal(parseVideoLink('그냥 글'), null);
  assert.equal(parseVideoLink(''), null);
});

test('시점 표기', () => {
  assert.equal(parseTimestamp('90'), 90);
  assert.equal(parseTimestamp('1h2m3s'), 3723);
  assert.equal(parseTimestamp('2m'), 120);
  assert.equal(parseTimestamp('abc'), null);
  assert.equal(parseTimestamp(null), null);
});

test('일반 페이지 — og 태그와 <title>에서 제목·사이트·이미지', () => {
  const html = `<html><head><title>낙관론자의 &quot;기록&quot;</title>
    <meta property="og:site_name" content="브런치">
    <meta content="https://img.example.com/og.jpg" property="og:image" />
    <meta property="og:title" content="기록하는 사람 &amp; 다시 읽는 사람" /></head></html>`;
  const m = parsePageMeta(html);
  assert.equal(m.title, '기록하는 사람 & 다시 읽는 사람');
  assert.equal(m.siteName, '브런치');
  assert.equal(m.imageUrl, 'https://img.example.com/og.jpg');
  assert.equal(parsePageMeta('<html><head><title> 제목만 </title></head></html>').title, '제목만');
  assert.deepEqual(parsePageMeta('<p>없음</p>'), { title: null, siteName: null, imageUrl: null });
});

test('링크에 한글·CJK 문장부호·따옴표가 붙어 와도 링크만 집는다', () => {
  for (const s of [
    'https://youtu.be/dQw4w9WgXcQ입니다',
    '「https://youtu.be/dQw4w9WgXcQ」',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ』 꼭 봐',
    'https://youtu.be/dQw4w9WgXcQ。',
    '“https://youtu.be/dQw4w9WgXcQ”',
    '(https://youtu.be/dQw4w9WgXcQ）',
  ]) {
    assert.equal(parseVideoLink(s)?.id, 'dQw4w9WgXcQ', s);
  }
});

test('스킴 없이 적은 링크도 알아본다', () => {
  assert.equal(extractFirstUrl('youtu.be/dQw4w9WgXcQ'), 'https://youtu.be/dQw4w9WgXcQ');
  assert.equal(parseVideoLink('www.youtube.com/watch?v=dQw4w9WgXcQ')?.id, 'dQw4w9WgXcQ');
  assert.equal(extractFirstUrl('example.com/a'), null);
});

test('치는 중인 주소는 아직 링크가 아니다', () => {
  assert.equal(looksCompleteUrl('https://y'), false);
  assert.equal(looksCompleteUrl('https://tv.naver.c'), false);
  assert.equal(looksCompleteUrl('https://tv.naver.com/v/1'), true);
  assert.equal(looksCompleteUrl('not a url'), false);
});

test('정규형 — 영상은 식별자로, 그 밖은 추적 꼬리를 떼고', () => {
  assert.equal(canonicalLinkUrl('https://youtu.be/dQw4w9WgXcQ?si=abc&t=90'), 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.equal(canonicalLinkUrl('https://blog.example.com/p/1?utm_source=x&id=2'), 'https://blog.example.com/p/1?id=2');
});

test('비메오 — 비공개 해시·채널·쇼케이스 주소', () => {
  const unlisted = parseVideoLink('https://vimeo.com/76979871/abcdef1234');
  assert.equal(unlisted?.canonicalUrl, 'https://vimeo.com/76979871/abcdef1234');
  assert.ok(unlisted?.embedUrl.includes('h=abcdef1234'));
  assert.equal(parseVideoLink('https://vimeo.com/channels/staffpicks/76979871')?.id, '76979871');
  assert.equal(parseVideoLink('https://vimeo.com/showcase/123/video/76979871')?.id, '76979871');
  assert.equal(parseVideoLink('https://vimeo.com/groups/foo/videos/76979871')?.id, '76979871');
  assert.equal(parseVideoLink('https://vimeo.com/showcase/8765432'), null);
});

test('og 태그 — 값 안의 따옴표·16진 엔티티', () => {
  assert.equal(parsePageMeta(`<meta property="og:title" content="Why We Can't Stop Recording">`).title, "Why We Can't Stop Recording");
  assert.equal(parsePageMeta(`<meta property='og:title' content='He said "hi" today'>`).title, 'He said "hi" today');
  assert.equal(parsePageMeta(`<meta property="og:title" content="Don&#x27;t Panic &amp; Read&nbsp;">`).title, "Don't Panic & Read");
  assert.equal(parsePageMeta(`<meta property="og:title" content="&amp;#39;">`).title, '&#39;');
});

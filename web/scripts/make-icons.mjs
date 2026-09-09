// 아이콘은 그림 파일이 아니라 코드다 — 색을 바꾸면 여기서 바꾸고 다시 돌린다.
// 표식: 검은 지면 위 세로 괘선 하나와 그 오른쪽에 줄지어 그어진 기입선들.
// 원장(ledger)이 그렇게 생겼다 — 선이 먼저 있고, 적히는 것은 그 옆에 쌓인다.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const INK = [0x0e, 0x11, 0x16];
const PAPER = [0xff, 0xff, 0xff];
const MUTED = [0x5b, 0x64, 0x72];

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, pixel) {
  const stride = size * 3 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel(x / size, y / size);
      const o = y * stride + 1 + x * 3;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// u, v는 0..1. 세로 괘선 하나 + 기입선 셋. 맨 아래 것만 흰색 — 오늘 적은 줄이다.
const bar = (u, v, x0, x1, y0, y1) => u >= x0 && u < x1 && v >= y0 && v < y1;
function mark(u, v) {
  if (bar(u, v, 0.3, 0.345, 0.22, 0.78)) return PAPER;
  if (bar(u, v, 0.43, 0.76, 0.3, 0.35)) return MUTED;
  if (bar(u, v, 0.43, 0.67, 0.475, 0.525)) return MUTED;
  if (bar(u, v, 0.43, 0.72, 0.65, 0.7)) return PAPER;
  return INK;
}

// 마스크 가능 아이콘은 안전 영역(가운데 80%)에 표식이 들어가야 한다
function maskable(u, v) {
  return mark(0.5 + (u - 0.5) / 0.8, 0.5 + (v - 0.5) / 0.8);
}

const out = fileURLToPath(new URL('../public/', import.meta.url));
mkdirSync(out, { recursive: true });
const files = [
  ['icon-180.png', 180, mark],
  ['icon-192.png', 192, mark],
  ['icon-512.png', 512, mark],
  ['icon-maskable-512.png', 512, maskable],
];
for (const [name, size, fn] of files) {
  writeFileSync(out + name, png(size, fn));
  console.log(name, size);
}

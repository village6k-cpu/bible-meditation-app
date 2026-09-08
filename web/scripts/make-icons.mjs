// 아이콘은 그림 파일이 아니라 코드다 — 색을 바꾸면 여기서 바꾸고 다시 돌린다.
// 표식: 검은 지면 위 두 줄의 글, 그 아래 그어진 흰 밑줄.
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

// u, v는 0..1. 글 두 줄과 그 아래 밑줄 하나.
const bar = (u, v, x0, x1, y0, y1) => u >= x0 && u < x1 && v >= y0 && v < y1;
function mark(u, v) {
  if (bar(u, v, 0.24, 0.7, 0.34, 0.4)) return MUTED;
  if (bar(u, v, 0.24, 0.58, 0.46, 0.52)) return MUTED;
  if (bar(u, v, 0.24, 0.76, 0.62, 0.68)) return PAPER;
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

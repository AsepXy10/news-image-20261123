// World News in One Image — Monday 23 November 2026.
//
// A Node 22 program (standard library only) that draws a 1024x1024 PNG
// summing up the day's world news. Everything is drawn by hand in this
// file: a 5x7 bitmap font, simple vector icons, and a hand-built PNG
// encoder. No network, no external assets, no dates or randomness, so
// every run writes exactly the same bytes.
//
// Run: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

// ---------------------------------------------------------------------------
// 5x7 bitmap font. Each glyph is 7 rows of 5 cells; '#' is ink, '.' is empty.
// ---------------------------------------------------------------------------
type Glyph = string[];

const FONT: Record<string, Glyph> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
};

Object.assign(FONT, {
  a: ['.....', '.....', '.###.', '....#', '.####', '#...#', '.####'],
  b: ['#....', '#....', '####.', '#...#', '#...#', '#...#', '####.'],
  c: ['.....', '.....', '.###.', '#....', '#....', '#...#', '.###.'],
  d: ['....#', '....#', '.####', '#...#', '#...#', '#...#', '.####'],
  e: ['.....', '.....', '.###.', '#...#', '#####', '#....', '.###.'],
  f: ['..##.', '.#...', '.#...', '####.', '.#...', '.#...', '.#...'],
  g: ['.....', '.####', '#...#', '#...#', '.####', '....#', '.###.'],
  h: ['#....', '#....', '####.', '#...#', '#...#', '#...#', '#...#'],
  i: ['..#..', '.....', '.##..', '..#..', '..#..', '..#..', '.###.'],
  j: ['...#.', '.....', '..##.', '...#.', '...#.', '#..#.', '.##..'],
  k: ['#....', '#....', '#..#.', '#.#..', '##...', '#.#..', '#..#.'],
  l: ['.##..', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  m: ['.....', '.....', '##.#.', '#.#.#', '#.#.#', '#.#.#', '#.#.#'],
  n: ['.....', '.....', '####.', '#...#', '#...#', '#...#', '#...#'],
  o: ['.....', '.....', '.###.', '#...#', '#...#', '#...#', '.###.'],
  p: ['.....', '.....', '####.', '#...#', '#...#', '####.', '#....'],
  q: ['.....', '.....', '.####', '#...#', '#...#', '.####', '....#'],
  r: ['.....', '.....', '#.##.', '##..#', '#....', '#....', '#....'],
  s: ['.....', '.....', '.####', '#....', '.###.', '....#', '####.'],
  t: ['..#..', '..#..', '.###.', '..#..', '..#..', '..#..', '...#.'],
  u: ['.....', '.....', '#...#', '#...#', '#...#', '#..##', '.##.#'],
  v: ['.....', '.....', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  w: ['.....', '.....', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
  x: ['.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  y: ['.....', '.....', '#...#', '#...#', '.####', '....#', '.###.'],
  z: ['.....', '.....', '#####', '...#.', '..#..', '.#...', '#####'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  ',': ['.....', '.....', '.....', '.....', '.##..', '..#..', '.#...'],
  ':': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'],
  ';': ['.....', '.##..', '.##..', '.....', '.##..', '..#..', '.#...'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  "'": ['..#..', '..#..', '.#...', '.....', '.....', '.....', '.....'],
  '"': ['.#.#.', '.#.#.', '.....', '.....', '.....', '.....', '.....'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  '(': ['...#.', '..#..', '.#...', '.#...', '.#...', '..#..', '...#.'],
  ')': ['.#...', '..#..', '...#.', '...#.', '...#.', '..#..', '.#...'],
  '/': ['....#', '...#.', '...#.', '..#..', '.#...', '.#...', '#....'],
  '%': ['##..#', '##.#.', '...#.', '..#..', '.#...', '#.##.', '#..##'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '=': ['.....', '.....', '#####', '.....', '#####', '.....', '.....'],
  '&': ['.##..', '#..#.', '#.#..', '.#...', '#.#.#', '#..#.', '.##.#'],
  $: ['..#..', '.####', '#.#..', '.###.', '..#.#', '####.', '..#..'],
  '#': ['.#.#.', '.#.#.', '#####', '.#.#.', '#####', '.#.#.', '.#.#.'],
  '*': ['.....', '#.#.#', '.###.', '#.#.#', '.....', '.....', '.....'],
  _: ['.....', '.....', '.....', '.....', '.....', '.....', '#####'],
  '@': ['.###.', '#...#', '#.###', '#.#.#', '#.##.', '#....', '.###.'],
  '[': ['.###.', '.#...', '.#...', '.#...', '.#...', '.#...', '.###.'],
  ']': ['.###.', '...#.', '...#.', '...#.', '...#.', '...#.', '.###.'],
  '\u2022': ['.....', '.....', '.##..', '.##..', '.....', '.....', '.....'],
});

const FALLBACK: Glyph = ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'];

// Turn curly quotes, long dashes and ellipses into plain ASCII the font has.
function clean(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00b7/g, '\u2022');
}

function glyphFor(ch: string): Glyph {
  return FONT[ch] ?? FALLBACK;
}

// ---------------------------------------------------------------------------
// Canvas: a plain RGB byte buffer with clipping drawing helpers.
// ---------------------------------------------------------------------------
type RGB = [number, number, number];

interface Canvas {
  data: Uint8Array;
  w: number;
  h: number;
}

function makeCanvas(w: number, h: number, bg: RGB): Canvas {
  const data = new Uint8Array(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    data[i * 3] = bg[0];
    data[i * 3 + 1] = bg[1];
    data[i * 3 + 2] = bg[2];
  }
  return { data, w, h };
}

function setPixel(c: Canvas, x: number, y: number, color: RGB): void {
  if (x < 0 || y < 0 || x >= c.w || y >= c.h) return;
  const i = (y * c.w + x) * 3;
  c.data[i] = color[0];
  c.data[i + 1] = color[1];
  c.data[i + 2] = color[2];
}

function fillRect(c: Canvas, x: number, y: number, w: number, h: number, color: RGB): void {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(c.w, x + w);
  const y1 = Math.min(c.h, y + h);
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const i = (yy * c.w + xx) * 3;
      c.data[i] = color[0];
      c.data[i + 1] = color[1];
      c.data[i + 2] = color[2];
    }
  }
}

// Bresenham line, integer only.
function drawLine(c: Canvas, x0: number, y0: number, x1: number, y1: number, color: RGB): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    setPixel(c, x, y, color);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

function thickLine(c: Canvas, x0: number, y0: number, x1: number, y1: number, color: RGB): void {
  drawLine(c, x0, y0, x1, y1, color);
  drawLine(c, x0 + 1, y0, x1 + 1, y1, color);
  drawLine(c, x0, y0 + 1, x1, y1 + 1, color);
}

// Midpoint circle outline, integer only.
function circleOutline(c: Canvas, cx: number, cy: number, r: number, color: RGB): void {
  let x = r;
  let y = 0;
  let err = 0;
  while (x >= y) {
    setPixel(c, cx + x, cy + y, color);
    setPixel(c, cx + y, cy + x, color);
    setPixel(c, cx - y, cy + x, color);
    setPixel(c, cx - x, cy + y, color);
    setPixel(c, cx - x, cy - y, color);
    setPixel(c, cx - y, cy - x, color);
    setPixel(c, cx + y, cy - x, color);
    setPixel(c, cx + x, cy - y, color);
    y += 1;
    err += 1 + 2 * y;
    if (2 * (err - x) + 1 > 0) {
      x -= 1;
      err += 1 - 2 * x;
    }
  }
}

function fillCircle(c: Canvas, cx: number, cy: number, r: number, color: RGB): void {
  for (let dy = -r; dy <= r; dy++) {
    const dx = Math.floor(Math.sqrt(r * r - dy * dy));
    fillRect(c, cx - dx, cy + dy, 2 * dx + 1, 1, color);
  }
}

// ---------------------------------------------------------------------------
// Text: draw and measure in the 5x7 font at any integer scale.
// ---------------------------------------------------------------------------
const advance = (scale: number): number => 6 * scale;
const lineHeight = (scale: number): number => 7 * scale + 2;

function textWidth(text: string, scale: number): number {
  const t = clean(text);
  if (t.length === 0) return 0;
  return t.length * advance(scale) - scale;
}

function drawText(c: Canvas, x: number, y: number, text: string, scale: number, color: RGB): void {
  let cx = x;
  for (const ch of clean(text)) {
    const g = glyphFor(ch);
    for (let r = 0; r < 7; r++) {
      const row = g[r];
      for (let col = 0; col < 5; col++) {
        if (row[col] === '#') {
          fillRect(c, cx + col * scale, y + r * scale, scale, scale, color);
        }
      }
    }
    cx += advance(scale);
  }
}

function drawTextCentered(c: Canvas, cx: number, y: number, text: string, scale: number, color: RGB): void {
  drawText(c, cx - Math.floor(textWidth(text, scale) / 2), y, text, scale, color);
}

function wrapText(text: string, maxWidth: number, scale: number): string[] {
  const words = clean(text).split(/\s+/).filter((w) => w.length > 0);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const trial = line === '' ? w : line + ' ' + w;
    if (textWidth(trial, scale) <= maxWidth || line === '') {
      line = trial;
    } else {
      lines.push(line);
      line = w;
    }
  }
  if (line !== '') lines.push(line);
  return lines;
}

// ---------------------------------------------------------------------------
// Small pictogram icons, drawn with the same integer primitives.
// Each draws inside a 40x40 box at (x, y) in one accent colour.
// ---------------------------------------------------------------------------
type IconName = 'warning' | 'chart' | 'globe' | 'venn' | 'pill' | 'storm';

function drawIcon(c: Canvas, name: IconName, x: number, y: number, color: RGB, ink: RGB): void {
  const cx = x + 20;
  const cy = y + 20;
  if (name === 'warning') {
    // Triangle with an exclamation mark.
    thickLine(c, cx, y + 3, x + 38, y + 37, color);
    thickLine(c, x + 38, y + 37, x + 2, y + 37, color);
    thickLine(c, x + 2, y + 37, cx, y + 3, color);
    fillRect(c, cx - 2, y + 15, 4, 12, color);
    fillRect(c, cx - 2, y + 30, 4, 4, color);
  } else if (name === 'chart') {
    // Four falling bars and a down arrow.
    const heights = [34, 26, 18, 10];
    for (let i = 0; i < 4; i++) {
      fillRect(c, x + 3 + i * 10, y + 38 - heights[i], 7, heights[i], color);
    }
    thickLine(c, x + 4, y + 4, x + 36, y + 34, ink);
    fillRect(c, x + 32, y + 26, 8, 3, ink);
    fillRect(c, x + 35, y + 29, 3, 8, ink);
  } else if (name === 'globe') {
    // Circle with equator, meridian and two chords.
    circleOutline(c, cx, cy, 18, color);
    drawLine(c, x + 2, cy, x + 38, cy, color);
    drawLine(c, cx, y + 2, cx, y + 38, color);
    drawLine(c, cx - 15, y + 10, cx + 15, y + 10, color);
    drawLine(c, cx - 15, y + 30, cx + 15, y + 30, color);
  } else if (name === 'venn') {
    // Two overlapping circles: talks.
    circleOutline(c, cx - 8, cy, 13, color);
    circleOutline(c, cx + 8, cy, 13, color);
  } else if (name === 'pill') {
    // Capsule, left half filled.
    fillCircle(c, x + 11, cy, 8, color);
    fillCircle(c, x + 29, cy, 8, [255, 253, 247]);
    fillRect(c, x + 11, cy - 8, 18, 16, color);
    fillRect(c, x + 20, cy - 8, 9, 16, [255, 253, 247]);
    circleOutline(c, x + 11, cy, 8, ink);
    circleOutline(c, x + 29, cy, 8, ink);
    drawLine(c, x + 11, cy - 8, x + 29, cy - 8, ink);
    drawLine(c, x + 11, cy + 8, x + 29, cy + 8, ink);
  } else {
    // Concentric rings: a storm.
    circleOutline(c, cx, cy, 18, color);
    circleOutline(c, cx, cy, 12, color);
    circleOutline(c, cx, cy, 6, color);
    fillCircle(c, cx, cy, 2, color);
  }
}

// ---------------------------------------------------------------------------
// PNG encoder, built by hand: signature, IHDR, one IDAT, IEND.
// zlib's deflate is deterministic for fixed input and level, so two runs
// of this program write identical bytes.
// ---------------------------------------------------------------------------
const CRC_TABLE: number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let v = n;
    for (let k = 0; k < 8; k++) {
      v = v & 1 ? 0xedb88320 ^ (v >>> 1) : v >>> 1;
    }
    table.push(v >>> 0);
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let v = 0xffffffff;
  for (const b of buf) {
    v = CRC_TABLE[(v ^ b) & 0xff] ^ (v >>> 8);
  }
  return (v ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(w: number, h: number, rgb: Uint8Array): Buffer {
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0; // filter: none
    raw.set(rgb.subarray(y * w * 3, (y + 1) * w * 3), y * (1 + w * 3) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// The day's news, Monday 23 November 2026. Each story was checked against
// live reporting this morning (Reuters, AP, BBC, Al Jazeera, Japan Times, Euronews).
// ---------------------------------------------------------------------------
const PAPER: RGB = [246, 241, 229];
const INK: RGB = [22, 19, 14];
const CARD: RGB = [255, 253, 247];
const BODY: RGB = [58, 52, 42];
const MUTED: RGB = [74, 68, 56];
const RED: RGB = [179, 39, 30];
const BLUE: RGB = [29, 78, 137];
const GREEN: RGB = [31, 122, 77];
const PURPLE: RGB = [91, 58, 142];
const TEAL: RGB = [14, 124, 123];
const ORANGE: RGB = [194, 94, 16];

interface Card {
  tag: string;
  color: RGB;
  icon: IconName;
  headline: string;
  body: string;
}

const CARDS: Card[] = [
  {
    tag: 'CLIMATE \u2022 COP31',
    color: GREEN,
    icon: 'globe',
    headline: 'COP31 COLLAPSES WITHOUT A DEAL',
    body: 'COP31 in Antalya ended with no deal, the first failure since 2009, as oil states blocked a phase-out.',
  },
  {
    tag: 'GULF \u2022 IRAN',
    color: RED,
    icon: 'warning',
    headline: 'IRAN STRIKES BAHRAIN, GULF TANKERS',
    body: 'Bahrain says Iran hit a civilian site, wounding two. The US hit an Iranian oil tanker near Hormuz.',
  },
  {
    tag: 'UKRAINE \u2022 WAR',
    color: PURPLE,
    icon: 'venn',
    headline: 'RUSSIAN DRONES HIT KYIV REGION',
    body: 'A Russian drone strike on Kyiv region killed at least four; Kyiv hit Russian ships in Libya.',
  },
  {
    tag: 'WALL STREET',
    color: BLUE,
    icon: 'chart',
    headline: 'STOCKS REBOUND AFTER AI ROUT',
    body: 'US stock futures rebounded after an AI-driven tech rout sent the S&P and Nasdaq into correction.',
  },
  {
    tag: 'SPACE \u2022 SCIENCE',
    color: TEAL,
    icon: 'globe',
    headline: 'BEPICOLOMBO REACHES MERCURY',
    body: 'Europe and Japan\'s BepiColombo probe began orbiting Mercury, though controllers reported a glitch.',
  },
  {
    tag: 'US \u2022 IRAN',
    color: ORANGE,
    icon: 'warning',
    headline: "TRUMP: PERMANENT DEAL OR STRIKES",
    body: 'Trump demands a permanent Iran nuclear deal or warns of major strikes after the new year.',
  },
];

const FOOTER: string[] = [
  'ALSO: NETANYAHU AND EISENKOT END COALITION TALKS WITHOUT A DEAL',
  'ALSO: SAUDI ARABIA ORDERS 50% SAUDIZATION IN 17 FINANCIAL JOBS FROM MAY 2027',
  'ALSO: BRITAIN TO BUILD UKRAINIAN DRONES IN A JOINT PROJECT',
  'SOURCES: REUTERS, AP, BBC, AL JAZEERA, JAPAN TIMES, EURONEWS',
];

// ---------------------------------------------------------------------------
// Layout: 1024x1024. Masthead, date, a 2x3 grid of story cards, footer.
// ---------------------------------------------------------------------------
const W = 1024;
const H = 1024;
const MARGIN = 28;
const CARD_W = 476;
const CARD_H = 245;
const GAP_X = 16;
const GAP_Y = 14;

function drawCard(c: Canvas, x: number, y: number, card: Card): void {
  fillRect(c, x, y, CARD_W, CARD_H, CARD);
  fillRect(c, x, y, CARD_W, 2, INK);
  fillRect(c, x, y + CARD_H - 2, CARD_W, 2, INK);
  fillRect(c, x, y, 2, CARD_H, INK);
  fillRect(c, x + CARD_W - 2, y, 2, CARD_H, INK);
  // Tag and icon.
  drawText(c, x + 16, y + 16, card.tag, 3, card.color);
  drawIcon(c, card.icon, x + CARD_W - 16 - 40, y + 12, card.color, INK);
  // Headline, up to two lines at scale 4.
  const headlineLines = wrapText(card.headline, CARD_W - 32, 4).slice(0, 2);
  headlineLines.forEach((line, i) => {
    drawText(c, x + 16, y + 54 + i * 30, line, 4, INK);
  });
  // Body, up to five lines at scale 3.
  const bodyLines = wrapText(card.body, CARD_W - 32, 3).slice(0, 5);
  bodyLines.forEach((line, i) => {
    drawText(c, x + 16, y + 118 + i * 22, line, 3, BODY);
  });
}

function main(): void {
  const c = makeCanvas(W, H, PAPER);
  // Masthead.
  drawTextCentered(c, W / 2, 30, 'WORLD NEWS', 6, INK);
  fillRect(c, MARGIN, 84, W - 2 * MARGIN, 4, RED);
  drawTextCentered(c, W / 2, 96, 'MONDAY, 23 NOVEMBER 2026', 4, INK);
  fillRect(c, MARGIN, 134, W - 2 * MARGIN, 2, INK);
  // Story cards, 2 columns x 3 rows.
  for (let i = 0; i < CARDS.length; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = MARGIN + col * (CARD_W + GAP_X);
    const y = 148 + row * (CARD_H + GAP_Y);
    drawCard(c, x, y, CARDS[i]);
  }
  // Footer.
  fillRect(c, MARGIN, 924, W - 2 * MARGIN, 2, INK);
  FOOTER.forEach((line, i) => {
    drawText(c, MARGIN, 934 + i * 16, line, 2, MUTED);
  });
  // Write the image.
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'entry.png'), encodePng(W, H, c.data));
}

main();

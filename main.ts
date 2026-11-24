// news-image-20261123: a program that draws a 1024x1024 PNG summing up
// Monday 23 November 2026's world news.
//
// Node 22, standard library only (node:fs, node:path, node:zlib).
// No network access at runtime, no external assets, no randomness.
// Everything is drawn by hand: a 5x7 bitmap font, simple vector
// shapes/icons, and a hand-built PNG encoder. Fully deterministic:
// two runs write byte-identical PNGs.
//
// Written as plain JavaScript (no TypeScript-only syntax) so it runs
// directly with `node main.ts` under Node's type stripping.
//
// Usage:  MAKEFUN_OUTPUT_DIR=out node main.ts
// Output: $MAKEFUN_OUTPUT_DIR/entry.png (default: out/entry.png)

import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------- palette
const PAPER = [248, 244, 234]; // warm newsprint
const CARD = [255, 255, 255]; // story card
const INK = [22, 22, 22]; // body text / rules
const NAVY = [20, 33, 61]; // masthead band
const GOLD = [232, 181, 77]; // masthead accent
const BODY = [74, 70, 60]; // summary text
const MUTED = [120, 114, 100]; // faint lines
const RED = [179, 38, 30];
const BLUE = [29, 78, 158];
const GREEN = [30, 122, 52];
const ORANGE = [198, 88, 18];
const PURPLE = [108, 58, 148];
const TEAL = [13, 118, 116];

// ---------------------------------------------------------------- canvas
// RGB buffer, 3 bytes per pixel, row-major.
const px = new Uint8Array(W * H * 3);

function fillAll(c) {
  for (let i = 0; i < W * H; i++) {
    px[i * 3] = c[0];
    px[i * 3 + 1] = c[1];
    px[i * 3 + 2] = c[2];
  }
}

function setPixel(x, y, c) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
}

function fillRect(x, y, w, h, c) {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(W, x + w);
  const y1 = Math.min(H, y + h);
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      setPixel(xx, yy, c);
    }
  }
}

// Outline of a rectangle, border thickness t.
function rectOutline(x, y, w, h, c, t) {
  fillRect(x, y, w, t, c);
  fillRect(x, y + h - t, w, t, c);
  fillRect(x, y, t, h, c);
  fillRect(x + w - t, y, t, h, c);
}

// Bresenham line, 1px.
function drawLine(x0, y0, x1, y1, c) {
  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    setPixel(x0, y0, c);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

// Line with stroke width w (drawn as w parallel 1px lines).
function drawLineW(x0, y0, x1, y1, w, c) {
  for (let i = 0; i < w; i++) {
    drawLine(x0, y0 + i, x1, y1 + i, c);
  }
}

function drawPolyline(pts, w, c) {
  for (let i = 0; i < pts.length - 1; i++) {
    drawLineW(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], w, c);
  }
}

// Midpoint circle outline.
function drawCircle(cx, cy, r, c) {
  let x = r;
  let y = 0;
  let err = 0;
  while (x >= y) {
    setPixel(cx + x, cy + y, c);
    setPixel(cx + y, cy + x, c);
    setPixel(cx - y, cy + x, c);
    setPixel(cx - x, cy + y, c);
    setPixel(cx - x, cy - y, c);
    setPixel(cx - y, cy - x, c);
    setPixel(cx + y, cy - x, c);
    setPixel(cx + x, cy - y, c);
    y += 1;
    if (err <= 0) err += 2 * y + 1;
    if (err > 0) {
      x -= 1;
      err -= 2 * x + 1;
    }
  }
}

// Filled circle, scanline by scanline.
function fillCircle(cx, cy, r, c) {
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.floor(Math.sqrt(r * r - dy * dy));
    fillRect(cx - half, cy + dy, 2 * half + 1, 1, c);
  }
}

// Axis-aligned ellipse outline, parametric.
function drawEllipse(cx, cy, rx, ry, c) {
  for (let a = 0; a < 360; a += 1) {
    const t = (a * Math.PI) / 180;
    setPixel(Math.round(cx + rx * Math.cos(t)), Math.round(cy + ry * Math.sin(t)), c);
  }
}

// Filled triangle, scanline fill.
function fillTriangle(x0, y0, x1, y1, x2, y2, c) {
  const minY = Math.min(y0, y1, y2);
  const maxY = Math.max(y0, y1, y2);
  const edges = [
    [x0, y0, x1, y1],
    [x1, y1, x2, y2],
    [x2, y2, x0, y0],
  ];
  for (let y = minY; y <= maxY; y++) {
    const xs = [];
    for (const e of edges) {
      const ax = e[0];
      const ay = e[1];
      const bx = e[2];
      const by = e[3];
      if ((ay <= y && by > y) || (by <= y && ay > y)) {
        xs.push(ax + ((y - ay) * (bx - ax)) / (by - ay));
      }
    }
    if (xs.length >= 2) {
      const a = Math.ceil(Math.min(xs[0], xs[1]));
      const b = Math.floor(Math.max(xs[0], xs[1]));
      if (b >= a) fillRect(a, y, b - a + 1, 1, c);
    }
  }
}

// Sine wave, 2px tall.
function drawWave(x, y, len, amp, period, c) {
  for (let i = 0; i <= len; i++) {
    const yy = Math.round(y + amp * Math.sin((i / period) * Math.PI * 2));
    setPixel(x + i, yy, c);
    setPixel(x + i, yy + 1, c);
  }
}

// ---------------------------------------------------------------- 5x7 font
// Each glyph: 7 rows of 5 cells, '#' = ink, '.' = empty. Uppercase,
// digits and common punctuation only; text is uppercased at render time.
const FONT = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  G: [".###.", "#...#", "#....", "#.###", "#...#", "#...#", ".####"],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: [".###.", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."],
  J: ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  N: ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "#.#.#", ".#.#."],
  X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  "0": [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "..##.", ".#...", "#....", "#####"],
  "3": ["#####", "...#.", "..#..", "...#.", "....#", "#...#", ".###."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": ["..##.", ".#...", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.."],
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
  ".": [".....", ".....", ".....", ".....", ".....", ".##..", ".##.."],
  ",": [".....", ".....", ".....", ".....", ".##..", "..#..", ".#..."],
  ":": [".....", ".##..", ".##..", ".....", ".##..", ".##..", "....."],
  ";": [".....", ".##..", ".##..", ".....", ".##..", "..#..", ".#..."],
  "-": [".....", ".....", ".....", ".###.", ".....", ".....", "....."],
  "'": ["..#..", "..#..", ".#...", ".....", ".....", ".....", "....."],
  "(": ["...#.", "..#..", ".#...", ".#...", ".#...", "..#..", "...#."],
  ")": [".#...", "..#..", "...#.", "...#.", "...#.", "..#..", ".#..."],
  "/": ["....#", "...#.", "...#.", "..#..", ".#...", ".#...", "#...."],
  "%": ["##..#", "##.#.", "...#.", "..#..", ".#...", "#.##.", "#..##"],
  "&": [".##..", "#..#.", "#.#..", ".#...", "#.#.#", "#..#.", ".##.#"],
  "+": [".....", "..#..", "..#..", "#####", "..#..", "..#..", "....."],
  "=": [".....", ".....", "#####", ".....", "#####", ".....", "....."],
  "?": [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."],
  "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
  '"': [".#.#.", ".#.#.", ".....", ".....", ".....", ".....", "....."],
  "[": [".###.", ".#...", ".#...", ".#...", ".#...", ".#...", ".###."],
  "]": [".###.", "...#.", "...#.", "...#.", "...#.", "...#.", ".###."],
  "*": [".....", "..#..", "#.#.#", ".###.", "#.#.#", "..#..", "....."],
  "<": ["...#.", "..#..", ".#...", "#....", ".#...", "..#..", "...#."],
  ">": [".#...", "..#..", "...#.", "....#", "...#.", "..#..", ".#..."],
  "#": [".#.#.", ".#.#.", "#####", ".#.#.", "#####", ".#.#.", ".#.#."],
  $: ["..#..", ".####", "#.#..", ".###.", "..#.#", "####.", "..#.."],
  "@": [".###.", "#...#", "#.###", "#.#.#", "#.##.", "#....", ".###."],
  _: [".....", ".....", ".....", ".....", ".....", ".....", "#####"],
  "\\": ["#....", ".#...", ".#...", "..#..", "...#.", "...#.", "....#"],
  "^": ["..#..", ".#.#.", "#...#", ".....", ".....", ".....", "....."],
  "`": [".#...", "..#..", ".....", ".....", ".....", ".....", "....."],
};

const CHAR_W = 6; // 5 glyph columns + 1 space, in font units

function textWidth(text, scale) {
  return text.toUpperCase().length * CHAR_W * scale;
}

function drawText(x, y, text, scale, c) {
  const upper = text.toUpperCase();
  let cx = x;
  for (let i = 0; i < upper.length; i++) {
    const glyph = FONT[upper[i]];
    if (glyph) {
      for (let row = 0; row < 7; row++) {
        const bits = glyph[row];
        for (let col = 0; col < 5; col++) {
          if (bits[col] === "#") {
            fillRect(cx + col * scale, y + row * scale, scale, scale, c);
          }
        }
      }
    }
    cx += CHAR_W * scale;
  }
  return cx - x;
}

function drawTextCentered(y, text, scale, c) {
  const w = textWidth(text, scale);
  drawText(Math.round((W - w) / 2), y, text, scale, c);
}

// Greedy word wrap: returns lines of at most maxChars characters.
function wrap(text, maxChars) {
  const words = text.split(" ");
  const lines = [];
  let cur = "";
  for (const word of words) {
    if (cur === "") {
      cur = word;
    } else if (cur.length + 1 + word.length <= maxChars) {
      cur += " " + word;
    } else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

// ---------------------------------------------------------------- icons
// Each icon fits in a ~100x100 box at (x, y), drawn in color c.

// 1. Globe (climate talks): circle with vertical ellipse + latitude lines.
function iconGlobe(x, y, c) {
  const cx = x + 50;
  const cy = y + 50;
  const r = 36;
  drawCircle(cx, cy, r, c);
  drawCircle(cx, cy, r - 2, c);
  drawEllipse(cx, cy, 14, r, c);
  const dy = Math.round(r * 0.45);
  const chord = Math.floor(Math.sqrt(r * r - dy * dy));
  drawLine(cx - chord, cy - dy, cx + chord, cy - dy, c);
  drawLine(cx - chord, cy + dy, cx + chord, cy + dy, c);
  drawLine(cx - r, cy, cx + r, cy, c);
}

// 2. Oil tanker (Gulf): hull, containers, mast, waves.
function iconShip(x, y, c) {
  const cx = x + 50;
  fillRect(cx - 6, y + 18, 4, 26, c); // mast
  fillRect(cx - 14, y + 12, 16, 6, c); // mast top
  fillRect(x + 12, y + 40, 20, 14, c); // container 1
  fillRect(x + 36, y + 40, 20, 14, BLUE); // container 2
  fillRect(x + 60, y + 40, 20, 14, c); // container 3
  fillRect(x + 6, y + 54, 88, 18, c); // hull
  fillTriangle(x + 94, y + 54, x + 94, y + 72, x + 108, y + 72, c); // bow
  drawWave(x + 4, y + 82, 92, 3, 16, c);
  drawWave(x + 14, y + 92, 72, 3, 14, c);
}

// 3. Drone (Kyiv): body, four arms, four rotors.
function iconDrone(x, y, c) {
  const cx = x + 50;
  const cy = y + 50;
  const arms = [
    [cx - 30, cy - 26],
    [cx + 30, cy - 26],
    [cx - 30, cy + 26],
    [cx + 30, cy + 26],
  ];
  for (const a of arms) {
    drawLineW(cx, cy, a[0], a[1], 3, c);
    drawCircle(a[0], a[1], 11, c);
    drawCircle(a[0], a[1], 10, c);
    fillCircle(a[0], a[1], 2, c);
  }
  fillRect(cx - 14, cy - 7, 28, 14, c); // body
  fillCircle(cx, cy + 12, 4, INK); // camera
}

// 4. Stock chart (markets): axes + rising line with arrowhead.
function iconChart(x, y, c) {
  drawLineW(x + 12, y + 10, x + 12, y + 88, 3, INK); // y axis
  drawLineW(x + 12, y + 88, x + 94, y + 88, 3, INK); // x axis
  const pts = [
    [x + 18, y + 72],
    [x + 36, y + 58],
    [x + 52, y + 64],
    [x + 68, y + 42],
    [x + 86, y + 26],
  ];
  drawPolyline(pts, 3, c);
  const tip = pts[pts.length - 1];
  drawLineW(tip[0], tip[1], tip[0] - 12, tip[1] + 2, 3, c); // arrow
  drawLineW(tip[0], tip[1], tip[0] - 2, tip[1] + 12, 3, c); // arrow
}

// 5. Mercury (space): planet with craters, orbit ellipse, satellite.
function iconPlanet(x, y, c) {
  const cx = x + 50;
  const cy = y + 52;
  drawEllipse(cx, cy, 44, 16, INK); // orbit
  fillCircle(cx, cy, 26, c); // planet
  fillCircle(cx - 9, cy - 7, 5, PAPER); // crater
  fillCircle(cx + 10, cy + 8, 4, PAPER); // crater
  fillCircle(cx + 3, cy - 13, 3, PAPER); // crater
  fillRect(cx + 38, cy - 20, 10, 7, INK); // satellite
  fillRect(cx + 36, cy - 17, 2, 2, INK);
  fillRect(cx + 48, cy - 17, 2, 2, INK);
}

// 6. Deal document (Iran): page with folded corner, text lines, check mark.
function iconDeal(x, y, c) {
  fillRect(x + 24, y + 8, 54, 80, CARD);
  rectOutline(x + 24, y + 8, 54, 80, INK, 2);
  fillTriangle(x + 78, y + 8, x + 78, y + 24, x + 62, y + 8, MUTED); // fold
  fillRect(x + 32, y + 32, 34, 4, MUTED);
  fillRect(x + 32, y + 42, 34, 4, MUTED);
  fillRect(x + 32, y + 52, 22, 4, MUTED);
  drawPolyline(
    [
      [x + 30, y + 70],
      [x + 40, y + 80],
      [x + 60, y + 58],
    ],
    4,
    GREEN,
  ); // check mark
}

// ---------------------------------------------------------------- stories
const STORIES = [
  {
    kicker: "CLIMATE",
    headline: "COP31 collapses without a deal",
    summary:
      "COP31 in Antalya ended with no agreement, the first failed UN climate talks since Copenhagen 2009, after oil states blocked a fossil-fuel phase-out.",
    place: "ANTALYA",
    accent: RED,
    icon: iconGlobe,
  },
  {
    kicker: "GULF",
    headline: "Iran strikes Bahrain, Gulf tankers",
    summary:
      "Bahrain says Iran hit a civilian site, wounding two; the US hit an Iranian oil tanker near Hormuz.",
    place: "MANAMA",
    accent: BLUE,
    icon: iconShip,
  },
  {
    kicker: "UKRAINE",
    headline: "Russian drones hit Kyiv region",
    summary:
      "A Russian drone strike on Kyiv region killed at least four; Kyiv hit Russian ships in Libya.",
    place: "KYIV",
    accent: ORANGE,
    icon: iconDrone,
  },
  {
    kicker: "MARKETS",
    headline: "Stocks rebound after AI rout",
    summary:
      "US stock futures rebounded after an AI-driven tech rout sent the S&P 500 and Nasdaq into correction.",
    place: "NEW YORK",
    accent: GREEN,
    icon: iconChart,
  },
  {
    kicker: "SPACE",
    headline: "BepiColombo reaches Mercury",
    summary:
      "Europe and Japan's BepiColombo probe began orbiting Mercury, though controllers reported a glitch.",
    place: "MERCURY",
    accent: PURPLE,
    icon: iconPlanet,
  },
  {
    kicker: "IRAN",
    headline: "Trump: permanent deal or strikes",
    summary:
      "Trump demands a permanent Iran nuclear deal or warns of major strikes after the new year.",
    place: "WASHINGTON",
    accent: TEAL,
    icon: iconDeal,
  },
];

const FOOTER_ITEMS = [
  {
    text: "Netanyahu and Eisenkot end coalition talks without a deal",
    accent: RED,
  },
  {
    text: "Saudi Arabia orders 50% Saudization in 17 financial professions from May 2027",
    accent: GREEN,
  },
  {
    text: "Britain to build Ukrainian drones in a joint project",
    accent: BLUE,
  },
];

// ---------------------------------------------------------------- layout
const MARGIN = 24;
const GRID_TOP = 128;
const CELL_W = 476;
const CELL_H = 240;
const GAP = 12;

function drawMasthead() {
  fillRect(0, 0, W, 116, NAVY);
  drawTextCentered(28, "MONDAY, 23 NOVEMBER 2026", 4, PAPER);
  drawTextCentered(72, "THE WORLD IN ONE IMAGE", 2, GOLD);
  fillRect(0, 112, W, 4, GOLD);
}

function drawCard(x, y, story) {
  const a = story.accent;
  fillRect(x, y, CELL_W, CELL_H, CARD);
  rectOutline(x, y, CELL_W, CELL_H, INK, 2);
  fillRect(x, y, CELL_W, 8, a); // accent bar
  drawText(x + 16, y + 18, story.kicker, 1, a);
  story.icon(x + 16, y + 42, a);
  // Headline, right of the icon, up to 3 lines at scale 2.
  const headLines = wrap(story.headline, 27);
  let hy = y + 42;
  for (const ln of headLines) {
    drawText(x + 132, hy, ln, 2, INK);
    hy += 16;
  }
  // Summary, full width below the icon row.
  const sumLines = wrap(story.summary, 74);
  let sy = y + 152;
  for (const ln of sumLines) {
    drawText(x + 16, sy, ln, 1, BODY);
    sy += 11;
  }
  drawText(x + 16, y + 212, story.place, 1, a);
}

function drawGrid() {
  for (let i = 0; i < STORIES.length; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = MARGIN + col * (CELL_W + GAP);
    const y = GRID_TOP + row * (CELL_H + GAP);
    drawCard(x, y, STORIES[i]);
  }
}

function drawFooter() {
  const top = 884;
  fillRect(MARGIN, top, W - 2 * MARGIN, H - top - MARGIN, INK);
  drawText(MARGIN + 16, top + 18, "ALSO TODAY", 1, GOLD);
  const colW = 309;
  for (let i = 0; i < FOOTER_ITEMS.length; i++) {
    const item = FOOTER_ITEMS[i];
    const x = MARGIN + 16 + i * (colW + 16);
    const y = top + 46;
    fillRect(x, y + 1, 8, 8, item.accent);
    const lines = wrap(item.text, 48);
    let ly = y;
    for (const ln of lines) {
      drawText(x + 16, ly, ln, 1, PAPER);
      ly += 11;
    }
  }
}

// ---------------------------------------------------------------- PNG encoder
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePNG() {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type 2 = truecolor RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  // Raw scanlines: filter byte 0 + RGB bytes per row.
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    raw.set(px.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- main
function main() {
  fillAll(PAPER);
  drawMasthead();
  drawGrid();
  drawFooter();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "out";
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, "entry.png");
  fs.writeFileSync(file, encodePNG());
  console.log("wrote " + file);
}

main();

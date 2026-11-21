// 生成桌面端占位图标（256×256，32 位 ICO）：深色圆角底 + 品牌蓝字标。
// 纯 Node 实现（无图形依赖），正式品牌图到位后直接替换 apps/desktop/resources/icon.ico 即可。
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const SIZE = 256;
const CORNER_RADIUS = 58;
const BACKGROUND = { r: 0x1b, g: 0x1b, b: 0x1b };
const ACCENT = { r: 0x3b, g: 0x82, b: 0xf6 };
const OUT_PATH = join(resolve(import.meta.dirname, ".."), "resources", "icon.ico");

// 每个像素做 4×4 超采样，让圆角边缘不出现锯齿。
const SUBSAMPLES = 4;

/** 判断点是否落在圆角矩形内。 */
function insideRoundedRect(x, y) {
  const left = CORNER_RADIUS;
  const right = SIZE - CORNER_RADIUS;
  if (x < left && y < left) return Math.hypot(x - left, y - left) <= CORNER_RADIUS;
  if (x > right && y < left) return Math.hypot(x - right, y - left) <= CORNER_RADIUS;
  if (x < left && y > right) return Math.hypot(x - left, y - right) <= CORNER_RADIUS;
  if (x > right && y > right) return Math.hypot(x - right, y - right) <= CORNER_RADIUS;
  return true;
}

/** 字标「L」：竖笔 + 横脚，坐标按 256 画布设计。 */
function insideGlyph(x, y) {
  const stem = x >= 84 && x <= 112 && y >= 64 && y <= 196;
  const foot = x >= 84 && x <= 180 && y >= 168 && y <= 196;
  return stem || foot;
}

/** 计算一个像素的颜色；返回 [r, g, b, a]。 */
function renderPixel(px, py) {
  let backgroundCoverage = 0;
  let glyphCoverage = 0;
  for (let sx = 0; sx < SUBSAMPLES; sx += 1) {
    for (let sy = 0; sy < SUBSAMPLES; sy += 1) {
      const x = px + (sx + 0.5) / SUBSAMPLES;
      const y = py + (sy + 0.5) / SUBSAMPLES;
      if (!insideRoundedRect(x, y)) continue;
      backgroundCoverage += 1;
      if (insideGlyph(x, y)) glyphCoverage += 1;
    }
  }
  const samples = SUBSAMPLES * SUBSAMPLES;
  const alpha = Math.round((backgroundCoverage / samples) * 255);
  const glyphRatio = backgroundCoverage > 0 ? glyphCoverage / backgroundCoverage : 0;
  return [
    Math.round(BACKGROUND.r + (ACCENT.r - BACKGROUND.r) * glyphRatio),
    Math.round(BACKGROUND.g + (ACCENT.g - BACKGROUND.g) * glyphRatio),
    Math.round(BACKGROUND.b + (ACCENT.b - BACKGROUND.b) * glyphRatio),
    alpha,
  ];
}

/** 组装 32 位 DIB 图标数据：BITMAPINFOHEADER + 自下而上的 BGRA 像素 + AND 掩码。 */
function buildDib() {
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0);
  header.writeInt32LE(SIZE, 4);
  // ICO 的 DIB 高度要写成两倍：包含 XOR 像素与 AND 掩码两部分。
  header.writeInt32LE(SIZE * 2, 8);
  header.writeUInt16LE(1, 12);
  header.writeUInt16LE(32, 14);
  header.writeUInt32LE(SIZE * SIZE * 4, 20);

  const pixels = Buffer.alloc(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y += 1) {
    // DIB 行序自下而上。
    const row = SIZE - 1 - y;
    for (let x = 0; x < SIZE; x += 1) {
      const [r, g, b, a] = renderPixel(x, y);
      const offset = (row * SIZE + x) * 4;
      pixels[offset] = b;
      pixels[offset + 1] = g;
      pixels[offset + 2] = r;
      pixels[offset + 3] = a;
    }
  }

  // AND 掩码：32bpp 下按全不透明处理，行按 4 字节对齐。
  const maskRowBytes = Math.ceil(SIZE / 32) * 4;
  const mask = Buffer.alloc(maskRowBytes * SIZE);
  return Buffer.concat([header, pixels, mask]);
}

function buildIco() {
  const image = buildDib();
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);

  const entry = Buffer.alloc(16);
  entry.writeUInt8(0, 0); // 0 表示 256 宽
  entry.writeUInt8(0, 1); // 0 表示 256 高
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(image.length, 8);
  entry.writeUInt32LE(header.length + entry.length, 12);
  return Buffer.concat([header, entry, image]);
}

mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, buildIco());
console.log(`已生成桌面图标：${OUT_PATH}（${SIZE}×${SIZE}，32 位）`);
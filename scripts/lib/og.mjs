// 1200x630 social card in the series' style: dotted cream paper, hand-lettered title, a still on the right.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import opentype from 'opentype.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// Text is drawn as vector paths from the bundled Kalam files (opentype.js), so no installed fonts are needed.
const KALAM_BOLD = opentype.loadSync(path.join(HERE, '..', 'assets', 'fonts', 'Kalam-Bold.ttf'));
const KALAM = opentype.loadSync(path.join(HERE, '..', 'assets', 'fonts', 'Kalam-Regular.ttf'));

const W = 1200;
const H = 630;
const BG = '#F7F3EC';
const INK = '#1F1F1F';
const GREEN = '#2E7D4F';
const GREY = '#6E6A64';

function paper() {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <defs><pattern id="d" width="22" height="22" patternUnits="userSpaceOnUse">
        <circle cx="11" cy="11" r="1.4" fill="#DED7CC"/></pattern></defs>
      <rect width="100%" height="100%" fill="${BG}"/><rect width="100%" height="100%" fill="url(#d)"/>
    </svg>`,
  );
}

/** Word-wrap `text` to `maxWidth` at `size` px; returns the lines. */
function wrap(font, text, size, maxWidth) {
  const lines = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const tryLine = line ? `${line} ${word}` : word;
    if (line && font.getAdvanceWidth(tryLine, size) > maxWidth) {
      lines.push(line);
      line = word;
    } else line = tryLine;
  }
  if (line) lines.push(line);
  return lines;
}

/** SVG <path> elements for `lines` starting at (x, y = first baseline). */
function pathsFor(font, lines, size, x, y, lineHeight, fill) {
  return lines
    .map((l, i) => font.getPath(l, x, y + i * lineHeight, size).toPathData(2))
    .map((d) => `<path d="${d}" fill="${fill}"/>`)
    .join('');
}

/**
 * @param {object} o
 * @param {string} o.title     big hand-lettered title
 * @param {string} o.kicker    small green line above the title (e.g. "PART 2 OF 16")
 * @param {string} o.footer    small grey line at the bottom (e.g. the series name)
 * @param {string} o.image     path to a square still shown on the right
 * @param {string} o.out       output .png path
 */
export async function makeOg({ title, kicker, footer, image, out }) {
  const pad = 56;
  const imgSize = H - 2 * 40;
  const textW = W - imgSize - 40 - pad * 2 - 10;

  const still = await sharp(image).resize(imgSize, imgSize).png().toBuffer();
  const frame = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${imgSize + 4}" height="${imgSize + 4}">
      <rect x="1" y="1" width="${imgSize + 2}" height="${imgSize + 2}" rx="18" fill="none" stroke="#DED7CC" stroke-width="2"/></svg>`,
  );
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${imgSize}" height="${imgSize}"><rect width="100%" height="100%" rx="16" fill="#fff"/></svg>`,
  );
  const rounded = await sharp(still).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();

  // Largest title size (64 → 40 px) that fits in 5 lines.
  const titleTop = pad + 30 + 34;
  const titleBottom = H - pad - 60;
  let size = 64;
  let lines = wrap(KALAM_BOLD, title, size, textW);
  while (size > 40 && (lines.length * size * 1.12 > titleBottom - titleTop || lines.length > 5)) {
    size -= 2;
    lines = wrap(KALAM_BOLD, title, size, textW);
  }
  const lh = size * 1.12;
  const blockH = lines.length * lh;
  const firstBaseline = titleTop + (titleBottom - titleTop - blockH) / 2 + size * 0.95;
  const textSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      ${pathsFor(KALAM_BOLD, [kicker], 28, pad, pad + 28, 0, GREEN)}
      ${pathsFor(KALAM_BOLD, lines, size, pad, firstBaseline, lh, INK)}
      ${pathsFor(KALAM, wrap(KALAM, footer, 26, textW), 26, pad, H - pad, 30, GREY)}
    </svg>`,
  );

  await sharp(paper())
    .composite([
      { input: textSvg, left: 0, top: 0 },
      { input: rounded, left: W - imgSize - 40, top: 40 },
      { input: frame, left: W - imgSize - 42, top: 38 },
    ])
    .png({ compressionLevel: 9, palette: true, quality: 90 })
    .toFile(out);
}

// Site-wide social card (public/og-default.png), used by pages that aren't posts.
//   node scripts/og-default.mjs [path/to/square-still.png]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeOg } from './lib/og.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await makeOg({
  title: 'LLM inference, measured on real GPUs.',
  kicker: 'AI ON SILICON',
  footer: 'Measured · sourced · reproducible',
  image: process.argv[2] ?? path.join(ROOT, 'public', 'media', 'post-01', 'stills', 'step10-2160.webp'),
  out: path.join(ROOT, 'public', 'og-default.png'),
});
console.log('wrote public/og-default.png');

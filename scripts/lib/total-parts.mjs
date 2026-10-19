// Number of planned parts, read from src/data/series.ts (so the OG card says "PART 2 OF 16").
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function totalParts() {
  const f = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'data', 'series.ts');
  const plan = fs.readFileSync(f, 'utf8').split('export const PLAN')[1] ?? '';
  return (plan.match(/\{\s*part:\s*\d+/g) ?? []).length;
}

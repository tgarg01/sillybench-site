// Series metadata. Each series has its own reproducibility repo; episodes link notebooks in it.
// Add a series by adding an entry to series.json (the importer reads the same file).
import list from './series.json';

export type Series = { id: string; number: number; title: string; blurb: string; repo: string };

export const SERIES: Series[] = list;

export function getSeries(id: string): Series {
  const s = SERIES.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown series "${id}" (add it to src/data/series.json)`);
  return s;
}

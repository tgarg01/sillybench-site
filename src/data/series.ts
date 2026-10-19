// Series metadata. Each series has its own reproducibility repo; episodes link notebooks in it.
// Add a series by adding an entry to series.json (the importer reads the same file).
import list from './series.json';

// `next` announces the upcoming episode until a post with that episode number is published.
export type NextEpisode = { episode: number; title: string; date: string };
export type Series = { id: string; number: number; title: string; blurb: string; repo: string; next?: NextEpisode };

export const SERIES: Series[] = list as Series[];

export function getSeries(id: string): Series {
  const s = SERIES.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown series "${id}" (add it to src/data/series.json)`);
  return s;
}

/** The announced next episode, unless it is already published. */
export function upcoming(s: Series, publishedEpisodes: number[]): NextEpisode | undefined {
  return s.next && !publishedEpisodes.includes(s.next.episode) ? s.next : undefined;
}

export function releaseDay(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

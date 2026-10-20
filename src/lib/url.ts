import { SITE } from '../site.config';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

/** Internal link that respects the deploy base path ('/sillybench-site' on GitHub Pages, '' on a custom domain). */
export function url(path = '/'): string {
  return `${BASE}/${path.replace(/^\//, '')}`;
}

/** URL of a post's media file: <media base>/<dir>/<file>. */
export function mediaUrl(dir: string, file: string): string {
  const root = SITE.mediaBase ? SITE.mediaBase.replace(/\/$/, '') : `${BASE}/media`;
  return `${root}/${dir}/${file}`;
}

export function postUrl(id: string): string {
  return url(`/posts/${id}/`);
}

/** GitHub link into the labs repo at a given ref (tag, branch or SHA). */
export function repoUrl(repo: string, ref: string, path = ''): string {
  return path ? `${repo}/tree/${ref}/${path}` : `${repo}/tree/${ref}`;
}

export function colabUrl(repo: string, ref: string, notebook: string): string {
  const slug = repo.replace('https://github.com/', '');
  return `https://colab.research.google.com/github/${slug}/blob/${ref}/${notebook}`;
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

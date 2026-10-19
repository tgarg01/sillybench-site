// Render a Jupyter notebook (.ipynb) to static HTML at build time: markdown cells, highlighted code,
// and outputs (text, tables, images). No client-side JavaScript needed.
import fs from 'node:fs';
import { marked } from 'marked';
import { codeToHtml } from 'shiki';

type Output = {
  output_type: 'stream' | 'execute_result' | 'display_data' | 'error';
  name?: string;
  text?: string | string[];
  data?: Record<string, string | string[]>;
  ename?: string;
  evalue?: string;
};
type Cell = {
  cell_type: 'markdown' | 'code' | 'raw';
  source: string | string[];
  outputs?: Output[];
  execution_count?: number | null;
};

export type RenderedCell =
  | { kind: 'markdown'; html: string }
  | { kind: 'code'; count: number | null; html: string; outputs: string[] };

const join = (s: string | string[] | undefined) => (Array.isArray(s) ? s.join('') : (s ?? ''));
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');

// Notebook HTML outputs (pandas tables) are trusted-ish but still: no scripts, styles, handlers or js: URLs.
function sanitize(html: string): string {
  return html
    .replace(/<(script|style|iframe|object|embed)[\s\S]*?<\/\1>/gi, '')
    .replace(/<(script|style|iframe|object|embed)[^>]*\/?>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1="#"');
}

// Relative links in markdown cells point into the repo: rewrite them to GitHub.
function rewriteLinks(html: string, base: string): string {
  return html.replace(/(href|src)="(?!https?:|#|mailto:|data:)([^"]+)"/g, (_, attr, rel) => {
    const url = new URL(rel, base).href;
    return `${attr}="${url}"`;
  });
}

async function renderOutput(o: Output): Promise<string> {
  if (o.output_type === 'stream') {
    return `<pre class="nb-stream${o.name === 'stderr' ? ' err' : ''}">${esc(stripAnsi(join(o.text)))}</pre>`;
  }
  if (o.output_type === 'error') {
    return `<pre class="nb-stream err">${esc(`${o.ename}: ${o.evalue}`)}</pre>`;
  }
  const d = o.data ?? {};
  if (d['application/vnd.jupyter.widget-view+json']) return ''; // progress bars and other live widgets
  if (d['image/png']) return `<img class="nb-img" alt="Notebook output figure" src="data:image/png;base64,${join(d['image/png']).trim()}" />`;
  if (d['image/jpeg']) return `<img class="nb-img" alt="Notebook output figure" src="data:image/jpeg;base64,${join(d['image/jpeg']).trim()}" />`;
  if (d['text/html']) return `<div class="nb-html">${sanitize(join(d['text/html']))}</div>`;
  if (d['text/markdown']) return `<div class="nb-md">${sanitize(await marked.parse(join(d['text/markdown'])))}</div>`;
  if (d['text/plain']) return `<pre class="nb-stream">${esc(stripAnsi(join(d['text/plain'])))}</pre>`;
  return '';
}

/**
 * @param file      path to the .ipynb on disk
 * @param linkBase  URL relative links resolve against, e.g. https://github.com/u/r/blob/<ref>/posts/post-02/
 */
export async function renderNotebook(file: string, linkBase: string): Promise<RenderedCell[]> {
  const nb = JSON.parse(fs.readFileSync(file, 'utf8')) as { cells: Cell[]; metadata?: any };
  const lang = nb.metadata?.kernelspec?.language ?? nb.metadata?.language_info?.name ?? 'python';
  const out: RenderedCell[] = [];
  for (const c of nb.cells) {
    const src = join(c.source);
    if (c.cell_type === 'markdown') {
      out.push({ kind: 'markdown', html: rewriteLinks(sanitize(await marked.parse(src)), linkBase) });
    } else if (c.cell_type === 'code') {
      if (!src.trim() && !(c.outputs ?? []).length) continue;
      const html = await codeToHtml(src, {
        lang,
        themes: { light: 'github-light', dark: 'github-dark' },
        defaultColor: false,
      });
      const outputs = (await Promise.all((c.outputs ?? []).map(renderOutput))).filter(Boolean);
      out.push({ kind: 'code', count: c.execution_count ?? null, html, outputs });
    }
  }
  return out;
}

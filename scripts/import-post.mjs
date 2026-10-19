#!/usr/bin/env node
// Turn a finished LinkedIn post folder (~/Posts/post-NN) into an episode page.
//
//   npm run import -- ~/Posts/post-02 --slug prefill-vs-decode --date 2026-10-19
//
// Reads   post-NN.md (hook, "Post N of ..." line, body, "Sources (not part of the post)" footer, hashtags),
//         post-NN.gif, stills/*.png, post-NN_carousel.pdf (and post-NN.mp4 + .srt with --narrated)
//         + the episode's notebook from the series repo (src/data/series.json) at the tag post-NN (else main):
//           <repo>/posts/post-NN/*.ipynb, run once in stored mode so the page shows its outputs
// Writes  public/media/post-NN/  loop.mp4, stills/*.webp, carousel.pdf, og.png, notebook.ipynb
//         src/content/posts/NN-slug/index.mdx  new: written in full
//                                              existing: only the importer's frontmatter (episode, media, repro)
//                                              is updated; your text and other fields are kept
//
// Options
//   --series <id>       series id from src/data/series.json (default: the first one)
//   --slug <s>          URL slug after the number (default: from the title)
//   --date <YYYY-MM-DD> publish date (default: today; new posts only)
//   --ref <git ref>     repo tag/branch/SHA to link and to take the notebook from (default: tag post-NN if it exists)
//   --local <dir>       preview: take the notebook from a local checkout (uncommitted files too) instead of GitHub;
//                       links still point at --ref, so don't publish until it's pushed and tagged
//   --python <path>     Python with jupyter to run the notebook (default: <Posts>/Sillybench/.venv-posts/bin/python)
//   --no-execute        show the notebook as committed (no outputs) instead of running it
//   --figure <file>     copy a figure into public/media/post-NN/figures/ (repeatable), for a "Go deeper" section
//   --poster <n>        which still the video shows before it plays (default 1)
//   --card <n>          which still goes on the social card and post thumbnail (default: the poster)
//   --narrated          also publish post-NN.mp4 (+ .srt captions) as a "Narrated" tab
//   --force             rewrite an existing index.mdx from scratch (your edits to it are lost)
//   --media-only        only regenerate the media files
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ffmpegPath from 'ffmpeg-static';
import sharp from 'sharp';
import yamlLib from 'js-yaml';
import { makeOg } from './lib/og.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERIES_LIST = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'data', 'series.json'), 'utf8'));

// Defaults for "Measured on"; edit the frontmatter afterwards if a post differs.
const MEASURED_ON = {
  gpu: '1x NVIDIA H100 SXM 80GB (GCP a3-highgpu-1g)',
  model: 'Qwen3.8-27B, BF16',
  engine: 'vLLM 0.31, default settings',
  workload: 'Batch 1, 512-token prompt',
};

// ---------- args ----------
const argv = process.argv.slice(2);
const opts = { figures: [] };
let srcDir;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--slug') opts.slug = argv[++i];
  else if (a === '--date') opts.date = argv[++i];
  else if (a === '--ref') opts.ref = argv[++i];
  else if (a === '--series') opts.series = argv[++i];
  else if (a === '--python') opts.python = argv[++i];
  else if (a === '--local') opts.local = path.resolve(argv[++i].replace(/^~(?=\/)/, os.homedir()));
  else if (a === '--no-execute') opts.noExecute = true;
  else if (a === '--narrated') opts.narrated = true;
  else if (a === '--figure') opts.figures.push(argv[++i]);
  else if (a === '--poster') opts.poster = Number(argv[++i]);
  else if (a === '--card') opts.card = Number(argv[++i]);
  else if (a === '--force') opts.force = true;
  else if (a === '--media-only') opts.mediaOnly = true;
  else if (a.startsWith('--')) die(`unknown option ${a}`);
  else srcDir = a;
}
if (!srcDir) {
  // Print the header comment as help.
  const self = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n');
  console.log(self.slice(1, self.findIndex((l) => l.startsWith('import'))).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
  process.exit(1);
}
srcDir = path.resolve(srcDir.replace(/^~(?=\/)/, os.homedir()));
const name = path.basename(srcDir); // post-02
const nn = name.match(/post-(\d+)/)?.[1];
if (!nn) die(`folder must be named post-NN, got ${name}`);

const SERIES = opts.series ? SERIES_LIST.find((s) => s.id === opts.series) : SERIES_LIST[0];
if (!SERIES) die(`unknown series ${opts.series}; add it to src/data/series.json`);

const mdPath = path.join(srcDir, `${name}.md`);
if (!fs.existsSync(mdPath)) die(`missing ${mdPath}`);

// ---------- parse the post ----------
const raw = fs.readFileSync(mdPath, 'utf8').replace(/\r\n/g, '\n');
const sepIdx = raw.split('\n').findIndex((l) => l.trim() === '---');
const lines = raw.split('\n');
const postLines = sepIdx >= 0 ? lines.slice(0, sepIdx) : lines;
const footerLines = sepIdx >= 0 ? lines.slice(sepIdx + 1) : [];

const title = postLines[0].trim();
let i0 = 1;
let episode = Number(nn);
let seriesLine = '';
if (/^Post \d+ of/i.test(postLines[1] ?? '')) {
  seriesLine = postLines[1].trim();
  episode = Number(seriesLine.match(/^Post (\d+)/i)[1]);
  i0 = 2;
}

let tags = [];
const bodyLines = [];
for (let i = i0; i < postLines.length; i++) {
  const l = postLines[i].trim();
  if (/^#\w+(\s+#\w+)*$/.test(l)) {
    tags = l.split(/\s+/).map((t) => t.slice(1));
    continue;
  }
  if (/^Reproduce it\b/i.test(l)) {
    // "Reproduce it (...):" followed by a github.com link; the Reproduce box replaces it on the site.
    let j = i + 1;
    while (j < postLines.length && !postLines[j].trim()) j++;
    i = j;
    continue;
  }
  bodyLines.push(l);
}

// Sources footer: "- item" lines, continuation lines indented.
const sources = [];
let inSources = false;
for (const l of footerLines) {
  if (/^Sources\b/i.test(l.trim())) {
    inSources = true;
    continue;
  }
  if (!inSources) continue;
  if (/^\s*-\s+/.test(l)) sources.push(l.replace(/^\s*-\s+/, '').trim());
  else if (l.trim() && sources.length) sources[sources.length - 1] += ' ' + l.trim();
}

const RUN_RE = /Sillybench run (\d{4}-\d\d-\d\d_[A-Za-z0-9._-]*[A-Za-z0-9])/;
const runId = sources.join(' ').match(RUN_RE)?.[1];
const tagName = `post-${nn}`;
const ref = opts.ref ?? (remoteHasTag(SERIES.repo, tagName) ? tagName : 'main');
log(`series ${SERIES.number}, episode ${episode}, repo ${SERIES.repo} @ ${ref}`);

// ---------- notebook: clone the repo at the ref, find posts/post-NN/*.ipynb, run it ----------
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aionsilicon-'));
const clone = path.join(tmp, 'repo');
if (opts.local) {
  // Copy the working tree (minus .git and virtualenvs) so uncommitted notebooks can be previewed.
  fs.cpSync(opts.local, clone, { recursive: true, filter: (p) => !/\/(\.git|\.venv[^/]*|node_modules)(\/|$)/.test(p.slice(opts.local.length)) });
  warn(`using local checkout ${opts.local} (preview only)`);
} else {
  const cl = spawnSync('git', ['clone', '--quiet', '--depth', '1', '--branch', ref, `${SERIES.repo}.git`, clone], { encoding: 'utf8' });
  if (cl.status !== 0) die(`could not clone ${SERIES.repo} at ${ref}: ${cl.stderr}`);
}
const nbDirRel = `posts/${name}`;
const nbFile = fs.existsSync(path.join(clone, nbDirRel))
  ? fs.readdirSync(path.join(clone, nbDirRel)).find((f) => f.endsWith('.ipynb'))
  : undefined;
let repro = { repo: SERIES.repo, ref };
let notebookOut;
if (nbFile) {
  const nbRel = `${nbDirRel}/${nbFile}`;
  const nbSrc = fs.readFileSync(path.join(clone, nbRel), 'utf8');
  repro = { ...repro, path: nbDirRel, notebook: nbRel, colab: nbSrc.includes('google.colab') };
  notebookOut = path.join(clone, nbDirRel, 'executed.ipynb');
  let executed = false;
  if (!opts.noExecute) {
    const py = opts.python ?? path.join(srcDir, '..', 'Sillybench', '.venv-posts', 'bin', 'python');
    if (fs.existsSync(py)) {
      log(`running ${nbRel} (stored mode) ...`);
      const r = spawnSync(
        py,
        ['-m', 'jupyter', 'nbconvert', '--to', 'notebook', '--execute', '--ExecutePreprocessor.kernel_name=python3',
          '--ExecutePreprocessor.timeout=600', '--output', 'executed.ipynb', nbFile],
        { cwd: path.join(clone, nbDirRel), encoding: 'utf8', env: { ...process.env, PATH: `${path.dirname(py)}:${process.env.PATH}` } },
      );
      executed = r.status === 0;
      if (!executed) warn(`notebook run failed, showing it without outputs:\n${r.stderr.split('\n').slice(-8).join('\n')}`);
    } else warn(`no Python with jupyter at ${py}; pass --python. Showing the notebook without outputs.`);
  }
  if (!executed) fs.writeFileSync(notebookOut, nbSrc);
  else {
    // Outputs may print where the notebook ran; show the repo name instead of this machine's temp folder.
    const repoName = SERIES.repo.split('/').pop();
    let out = fs.readFileSync(notebookOut, 'utf8');
    for (const p of new Set([fs.realpathSync(clone), clone])) out = out.split(p).join(repoName);
    fs.writeFileSync(notebookOut, out);
  }
  repro.view = 'notebook.ipynb';
  repro.viewNote = executed
    ? `${ref} · outputs from a run without a GPU (stored results), ${new Date().toISOString().slice(0, 10)}`
    : `${ref} · as committed, run it to see the outputs`;
} else {
  repro.path = runId ? `runs/${runId}/analysis` : undefined;
  repro.note = runId
    ? 'The notebook for this episode is on its way. Until then, every number traces to the run’s analysis files listed in the sources below.'
    : 'The notebook for this episode is on its way.';
  log(`no notebook in ${nbDirRel} at ${ref}`);
}

// ---------- media ----------
const mediaDir = path.join(ROOT, 'public', 'media', name);
fs.mkdirSync(path.join(mediaDir, 'stills'), { recursive: true });
const media = { dir: name };

function ff(args) {
  const r = spawnSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8' });
  if (r.status !== 0) die(`ffmpeg failed: ${r.stderr}`);
}
function probe(file) {
  const r = spawnSync(ffmpegPath, ['-hide_banner', '-i', file], { encoding: 'utf8' });
  const s = r.stderr;
  const d = s.match(/Duration: (\d+):(\d+):([\d.]+)/);
  const wh = s.match(/Video:.*?, (\d{2,5})x(\d{2,5})/);
  return {
    seconds: d ? Math.round((+d[1] * 3600 + +d[2] * 60 + +d[3]) * 10) / 10 : 0,
    width: wh ? +wh[1] : 0,
    height: wh ? +wh[2] : 0,
  };
}
const kb = (f) => `${Math.round(fs.statSync(f).size / 1024)} KB`;

// Stills -> 1080 + 2160 WebP
const stillsSrc = path.join(srcDir, 'stills');
const pngs = fs.existsSync(stillsSrc) ? fs.readdirSync(stillsSrc).filter((f) => f.endsWith('.png')).sort() : [];
media.stills = [];
for (const [k, f] of pngs.entries()) {
  const id = `step${String(k + 1).padStart(2, '0')}`;
  await sharp(path.join(stillsSrc, f)).resize(1080).webp({ quality: 82 }).toFile(path.join(mediaDir, 'stills', `${id}.webp`));
  await sharp(path.join(stillsSrc, f)).resize(2160).webp({ quality: 80 }).toFile(path.join(mediaDir, 'stills', `${id}-2160.webp`));
  media.stills.push({ src: `stills/${id}.webp`, full: `stills/${id}-2160.webp` });
}
log(`stills: ${media.stills.length}`);
const posterIdx = Math.min(Math.max((opts.poster ?? 1) - 1, 0), Math.max(media.stills.length - 1, 0));
const poster = media.stills[posterIdx]?.src;
const cardIdx = Math.min(Math.max((opts.card ?? posterIdx + 1) - 1, 0), Math.max(media.stills.length - 1, 0));

// GIF -> silent looping H.264 MP4 (a fraction of the GIF's size)
const gif = path.join(srcDir, `${name}.gif`);
if (!fs.existsSync(gif)) die(`missing ${gif}`);
const loopOut = path.join(mediaDir, 'loop.mp4');
ff(['-i', gif, '-movflags', '+faststart', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '22',
  '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-an', loopOut]);
const lp = probe(loopOut);
media.loop = { mp4: 'loop.mp4', poster: poster ?? 'loop-poster.webp', width: lp.width, height: lp.height, seconds: lp.seconds };
if (!poster) {
  ff(['-i', loopOut, '-frames:v', '1', path.join(mediaDir, 'loop-poster.png')]);
  await sharp(path.join(mediaDir, 'loop-poster.png')).webp({ quality: 82 }).toFile(path.join(mediaDir, 'loop-poster.webp'));
  fs.rmSync(path.join(mediaDir, 'loop-poster.png'));
}
log(`loop.mp4: ${lp.seconds}s ${lp.width}x${lp.height}, ${kb(loopOut)} (GIF was ${kb(gif)})`);

// Narrated MP4 + captions (only with --narrated)
const narr = path.join(srcDir, `${name}.mp4`);
for (const f of ['narrated.mp4', 'narrated.vtt']) if (!opts.narrated) fs.rmSync(path.join(mediaDir, f), { force: true });
if (opts.narrated && fs.existsSync(narr)) {
  const out = path.join(mediaDir, 'narrated.mp4');
  ff(['-i', narr, '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-vf', 'scale=720:-2', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', out]);
  const np = probe(out);
  media.narrated = { mp4: 'narrated.mp4', poster: poster ?? media.loop.poster, seconds: np.seconds };
  const srt = path.join(srcDir, `${name}.srt`);
  if (fs.existsSync(srt)) {
    const vtt = 'WEBVTT\n\n' + fs.readFileSync(srt, 'utf8').replace(/\r\n/g, '\n').replace(/(\d\d:\d\d:\d\d),(\d\d\d)/g, '$1.$2');
    fs.writeFileSync(path.join(mediaDir, 'narrated.vtt'), vtt);
    media.narrated.vtt = 'narrated.vtt';
  }
  log(`narrated.mp4: ${np.seconds}s, ${kb(out)} (source ${kb(narr)})`);
}

// Carousel PDF
const pdf = path.join(srcDir, `${name}_carousel.pdf`);
if (fs.existsSync(pdf)) {
  fs.copyFileSync(pdf, path.join(mediaDir, 'carousel.pdf'));
  media.carousel = 'carousel.pdf';
  log(`carousel.pdf: ${kb(pdf)}`);
}

// Extra figures for "Go deeper"
for (const f of opts.figures) {
  const src = path.resolve(f.replace(/^~(?=\/)/, os.homedir()));
  fs.mkdirSync(path.join(mediaDir, 'figures'), { recursive: true });
  fs.copyFileSync(src, path.join(mediaDir, 'figures', path.basename(src)));
  log(`figure: figures/${path.basename(src)}`);
}

// Notebook copy for the page
if (notebookOut) {
  fs.copyFileSync(notebookOut, path.join(mediaDir, 'notebook.ipynb'));
  log(`notebook.ipynb: ${kb(path.join(mediaDir, 'notebook.ipynb'))}`);
} else fs.rmSync(path.join(mediaDir, 'notebook.ipynb'), { force: true });
fs.rmSync(tmp, { recursive: true, force: true });

// Social card: use the site title if the episode page exists (it may have been edited)
const existingForOg = fs.readdirSync(path.join(ROOT, 'src', 'content', 'posts')).find((d) => d.startsWith(`${nn}-`));
let ogTitle = title;
if (existingForOg) {
  const fmText = fs.readFileSync(path.join(ROOT, 'src', 'content', 'posts', existingForOg, 'index.mdx'), 'utf8').match(/^---\n([\s\S]*?)\n---/);
  if (fmText) ogTitle = yamlLib.load(fmText[1]).title ?? title;
}
await makeOg({
  title: ogTitle,
  kicker: `SERIES ${SERIES.number} · EPISODE ${episode}`,
  footer: `AI on Silicon · ${SERIES.title}`,
  image: pngs.length ? path.join(stillsSrc, pngs[cardIdx]) : path.join(mediaDir, 'loop-poster.webp'),
  out: path.join(mediaDir, 'og.png'),
});
media.og = 'og.png';
if (media.stills[cardIdx]) media.card = media.stills[cardIdx].src;
log(`og.png: ${kb(path.join(mediaDir, 'og.png'))}`);

if (opts.mediaOnly) done();

// ---------- MDX ----------
const slug = opts.slug ?? slugify(title);
const postDir = path.join(ROOT, 'src', 'content', 'posts', `${nn}-${slug}`);
const mdxPath = path.join(postDir, 'index.mdx');
const existing = fs.readdirSync(path.join(ROOT, 'src', 'content', 'posts')).find((d) => d.startsWith(`${nn}-`));
const reproFm = Object.fromEntries(Object.entries(repro).filter(([, v]) => v !== undefined));
const existingMdx = existing && !opts.force ? path.join(ROOT, 'src', 'content', 'posts', existing, 'index.mdx') : undefined;
if (existingMdx && fs.existsSync(existingMdx)) {
  // Update only what the importer owns; keep the author's text and other fields.
  const txt = fs.readFileSync(existingMdx, 'utf8');
  const m = txt.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) die(`no frontmatter in ${existingMdx}`);
  const data = yamlLib.load(m[1]);
  delete data.part;
  const updated = { ...data, series: SERIES.id, episode, media, repro: reproFm };
  if (data.date instanceof Date) updated.date = data.date.toISOString().slice(0, 10);
  const linkedinHint = updated.linkedin ? '' : '# linkedin: https://www.linkedin.com/feed/update/...   (adds a "Discuss on LinkedIn" button)\n';
  fs.writeFileSync(existingMdx, `---\n${yaml(updated)}${linkedinHint}---\n${txt.slice(m[0].length)}`);
  log(`updated frontmatter of ${path.relative(ROOT, existingMdx)} (text kept)`);
  done();
}

const description = seriesLine
  ? `Episode ${episode} of ${SERIES.title}: ${seriesLine.replace(/^Post \d+ of [^:]*:\s*/i, '').replace(/^LLM inference through the lens of a GPU\.\s*/i, '')}`.trim()
  : firstSentence(bodyLines);

const fm = {
  title,
  description,
  series: SERIES.id,
  episode,
  date: opts.date ?? new Date().toISOString().slice(0, 10),
  tags,
  media,
  measuredOn: { ...MEASURED_ON, ...(runId ? { run: runId } : {}) },
  repro: reproFm,
};

const mdx = `---
${yaml(fm)}# linkedin: https://www.linkedin.com/feed/update/...   (adds a "Discuss on LinkedIn" button)
---
import MeasuredOn from '../../../components/MeasuredOn.astro';
import Reproduce from '../../../components/Reproduce.astro';
import Sources from '../../../components/Sources.astro';
import Figure from '../../../components/Figure.astro';
import Callout from '../../../components/Callout.astro';

${toMdxBody(bodyLines)}

${goDeeper()}

<MeasuredOn post={frontmatter} />

<Reproduce post={frontmatter} />

<Sources post={frontmatter}>

${sources.map((s) => `- ${linkRuns(esc(s))}`).join('\n')}

</Sources>
`;
fs.mkdirSync(postDir, { recursive: true });
fs.writeFileSync(mdxPath, mdx);
log(`wrote ${path.relative(ROOT, mdxPath)}`);
done();

// ---------- helpers ----------
function toMdxBody(ls) {
  const out = [];
  let prevKind = 'blank';
  for (const l of ls) {
    let kind;
    let text;
    if (!l) kind = 'blank';
    else if (/^→\s*/.test(l)) {
      kind = 'ul';
      text = `- ${esc(l.replace(/^→\s*/, ''))}`;
    } else if (/^\d+\.\s/.test(l)) {
      kind = 'ol';
      text = l.replace(/^(\d+\.\s)(.*)$/, (_, n, rest) => n + esc(rest));
    } else {
      kind = 'p';
      text = /^Next post:/i.test(l) ? `**Next post:** ${esc(l.replace(/^Next post:\s*/i, ''))}` : esc(l);
    }
    if (kind === 'blank') {
      if (prevKind !== 'blank') out.push('');
      prevKind = 'blank';
      continue;
    }
    // Each LinkedIn line is its own paragraph; lists stay together.
    if (prevKind !== 'blank' && !(kind === prevKind && kind !== 'p')) out.push('');
    out.push(text);
    prevKind = kind;
  }
  return out.join('\n').trim();
}

function goDeeper() {
  if (!opts.figures.length) {
    return `{/* Go deeper (site only). Add figures from the Sillybench run with --figure, then e.g.
## Go deeper
<Figure post={frontmatter} file="figures/C4_roofline_napkin.png" alt="..." source="${SERIES.repo}/blob/${ref}/runs/<run>/analysis/C4_roofline_napkin.png">Caption.</Figure>
*/}`;
  }
  return `## Go deeper\n\n${opts.figures
    .map((f) => {
      const b = path.basename(f);
      return `<Figure post={frontmatter} file="figures/${b}" alt="TODO: describe ${b}">TODO: caption for ${b}.</Figure>`;
    })
    .join('\n\n')}`;
}

// Escape MDX/markdown specials outside `code spans`.
function esc(s) {
  return s
    .split(/(`[^`]*`)/)
    .map((part, i) =>
      i % 2
        ? part
        : part
            .replace(/[{}]/g, '\\$&')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/~/g, '\\~')
            .replace(/\*/g, '\\*'),
    )
    .join('');
}

function linkRuns(s) {
  return s.replace(new RegExp(RUN_RE.source, 'g'), (_, id) => `Sillybench run [\`${id}\`](${SERIES.repo}/tree/${ref}/runs/${id})`);
}

function firstSentence(ls) {
  const t = ls.find((l) => l.length > 40) ?? title;
  return t.length > 180 ? t.slice(0, 177) + '…' : t;
}

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .split('-')
    .filter(Boolean)
    .slice(0, 7)
    .join('-');
}

// Minimal YAML writer: JSON scalars are valid YAML and need no quoting rules.
function yaml(obj, indent = '') {
  let s = '';
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) {
      if (!v.length) s += `${indent}${k}: []\n`;
      else if (v.every((x) => typeof x !== 'object')) s += `${indent}${k}: ${JSON.stringify(v)}\n`;
      else s += `${indent}${k}:\n` + v.map((x) => `${indent}  - ${JSON.stringify(x)}\n`).join('');
    } else if (v && typeof v === 'object') {
      s += `${indent}${k}:\n${yaml(v, indent + '  ')}`;
    } else if (k === 'date') {
      s += `${indent}${k}: ${v}\n`;
    } else {
      s += `${indent}${k}: ${JSON.stringify(v)}\n`;
    }
  }
  return s;
}

function remoteHasTag(repo, tag) {
  const r = spawnSync('git', ['ls-remote', '--tags', `${repo}.git`, `refs/tags/${tag}`], { encoding: 'utf8' });
  return r.status === 0 && r.stdout.trim().length > 0;
}

function log(m) {
  console.log(`  ${m}`);
}
function warn(m) {
  console.warn(`  ! ${m}`);
}
function die(m) {
  console.error(`import-post: ${m}`);
  process.exit(1);
}
function done() {
  console.log(`done: ${name}`);
  process.exit(0);
}

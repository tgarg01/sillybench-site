# AI on Silicon

The website for my GPU-inference series. **Series 1: LLM inference through the lens of a GPU.** Each LinkedIn post
becomes an *episode* page with everything LinkedIn can't hold:
* the animation and the same story step by step (stills + carousel PDF)
* extra figures from the run
* the exact setup ("Measured on")
* **Reproduce it**: the episode's Jupyter notebook, readable on the page with its outputs, plus Open in Colab / GitHub / download
* the full **Sources & methodology** footer

Astro 7 + MDX, deployed to GitHub Pages. No server and no database.

## Publish an episode

1. **Write and render it in `~/Posts/post-NN/`** as usual: `post-NN.md` (with its Sources footer), `make_gif.py`,
   `export_stills.py post-NN`.
2. **Notebook:** in the series repo (Sillybench for Series 1), add `posts/post-NN/<name>.ipynb` and its results.
   Commit, push, and tag: `git tag -a post-NN -m "Episode NN" && git push origin main post-NN`.
3. **Import it here:**
   ```bash
   npm run import -- ~/Posts/post-03 --slug batching --date 2026-10-23 --card 4 \
     --figure ~/Posts/Sillybench/runs/<run>/analysis/<figure>.png
   ```
   The importer:
   * clones the repo at tag `post-03` (or `main` if there's no tag yet)
   * runs the notebook once with the stored results, so the page shows its outputs
   * writes `public/media/post-03/` (looping MP4 from the GIF, WebP stills, carousel PDF, social card, notebook)
   * writes `src/content/posts/03-batching/index.mdx`
4. **Edit the MDX:** sharpen the `description`, write the "Go deeper" captions, and add the `linkedin:` URL once the post is live.
5. `npm run dev` to preview (http://localhost:4321/AIonSilicon/). Commit and push; `main` deploys.

**Re-running the importer** on an existing episode (for example after updating its notebook or tag) only updates the
frontmatter it owns (`episode`, `media`, `repro`) and keeps your text. `--force` rewrites the whole MDX instead.
`node scripts/import-post.mjs` with no arguments lists every option (`--narrated` adds a Narrated tab later).

**Preview a notebook before pushing it:** add `--local ~/Posts/Sillybench` to use your local checkout. Links still
point at the tag, so re-import without `--local` once it's pushed and tagged, before you deploy.

**Announce the next episode:** set `next` (`episode`, `title`, `date`) for the series in `src/data/series.json`. It
shows on the home page, the series page and the latest episode until that episode is published.

**A new series:** add it to `src/data/series.json` with its own repo, then import with `--series <id>`.

## Layout

```
src/content/posts/NN-slug/index.mdx   one post (frontmatter schema: src/content.config.ts)
public/media/post-NN/                 its media (written by the importer)
src/components/                       PostHero (Animation / Step by step tabs), MeasuredOn, Reproduce, Sources, Figure, ...
src/data/series.json                  each series: number, title, blurb, its notebook repo
src/lib/notebook.ts                   renders a .ipynb to static HTML for the Reproduce section
src/site.config.ts                    name, links, comments, analytics: fill these in
scripts/import-post.mjs               ~/Posts/post-NN → site post
scripts/og-default.mjs                site-wide social card
```

## Settings to fill in (`src/site.config.ts`)

| Setting | What it turns on |
|---|---|
| `links.cv`, `links.email` | CV / email buttons on /about (LinkedIn is already set) |
| `giscus.*` | Comments under each post, stored in GitHub Discussions (values from https://giscus.app) |
| `goatcounter` | Privacy-friendly page-view counts (free GoatCounter account) |

## Hosting

* **GitHub Pages:** create the GitHub repo, push, then Settings → Pages → Source: **GitHub Actions**.
  The site is served at `https://tgarg01.github.io/AIonSilicon/`.
* **Custom domain:** buy it (e.g. Cloudflare Registrar), add it under Settings → Pages, then set the repository
  variables `SITE_URL=https://yourdomain.com` and `BASE_PATH=/`.
* **Media size:** each episode adds about 5–10 MB (most of it the carousel PDF). GitHub Pages allows
  1 GB, so season 1 fits. When it grows, upload `public/media/` to Cloudflare R2 and set `PUBLIC_MEDIA_BASE`
  to its URL; the pages then load media from there.
* `.github/workflows/links.yml` builds the site weekly (and on every PR) and checks every link, so a moved
  notebook or run file shows up as a failed run.

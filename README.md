# AI on Silicon

The website for **LLM inference through the lens of a GPU**. Each LinkedIn post gets a permanent home here with
everything LinkedIn can't hold: the narrated video with captions, the step-by-step stills, the carousel PDF, extra figures
from the run, the exact setup ("Measured on"), a "Reproduce it" box pointing at [Sillybench](https://github.com/tgarg01/Sillybench),
and the full **Sources & methodology** footer.

Astro 7 + MDX, deployed to GitHub Pages. No server and no database. Costs nothing apart from an optional domain.

## Publish a post (the whole workflow)

1. **Write and render it in `~/Posts/post-NN/`** as usual: `post-NN.md` (with its Sources footer), `make_gif.py`,
   `export_stills.py post-NN`, and optionally the narration + `make_video.py`.
2. **Sillybench:** commit and push the post's notebook and `results/`, then tag the commit:
   `git tag post-NN && git push origin post-NN`.
3. **Import it here:**
   ```bash
   npm run import -- ~/Posts/post-03 --slug batching --date 2026-10-23 --ref post-03 --card 4 \
     --figure ~/Posts/Sillybench/runs/<run>/analysis/<figure>.png
   ```
   This writes `src/content/posts/03-batching/index.mdx` and `public/media/post-03/`:
   * GIF → silent looping MP4, about 4× smaller
   * narrated MP4 re-encoded to 720p, with SRT → VTT captions
   * stills → WebP at 1080 and 2160 px
   * carousel PDF copied
   * a 1200×630 social card in the series style
4. **Edit the MDX:** sharpen the `description`, write the "Go deeper" captions, and add the `linkedin:` URL once the post is live.
5. `npm run dev` to preview (http://localhost:4321/AIonSilicon/), then open a PR. Merging to `main` deploys.

Re-running the importer on an existing post only refreshes the media and keeps your MDX edits. Pass `--force` to
regenerate the MDX too, or `--media-only` to skip it. `node scripts/import-post.mjs` with no arguments lists every option.

## Layout

```
src/content/posts/NN-slug/index.mdx   one post (frontmatter schema: src/content.config.ts)
public/media/post-NN/                 its media (written by the importer)
src/components/                       PostHero, StepGallery, MeasuredOn, Reproduce, Sources, Figure, Callout, ...
src/data/series.ts                    series roadmap (the 16 planned parts, shown on /series/...)
src/data/runs.ts                      the Sillybench runs shown on /runs
src/data/glossary.ts                  /glossary terms
src/site.config.ts                    name, links, newsletter, comments, analytics: fill these in
scripts/import-post.mjs               ~/Posts/post-NN → site post
scripts/og-default.mjs                site-wide social card
```

## Settings to fill in (`src/site.config.ts`)

| Setting | What it turns on |
|---|---|
| `links.linkedin`, `links.cv`, `links.email` | LinkedIn/CV/email buttons on /about and in the footer |
| `newsletter.buttondownUser` | Email signup form (free Buttondown account); otherwise RSS + LinkedIn buttons |
| `giscus.*` | Comments under each post, stored in GitHub Discussions (values from https://giscus.app) |
| `goatcounter` | Privacy-friendly page-view counts (free GoatCounter account) |

## Hosting

* **GitHub Pages:** create the GitHub repo, push, then Settings → Pages → Source: **GitHub Actions**.
  The site is served at `https://tgarg01.github.io/AIonSilicon/`.
* **Custom domain:** buy it (e.g. Cloudflare Registrar), add it under Settings → Pages, then set the repository
  variables `SITE_URL=https://yourdomain.com` and `BASE_PATH=/`.
* **Media size:** each post adds about 8–15 MB (most of it the carousel PDF and the narrated video). GitHub Pages allows
  1 GB, so season 1 fits. When it grows, upload `public/media/` to Cloudflare R2 and set `PUBLIC_MEDIA_BASE`
  to its URL; the pages then load media from there.
* `.github/workflows/links.yml` builds the site weekly (and on every PR) and checks every link, so a moved
  Sillybench file shows up as a failed run.

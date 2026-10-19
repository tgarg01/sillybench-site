import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// One folder per post: src/content/posts/<NN-slug>/index.mdx (written by `npm run import`).
// Media paths are relative to media.dir under the media base (public/media/<dir>/ by default).
const posts = defineCollection({
  loader: glob({ pattern: '**/index.mdx', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    series: z.string().default('llm-inference-gpu'),
    episode: z.number().int().positive(),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    draft: z.boolean().default(false),
    tags: z.array(z.string()).default([]),
    linkedin: z.string().url().optional(),
    media: z.object({
      dir: z.string(),
      loop: z.object({
        mp4: z.string(),
        poster: z.string(),
        width: z.number(),
        height: z.number(),
        seconds: z.number(),
      }),
      // Optional: a narrated video adds a third tab to the hero (import with --narrated).
      narrated: z
        .object({ mp4: z.string(), vtt: z.string().optional(), poster: z.string(), seconds: z.number() })
        .optional(),
      stills: z.array(z.object({ src: z.string(), full: z.string() })).default([]),
      carousel: z.string().optional(),
      og: z.string(),
      card: z.string().optional(), // thumbnail on post lists; defaults to loop.poster
    }),
    measuredOn: z
      .object({
        gpu: z.string(),
        model: z.string(),
        engine: z.string(),
        workload: z.string(),
        run: z.string().optional(),
      })
      .optional(),
    repro: z
      .object({
        repo: z.string().url(),
        ref: z.string(),
        path: z.string().optional(),
        notebook: z.string().optional(), // path of the episode's notebook in the repo
        colab: z.boolean().default(false),
        // A copy of the notebook (with outputs) shown read-only on the page, relative to media.dir.
        view: z.string().optional(),
        viewNote: z.string().optional(), // e.g. "Outputs from a stored-mode run on 2026-10-19"
        note: z.string().optional(), // shown when there is no notebook yet
      })
      .optional(),
  }),
});

export const collections = { posts };

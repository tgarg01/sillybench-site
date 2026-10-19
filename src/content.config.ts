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
    part: z.number().int().positive(),
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
        notebook: z.string().optional(),
        colab: z.boolean().default(false),
        note: z.string().optional(),
      })
      .optional(),
  }),
});

export const collections = { posts };

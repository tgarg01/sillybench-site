// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// GitHub Pages without a custom domain serves the site at https://<user>.github.io/<repo>/.
// Once a custom domain is set up, build with SITE_URL=https://yourdomain.com BASE_PATH=/
const site = process.env.SITE_URL ?? 'https://tgarg01.github.io';
const base = process.env.BASE_PATH ?? '/AIonSilicon';

export default defineConfig({
  site,
  base,
  trailingSlash: 'ignore',
  integrations: [mdx(), sitemap()],
});

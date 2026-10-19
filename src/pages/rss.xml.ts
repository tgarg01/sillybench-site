import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { SITE } from '../site.config';
import { postUrl } from '../lib/url';

export async function GET(context: APIContext) {
  const posts = (await getCollection('posts', (p) => !p.data.draft)).sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf(),
  );
  return rss({
    title: SITE.name,
    description: SITE.description,
    site: context.site!,
    items: posts.map((p) => ({
      title: `Part ${p.data.part}: ${p.data.title}`,
      description: p.data.description,
      pubDate: p.data.date,
      link: postUrl(p.id),
      categories: p.data.tags,
    })),
  });
}

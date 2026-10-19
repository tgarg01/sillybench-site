// Everything you are likely to change about the site, in one place.
// Empty strings switch a feature off (the page then hides it).

export const SITE = {
  name: 'AI on Silicon',
  tagline: 'LLM inference, measured on real GPUs.',
  description:
    'LLM inference through the lens of a GPU: every number measured on real hardware, every claim sourced, every result reproducible from a public repo.',
  author: 'Tushar Garg',
  lang: 'en',

  links: {
    linkedin: 'https://www.linkedin.com/in/tushargarg22/',
    youtube: '',
    x: '',
    cv: '', // link to a PDF résumé (e.g. /cv.pdf in public/) to show a CV button on /about
    email: '', // shown on /about if set
  },

  // Where post media (videos, stills, PDFs) is served from. Defaults to /media inside this site.
  // Move it to Cloudflare R2 later by uploading public/media/ and setting PUBLIC_MEDIA_BASE at build time.
  mediaBase: import.meta.env.PUBLIC_MEDIA_BASE || '',

  // Giscus (GitHub Discussions comments): fill all four from https://giscus.app; '' hides comments.
  giscus: { repo: '', repoId: '', category: '', categoryId: '' },

  // Privacy-friendly analytics. GoatCounter code, e.g. 'aionsilicon' for aionsilicon.goatcounter.com; '' = off.
  goatcounter: '',
} as const;

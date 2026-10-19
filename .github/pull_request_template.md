## Post checklist

- [ ] Every number in `post-NN.md` traces to a Sillybench file named in its Sources footer
- [ ] Animation, stills and carousel re-rendered after the last number change (`make_gif.py`, `export_stills.py`)
- [ ] Sillybench: notebook + `results/postN/` committed and pushed; tag `post-NN` created; `repro.ref` points at it
- [ ] `npm run import -- ~/Posts/post-NN ...` run; description and "Go deeper" captions written (no TODOs)
- [ ] `npm run build` passes; page checked in light, dark and at phone width
- [ ] Social card (`public/media/post-NN/og.png`) looks right
- [ ] After merge: LinkedIn post live, `linkedin:` URL added to the frontmatter

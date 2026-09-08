# Learnings

Concrete, earned lessons from building email-manager. No general advice — only
things that actually burned time or required non-obvious fixes here.

## Files

- [`browser-model-2026-09-08.md`](browser-model-2026-09-08.md) — actual browser model loading, CSP failure/repair, and bounded ranking comparison.

- [`lessons.md`](lessons.md) — 20 numbered lessons organized by topic:
  Transformers.js/ONNX (1–4), IndexedDB (5–8), Cloudflare Workers (9–13,
  Build Pipeline (14–16, historical), OAuth/Auth (17–20). Lessons 14–16 are
  historical context from the pre-Vite OpenNext era.
- [`external-references.md`](external-references.md) — one-line entries per
  topic pointing to authoritative external sources (Transformers.js, ONNX,
  IndexedDB, Cloudflare Workers, Drizzle, better-auth, RFC 8058). No
  re-explanation of concepts that these sources already cover well.
- [`new-things.md`](new-things.md) — short stubs for non-standard tech in this
  repo (study queue). 3–5 lines each; fill `Why here:` after learning.

## Guidance

Per the global documentation standard: for concepts with authoritative
sources, reduce each entry to one-sentence "what", one-sentence "why it
matters to THIS project", a link to the source, and an optional "where in this
codebase" pointer. Do not re-explain things that already have a definitive
source.

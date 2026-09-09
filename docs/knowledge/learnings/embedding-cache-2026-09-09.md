# Embedding cache identity — 9 September 2026

## Reproduced defect and repair

Actual browser IndexedDB/search accepted a same-width vector explicitly tagged
for an unrelated model as a top result (score 1.00000008). Indexed counts also
accepted every non-null vector. Untagged vectors could not establish which
model, revision or preparation generated them.

The existing MiniLM model remains in use. Its previously observed revision
`751bff37182d3f1213fa05d7196b954e230abad9` is pinned. Cache identity includes model,
revision, fp32, mean pooling, normalization and email-text preparation version.
Search and counts require this identity and 384 finite normalized dimensions.
Untagged, foreign and malformed vectors remain stored alongside their emails,
but are pending until the user runs normal indexing. No email deletion or
IndexedDB schema reset occurs. Sync preserves the vector's original identity;
indexing writes current identity only after validating fresh inference.

The first upgrade therefore temporarily removes legacy messages from semantic
search until reindexing; cached inbox/sender/digest data remains available.
Existing batch limits and explicit indexing controls remain. The result badge
now says “Similarity” with a numeric score rather than claiming a match probability.
Subject/sender boosts remain part of the ranking; the score is not calibrated.

## Evidence

[Machine-readable receipt](embedding-cache-2026-09-09.json) retains the exact
synthetic corpus, queries and top-three results. Sixteen synthetic messages and
eighteen queries included flight cancellation, paid/unpaid bills and promotional
distractors: MiniLM scored 16/18, BGE 17/18. Baseline uses application ranking;
BGE uses prefixed query cosine similarity. This is a diagnostic comparison, not
an isolated model benchmark or real-inbox accuracy. No model replacement is justified.

The fresh pinned-model cold-cache verifier produced 384 finite normalized
values in 6116 ms with zero application CSP violations. That proves loading and
inference, not retrieval accuracy or offline installation. Model downloads used
an isolated temporary browser, with no owner profile, mailbox or credentials.
The existing MiniLM [model card](https://huggingface.co/Xenova/all-MiniLM-L6-v2)
identifies Apache 2.0 licensing; no new runtime dependency was added.

`pnpm verify:local-mailbox` uses actual account-scoped IndexedDB and fixture
inference. Five legacy/foreign/short/NaN/infinite records remain intact through
refresh, return no search hits and count pending; partial indexing leaves three,
retry completes all five, and page reload preserves identities and other-account
mail. Unit checks reject invalid inference before any identity/write is saved.
Cancellation/retry and delayed account-A writes retain their existing checks.

No production migration or deployment, real mail, unsubscribe, native
installation, or Google-account acceptance is claimed. Those requirements remain
in [issue 54](https://github.com/Significant-Hobbies/email-manager/issues/54).

## Dependency gates required before push

The full quality gate independently found four newly blocking advisories. A
separate dependency commit upgrades the static landing from Astro 6.4.8 to 7.2.8,
retains its sitemap integration and adds documented `compressHTML: true` to
preserve inline word boundaries. Existing root Vite 8.1.5 and Wrangler 4.114.0 stay
unchanged. Scoped overrides use Sharp 0.35.4 (`miniflare>sharp` and the existing
`sharp@>=0.34.0 <0.35.0` selector), js-yaml 4.3.2 and svgo 4.1.0. No new direct
production dependency or provider configuration was introduced.

Resolved advisories: GHSA-26w7-cxv4-gfx2, GHSA-rgj7-g3m4-5g8c,
GHSA-2883-xcg3-v3hh and GHSA-w27v-7q3p-w38r. Full quality passes 121 tests, all
existing thresholds, and zero critical/high advisories; the complete production
build, sitemap/canonical checks and 47-document validation pass. Existing
Wrangler/Workers-types peer warning remains; application/Worker typechecks pass.

All six existing desktop/mobile Playwright assertions pass against the actual
built assets and a synthetic logged-out session API. The first unisolated mobile
run reached the Google button but failed on Clarity collect CORS page errors from
localhost. The final local-only test CSP blocks third-party telemetry while
allowing the actual SaaS Maker footer scripts. This proves landing text, footer,
touch target, no overflow and navigation to the real sign-in component; it does
not qualify hosted analytics or Google callback completion. No product assertion
was suppressed or changed.

[390px landing](email-astro7-phone.png) · [390px sign-in](email-login-phone.png).
All test browsers/servers closed. The initial sign-in screenshot caught an
in-progress entrance animation; the retained screenshot was captured after it
settled and visually inspected. No owner mail or profile was used.

## Review follow-up: sparse vectors

Root review identified that JavaScript `every` and `reduce` skip array holes.
A sparse 384-slot array with only its first value set to 1 could therefore pass
validation but produce NaN during ranking. Validation now checks every slot
through `Array.from`; regression tests reject sparse cached vectors even with
current identity and reject a sparse query before scoring. Valid dense vectors
remain searchable. The expanded full gate passes 124 tests.

## Authorized release and ordinary-domain acceptance

Runtime `24142fee34c39a2f941e4c8855b5926c24a62255` passed exact CI 34323190467
and all six Fleet deployment gates. `pnpm run deploy` published Worker version
`9ad4e473-50cb-4cfb-8735-895e4a909941`, deployment
`5df53469-9e8c-40fa-b4bb-59febc65be2d`, at 100% traffic with the full source tag.
[Release receipt](embedding-cache-release-2026-09-09.json).

Ordinary `https://mail.significanthobbies.com/app` serves the byte-identical
`/assets/index-Dw903OH4.js` built from that source. Real 390px public navigation
reaches the actual Google sign-in button; landing and login have no overflow
or page errors. Health/session return 200 and anonymous mail returns 401. Hosted
telemetry produced no page errors in this guest check; no test CSP or mocked
response was used for hosted acceptance.

[Hosted landing](email-deployed-landing-phone.png) ·
[Hosted sign-in](email-deployed-login-phone.png). Both screenshots were inspected.
Google credentials/callback, account switching, real mailbox search and
unsubscribe remain unqualified. This release does not make the full app shareable.

Known rollback: `pnpm exec wrangler rollback b42e2e27-b358-4ee7-a338-f9cc9d4cbc69 --name email-manager` restores prior runtime 451b699; no rollback was performed.
No D1 migration, provider configuration, credentials or mailbox writes occurred.
The release-record commit changes documentation only and does not require
another deployment.

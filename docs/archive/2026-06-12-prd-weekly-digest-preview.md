# Weekly digest preview and export loop

**Status:** Shipped (2026-06-20)
**Product:** Email Manager
**Theme:** Personal memory OS
**Primary surface:** `#digest` or folded into `#analytics`

## Problem

The app already knows enough to summarize the inbox, but the output is still a library function and a planned fixture. Users can search, triage, and inspect, but there is no dedicated reflection loop that says:

- who went quiet,
- which threads should be reopened,
- what patterns dominated the week.

That leaves the app strongest at inbox management, but weaker at "what should I remember or revisit next week?"

## Target user

An active Gmail user who checks the app regularly, wants privacy-preserving insight, and prefers deterministic local outputs over a server-sent AI digest.

## Current failure

- Weekly signals exist in code, but not in the product.
- There is no visible digest surface to invite habit formation.
- There is no first-class export path to a downstream journaling workflow.

## Desired behavior

The user can:

- generate a digest from locally cached emails,
- inspect quiet relationships, revisitable threads, and weekly themes,
- open the underlying thread or sender context,
- copy a summary to clipboard in a format suitable for another app,
- keep the entire workflow offline once data is local.

## Non-goals

- No new Gmail write scopes.
- No server cron or background generation.
- No automatic outbound email.
- No LLM prose generation in v1.

## UX shape

- Add a `Digest` entry in the sidebar or make digest a secondary panel under `Analytics`.
- Show three sections:
  - Quiet relationships.
  - Threads to revisit.
  - Weekly themes.
- Include one primary CTA:
  - `Generate this week`.

## Success proof

- User can generate a digest without leaving the app.
- User can open at least one quiet relationship or revisit thread from the digest.
- User can export a concise local summary with no message bodies.

## Acceptance criteria

- Digest preview is powered by `buildWeeklyDigest(...)`.
- Digest UI renders all three digest sections.
- No server storage is introduced.
- No additional Gmail scopes are required.

## Risks

- Digest quality can feel repetitive if the heuristics are too strict.
- Theme labels may be too coarse without a future embedding-based pass.
- A separate sidebar item could compete with existing navigation if not positioned carefully.

## Suggested follow-up

- Add local retention for generated digests only after the preview loop feels valuable in dogfood.

# Testing Strategy

## Unit tests (Vitest)

```bash
pnpm test              # vitest run
pnpm test:coverage     # vitest run --coverage
```

Unit tests live in `src/lib/__tests__/` and cover pure library logic:

- `digest.test.ts` — weekly digest builder (`buildWeeklyDigest`).
- `filter-builder.test.ts` — Gmail filter XML recipe builder.
- `format-date.test.ts` — humanized date formatting.
- `inbox-sample.test.ts` — inbox sample cache.
- `sent-reply.test.ts` — thread reply status classification.
- `subscription-senders.test.ts` — deduped unsubscribe sender extraction.
- `sync-age.test.ts` — sync age calculation.
- `triage-session.test.ts` — focused session queue builder, keymap,
  `isTypingTarget` (duck-typed, Node-safe).

Unit tests mock the DB and do not require credentials. They run in CI on every
push.

## E2E tests (Playwright)

```bash
pnpm test:e2e          # playwright test
pnpm test:e2e:mobile   # playwright test --project=mobile
```

E2E tests live in `tests/`:

- `example.spec.ts` — landing hero/features/CTA, no horizontal scroll, CTA touch
  target ≥44px (desktop + mobile).
- `open-app.spec.ts` — `/app` open link behavior.

### What e2e does NOT cover

- **Signed-in flows** require manual OAuth — unit tests cover lib logic only.
- `ci.yml` does not run e2e (the weekly workflow does — see
  [`../operations/jobs/README.md`](../operations/jobs/README.md)).

## Digest fixture verification

```bash
pnpm digest:verify
# or: pnpm dlx tsx scripts/verify-digest-fixture.mjs
```

Golden-file check for the weekly digest builder:

- Input: `fixtures/digest-sample-emails.json` (synthetic `Email`-shaped rows).
- Expected output: `fixtures/weekly-digest-sample.json` (golden digest).
- Logic: `src/lib/digest.ts` — `buildWeeklyDigest(emails, options?)`.

This verifies the pure digest builder produces deterministic output against the
fixture. It does not test the UI or IndexedDB integration.

## CI coverage

| Check | CI (`ci.yml`) |
| --- | --- |
| `pnpm lint` | yes |
| `pnpm typecheck` | yes |
| `pnpm test:unit` | yes |
| `pnpm build` | yes |
| `pnpm check:docs` | yes |
| `pnpm test:e2e` | no — run locally before a release when relevant |

See [`../operations/jobs/README.md`](../operations/jobs/README.md) for the full
scheduled job catalog.

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
- `guest-inbox.test.ts` — fictional fixture provenance and local text search.

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
- `guest-sample.spec.ts` — fictional inbox browse/search/empty states, explicit
  Connect Gmail consent, retryable synthetic auth errors, account-scoped signed-in
  boundary, and `/app` + `/about` screenshots at 390/768/1440 pixels.

All browser tests use `local-test.ts` to block external requests and mock auth and
mailbox endpoints. Guest messages remain in component memory: they never seed
IndexedDB or load the embedding model. The existing inbox-sample helpers still
serve authenticated sampling; the guest fixture uses them only with local data.

For an installed system Chromium, set
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium` for both Playwright and
`pnpm verify:local-mailbox`. This switches the mobile project to Chromium device
emulation; without it, the existing iPhone/WebKit project remains the default.
A running local Vite server may be reused for these mocked browser tests. This
qualifies local rendering and synthetic boundaries, not Worker-backed OAuth.

### What e2e does NOT cover

- **Real signed-in flows** still require manual OAuth and mailbox qualification.
  Synthetic sessions are regression evidence, not live acceptance.
- `ci.yml` does not run e2e; run relevant browser checks locally.

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

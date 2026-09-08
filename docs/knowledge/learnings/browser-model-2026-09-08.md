# Browser model verification — 8 September 2026

## Loading failure and repair

An isolated Chrome browser loaded the actual application embedding module through
Vite, with the application's Content Security Policy on its HTML response.
No environment files, owner browser profile, mailbox, API or analytics were loaded.

The original policy blocked the model redirect to `us.aws.cdn.hf.co`. Allowing
that host exposed a second failure: the locked ONNX runtime downloads its WASM
and module factory from jsDelivr. Both were blocked, leaving no available backend.
The repair allows the observed model host, the exact runtime version's `dist/`
path for fetching/importing, and blob scripts for the library's cached factory.
It does not allow arbitrary jsDelivr packages. Runtime dependency updates must
recheck this explicit version and the browser command below.

Run `pnpm verify:browser-model` with Node 24 or later and Chrome installed.
It downloads roughly 95 MB into an isolated browser, applies the application CSP,
generates an actual embedding, and checks 384 finite normalized dimensions and
zero CSP violations. Browser and local server close on completion or failure.
This is an explicit network check, separate from ordinary unit tests. The
repair passed the full local quality gate (104 tests, unchanged coverage and
complexity floors) and documentation validation (46 Markdown files).

## Ranking observation

The [measurement receipt](browser-model-2026-09-08.json) records a comparison on
eight synthetic messages: flight, hotel, refund, meeting, invoice, lease,
newsletter and concert. Ten short queries had a single intended target each.
MiniLM fp32 put concert ahead of flight for “boarding pass for my trip”,
“boarding pass” and “airline reservation”. Re-embedding and repeating the search
produced the same result; it was not a first-inference glitch.

The candidate `Xenova/bge-small-en-v1.5` q8, with its retrieval query prefix and
mean pooling, ranked the intended message first for all ten examples. Its ONNX
file was 34,014,426 bytes versus MiniLM's 90,387,606 bytes. Timings in the receipt
are observations on this Mac; model loading and first inference have different
measurement boundaries and are not comparable speed benchmarks.

These examples establish a reproducible ranking weakness, not real-inbox
accuracy or a statistically meaningful model evaluation. Production still uses
MiniLM. Replacing it requires model-tagged vectors, exclusion/re-indexing of
legacy vectors without deleting email data, and verification with broader
examples. Existing cosine scores are not calibrated match probabilities.

Signed-in mailbox and production qualification remain in
[issue 54](https://github.com/Significant-Hobbies/email-manager/issues/54).

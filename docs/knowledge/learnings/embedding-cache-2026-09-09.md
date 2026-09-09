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

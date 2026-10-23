# Execution ledger — 2026-10-22-persist-form

Plan: docs/superpowers/plans/2026-10-22-persist-form.md
Spec: docs/superpowers/specs/2026-10-22-persist-form-design.md

Ruling: Work in the user's new standalone repository on codex/persist-form, not a second checkout; there is no existing product to isolate.
Pre-flight: adapters → queue → core share PersistAdapter; values → core share FieldValues snapshots; entrypoints → consumer tests share exports. No conflicting signatures.
Ruling: filterValues returns a partial shape at runtime; the restore boundary owns the documented generic assertion. No application-schema validation is claimed.

Tasks 1–4: implementation present; 49 tests pass, typecheck/lint/build pass on React 19.3.1 + RHF 7.55.0. Initial tests failed on missing modules. A later regression test caught flush resolving after clone failure; retaining the clone error fixed it and the suite passed.
Ruling: session restoration and lifecycle tests live in hook.test.tsx rather than duplicating the same behavior with mocked sessions. Queue and value processing have independent unit tests.
Ruling: tsdown defaults produced .mjs while exports targeted .js; set platform neutral, ES2022 and fixedExtension false. Package validator caught the mismatch before tarball consumption.
Remaining: extended lifecycle tests, tarball consumers, examples, release/CI, final independent review.

2026-10-23: Tasks 1–6 complete, with verification in docs/implementation/verification.md.
Final review: independent reviewer found clear-during-read edits, Map/Set sensitive fields and invalid JSON removal; all reproduced RED and fixed GREEN. Reviewer rechecked core and found only example lock integrity; fixed via prepare-examples and verified npm ci + builds.
Additional regressions: excluded uncloneable values and restoration-finally clone rejection fixed; 68 tests now pass on locked React 19/RHF 7.55. Earlier full suite of 66 passed on React 18/RHF 7.90.
Package checks: exports mismatch and use-client banner leaking into declarations caught and fixed. Consumer TypeScript now runs without skipLibCheck. Final React 18/19 tarball smoke, SSR and tree-shaking checks passed.
Ruling: commits consolidate the first four tasks and final packaging/docs/tests rather than one commit for every planned substep. This was a new repository with no prior commit; all deliverables remain reviewable.
Ruling: leave the completed local codex/persist-form branch intact; no main merge, remote creation, push or publish is in the authorized scope.

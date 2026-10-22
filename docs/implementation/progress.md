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

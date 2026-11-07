---
name: write-unit-tests
description: Writes the smallest Vitest unit tests for MIT Sailing libs and actions. Use when adding or rewriting *.test.ts coverage, or when the user asks a sub-agent to write tests.
---

# Write unit tests

Write **few, behavioral** tests. Do not exhaust the public API.

**Cite:** `AGENTS.md` Tests; `.cursor/rules/tdd.mdc`. Do not paste those files.

## Size

- Default: **1–3** `it` blocks per module. Add a fourth only for a real extra branch.
- One `expect` per outcome. Loop when repeating the same check (`for` + last assertion).
- No `expect.assertions`. No Playwright-style soft asserts. No `vi.resetModules()` unless the module keeps process-wide state that stubbing cannot reach.
- Do not mock the unit under test. Mock I/O boundaries only (`vi.fn()`).
- Do not test log lines, constructor names, or “redis is missing” when the implementation is in-memory.
- `it` titles: short lowercase verb phrase, no “should”, no period.
- Tests never read the live calendar; use unique string keys, not `Date.now()`.

## After writing

Run only:

```sh
npm run test -- <the-test-file>
```

If it fails, fix the **test** unless production code is wrong. Do not add more cases to silence a failure.

# ADR-0006: Behaviour specs — one written source of truth for what the system must do

- **Status:** Accepted
- **Date:** 2026-10-05

## Context
TEE Admin records **why** (ADRs), **work** (GitHub issues) and **big designs**
(`docs/*.md`). Nothing records, in one place, **what each feature must do**. So
a fix is checked against the bug in front of it, not against everything that
area is supposed to do, and requirements get cut, dropped or broken. On a single
day (2026-10-05) this surfaced three times:

- #191, the owner/RB "change a member's email" UI, was blocked by a bug. #239
  fixed the bug, but nothing said "admins must be able to fix an email", so
  #191 sat unmerged for seven weeks. The owner couldn't fix a typo that made a
  speaker's reminder bounce.
- #245 deliberately left email out of community confirmation. Nothing said "a
  suggested email fix must reach someone who can act on it", so the suggestion
  path for email stayed a dead end: it mails the person's own (wrong) address
  and claims it was "passed to your Recording Brother".
- Privacy drifted from the five choices the owner intended to four slightly
  different ones (#259), and nobody noticed.

## Decision
1. **A behaviour spec per capability** lives in `docs/behavior/<capability>.md`.
   It states the expected behaviour in plain language: the rules, a
   who-can-do-what table, and numbered **scenarios**.
2. **Scenarios have stable IDs** (`CONTACT-EDIT-03`). An ID is never reused or
   renumbered; a retired scenario is marked *Retired* with the reason.
3. **Each scenario carries a status**: ✅ *Implemented* (with the test that
   proves it), ⚠️ *Partial*, ❌ *Gap* (with its issue), or ⏸ *Deferred*. The
   spec is honest about today, so a reader sees what works and what doesn't.
4. **Tests cite the scenarios they prove**, e.g. `it('CONTACT-EDIT-03: …')`.
   `scripts/behavior-coverage.mjs` lists every scenario no test cites. It is
   report-only until the specs settle, then becomes a CI gate.
5. **A PR that changes behaviour updates the spec in the same PR**, and names
   the scenarios it touched. A fix that has no scenario to point at either
   adds one or explains why the behaviour isn't specified.
6. **Where things live:** spec = *what it must do* · ADR = *why it's that way*
   · issue = *the work to get there* · design doc = *how a big piece is built*.
   A spec links to the ADRs behind it and the issues for its gaps; it doesn't
   repeat them.

## Consequences
- Fixing a bug starts with reading the spec for that area, so the fix is
  checked against all of it, not just the symptom.
- A "Gap" in a spec is a standing, visible commitment. Gaps can't be dropped
  silently, because the spec still says ❌.
- The owner can review expected behaviour without reading code.
- The specs only help if kept current. Rule 5 makes that part of every
  behaviour change, and rule 4's coverage report shows where they've drifted.
- First spec: `docs/behavior/contact-details.md`. Others follow as each area is
  touched, not as a big-bang rewrite.

## References
- Issue #260 (this system), #259 (privacy), #190/#258 (admin email correction)
- ADR-0005 (smart-component contract), ADR-0002 (escalation and approval)
- `docs/behavior/README.md`

# Behaviour specs

**What TEE Admin must do**, one file per capability. This is the reference a
change is checked against: read the spec for an area before changing it, and
update it in the same PR when behaviour changes. Why this exists and the rules:
[ADR-0006](../adr/0006-behavior-specs.md).

| Spec | Covers | Prefix |
|---|---|---|
| [contact-details.md](contact-details.md) | See / ask / edit / correct / suggest / confirm a person's name, email, phone, address | `CONTACT-` |

## Writing a scenario
- One row: **ID · scenario · status**. The ID is the spec prefix plus section and
  number (`CONTACT-EDIT-04`), and is never reused or renumbered.
- **Status:** ✅ Implemented (cite the test) · ⚠️ Partial · ❌ Gap (link the
  issue) · ⏸ Deferred · 🔷 Decision needed. Be honest about today.
- Mark a rule the owner stated with *(owner)*.

## Tests cite scenarios
Put the full ID in the test name: `it('CONTACT-EDIT-05: correcting the sign-in…')`.
`node scripts/behavior-coverage.mjs` lists scenarios that no test cites
(report-only for now).

## Where things live
Spec = what it must do · ADR = why · issue = the work · design doc = how a big
piece is built.

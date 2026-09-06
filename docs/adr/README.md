# Architecture Decision Records (ADRs)

Short, durable records of **decisions** — the "why" and the settled model — so we
don't re-litigate the same questions. An ADR captures a decision and its context;
it is **not** a status report (progress lives in GitHub issues) and **not** a
design doc (deep designs live in `docs/*.md`). When a decision changes, add a new
ADR that supersedes the old one rather than editing history.

**When to write one:** a choice that (a) is expensive to reverse, (b) keeps coming
up, or (c) shapes multiple features. "What does *multi-tenancy* mean here?" is the
canonical example.

**Format** (see `template.md`): Title · Status · Context · Decision · Consequences ·
References. Keep it to a page. Number sequentially, `NNNN-kebab-title.md`.

## Index

| ADR | Title | Status |
|-----|-------|--------|
| [0001](0001-tenancy-model.md) | Tenancy model — a tenant is an Ecclesia or a Christadelphian Organization | Accepted |
| [0002](0002-privilege-escalation-and-anti-abuse.md) | Privilege escalation & anti-abuse — trust model for creating tenants, adding members, assigning Recording Brother | Accepted |
| [0003](0003-ui-layering-and-the-design-language-seam.md) | UI layering — route files are mount points; `@my/ui` is the design-language seam | Accepted |

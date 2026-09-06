# ADR-0003: UI layering — where code lives, and the design-language seam

- **Status:** Accepted
- **Date:** 2026-09-06

## Context

The monorepo exists so web and native share business logic and UI. Two habits
have been quietly eroding that, and the Consolidated CMS keystone (#204) brought
both to a head.

**1. `@my/ui` is not a design language; it is a Tamagui passthrough.**
`packages/ui/src/index.tsx` begins `export * from 'tamagui'`, then layers two
overrides (`Button`, `Spinner`) and a set of composed components on top. So
`import { YStack, XStack, Text } from '@my/ui'` is literally importing Tamagui
through an alias. There is no seam at which brand decisions can be made once:

- 26 route files had each hand-rolled the same full-page spinner block, free to
  drift on size, spacing and wording.
- "Every `Button` with a custom `backgroundColor` needs an explicit `hoverStyle`"
  has to survive as a *rule people remember*, because no component owns it.
- 9 files in `apps/next` skip the alias and import `tamagui` directly, which is
  indistinguishable in effect from importing `@my/ui`.

**2. Route files accumulate behaviour that is not web-specific.**
Of 67 `page.tsx` files, only 29 are under 40 lines. The documented pattern
(CLAUDE.md, "Migration Pattern") — a route mounts a screen from
`@my/app/features/` and passes platform state down — is followed where it was
applied: `(public)/events/page.tsx` is 16 lines. But
`admin/(admin-plus)/posts/[id]/page.tsx` had grown to 217 lines holding a
debounced autosave loop, a save-state machine, first-save id-minting and series
loading. None of that is web-specific; all of it was out of reach of native.

**3. The drift produces defects, not just untidiness.** The doc-canvas editor was
built entirely inside `apps/next/features/post-doc-editor/` (4,303 lines) on the
premise that "Lexical is web-only." A per-file audit found only 6 files (~1,041
lines, 24%) actually import Lexical. The other 76% — six resolvers, the widget
UIs, the templates, and `doc-serialization.ts` (the pure `Post ⇄ doc` bijection,
which imports no Lexical at all) — was portable code stranded in the web app.
Because it was stranded, the PII-bearing-occasion set was re-declared there, and
the copy drifted from the canonical one in `legacy-to-post.ts`: `engagement` was
PII-bearing on the legacy read path and **public** through the new editor. The
same post, two different privacy answers. That is the cost of the layering being
advisory.

## Decision

1. **A route file is a mount point.** It may read platform primitives (params,
   router, session, feature flags) and pass them down as props. It holds no
   fetching, no persistence, no state machine, and no layout beyond mounting a
   screen. Target: under ~40 lines.
2. **Screens live in `packages/app/features/<feature>/`.** They receive auth
   state and navigation as props (never `next-auth` / `next/navigation` imports),
   per the existing package rules in CLAUDE.md.
3. **Platform-agnostic rules live in `packages/app`.** If a module does not
   import a platform API, it belongs in a package — not in `apps/*`. Knowledge
   about the domain (what an occasion means, when prose is PII) is declared
   **exactly once**, in `packages/app`, and imported everywhere else.
4. **A platform-only dependency is isolated behind a slot, not a location.**
   When a component needs a web-only engine, the shared component takes it as a
   render prop and the app supplies it. `PostDocChrome` takes `renderCanvas`;
   the web app injects Lexical, and native can inject its own. Choosing a
   rendering engine must not exile the surrounding logic from the packages.
5. **`apps/next` does not import `tamagui` directly.** It imports `@my/ui`.
   Inside `packages/ui`, importing `tamagui` is correct — that package *is* the
   design layer.
6. **Recurring surface states are components, not snippets.** `LoadingState`,
   `ErrorState` and `PageHeader` are the first three. When the same visual
   arrangement appears in three or more places, it becomes a component in
   `packages/ui` and the copies are retired.
7. **`export * from 'tamagui'` is deprecated, and removed incrementally.** It is
   not removed in one pass: each surface that migrates to composed components
   drops its raw-primitive imports, and the blanket re-export is deleted once the
   last consumer is gone. New code does not add raw-primitive imports to app
   routes.

## Consequences

**Good.** Brand decisions get one home, so hover states, spinner sizing and error
colour stop being rules to remember. Domain knowledge gets one home, so a privacy
rule cannot answer differently on two paths. Native becomes reachable for the CMS:
with the chrome, state machine, serialization and resolvers shared, an Expo
canvas is the only thing left to write — not a second editor.

**Costs.** Slots are indirection: `renderCanvas` is a hop that a direct import
does not have, and it is only worth it at a genuine platform boundary. Moving
code across packages produces large, mechanical diffs that are tedious to review.
The `tamagui` re-export will linger for a while, so both import styles coexist
during migration, and the layering is only as good as review attention until
lint enforces it.

**Ruled out.** Duplicating a domain constant "for convenience" in an app.
Building a second editor for native. Adding new full-page spinner or error
snippets to route files.

**Not yet done.** Three doc-editor widgets (`location-resolver`,
`person-resolver`, `flyer-uploader`) still call relative-URL `fetch` and, in one
case, `useUserRole` / `useRouter` directly. They stay in `apps/next` until they
get a shared data seam through `@my/app/provider/get-data` — tracked separately.
No lint rule enforces (1) or (5) yet; today they are review-enforced.

## References

- Epic #131 (Consolidated CMS), issue #204 (doc-editor wiring keystone), PR #207.
- `docs/UNIFIED_POST_MODEL_DESIGN.md`, `docs/cms-rework-design.md` (#202).
- CLAUDE.md — "Cross-Platform Development & Package Architecture Rules".
- Reference implementation: `packages/app/features/post-editor/` (screen + state
  machine + rules), `packages/ui/src/post-editor/post-doc-chrome.tsx` (slot),
  `apps/next/app/admin/(admin-plus)/posts/[id]/page.tsx` (mount point).

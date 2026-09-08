# ADR-0004: Rich-text storage — capture losslessly, render progressively

- **Status:** Accepted
- **Date:** 2026-09-07

## Context

The doc canvas is meant to make posts read well — headings, emphasis, lists,
callouts. But a post is authored once and rendered in at least four places (the
web post view, the announcement email, the newsletter, and plain-text mail
parts), and those renderers are not equally capable. Email HTML in particular
supports far less than a browser, and each renderer is a separate body of code
that will be upgraded at a different time.

Today `TextBlock.body` is a mini-markdown string, and the three layers disagree
about what it can hold:

| | Editor | Storage | Web | Email |
|---|---|---|---|---|
| bold | ✅ | ✅ | ✅ | ✅ |
| italic | ✅ | ✅ | ❌ | ❌ |
| `#` headings | ✅ | ✅ | ✅ | ✅ |
| bullets | capable | ❌ | ✅ | ❌ |
| numbered / underline / highlight / align | capable | ❌ | ❌ | ❌ |

Two live consequences. **Italic is captured and stored but rendered by nobody**,
so it silently disappears at publish. And `docToBlocks` only understands
paragraph and heading nodes — every other node type is discarded — so the moment
a list button exists, lists vanish on the next keystroke, because serialization
re-derives the body on every change.

That is the same failure class as the PII-visibility loss (ADR context, #177):
the editor holds something the storage format cannot express, and it evaporates
on round-trip. Adding formatting buttons on top of this format would ship
formatting that appears to work and then disappears.

The forcing question is therefore not "which buttons" but "what may storage
lose". And the answer the product needs is: **nothing**. A renderer being unable
to display italic is a temporary gap in one renderer; losing the author's italic
is permanent data loss.

## Decision

1. **Storage is lossless. Rendering is progressive.** The editor may capture any
   formatting the storage format can describe, whether or not any renderer
   displays it yet. A renderer that does not understand a mark **ignores** it and
   renders the text — never crashes, never emits raw markup.
2. **`TextBlock.rich?: RichNode[]` is the source of truth** when present: a
   small, portable rich-text tree (plain JSON — blocks with inline runs, each run
   carrying a set of marks). It is renderer-agnostic and platform-neutral: it
   names no Lexical type and no DOM type, per ADR-0003 §3.
3. **`TextBlock.body` remains the plain-markdown projection**, always derived
   from `rich` when `rich` exists. It is not removed and not deprecated: it is
   the graceful-degradation path (plain-text mail, summaries, search) and the
   reason every existing renderer keeps working with no change on the day `rich`
   lands.
4. **Unknown marks survive.** A mark a given writer does not recognise is
   preserved verbatim through read/write, so an older client cannot silently
   strip a newer client's formatting.
5. **Renderers upgrade one at a time**, in the order the audience feels: web post
   view, announcement email, newsletter. No renderer blocks the format.
6. **Inline block markers stay one idea.** `{{kind:id}}` in `body` (§2.2
   revision) appears in `rich` as a `blockRef` inline node — the same reference,
   two projections, never two mechanisms.

## Consequences

**Good.** Formatting can ship in the editor before any renderer supports it,
which is what lets the toolbar land incrementally instead of as one large change
gated on the weakest renderer. Nothing an author types is lost. Existing
renderers keep working untouched because `body` still means what it always did.
The format is JSON, so it extends by adding fields rather than by inventing
syntax — which is exactly where mini-markdown ran out (highlight and alignment
have no markdown spelling).

**Costs.** Two representations of the same prose must be kept consistent; `body`
is derived, never hand-edited, and that invariant needs a test rather than a
convention. A post authored with rich formatting will look plainer in a renderer
that has not caught up, and that gap is visible to real readers until the
renderer lands — an accepted, deliberate trade. The tree is more verbose than a
markdown string.

**Ruled out.** Persisting Lexical editor state as the stored format (couples
storage to one web library, blocks Expo, contradicts ADR-0003 §4). Extending
mini-markdown with invented attribute syntax for highlight/alignment. Gating the
formatting toolbar on every renderer supporting every mark.

## References

- Epic #131, design `docs/cms-rework-design.md` §2.2 (revised), issue #225.
- ADR-0003 (UI layering — platform-neutral rules live in `packages/app`).
- #177 — the prior instance of "editor holds it, storage loses it".

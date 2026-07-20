# Unified Post Model — PII-Aware by Construction

> **Status**: Design / proposal (no code committed). §8 decisions RESOLVED 2026-07-20 → Phase 0 unblocked.
> **Author**: Ken Easson + Claude
> **Date**: 2026-07-16 (decisions 2026-07-20)
> **Depends on / extends**:
> - [`OFFICES_AUDIENCES_AND_SENDING_REDESIGN.md`](./OFFICES_AUDIENCES_AND_SENDING_REDESIGN.md) §2.1 — "News and Events are one thing (a *post*); occasion is data, not a code path."
> - [`ASSURANCE_PII_AND_VERIFY.md`](./ASSURANCE_PII_AND_VERIFY.md) §4–§6 — the assurance ladder and server-side PII redaction (slices A–E).
> **Purpose**: Define the concrete **content data model** that realizes the "one post" idea, and make it so **PII is structurally locatable** — names *and* locations *and* bios — so redaction is a single server-side traversal instead of an audit of every string-interpolation site.

---

## 1. The one idea

> *"If we want to easily scrub names, we should be able to identify where they are in the news/event — same for locations."* — Ken, 2026-07-16

Today PII is smeared across a flat `Event` interface (`candidate.firstName`, `deceased.lastName`, `aboutCandidate` prose, `location.address`, free-text bodies) and a separate `NewsItem`. The assurance doc's Slice E therefore reads as *"audit every redaction point"* (§4 lists ~6 of them) — a whack-a-mole that silently breaks the next time someone interpolates a name in a new template.

**This design removes the whack-a-mole.** A post is an ordered list of **typed blocks**, and every block field that can hold PII carries a **declared PII class**. Redaction becomes one function — `redactPost(post, viewer)` — that walks the blocks and applies the assurance rules by class. Add a new block type → you declare its PII classes once → every read surface is covered for free.

This is the content half of the offices redesign; it does **not** re-litigate the assurance ladder (that doc owns it) or the offices/audience axes (that doc owns those).

---

## 2. Core model

```ts
// One entity for News AND Events. "Event-shaped" vs "news-shaped" is DERIVED, not a type.
interface Post {
  id: string
  tenant: string              // owning ecclesia/org (today's ownerEcclesia)
  authorId: string

  title: string
  occasion: OccasionTag[]     // ['baptism'] | ['wedding','shower'] | ['news','medical'] — DATA, not a code path
  summary?: string            // short, PII-safe headline/teaser (public floor)

  // Reach (WHO can see the post at all) — coarse gate, resolved vs viewer tier
  visibility: Visibility      // 'public' | 'recognized' | 'members' | 'admins'
  sharingScope: SharingScope  // geo: 'own' | 'region' | 'global'  (existing resolver)

  // Lifecycle — presence/relation of `startsAt` to now decides event vs news facet
  lifecycle: {
    publishDate?: string      // when it becomes visible (existing source of truth)
    startsAt?: string         // a FUTURE start ⇒ behaves event-shaped; absent/past ⇒ news-shaped
    endsAt?: string
    expiresAt?: string        // news retrospective window (existing durationWeeks/expiresAt)
  }

  blocks: Block[]             // the composable "toolbar" output — where all content (and all PII) lives

  createdAt: string; updatedAt: string; status: 'draft' | 'ready' | 'archived'
}
```

Two visibility mechanisms, deliberately separate:

| Level | Field | Answers | Granularity |
|-------|-------|---------|-------------|
| **Post reach** | `Post.visibility` + `sharingScope` | "Can this viewer see the post exists?" | whole post |
| **Field PII class** | `pii` on block fields | "Within a visible post, which fields get scrubbed for this tier?" | per field |

Both resolve against the **same** `Viewer` (assurance + role) from `viewer-pii.ts`. Reach is the door; PII class is what you can read once inside.

---

## 3. Blocks — the "Photoshop toolbar"

One generic post; the Admin drops in blocks. No more 8 hardcoded event types; "wedding shower" and "baby shower" are the same blocks under different `occasion` tags.

```ts
interface BlockBase {
  id: string
  kind: BlockKind
  visibility?: Visibility     // optional per-block override of Post.visibility (e.g. flyer = members)
}

type Block =
  | TextBlock         // rich text / markdown  (copy-paste-from-email lands here)
  | PersonBlock       // one or more role-labelled people
  | LocationBlock     // geo-aware | plain address | inherit-from-ecclesia
  | TimeBlock         // timezone-aware date/times (drives event-vs-news facet)
  | FlyerBlock        // PDF/image attachment (DocumentAttachment)
  | RegistrationBlock
  | LinkBlock
```

### Block catalog (v1) and their PII declarations

```ts
type PiiClass =
  | 'none'
  | 'name'              // person name  → first-name-only floor
  | 'bio'              // obituary / testimony / aboutCandidate → hidden below member
  | 'location-precise' // street, unit, lat/lng, postal → coarsened/hidden for anon
  | 'contact'          // phone / personal email → hidden below member

interface PersonBlock extends BlockBase {
  kind: 'person'
  role: 'speaker' | 'candidate' | 'deceased' | 'bride' | 'groom' | 'sponsor' | 'contact' | 'other'
  people: Array<{
    firstName: string        // pii:'name' — ALWAYS shown (first-name floor)
    lastName?: string        // pii:'name' — dropped below authenticated-member
    bio?: string             // pii:'bio'
    ecclesia?: string        // pii:'none'
    contact?: string         // pii:'contact'
  }>
}

interface LocationBlock extends BlockBase {
  kind: 'location'
  mode: 'geo' | 'plain' | 'ecclesia'   // geo-aware address | plain text address | inherit from an Ecclesia
  ecclesiaRef?: string                 // when mode==='ecclesia' — pulls name/coords/times/office people
  venueName?: string                   // pii:'none' (e.g. "Toronto East Hall")
  city?: string                        // pii:'none' (coarse — safe floor)
  address?: string                     // pii:'location-precise'
  postalCode?: string                  // pii:'location-precise'
  lat?: number; lng?: number           // pii:'location-precise'
}

interface TextBlock extends BlockBase {
  kind: 'text'
  body: string                         // markdown
  containsPii: boolean                 // author/assist flag — see §5
}
```

Because PII sits in typed fields with a class, `redactPost` never has to parse prose to find a name — **the structure is the map.**

### 3.1 Packaging the toolbar — encapsulated module, NOT a Web Component

Goal (Ken): the toolbar is its own style, its own model, its own data, and talks to the page through a defined API. That goal is right; the mechanism must be cross-platform.

**A literal Web Component won't work.** React Native / Expo has no DOM — no `customElements`, no Shadow DOM. A Custom Element cannot mount in the mobile app, and this codebase renders shared `packages/ui` on **both** web and native (Tamagui + Solito). A Web Component makes the toolbar web-only and breaks mobile; it also fights React props/events/SSR and doesn't slot into the `/brand` showcase.

**Get the same encapsulation the cross-platform way** — the block model is already shaped for it:

- Ship the toolbar as a **self-contained module/package** (e.g. `packages/ui/src/post-editor`): own Tamagui styling, own internal **draft `Post` model** (own store/reducer), showcased in isolation in `/brand`.
- Its **API to the page is a narrow controlled contract** — `value: Post`, `onChange: (Post) => void` (or an imperative ref) — a React/Tamagui equivalent of the Web Component's `CustomEvent` boundary. The page never reaches inside.
- Each **Block type is its own encapsulated editor**, registered in a **block registry**; the toolbar orchestrates them. Own model / data / style / boundary — and it renders on web and native.

---

## 4. The redactor (single read boundary)

```ts
function redactPost(post: Post, viewer: Viewer): Post | null {
  if (!canSee(post.visibility, viewer)) return null            // reach gate (post-level)
  return {
    ...post,
    blocks: post.blocks
      .filter(b => canSee(b.visibility ?? post.visibility, viewer))  // reach gate (block-level)
      .map(b => redactBlock(b, viewer)),                              // PII-class scrub (field-level)
  }
}
```

`redactBlock` applies, by class:

| PII class | anonymous / recognized (public web) | authenticated member+ · curated newsletter email |
|-----------|------------------------|-----------------------|
| `name` | first name only (reuse `shapePersonName` — drops `lastName` from the object, no View-Source leak) | full name |
| `bio` | omitted | shown |
| `location-precise` | omitted → fall back to `venueName` + `city` (per §8.1); a private-residence LocationBlock is dropped entirely | full address / geo |
| `contact` | omitted | shown |
| `none` | shown | shown |

**Channel-aware tier (§8.2).** The right column also covers the **emailed newsletter**: it goes to a curated, opted-in community list, so it renders at **member tier (full names + full location)** even though the recipients are only `recognized`. Redaction is therefore a function of **(viewer tier, channel)** — `redactPost(post, viewer, { channel })` — where `channel: 'newsletter-email'` to the member list resolves to member tier, while `channel: 'public-web'` (and the anonymous "view in browser" page) uses the left column. Accepted caveat: a forwarded email carries full names onward.

This **is** assurance-doc Slice E — but implemented once, and extended past names to locations and bios. Wire it (plus the already-built-but-dead `resolveViewer`) at every public read boundary: `/api/events/public`, `/api/news`, `/api/schedule/[type]`, and the public web newsletter/preview render path (the *sent* newsletter email uses the member-tier channel). The redactor computes the safe shape **server-side**, matching the doc's non-negotiable.

Reuse map:
- `packages/app/utils/viewer-pii.ts` → tier model + `shapePersonName`/`renderName` for `name`. **Extend** with `shapeLocation` / bio gating.
- `apps/next/utils/resolve-viewer.ts` → currently imported by nothing; this design wires it in.
- `event-sharing-resolver.ts` geo logic → `sharingScope` reach (one resolver for posts; retire the mirrored `news-sharing-resolver.ts`).
- `DocumentAttachment` → `FlyerBlock`. `location-components.tsx`, `event-form-sections.tsx` → block editor UIs.

### 4.1 Defense in depth — sanitize by default, at three rings

The default served shape is sanitized, so a missed redaction fails **closed** (leaks a first name) not **open** (leaks everything). Three rings:

1. **Query / reach filter** — don't even *fetch* what the viewer can't see. An anon request never loads `members`-visibility posts/blocks; nothing to accidentally serialize.
2. **Redaction pass** — `redactPost(post, viewer)` is the mandatory server boundary. "Full data" requires an explicit `Viewer` that authorizes it.
3. **Template** — receives only the shaped object, so it *cannot* render a field it was never handed (no CSS/JS View-Source leak).

**Where "the data layer sanitizes" actually lives.** DynamoDB can't do per-field security — the table stores full PII (members+ need it). So this is a **repository/serving wrapper that takes a `Viewer` and returns the sanitized projection**, not a DB feature. Rule: the sanitized projection is the **default** return; obtaining full data is an **explicit, audited** call used only server-side (the newsletter *sender*, the admin edit view). That one full-data door must stay narrow and logged — an implicit "full data" bypass is exactly the privileged path that rots (cf. the topic-filter wipe and the tenant-filter-broke-the-newsletter incidents).

---

## 5. The hard cases (where PII can hide)

Two block types can carry PII the structure can't see. Both need an explicit stance.

**TextBlock (copy-paste from an email).** Free prose can contain names/addresses the redactor can't locate. Stance:
- Make the structured path the *easy* path — the toolbar makes adding a `PersonBlock`/`LocationBlock` faster than typing names into prose.
- A `TextBlock` authored under a PII-bearing occasion (funeral/baptism) **defaults to `visibility:'members'`**; anon simply doesn't see it.
- `containsPii` flag drives a save-time author warning ("this text mentions people — move them to a Person block or keep it members-only"). A future PII-detection assist can auto-flag; the model already has the hook.

**FlyerBlock (PDF/image).** PII can be baked into pixels — unredactable. Stance:
- `FlyerBlock` **defaults to `visibility:'members'`** for PII-bearing occasions; anon sees a "flyer available to members — sign in" placeholder.
- Author can mark a flyer public-safe when it genuinely is (e.g. a public lecture poster).
- Future: dual public/full flyer variants.

Design rule of thumb: **the model is safe-by-default for the tiers that matter; the author opts *up* to public, never down to hidden.**

---

## 6. Events ⇄ News unification & the display-rules fix

"Event" vs "News" is a **derived facet of one post**, from `lifecycle`:
- future `startsAt` ⇒ event-shaped (countdown/RSVP/"upcoming"); absent/past ⇒ news-shaped (retrospective/archive).
- **Promotion News → Event** = add/patch a future `TimeBlock`. No cross-table migration.
- **One** sharing resolver, **one** display-rules engine (generalize `event-display-rules.ts` to posts), **one** read API + redactor.

This also fixes the inconsistency found on 2026-07-16 (a member saw 1 of 6 events because `/api/events/feed`'s 90-day `getFilteredEvents` window disagreed with the public page's `publishDate`+duration rules). With one post model there is **one** definition of "current," so the two surfaces can't diverge.

The News archive + "news from Jul–Aug 2024 in the UK" filter Ken wants becomes a saved query over posts (time range × `sharingScope`/region) — reusing the sharing resolver's geo machinery, unlocked once multi-tenancy is real.

---

## 7. Migration — anon-PII scrub ships FIRST, as Phase 0

This is how item 1 (anon scrub) folds into item 2 (the model): **build the PII taxonomy + redactor against a legacy adapter before the new storage or authoring UI exists.**

- **Phase 0 — Redactor over an adapter (ships the live-leak fix).**
  Define `Post`/`Block`/`PiiClass` + `redactPost`. Write `legacyToPost(event | newsItem): Post` that maps today's flat records into virtual blocks *with PII classes* (candidate→PersonBlock, location→LocationBlock, aboutCandidate→bio). Wire `resolveViewer` + `redactPost` at the four read boundaries. **Result: anon stops receiving raw last names / addresses / bios on events, news, schedules, and the newsletter — with no data migration and no new UI.** This is the safety win, and it forces us to enumerate every PII field once (the whole point).
- **Phase 1 — Native storage.** Persist posts as blocks; adapter-read legacy during transition.
- **Phase 2 — Toolbar authoring UI.** Composable block editor (built from existing section/location components); `occasion` tags seed default block sets (a baptism occasion pre-adds Candidate + Location + Time + a members-only Testimony text block).
- **Phase 3 — Retire.** Migrate legacy records, delete the 8 per-type templates and the mirrored `news-sharing-resolver.ts`.

Phases 1–3 are large; **Phase 0 is small, high-value, and independently shippable.**

---

## 8. Decisions (resolved 2026-07-20)

1. **Location floor for anon — DECIDED: venue + city, hide street/geo.** Anon sees `venueName` + `city` (e.g. "Toronto East Hall, Toronto"); `address`/`postalCode`/`lat`/`lng` are omitted. Exception: a **private residence** (e.g. a funeral visitation at a home) hides the location block entirely — an author toggle on the LocationBlock. Member+ sees full.
2. **Emailed newsletter tier — DECIDED: full names in the email, redact the public web.** This DIVERGES from the assurance-doc default. The emailed newsletter goes to a curated, opted-in community list, so it renders at **member tier** (full names + full location). The **public/anonymous web view** (and the "view in browser" page for a non-authenticated reader) applies the hard redaction (first-name-only, venue+city). ⇒ Redaction tier is **channel-aware**, not purely assurance-derived: the community newsletter email is a member-tier audience. Accepted caveat: a forwarded email carries the full names to whoever it's forwarded to.
3. **Free-text (TextBlock) default under PII-bearing occasions — DECIDED: `members`.** Prose under baptism/funeral/etc. defaults to `visibility: 'members'`; the author explicitly opts it up to public. (Safe-by-default; author opts up.)
4. **`Visibility` ladder — DECIDED: `public < recognized < members < admins`**, mapping onto the existing assurance tiers + access roles.
5. **Occasion taxonomy — DECIDED: retire the `EventType` enum as source of truth.** One generic post + free-combining **occasion tags** (baptism, wedding, shower, …); no new code per occasion. Legacy `EventType` values map to occasion tags during migration.

---

## 9. What this reuses vs. builds new

| Reuse as-is | Extend | Build new |
|-------------|--------|-----------|
| `viewer-pii.ts` tier model + name shaping | name-only → add `shapeLocation`, bio gating | `Post`/`Block`/`PiiClass` types |
| `resolve-viewer.ts` (wire the dead code in) | `event-sharing-resolver` → generic post resolver | `redactPost`/`redactBlock` |
| `DocumentAttachment`, `sharingScope` | `event-display-rules` → post lifecycle | `legacyToPost` adapter (Phase 0) |
| `location-components`, `event-form-sections` (UI) | — | block-based authoring toolbar (Phase 2) |

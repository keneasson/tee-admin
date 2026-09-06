# CMS Rework: Free-Form, Google-Docs-Style News & Events Manager

**Status:** Design — approved for build behind `CONSOLIDATED_CMS`
**Issue:** #202
**Owner:** Design lead (synthesis of ACTUAL-USAGE, EDITOR-FOUNDATION, SMART-FEATURES, SEND-BRIDGE research)
**Date:** 2026-08

---

## 0. North Star

> "As easy to work with as Google Docs." Complexity hidden. No complicated forms. Flexibility (N images not 1, N candidates not a hard slot, freeform names / locations / addresses) that can be **enhanced** in one click.

The product owner's real workflow is **email-first**: he receives an announcement by email, copies the text, pastes it into the editor, and then wants to _point at_ pieces of that text and upgrade them — select the dates → "When"; select the hall → a smart Location with address / map / meeting link; select the speaker names → link them to their home ecclesia; drop in the poster PDF and a couple of photos. Then he hits **Send** and the right people get the right email. The tool must make his life **easier**, and the content model must be grounded in **what we actually send**, not in a 2,860-line form of dead fields.

This document is the single cohesive design. It is deliberately built on top of what **already exists** in the repo — most of the vision is already coded but only wired into `/brand` showcases. The work is mostly _wiring, one bridge, and enrichment_, not green-field.

---

## 1. The Free-Form Content Model (blocks + enhancers)

### 1.1 Ground truth: what we actually send

A production scan of `tee-schedules` (32 events across 8 types + 5 news items) cross-referenced against the email templates and the router `apps/next/utils/email/get-email-content.tsx` yields one bombshell:

- The `event-announcement` email path renders **only `FuneralEmail` and `BaptismEmail`** and **throws for every other type** (`get-email-content.tsx:~502`). There is **no** Wedding / Engagement / General / Study-Weekend email template. Those types render on the web event page but **cannot be emailed** as a typed announcement.
- The only other announcement email is **News → `NewsAlert.tsx`**, which is pure prose + one optional poster.

So the entire "sendable content" surface reduces to **three shapes: Funeral, Baptism, and Prose**. Everything else in the progressive form is web-only decoration or dead data.

### 1.2 The small block set (grounded in real populated fields)

The canonical model already exists at `packages/app/types/post.ts` — `Post` (`id, tenant, authorId, title, occasion[], summary?, seriesId?, visibility, sharingScope, lifecycle, blocks[], status`) with a 7-kind `BlockKind` union. That model is correct and stays. The content model for the editor is exactly these blocks:

| Block | Real-usage evidence | In emails |
|---|---|---|
| **Title** | 100% of events + news | Every template |
| **Prose body** (markdown `**bold**` + auto-linked URLs) | funeral `aboutDeceased` 9/9; baptism `aboutCandidate` 4/5; general `description` 5/8; **news `body` 5/5**; engagement 1/1 | Funeral / Baptism / NewsAlert render prose as main content |
| **When** — single datetime **or** a range | funeral `serviceDate` 9/9; baptism 5/5; general `startDate` 7/8 (+`endDate` 5/8); study-weekend `dateRange` 6/6 | Yes |
| **Where** — Location object: freeform name/address **OR** known ecclesia venue (`name, address, city, province, postalCode, mapsUrl`) + nested `onlineMeeting{link,platform,meetingId,password,dialInNumber}` | funeral `locations.service` 9/9; baptism 5/5; general 5/8; hybrid online in baptism/wedding/business | Yes; online rendered from `location.onlineMeeting` (NOT legacy top-level `zoomLink`) |
| **People (0..N, occasion-labeled)** | deceased 9/9; candidate 4/5; couple `{bride,groom}`; study-weekend `speakers[]` 6/6 with `ecclesia` | Funeral / Baptism render the name |
| **Media (0..N images + PDF flyer)** — `DocumentAttachment{documentType, fileUrl(S3), mimeType, thumbnailUrl}`; person photo is separate | general 3/8 (PDF flyer); news 3/5 (poster/PDF); funeral person photo 7/9 | NewsAlert shows one poster; Funeral/Baptism show a person photo |
| **Registration / links** — `{required, registrationUrl, deadline, contactEmail, notes}`, or just a URL pasted into prose | study-weekend 4/6; general 1/8 | Prose links auto-linked |

**`occasion` is data, not a code path.** `OccasionTag` (12 tags: baptism/wedding/funeral/news/study-weekend/…) is a label on the Post that (a) seeds sensible default blocks and (b) drives PII defaulting — it is **never** a `switch` that selects a template or a form. A wedding and a double-baptism are just Posts with different blocks and a different tag. This is what kills the per-type whack-a-mole.

### 1.3 Dead fields to drop (never populated in prod)

Grounded in the form at `packages/ui/src/events/progressive-event-form.tsx`:

- **Global:** `noInPersonServicesMessage` (0/32), `published` (0/32, superseded by `status`), `membersOnly` (2/32).
- **Baptism:** `candidate.testimony`, `candidate.baptismStatement` (never populated), `documents` (0/5), top-level `zoomLink` (legacy).
- **Funeral:** `hasGravesideService` / `gravesideDate` / `gravesideLocation` (0/9), separate `description` (0/9), `visitationSameLocation`.
- **General:** `speakers` (0/8), `hideDates` (0/8), `sections` (absent); `schedule`/`registration` on-demand only.
- **Study-weekend:** separate `description` (0/6, uses `theme`); `schedule`/`sections` rare/optional.
- **Wedding / Engagement:** `description` + `documents` (0/1) — and these have no email template anyway, so the whole typed form was over-built vs. prose + date + location.

The new editor supports **none** of these as first-class fields. Rare survivors (registration, schedule) are on-demand blocks, not default chrome.

---

## 2. The Editor UX (WYSIWYG + one-click enhance)

### 2.1 What already exists (the foundation)

Two editors sit over one `Post` model:

- **Block-form `PostEditor`** (`packages/ui/src/post-editor/*`) — currently mounted at `/admin/posts/[id]`. Owns the metadata **chrome** (title, occasion tags, visibility, publish date, series, Publish button) and validation. Cross-platform Tamagui, pure `value`/`onChange`/`onPublish`.
- **Lexical doc-canvas `PostDocEditor`** (`apps/next/features/post-doc-editor/*`) — a "Photoshop-style" WYSIWYG canvas with a draggable floating toolbar and 6 working tools (Location, Person, Time, Link, Flyer, Registration). **Feature-complete for the body**, but mounted **only** in the `/admin/ui-ux/brand/post-doc-editor` showcase. It has **no** title/occasion/visibility/publish chrome. Its own showcase note says: _"Wiring this editor into /admin/posts/[id] is a later slice."_

The two share the block registry, the redactor, and the public `PostView`/`BlockView` renderer. The doc canvas renders each block as its **published appearance** (`block-widget.tsx` → `BlockView`) — "the document is the final version," no inline forms — with a hover affordance to edit in the floating tool. This _is_ the Google-Docs feel; it just isn't wired to the real page.

### 2.2 The target UX

The editor at `/admin/posts/[id]` becomes:

```
┌─ Chrome (slim) ─────────────────────────────────────────────┐
│ Title:  [_______________]          Occasion: [funeral ✕][+] │
│ Visibility: [members ▾]   Publish: [date]   ● Ready          │
│                                    [ Publish ]  [ Send ▸ ]    │
└─────────────────────────────────────────────────────────────┘
┌─ Doc canvas (WYSIWYG) ───────────────┐   ┌ Floating tools ─┐
│ Beloved brother John Smith fell      │   │ [Location][When]│
│ asleep… (prose, typed or pasted)     │   │ [Name][Link]    │
│                                      │   │ [Flyer][Regist.]│
│ ▸ When: Sat Aug 30, 2026, 2:00pm     │   │  Insert │ Edit  │
│ ▸ Where: TEE Hall · 940 Pape Ave …🗺 │   └─────────────────┘
└──────────────────────────────────────┘
```

- **Prose is just typed or pasted.** Markdown bold + auto-linked URLs render live.
- **Enhancers are applied in one click** via the existing armed-tool mechanic (`armed-tool-plugin.tsx`, `floating-toolbar.tsx`), which has two modes:
  - **Convert-selection:** select text → click a tool → the selection is replaced by a seeded widget pre-filled with that text, which auto-resolves. _This is literally the paste-email→select-hall→click-Location flow._
  - **Insert-at-caret:** click a tool with nothing selected → the next canvas click drops a blank widget and opens its editor in the floating tool.
- **Complexity stays hidden:** all form affordances (address fields, meeting link, dates) live in the **detached floating tool** (`EditPanel`), never on the canvas. The canvas always shows the final look.

### 2.3 Wiring (the shortest path — a container swap)

The page `app/admin/(admin-plus)/posts/[id]/page.tsx` is **editor-agnostic**: it owns load-or-`createEmptyPost`, debounced autosave (create-then-update against the DONE `/api/admin/posts` API), publish, the admin-access gate, and series fetch. It just needs `Post` in / `Post` out.

Plan:
1. **Keep** the page's persistence/publish/gate machinery verbatim.
2. **Extract** `PostEditor`'s header chrome (title / occasion / visibility / publish-date / series / Publish button) into a small reusable chrome component **in `apps/next`** (not `packages/ui` — `PostDocEditor` is web-only Lexical).
3. **Render** `<PostDocEditor initialBlocks={post.blocks} onBlocksChange={blocks => onChange({...post, blocks})}/>` in place of the block canvas. `PostDocEditor` seeds its Lexical state **once** from `blocksToDocState` and emits `docToBlocks` on every change; because it is read-once, occasion-add default-blocks work by **remounting on a `key`** tied to occasion.

Blast radius: one new `apps/next` chrome/wrapper component + an edit to the one page file. **No model, API, repository, or render change.** The serialization bijection (`doc-serialization.ts`) is pure and unit-tested.

### 2.4 PII correctness gate (must ship with the wiring)

`docToBlocks` emits free canvas prose as `{kind:'text', containsPii:false}` with **no `visibility` override** (absent ⇒ inherits post reach). The doc editor has no occasion context in the prose path, so an obituary/testimony typed as plain prose under a `funeral`/`medical` occasion would serialize **public** — contradicting the model's intent (`post.ts:75-80`: a text block under a PII-bearing occasion should default to `visibility:'members'`). The existing serialization fix only _preserves_ an existing visibility (rides as a decorator node so Lexical can't strip it); it does not _set_ one.

**Required with the wiring:** occasion-aware defaulting for text blocks — when the Post carries a PII-bearing occasion (funeral, medical, and per the tag's PII class), new/edited text blocks default to `containsPii:true` + `visibility:'members'`, with a one-tap "make public" toggle in the floating Edit panel. This is a small, contained addition and is a **blocker** for making the doc editor the primary surface for PII occasions.

---

## 3. Smart Enhancers (reuse existing data, one click)

Each enhancer is a floating tool with a pure `*-resolve.ts` mapper + a `*-resolver.tsx` shell. Most are already built; the table marks the net-new.

### 3.1 Smart location from a known ecclesia — _mostly built; enrichment is the gap_

- **Built:** `LocationResolver` searches our directory via `/api/ecclesia/search` (→ `searchEcclesia` in `apps/next/utils/dynamodb/locations.ts`). Pick a match → `ecclesiaToLocationBlock` commits name/venue/address/city/province/country/postalCode. Progressive "Add details" already exposes directions/parking/**onlineMeeting link**. External venues via Google Places are fully coded (`/api/places/autocomplete` + `/details`), gated only on `GOOGLE_PLACES_API_KEY` (paid; UI shows a disabled "Connect Google Places…" state when unset).
- **Source of truth:** `EcclesiaData` (`ECCLESIA#` items) carries `address, postalCode, latitude, longitude, timezone`, and per-service-type `scheduleConfig[type].serviceTime`.
- **Net-new (the enrichment):** `ecclesiaToLocationBlock` pulls address only. Extend the pick handler so choosing an ecclesia optionally stamps, in one click:
  - **`mapsUrl`** — derive from `latitude/longitude` or address (`https://www.google.com/maps/search/?api=1&query=…`). No external call. The `LocationBlock.mapsUrl` field exists but nothing populates it today.
  - **Service time** — from `scheduleConfig.*.serviceTime` via `resolveServiceTime()` / `getActiveSchedulePeriod()` (season-aware); map the chosen service into a Time block or the location chip.
  - **`onlineMeeting`** — NOT stored at ecclesia level today. A per-ecclesia standing meeting link needs a **new field on `EcclesiaData`** + admin editor (queued). Until then it stays manual per-block.
- Size: **S–M** (enrich mapper + derive mapsUrl; the meeting-link field is a separate queued slice).

### 3.2 Name → Contact List / PersonRecord — _effectively done_

- **Built:** `PersonResolver` autocompletes against `/api/people?search=` (PersonRecords). `suggestionToPerson` snapshots name + ecclesia.
- **By design it's a snapshot:** the PersonRecord `id` is intentionally dropped so posts render even if the record changes and PII redaction works on copied fields.
- **Optional net-new (live link):** keep `personId` on the block + add a "open contact" affordance (GSI1 O(1) `personRepository.getByEmail` exists). Size **S**. Ship snapshot first; live link is an iteration.

### 3.3 Speaker → home ecclesia — _mostly built_

- **Built:** the person suggestion already carries `ecclesia`, so a picked speaker shows their home ecclesia now.
- **Net-new (fuzzy / schedule-driven):** for visiting speakers typed as free text with no directory match, wire the "Add as typed" no-match branch of `PersonResolver` to `resolveScheduleName()` (`packages/app/utils/name-resolver.ts`) — deterministic name→PersonRecord matching with typo/ambiguity flags; visiting-speaker auto-creation already exists (`visiting-speakers-ingest.ts`). Size **S–M**.

### 3.4 Multi-image + PDF — _single built; gallery is net-new_

- **Built (single):** `FlyerUploader` posts one file to `/api/files/upload` → S3. The route **already handles PDFs** and rasterizes page 1 to a JPEG thumbnail. `FlyerBlock` holds exactly **one** `DocumentAttachment`; `FLYER_ACCEPT` is `image/*` only.
- **Net-new (N images + PDF):**
  - Make `FlyerBlock.documents: DocumentAttachment[]` (or add a Gallery block); loop N uploads client-side — **the upload API needs no change** (call per file).
  - Widen `FLYER_ACCEPT` to include `application/pdf` (backend already supports it).
  - New multi-image canvas layout (current `FlyerCanvas` is single-image geometry).
  - **Email rule:** first image/poster becomes the email poster (matches `NewsAlert`'s single `previewImageUrl`); person photo stays a separate concept.
- Size: **M** (new block/gallery + multi-select + render; plumbing reused).

### 3.5 Email-paste extraction — _where/who done; when is net-new_

- **Built (where/who):** the convert-selection mechanic already _is_ paste→select→enhance. Paste an email, select the venue → Location resolves against the directory; select a name → Person. This is the shipped interaction and the owner's core flow.
- **Gap (when):** there is **no** date parser anywhere (no `chrono-node`/`date-fns`/`luxon`/`dayjs` in any `package.json`). The Time widget is a manual wall-clock↔UTC picker. Add **`chrono-node`** (local dep, **no external API**) so selecting a date phrase → click When parses to an ISO instant, fed into the existing `wallTimeToUtc()` converter. Size **M**.
- **Optional (auto-extract whole blob):** one paste that simultaneously pulls dates + venue + names is the big lift and the only piece needing an **external LLM (Anthropic) API**. Not required — the select-then-enhance flow avoids it. Size **L**, deferred.

### 3.6 Sizing summary

| Enhancer | State | Net-new | Size |
|---|---|---|---|
| Smart location (address) | Done | — | — |
| …+ service time / mapsUrl | Partial | enrich mapper, derive mapsUrl | S–M |
| …+ per-ecclesia meeting link | Missing | new `EcclesiaData` field + editor | M (queued) |
| Name → Contact | Done (snapshot) | optional live `personId` link | S |
| Speaker → home ecclesia | Mostly done | fuzzy `resolveScheduleName` on no-match | S–M |
| Multi-image + PDF | Single done | gallery + loop uploads + widen accept | M |
| Email-paste where/who | Done | — | — |
| Email-paste when | Missing | `chrono-node` + existing Time converter | M |
| Email-paste whole blob | Missing | LLM pass (external API) | L (deferred) |

---

## 4. The Post → Email Send Bridge (ends per-type whack-a-mole)

### 4.1 The problem it replaces

`get-email-content.tsx:336-508` (`event-announcement`) hard-branches on `event.type` — funeral → `FuneralEmail` (~20 hand-mapped props + bespoke subject), baptism → `BaptismEmail`, **else throws**. `inter-ecclesia` (509-743) repeats the same branching. Every occasion = a template file + bespoke prop-mapping + bespoke subject, in two places. Wedding/double-baptism can't exist without adding all three in both places.

Today the **only** Post→email path is the weekly newsletter, where Posts ride _inside_ `Newsletter.tsx` via `PostEmailView` (already redacted, server-safe, occasion-agnostic — renders `post.blocks`). There is no standalone "send this Post" path. We add exactly one, occasion-agnostic.

### 4.2 The bridge (five small pieces)

**A. New wrapper template — `apps/email-builder/emails/PostAnnouncement.tsx`.** A thin full-document shell modeled on `CustomEmail.tsx`, whose entire body is the existing `PostEmailView`:

```tsx
export type PostAnnouncementProps = { post: Post; note?: string; identity?: EmailIdentity }
export default function PostAnnouncement({ post, note, identity }: PostAnnouncementProps) {
  return (
    <Html lang="en"><Head><style>{globalCss}</style></Head>
      <Preview>{post.title || 'Announcement'}</Preview>
      <Body style={main}>
        <Section style={header}><EmailBrandLinkContent identity={identity} /></Section>
        {note?.trim() ? /* amber note block, as CustomEmail */ null : null}
        <Container style={container}><PostEmailView post={post} /></Container>
        <FooterContent identity={identity} />   {/* carries {{emailPreferencesUrl}} etc. */}
      </Body>
    </Html>
  )
}
```

`PostEmailView` renders a bare `<Section>` (no `<Html>`/footer); this shell supplies the document + brand header + footer tokens. It is the **only** rendering code and it is **occasion-agnostic** — funeral/baptism/wedding/double-baptism are all just blocks. Must stay server-safe (no `'use client'` imports — same discipline `PostEmailView`'s header enforces).

**B. New renderer helper — `getPostAnnouncementContent(postId, tenant, note?) → [html, text, subject]`.** Mirrors `getNewsletterNativePosts` but for one post:

```ts
const raw = await postRepository.getPost(postId)               // unredacted
if (!raw || raw.status !== 'ready') throw ...                  // never send drafts
const viewer = { assurance:'authenticated', role:'member', tenant, email:null }
const post = redactPost(raw, viewer, { channel: 'newsletter-email' })  // member-tier, full PII
const identity = emailIdentityFromProfile(await resolveBrandProfile({ tenant }))
const el = <PostAnnouncement post={post} note={note} identity={identity} />
return [await render(el), await render(el, { plainText: true }), post.title]
```

Reuses the exact redactor + brand-identity plumbing the newsletter uses. Subject = `post.title`.

**C. One line in the send primitive.** Add `'post-announcement'` to the `senders` map in `email-send.tsx` with `{ subject:'Announcement', contactList:'newsletter', replyTo: REPLY_TO }`. That satisfies `reason` validation and gives default subject/reply-to/audience. **No other change** — tokenization, canonical sender (`communications@{tenant.senderDomain}`), Toronto-dated subject, per-recipient tracking, and the `emailsEnabled()` kill switch all apply unchanged via the existing `emailSend`/`buildEmailEnvelope` path (single sender, single reply-to — reputation unchanged).

**D. New route — `POST /api/admin/posts/[id]/send`.** Reuses the `authorize()` gate from the sibling route (auth → owner/admin → `CONSOLIDATED_CMS` → else 404):

```ts
Body: { audience: EmailListTypeKeys, test: boolean, note?: string }
const raw = await postRepository.getPost(id)
if (!raw || raw.tenant !== tenant.homeEcclesiaName) return 404   // TENANT GUARD (see §4.3)
if (raw.status !== 'ready') return 422 'Publish the post before sending'
const [html, text, subject] = await getPostAnnouncementContent(id, tenant.homeEcclesiaName, note)
return json(await emailSend({
  reason: 'post-announcement', emailHtml: html, emailText: text,
  test: body.test,            // test → testList, hard override
  customList: body.audience,  // chosen SES topic on a live send
  customSubject: subject, subReason: 'general',
  description: `Post announcement: ${subject}`, sentBy: session.user.email, tenant,
}))
```

**E. Editor / list action — "Send announcement".** In the editor page, add a **Send announcement** button next to Publish, **enabled only when `status === 'ready'`** (disabled with "Publish first" on drafts). Opens a small dialog reusing the composer's audience `<Select>` (same `getContactsList()` topics as `email-sender/index.tsx`, `testList` filtered out for live) + a **Test / Live** toggle (default **Test**) + the existing confirmation dialog (names the exact list + recipient count before send). Mirror on `ready` rows in the posts list page.

**F. Retire the per-type path.** Once A–E ship behind the flag: point the composer's event/news send at the new route, then delete the `event-announcement` + `inter-ecclesia` branching in `get-email-content.tsx:336-743` and the `Funeral.tsx` / `Baptism.tsx` / `InterEcclesiaWrapper.tsx` templates. New occasions need **zero** new code.

### 4.3 Prod-email safety (non-negotiable)

- **Test is default and a hard override:** `emailSend` forces `testList` whenever `test===true`, regardless of `customList` — the Test toggle can never leak to the real list.
- **Audience explicit:** live sends require picking an SES topic; no implicit "everyone." Confirmation names the list + count.
- **Never send drafts:** route hard-checks `status==='ready'` (422 otherwise); button disabled on drafts. (Draft-events no-side-effects rule.)
- **Kill switch + flag:** `emailsEnabled()` short-circuits all sends; the whole feature is dark behind `CONSOLIDATED_CMS` until flipped.
- **Tenant isolation:** the route validates `post.tenant === resolved tenant` before sending — closing the known gap where content routes gate only on **global** admin/owner and ignore tenant. Sender domain + footer come from the resolved tenant, so a TEE post can't send from Echad's domain or vice-versa.
- **Full PII intended here:** redaction uses `channel:'newsletter-email'` (member-tier, full names/locations) because an announcement goes to the member/subscriber audience — same channel the newsletter uses.
- **Caveat to verify before wiring the button:** confirm `PostAnnouncement`'s `<Html><Body>` + `FooterContent` render cleanly through `@react-email/render` from the App Router server route **without** pulling any `'use client'` module (the app-router-email-render failure mode). `FooterContent`/`EmailBrandLinkContent` are the server-safe split `CustomEmail` already uses, so this should hold — render once and diff before shipping the button.

---

## 5. Migration & Coexistence (behind `CONSOLIDATED_CMS`)

- **Flag state today:** `feature-flags.ts` key `consolidated_cms`, `visibleTo:'owner'`, `users:[]` — **owner-only, dark for everyone else.** Every admin route, public read, newsletter inclusion, and news redaction is gated on it; OFF ⇒ byte-identical legacy behavior (admin routes 404, reads return empty). This is our launch-dark envelope.
- **Coexistence:** the legacy progressive event form + `tee-schedules` events keep running for everyone with the flag off. The new `Post` model lives in `tee-admin` (`POST#{tenant}` items) — a **separate store**, so there is no dual-write hazard on the shared query paths (respects the feature-flag-safety rule: no mutation of shared query paths/formats).
- **Public read parity:** `/api/posts/public` (flag-gated) already splits `{events,news}` by `resolvePostNextDate` and only surfaces `status==='ready'`, consumed by the events feature + news page + single-post page via the redactor + `PostView`. When the flag is on for a viewer, Posts appear alongside/instead of legacy per the existing gating.
- **No backfill required to ship.** The owner authors _new_ announcements as Posts. A one-shot legacy-event→Post importer (map details JSON → blocks) is an **optional later slice** — not on the critical path, since the value is in new authoring + sending.
- **Rollout:** owner-only today → widen `visibleTo`/`users` after the send bridge + editor wiring are verified in prod behind the flag (no staging DB; test in prod behind the flag per working-style rules). External-dependency note: lighting up Google Places (§3.1) needs `GOOGLE_PLACES_API_KEY` on Vercel; `chrono-node` (§3.5) is a local dep. Any such external step goes in `EXTERNAL_CHANGES.md` when its slice lands.

---

## 6. Prioritized, Sliced Implementation Plan

Ordered so **create → enhance → publish → SEND** works first, smart enhancers next. Every slice ships behind `CONSOLIDATED_CMS` and is independently shippable.

### Built TONIGHT

**Slice 1 — Send bridge (occasion-agnostic Post → email).** _Depends on: nothing new._
- `PostAnnouncement.tsx` wrapper (server-safe; render-and-diff check per §4.3).
- `getPostAnnouncementContent()` helper (reuse redactor + brand identity).
- `'post-announcement'` in the `senders` map.
- `POST /api/admin/posts/[id]/send` with `ready`-only + tenant guard + Test default.
- "Send announcement" dialog on the editor (audience select + Test/Live toggle + confirmation).
- **Exit:** an owner can publish a Post and send it as an email to Test, then to a chosen list, with full safety — for **any** occasion, no per-type code.

**Slice 2 — Doc-editor wiring + chrome.** _Depends on: nothing (parallel to Slice 1)._
- Extract chrome (title/occasion/visibility/publish-date/series/Publish) into an `apps/next` component.
- Mount `<PostDocEditor>` at `/admin/posts/[id]` in place of the block canvas (container swap; remount-on-occasion `key`).
- **PII gate (blocker):** occasion-aware `containsPii`/`visibility` defaulting for canvas text blocks + a make-public toggle (§2.4).
- **Exit:** the WYSIWYG doc canvas is the real authoring surface; create → enhance (existing 6 tools) → publish → **send** (Slice 1) works end-to-end.

> Slices 1 and 2 together deliver the North-Star loop: paste an email, enhance the pieces, publish, send — for any occasion.

### Queued for iteration (smart-enhancer enrichment & flexibility)

**Slice 3 — Location enrichment.** Stamp `mapsUrl` (derived, no external call) + season-resolved service time on ecclesia pick. (S–M)

**Slice 4 — Multi-image + PDF gallery.** `FlyerBlock.documents[]` (or Gallery block), loop uploads, widen `FLYER_ACCEPT` to `application/pdf`, multi-image canvas; first image = email poster. (M) — the owner's "N images not 1" ask.

**Slice 5 — Email-paste "When".** Add `chrono-node`; select a date phrase → When parses to ISO via existing `wallTimeToUtc()`. (M)

**Slice 6 — Speaker → home ecclesia fuzzy match.** Wire `resolveScheduleName()` on the Person no-match branch. (S–M)

**Slice 7 — Name → live contact link.** Keep `personId`, add "open contact" affordance. (S)

**Slice 8 — Per-ecclesia standing meeting link.** New `EcclesiaData` field + admin editor; auto-inject `onlineMeeting` on ecclesia pick. (M; external — note in `EXTERNAL_CHANGES.md`.)

**Slice 9 — Retire per-type email path.** Point composer at the send route; delete `event-announcement`/`inter-ecclesia` branching + `Funeral`/`Baptism`/`InterEcclesia` templates. (S; do after Slices 1–2 are verified in prod behind the flag.)

**Slice 10 (deferred, optional) — Google Places live** (add API key) and **LLM whole-blob extraction** (external Anthropic API). Not required for the North Star.

### Dependency order

```
Slice 1 (send) ─┐
Slice 2 (editor+PII) ─┴─▶ North-Star loop ▶ Slice 9 (retire legacy)
Slices 3–8 (enhancers) attach to Slice 2 independently, any order
Slice 10 deferred
```

---

## 7. Key Files (for build agents)

- **Model:** `packages/app/types/post.ts` (Post, Block union, OccasionTag, PiiClass, Visibility).
- **Doc editor:** `apps/next/features/post-doc-editor/` — `post-doc-editor.tsx`, `doc-serialization.ts` (pure bijection + PII-preserve fix), `armed-tool-plugin.tsx`, `floating-toolbar.tsx`, `block-widget.tsx`, `tool-blocks.ts`, `widgets/{location,person,time,link,flyer,registration}-{resolver.tsx,resolve.ts}`.
- **Block-form chrome (source of extract):** `packages/ui/src/post-editor/` — `post-editor.tsx`, `post-reducer.ts`, `occasion-defaults.ts`, `registry.ts`.
- **Editor page:** `apps/next/app/admin/(admin-plus)/posts/[id]/page.tsx` (load/autosave/publish/gate); list `…/posts/page.tsx`.
- **Persistence:** `apps/next/app/api/admin/posts/*` + `apps/next/utils/dynamodb/post-repository.ts`.
- **Public render:** `packages/ui/src/post-view/*` (`PostView`/`BlockView`), `apps/next/utils/get-public-posts.ts`, `/api/posts/public/route.ts`.
- **Email render-twin:** `apps/email-builder/components/PostEmailView.tsx`; wrapper model `apps/email-builder/emails/CustomEmail.tsx`; footer split `FooterContent`/`EmailBrandLinkContent`.
- **Send:** `apps/next/utils/email/email-send.tsx` (`emailSend`, `buildEmailEnvelope`, `senders` map), `get-email-content.tsx` (legacy per-type path to retire), `get-newsletter-posts.ts` (redactor pattern to mirror).
- **Enhancer data sources:** `apps/next/utils/dynamodb/locations.ts` (`searchEcclesia`, `EcclesiaData`), `packages/app/config/service-time-resolver.ts`, `packages/app/utils/name-resolver.ts` (`resolveScheduleName`), `apps/next/app/api/{ecclesia/search,people,files/upload,places/*}/route.ts`.
- **Flag:** `feature-flags.ts` (`consolidated_cms`).
- **Dead-field reference:** `packages/ui/src/events/progressive-event-form.tsx` (fields to drop, §1.3).

---

_This design is grounded in production data and the existing (largely built-but-unwired) foundation. The critical insight: the vision is 80% coded — the work is one send bridge, a container-swap wiring with a PII gate, and enrichment. Ship Slices 1–2 tonight to close the North-Star loop; iterate enhancers behind the flag._

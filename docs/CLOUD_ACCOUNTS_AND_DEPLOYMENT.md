# Cloud Accounts, Scoping & Deployment — Runbook

> **Purpose**: The single authoritative reference for *which* cloud account/team/project
> this app uses, how to scope CLIs correctly, and how to deploy each brand. If you are
> reaching for a cloud CLI (`aws`, `vercel`, `gh`) for TEE Admin, start here.
>
> **Audience**: Anyone (human or agent) operating this repo's infrastructure.
> **Golden rule**: *Verify the account/scope before any mutating command.* These machines
> hold credentials for **multiple unrelated projects** — the default scope is not always TEE.

---

## TL;DR — the facts you need

| Thing | Value |
|-------|-------|
| **AWS account** | `911911532459` (IAM user `arn:aws:iam::911911532459:user/tee`) |
| **AWS region** | `ca-central-1` |
| **AWS profile to use** | `default` (do **not** pass `--profile` for TEE; the named profiles are other clients) |
| **Vercel team / scope** | `ken-eassons-projects` (org `team_vwApqYX2oh48OUB9tx1TTTgR`) |
| **Vercel project — TEE** | `tee-admin` (`prj_2L0Euv1kofKg7iJzd3D8rJ9IWBUo`) → `www.tee-admin.com` |
| **Vercel project — Hub** | `echadhub` (`prj_mVrlWBXnVIyYyKB8dxOOtfwEINPp`) → `echadhub.org`, `echadhub.com` |
| **GitHub repo** | `keneasson/tee-admin` |
| **Brand selector** | `NEXT_PUBLIC_BRAND` env, set per Vercel project (`tee` vs `echadhub`), baked at build time |

> ⚠️ **One shared database.** Both Vercel projects (and *all* preview deployments) read and
> write the **same production DynamoDB tables** (`tee-admin`, `tee-schedules`, `tee-sync-status`)
> in account `911911532459`. A "preview" or "staging" deploy isolates the build/env/domain only —
> **not the data**. A test upload on the Echad Hub preview writes real rows to production tables.

---

## AWS

### Why scoping matters here
`aws configure list-profiles` on this machine returns several profiles that belong to
**different, unrelated projects**:

```
Kene-YourPeer
default        ← TEE Admin  (account 911911532459, ca-central-1)
cruiter
kene-home
kene-docutrax
```

The `default` profile is TEE. The others are **not** — never run TEE commands under them, and
never assume `default` is TEE without checking (a stray `AWS_PROFILE` in the environment can
silently redirect you).

### Always verify before mutating
```bash
aws sts get-caller-identity
# Expect EXACTLY:
#   "Account": "911911532459"
#   "Arn":     "arn:aws:iam::911911532459:user/tee"

aws configure list | grep region        # expect ca-central-1
echo "AWS_PROFILE=${AWS_PROFILE:-<unset>}"   # expect unset (→ default)
```

If `AWS_PROFILE` is set to anything else, unset it for TEE work:
```bash
unset AWS_PROFILE
```

### Services in this account
| Service | Use | Notes |
|---------|-----|-------|
| **DynamoDB** | `tee-admin`, `tee-schedules`, `tee-sync-status` | Single shared prod DB — see warning above. Legacy `pkey/skey` naming. |
| **SES** | Outbound email delivery | `aws ses get-send-quota` shows `SentLast24Hours` — useful to confirm whether a send was *attempted*. |
| **S3** | File uploads (`tee-admin-files` bucket by default) | News/event attachments + generated PDF thumbnails. Configurable via `FILE_STORAGE_*` env. |
| **Lambda (SAM)** | `aws-monitor` health checks | Deployed from `apps/next/aws-monitor/` via `sam build && sam deploy`. |

### Common read-only checks (safe)
```bash
aws sts get-caller-identity
aws ses get-send-quota --region ca-central-1
aws dynamodb describe-table --table-name tee-admin --region ca-central-1 --query 'Table.ItemCount'
```

---

## Vercel

### Scope first, every time
The CLI remembers the **last** team you switched to — and on this machine that may be a
different client (e.g. `pharmacy-online`). Set the scope explicitly before doing anything:

```bash
vercel whoami                        # confirm logged-in user (keneasson)
vercel switch ken-eassons-projects   # ← TEE/Hub team. NOT pharmacy-online, NOT rangleio.
vercel projects ls                   # should list: tee-admin, echadhub, ...
```

### The two projects (one repo, two brands)
Both projects share this repo, both build from **Root Directory `apps/next`**, Next.js, Node 20.x.
They differ only by env (and domain):

| Project | `NEXT_PUBLIC_BRAND` | Domains | Stable branch-preview alias prefix |
|---------|--------------------|---------|-----------------------------------|
| `tee-admin` | `tee` | `www.tee-admin.com` | `tee-admin-git-<branch>-ken-eassons-projects.vercel.app` |
| `echadhub` | `echadhub` | `echadhub.org`, `echadhub.com` | `echadhub-git-<branch>-ken-eassons-projects.vercel.app` |

- **Build-time brand**: `NEXT_PUBLIC_BRAND` is baked into the bundle at build. It is set per
  project in the Vercel dashboard (`tee-admin`→`tee`, `echadhub`→`echadhub`). You do **not** set
  it locally for a remote build — the project supplies it.
- **Runtime tenant**: independent of the build brand, `apps/next/middleware.ts` resolves the
  active tenant from the `Host` header (`getTenantByHost` → `x-tenant-id`). This is how one
  build can serve the right tenant per domain. The Echad Hub gate (signed-out → `/auth/signin`)
  keys off this Host resolution.

### Local link state (`.vercel/`)
```
apps/next/.vercel/project.json         → tee-admin   (canonical local link)
apps/next/.vercel-backup/project.json  → "next"      (STALE — unrelated project prj_rQg…; ignore)
```
`vercel deploy` with no flags deploys to whatever `.vercel/project.json` points at — i.e.
**tee-admin**. To deploy the Hub you must target `echadhub` explicitly (see below).

### Deploying

**Preferred: let Git do it.** Both projects have the GitHub integration enabled, so:
- **Pushing any branch** → auto-creates a **Preview** deployment on **both** projects.
- **Merging to `main`** → auto-deploys **Production** on both (tee-admin.com *and* echadhub.org).

So to "deploy a branch to the Echad Hub preview", you just `git push` the branch and read the
`echadhub-git-<branch>-…` alias. No manual CLI deploy needed.

```bash
# Find / watch the Hub preview for the current branch
vercel switch ken-eassons-projects
vercel ls echadhub                        # newest first; look for Environment=Preview, your branch
vercel inspect <deployment-url>           # shows status + the "git-<branch>" alias (stable URL)
```

**Manual CLI deploy** (when you need to force one, or Git integration is off):
```bash
vercel switch ken-eassons-projects

# TEE (default link):
cd apps/next && vercel deploy            # preview
cd apps/next && vercel deploy --prod     # production → tee-admin.com

# Echad Hub: target the project explicitly so env/brand are correct
cd apps/next && vercel deploy --scope ken-eassons-projects \
  && <or> link to echadhub first:  vercel link --project echadhub --yes && vercel deploy
```
> When in doubt, prefer the Git push flow — it guarantees each project builds with its own
> dashboard env (including `NEXT_PUBLIC_BRAND`). A local `vercel deploy --prebuilt` can ship a
> bundle built with the *wrong* brand.

### Environment variables (set in the Vercel dashboard, per project)
| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_BRAND` | `tee` or `echadhub` — selects brand at build time |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` | AWS auth (account 911911532459, ca-central-1) |
| `NEXTAUTH_SECRET` | NextAuth session encryption |
| `NEXT_PUBLIC_GOOGLE_CLIENTID` / `NEXT_PUBLIC_GOOGLE_ACCOUNT_SECRET` | Google OAuth |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Full Google service-account JSON **on one line** (creds + `sheet_ids`). No committed file — this env var is the single source of truth. |
| `WEBHOOK_SECRET` | Google Sheets webhook verification (Apps Script must send the matching header) |
| `EMAIL_SENDER_SECRET` | Auth for email/cron endpoints |
| `FILE_STORAGE_BUCKET` / `FILE_STORAGE_*` | S3 upload config (defaults to `tee-admin-files`) |

```bash
vercel env ls                 # lists env for the LINKED project (tee-admin by default)
```

---

## GitHub

```bash
gh auth status                # needs `project` scope for board operations
gh pr list --state open
gh pr create --base main --head <branch> --title "…" --body "…"
```
- Repo: `keneasson/tee-admin`. Default branch: `main`.
- Project board: `TEE Admin — Now / Next / Later` (https://github.com/users/keneasson/projects/2).

---

## End-to-end: deploy a branch to the Echad Hub preview & test

1. **Push the branch** (PR optional but recommended):
   ```bash
   git push -u origin <branch>
   ```
2. **Find the Hub preview** (Git integration builds it automatically):
   ```bash
   vercel switch ken-eassons-projects
   vercel ls echadhub | head        # find the Preview build for your branch
   ```
   Stable URL: `https://echadhub-git-<branch>-ken-eassons-projects.vercel.app`
3. **Watch to completion** (covers failure, not just success):
   ```bash
   vercel inspect <url> | grep -i status   # ● Building → ● Ready / ● Error / Canceled
   ```
4. **Test on the Hub** (signed-out users are gated to `/auth/signin`):
   - Sign in → exercise the feature.
   - Remember: writes hit **production DynamoDB/S3**. Use test modes where available
     (e.g. "Send **test** alert" sends to the test list only).

---

## Gotchas (the things that cost time)

- **Wrong Vercel team.** The CLI defaults to the last-used scope, often `pharmacy-online`.
  Always `vercel switch ken-eassons-projects` first.
- **Wrong AWS profile.** `default` is TEE; the other named profiles are other clients. Verify
  with `aws sts get-caller-identity` (expect `911911532459`). Unset a stray `AWS_PROFILE`.
- **`.vercel-backup` is stale.** It links to an unrelated `next` project — do not restore it.
- **One database for everything.** "Preview"/"staging" never isolates data. Treat every deploy
  as touching production tables.
- **Brand is build-time.** You can't flip `tee`↔`echadhub` at runtime; it's the project's
  `NEXT_PUBLIC_BRAND`. Runtime *tenant* (per-domain behaviour) is separate, from the Host header.
- **SES "did it send?"** `aws ses get-send-quota` `SentLast24Hours` tells you whether a send was
  even attempted (useful when a cron appears to have silently no-op'd).

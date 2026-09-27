# SomaShare 📚

**Share notes & past papers. Every student brings the storage.**

SomaShare is a Progressive Web App (PWA) that lets university and college students share lecture notes and past papers for revision. Students sign in with their institutional Google account (`@ku.ac.ke`), browse by unit and resource type, download for offline revision — and every upload is stored in the **contributor's own Google Drive**, so the platform's storage grows with its community instead of its costs.

Built from a custom Figma design (cream / forest-green / pumpkin palette, serif display typography).

---

## ✨ Features

| Area | What you get |
|---|---|
| **Google sign-in** | One-tap OAuth restricted to `@ku.ac.ke` — verified server-side on the callback. No passwords. |
| **Bring-your-own Drive** | The sign-in consent also grants `drive.file` — uploads live in each student's own Drive. Tokens are encrypted at rest (AES-256-GCM). |
| **Browse & filter** | Filter by unit code, resource type (Notes / Past Papers / CATs / Lab Reports), year and semester. |
| **Upload & contribute** | Strictly PDF (magic-byte verified), 25 MB cap, rate-limited, filenames sanitized. |
| **Moderation queue** | New uploads await review; admins verify or delete from the profile's Owner Tools. |
| **Mailing list** | "Join the community" page collects emails; admins export CSV or send updates via Resend. |
| **True offline mode** | Installable PWA; the app shell, browsed data and *saved resources* all open with zero network. |
| **Student-only vault** | Browse and download APIs require a session — no public scraping. |

## 🧰 Tech stack

- **Framework** — Next.js 16 (App Router), React 19, TypeScript
- **Styling** — Tailwind CSS 4 + shadcn/ui, custom design tokens in `globals.css`
- **State** — Zustand (UI state) + TanStack Query (server state)
- **Database** — Prisma ORM · PostgreSQL in production (Neon/Supabase), SQLite for local dev
- **Auth** — Google OAuth 2.0 + compact HMAC-signed session cookies (httpOnly, expiring, `__Secure-` prefixed in production)
- **PWA** — Web App Manifest, custom Service Worker (precache shell, stale-while-revalidate static assets, network-first API with cache fallback, download mirroring into a dedicated cache)
- **Storage** — pluggable `StorageProvider`: per-student Google Drive (production) or a sandbox filesystem provider (dev)
- **Quality** — Vitest unit tests, ESLint, GitHub Actions CI, strict TypeScript builds

## 🚀 Getting started (local dev)

### Prerequisites

- Node.js 20+ (or [Bun](https://bun.sh) 1.1+)
- No external services required — the app runs with a sandbox Drive and demo sign-in out of the box

### Setup

```bash
# 1. Install dependencies
bun install            # or: npm install

# 2. Configure environment
cp .env.example .env   # the SQLite defaults work as-is

# 3. Create the database schema (SQLite dev schema)
bun run db:generate:dev
bun run db:push:dev

# 4. (Optional) Seed demo data — units, users and 12 real sample PDFs
bun run seed

# 5. Start the dev server
bun run dev            # or: npm run dev
```

Open **http://localhost:3000**. Without Google credentials configured, the login screen offers a **demo account** so you can explore the whole product. Adding real `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` switches everything to the real Google flow — no code changes.

> The repository includes the seeded SQLite database (`db/custom.db`) and its sample PDFs (`storage/`) so a fresh clone can be explored instantly. For a clean slate, delete both and re-run steps 3–4.

### Tests, lint, typecheck

```bash
bun run test        # vitest unit tests (auth, validation, rate limiting)
bun run lint        # eslint
bun run typecheck   # tsc --noEmit
bun run build       # production build (standalone)
```

## 🗺 Going to production (Vercel)

SomaShare is designed for **Vercel + Postgres + per-student Drive storage** — no server filesystem, no storage bills.

### 1. Create a Postgres database

1. Create a free database on [Neon](https://neon.tech) or [Supabase](https://supabase.com) (or Vercel Postgres).
2. Copy the connection string (`postgresql://…?sslmode=require`).

### 2. Configure Google Cloud OAuth

1. At [console.cloud.google.com](https://console.cloud.google.com), create a project.
2. **APIs & Services → Library** → enable **Google Drive API**.
3. **OAuth consent screen** → External → add your app name/support email → add the scope `.../auth/drive.file`.
4. **Credentials → Create credentials → OAuth client ID → Web application**:
   - Authorized redirect URI: `https://YOUR-DOMAIN/api/auth/google/callback`
5. Publish the consent screen (**In production**). Note on scopes: basic profile scopes need no verification; `drive.file` is a *restricted* scope — until you complete Google's verification, users see an "unverified app" warning (choose *Advanced → Go to SomaShare*) and, while the app is in *Testing*, refresh tokens expire after 7 days and only added test users can sign in. For a student community at launch this is usually acceptable; long-term, complete the verification flow.

### 3. Deploy to Vercel

1. Push this repo to GitHub and import it in Vercel.
2. Set environment variables (Project → Settings → Environment Variables):

| Variable | Value |
|---|---|
| `DATABASE_URL` | your Postgres connection string |
| `SESSION_SECRET` | `openssl rand -hex 32` |
| `APP_URL` | `https://your-app.vercel.app` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | from step 2 |
| `ADMIN_EMAILS` | your `@ku.ac.ke` email |
| `RESEND_API_KEY` / `MAIL_FROM` | optional, for the mailing list |

3. Apply the schema to Postgres once from your machine:
   ```bash
   DATABASE_URL="<your-postgres-url>" npx prisma db push --schema=prisma/schema.prisma
   ```
4. Deploy. Check `https://your-app.vercel.app/api/health` — it reports DB, OAuth, storage and mailer status.

## 🗂 Project structure

```
├─ prisma/
│  ├─ schema.prisma             # PRODUCTION models (PostgreSQL)
│  └─ schema.dev.prisma         # LOCAL DEV models (SQLite)
├─ scripts/
│  ├─ seed.ts                   # Demo units, users, resources + sample PDFs
│  └─ lib/minipdf.ts            # Dependency-free PDF generator for seed data
├─ src/
│  ├─ app/
│  │  ├─ page.tsx               # Single-screen app shell (SPA-style)
│  │  └─ api/
│  │     ├─ auth/google/*       # OAuth start + callback (@ku.ac.ke enforced)
│  │     ├─ auth/signin         # DEV-ONLY demo sign-in (404 in production)
│  │     ├─ resources/*         # vault catalog, PDF uploads, downloads
│  │     ├─ subscribe           # mailing-list signup
│  │     ├─ drive               # Drive status / disconnect (revoke)
│  │     ├─ admin/*             # moderation queue, subscribers, broadcast
│  │     └─ health              # deployment probe
│  ├─ components/somashare/     # Login, Home, Browse, Upload, Profile, Admin
│  │  ├─ offline.ts             # Save/open/remove offline library (Cache API)
│  │  ├─ pwa.ts                 # Install prompt + SW registration
│  │  └─ store.ts               # Zustand app state
│  └─ lib/
│     ├─ auth.ts                # HMAC sessions (expiring, timing-safe)
│     ├─ google.ts              # OAuth + token refresh
│     ├─ storage.ts             # StorageProvider: sandbox | per-student Drive
│     ├─ crypto.ts              # AES-256-GCM token encryption
│     ├─ rate-limit.ts          # Fixed-window limiter
│     ├─ mailer.ts              # Resend adapter + templates
│     └─ validate.ts            # Filename/PDF/email sanitization (tested)
├─ tests/                       # Vitest unit tests
└─ .github/workflows/ci.yml     # typecheck → lint → test → build
```

## 🔒 Privacy & security notes

- Sign-in is restricted to `@ku.ac.ke` **and verified server-side** after the OAuth token exchange — the domain cannot be spoofed from the client.
- Session cookies are HMAC-signed with an expiring payload, `httpOnly`, `SameSite=Lax`, and `Secure` + `__Secure-`-prefixed in production. `SESSION_SECRET` is mandatory in production (the app refuses to boot without it).
- Only real PDFs (magic-byte verified) can be uploaded; filenames are sanitized against path traversal and header injection.
- The browse/download APIs require a session; uploads and downloads are rate-limited.
- Drive refresh tokens are stored **AES-256-GCM encrypted**, keyed from `SESSION_SECRET`. Disconnecting revokes the token with Google.
- Uploads land in a moderation queue — the verified badge is granted by an admin, never automatically.
- No analytics, no tracking — revision data stays between students.

## 🗺 Roadmap

- [ ] In-app full-text search across units and titles
- [ ] Cross-device sync of the offline library
- [ ] Resource badges by class reps (lighter moderation roles)
- [ ] Storage leaderboard — celebrate the biggest contributors

---

Made for students, by students. Karibu! 🎓

# SomaShare 📚

**Share notes & past papers. Every student brings the storage.**

SomaShare is a Progressive Web App (PWA) that lets university and college students share lecture notes and past papers for revision. Sign in with your institutional email, browse by unit and resource type, download for offline revision — and every upload can be stored in the contributor's own Google Drive, so the platform's storage grows with its community.

Built from a custom Figma design (cream / forest-green / pumpkin palette, serif display typography).

---

## ✨ Features

| Area | What you get |
|---|---|
| **Institutional sign-in** | Email-gated authentication (`@ku.ac.ke`) with signed, httpOnly cookie sessions |
| **Browse & filter** | Filter by unit code, resource type (Notes / Past Papers / CATs / Lab Reports), year and semester |
| **Upload & contribute** | PDF uploads with unit metadata, exam year/semester, and a storage-consent step |
| **Bring-your-own Drive** | Each student connects their Google Drive — the more students join, the more storage the platform has |
| **True offline mode** | Installable PWA; the app shell, browsed data and *saved resources* all open with zero network |
| **Offline library** | Save any resource to your device, manage it from your profile, open it without internet |
| **Contribution stats** | Profile tracks uploads and downloads contributed back to the community |

## 🧰 Tech stack

- **Framework** — Next.js 16 (App Router), React 19, TypeScript
- **Styling** — Tailwind CSS 4 + shadcn/ui, custom design tokens in `globals.css`
- **State** — Zustand (UI state) + TanStack Query (server state)
- **Database** — Prisma ORM + SQLite
- **PWA** — Web App Manifest, custom Service Worker (precache shell, stale-while-revalidate static assets, network-first API with cache fallback, download mirroring into a dedicated cache)
- **Storage** — pluggable `StorageProvider` abstraction: sandbox filesystem provider by default, Google Drive REST v3 provider activated by env vars

## 🚀 Getting started

### Prerequisites

- Node.js 20+ (or [Bun](https://bun.sh) 1.1+)
- No external services required — the app ships with a sandbox Drive so it runs out of the box

### Setup

```bash
# 1. Install dependencies
bun install            # or: npm install

# 2. Configure environment
cp .env.example .env   # DATABASE_URL=file:./db/custom.db works as-is

# 3. Create the database schema
bun run db:generate    # or: npx prisma generate
bun run db:push        # or: npx prisma db push

# 4. (Optional) Seed demo data — units, users and 12 real sample PDFs
bun run seed           # or: npx tsx scripts/seed.ts

# 5. Start the dev server
bun run dev            # or: npm run dev
```

Open **http://localhost:3000**. A demo sign-in is provided on the login screen; signing in with a non-institutional email is rejected by design.

> The repository includes the seeded SQLite database (`db/custom.db`) and its sample PDFs (`storage/`) so a fresh clone can be explored instantly. For a clean slate, delete both folders and run steps 3–4 again.

### Connecting real Google Drive storage

The storage layer is an interface with two implementations (`src/lib/storage.ts`):

| Provider | Activation | Behaviour |
|---|---|---|
| `SandboxDriveProvider` | default | Files stored in `./storage`, Drive-style file IDs, zero config |
| `GoogleDriveProvider` | set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` | Multipart uploads to the connected student's Drive, anyone-with-link view permission, Drive REST v3 |

Switching providers requires **no application or UI changes** — the rest of the codebase only ever sees the `StorageProvider` interface.

### Building for production

```bash
bun run build   # standalone Next.js build
bun run start   # serve it
```

## 🗂 Project structure

```
├─ prisma/schema.prisma        # User, Unit, Resource, DownloadEvent models
├─ scripts/
│  ├─ seed.ts                  # Demo units, users, resources + sample PDFs
│  └─ lib/minipdf.ts           # Dependency-free PDF generator for seed data
├─ src/
│  ├─ app/
│  │  ├─ page.tsx              # Single-screen app shell (SPA-style)
│  │  └─ api/                  # auth · units · resources · download · drive · profile
│  ├─ components/somashare/    # Login, Home, Browse, Upload, Profile screens
│  │  ├─ offline.ts            # Save/open/remove offline library (Cache API)
│  │  ├─ pwa.ts                # Install prompt + SW registration
│  │  └─ store.ts              # Zustand app state
│  ├─ lib/                     # auth (HMAC sessions) · storage providers · db
├─ public/
│  ├─ sw.js                    # Service worker (precache, SWR, offline downloads)
│  ├─ manifest.webmanifest     # Installable PWA manifest + shortcuts
│  └─ icons/ fonts/            # App icons, subset serif webfonts
└─ db/ · storage/              # Seeded SQLite db + sandbox Drive contents
```

## 🔒 Privacy & security notes

- Sessions are HMAC-signed, httpOnly cookies — no third-party auth dependency
- The `@ku.ac.ke` domain restriction is enforced **server-side** on the sign-in API
- Uploads require explicit storage consent; Gmail accounts are refused for Drive connection
- No analytics, no tracking — revision data stays between students

## 🗺 Roadmap

- [ ] Per-user OAuth flow for Google Drive (currently refresh-token based)
- [ ] In-app full-text search across units and titles
- [ ] Resource verification badges by class reps / moderators
- [ ] Cross-device sync of the offline library

---

Made for students, by students. Karibu! 🎓

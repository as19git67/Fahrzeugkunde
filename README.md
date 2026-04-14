# Fahrzeugkunde

A web-based learning game for German firefighters to memorise the equipment
layout of rescue vehicles. Players learn which tool lives in which compartment,
position, and box of a given fire truck (HLF 20, TLF, DLK, …) and can test
themselves in timed quiz modes. A separate Creator mode lets admins build
their own vehicles with images, hotspots, and descriptions.

## Features

- **Play mode** (`/play/[vehicleId]`) — Time-attack and speed-run quizzes
  against the full equipment catalogue of a vehicle. Per-mode, per-vehicle
  highscores.
- **Creator mode** (`/creator`) — Edit vehicles: views (left/right/back/top),
  compartments with hotspot rectangles, positions, boxes, items including
  image upload, category and difficulty.
- **Authentication** — Email-code login (6-digit code sent via SMTP, no
  passwords). Sessions via signed cookie `fwk_session`.
- **Vehicle package export/import** — Move a complete vehicle between
  installations (structure + all images) as a single `.fzk` file.
  See [Backup & Restore](#backup--restore).
- **HLF 20 seed** — Curated demo vehicle per DIN 14530-27 with 102 items,
  4 views, 13 compartments and 80 positions — available on fresh installs.

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack), React 19
- **Styling**: Tailwind CSS v4, Framer Motion
- **Database**: PostgreSQL 16 with Drizzle ORM 0.45
- **Mail**: Nodemailer
- **Tests**: Vitest 4 with a dedicated `fahrzeugkunde_test` database

## Getting Started

### Local development

Requires a running PostgreSQL on `localhost:5432`.

```bash
npm install
createdb fahrzeugkunde
npm run db:migrate      # apply schema
npm run db:seed         # load HLF 20 demo vehicle
npm run dev             # http://localhost:3000
```

### Production via Docker Compose

```bash
docker compose up -d
```

Two services are launched:

| Service | Purpose |
|---|---|
| `db`    | Postgres 16, data persisted in the `app-data` volume under `/data/pgdata`. |
| `app`   | Next.js standalone build. On first start `startup.js` runs migrations, loads the seed vehicle, and mirrors bundled image assets into `/data/assets`. Uploads are served from there via `public/uploads`. |

### Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgres://postgres:postgres@localhost:5432/fahrzeugkunde` | Postgres connection string |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | — | Login-code delivery. Without these the 6-digit code is printed to the server log (dev fallback). |
| `BUILD_NUMBER` | — | Shown in the footer; injected at build time. |

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── admin/            # reset-seed, vehicles/[id]/export, vehicles/import
│   │   ├── auth/             # login, verify, logout, me
│   │   ├── vehicles/         # CRUD + nested hierarchy
│   │   ├── compartments/, positions/, boxes/, items/
│   │   ├── upload/           # image upload (POST)
│   │   └── uploads/[...path] # image serving (GET)
│   ├── creator/              # vehicle editor page
│   ├── play/[vehicleId]/     # quiz page
│   └── highscore/            # ranking tables
├── components/{creator,game,ui}
├── db/                       # Drizzle schema, migration, seed
├── lib/
│   ├── auth.ts               # session helpers
│   ├── email.ts              # SMTP
│   ├── scoring.ts            # quiz scoring
│   ├── zip.ts                # minimal ZIP reader/writer (no dependencies)
│   └── vehicle-package.ts    # .fzk manifest v1, build + parse + checksums
└── __tests__/                # Vitest integration tests
```

## Data Model

Equipment is modelled as a five-level hierarchy:

```
vehicles
└── vehicle_views            (left / right / back / top / front)
    └── compartments         (G1, G2, Dachkasten …)  with hotspot rectangle
        └── positions        (oben / mitte / unten …) with hotspot rectangle
            ├── boxes        (optional: crate/tray)  with hotspot rectangle
            │   └── items
            └── items        (directly in the position)
```

All parent relations use `ON DELETE CASCADE`, so removing a vehicle cleans
up every descendant. Hotspot coordinates (X/Y/W/H in percent of the parent
image) drive the interactive overlay in both editor and quiz.

Supporting tables: `users`, `auth_codes`, `sessions`, `highscores`.

## Backup & Restore

The project supports two complementary approaches. The first is fully
implemented; the second is on the roadmap.

### 1. Vehicle package (`.fzk`) — per-vehicle backup and transfer

Use this to move a single vehicle between installations, share it with a
colleague, or keep per-vehicle snapshots.

#### Package format

```
vehicle-<id>-<slug>-<timestamp>.fzk       (a standard ZIP)
├── manifest.json       # magic, schema version, export time,
│                       # SHA-256 of every asset
├── vehicle.json        # full tree; image paths rewritten to "assets/…"
└── assets/
    ├── views/…         # view background images
    └── items/…         # item, box and compartment images
```

Example `manifest.json`:

```json
{
  "magic": "fahrzeugkunde-vehicle-package",
  "schemaVersion": 1,
  "appName": "fahrzeugkunde",
  "exportedAt": "2026-04-14T10:15:30.123Z",
  "vehicle": {
    "name": "HLF 20",
    "description": "Hilfeleistungslöschgruppenfahrzeug 20/16 – DIN 14530-27"
  },
  "assetChecksums": {
    "assets/items/seed/akku-bohrmaschine.svg": "a1b2c3…",
    "assets/views/hlf_left.svg": "f9e8d7…"
  }
}
```

Because `.fzk` is a plain ZIP, any tool can inspect it:

```bash
unzip -l vehicle-1-hlf-20-2026-04-14.fzk
unzip -p vehicle-1-hlf-20-2026-04-14.fzk manifest.json | jq .
```

#### Export (backup a vehicle)

1. Open `/creator` while logged in.
2. Click the 📦 icon on the vehicle tile you want to back up.
3. The browser downloads `vehicle-<id>-<slug>-<timestamp>.fzk`.

Programmatically: `GET /api/admin/vehicles/<id>/export`. Requires a valid
`fwk_session` cookie. The response is `application/zip` with a
`Content-Disposition: attachment; filename="…"` header.

The server loads the vehicle and all descendants in one pass, rewrites each
image reference from `/api/uploads/…` to the package-relative
`assets/…` path, reads the corresponding files from `public/uploads/`,
computes a SHA-256 over every asset, and streams the resulting ZIP.

#### Import (restore a vehicle)

1. In `/creator`, click **"Datei auswählen"** in the
   *"Fahrzeug-Paket importieren"* card.
2. Pick a `.fzk`. On success the page jumps straight into the new vehicle.

Programmatically: `POST /api/admin/vehicles/import` as
`multipart/form-data` with a single field `file`. Requires a valid session.

What the server does, in order:

1. Parse the ZIP, pull out `manifest.json` and `vehicle.json`.
2. Check the magic string and schema version. Reject on mismatch (HTTP 400).
3. For every asset inside `assets/…`, verify its SHA-256 against the
   value in `manifest.assetChecksums`. Reject on mismatch.
4. Verify every asset referenced by `vehicle.json` is actually present in
   the ZIP. Reject on missing asset.
5. Write each asset to `public/uploads/<folder>/<new-filename>` where
   `<new-filename>` is `Date.now()_<random>.<ext>` (same scheme as the
   regular upload route — guarantees collisions are impossible).
6. Insert the vehicle, views, compartments, positions, boxes, and items
   in a single DB transaction, rewriting `assets/…` paths to the new
   `/api/uploads/<folder>/<file>` URLs.
7. On any DB error: transaction rolls back **and** the newly written
   asset files are `unlink`-ed, so no orphan files or rows remain.

Importing the same `.fzk` twice creates two independent vehicles — IDs are
always assigned fresh, so packages can be passed freely between
installations without ID conflicts.

#### Security notes

- Both routes require a logged-in session (`fwk_session` cookie).
- Asset paths inside the package are validated against directory
  traversal: `..`, backslashes and `.`-only segments are rejected.
- Folder segments must match `[a-z0-9_-]{1,32}`.
- Files are written strictly inside `public/uploads/`; any path escaping
  that prefix is refused.
- SHA-256 mismatches abort the import with HTTP 400 *before* any writes.

### 2. Full daily backup (sidecar)

A dedicated `backup` service in `docker-compose.yml` (built from
`scripts/backup/`) runs alongside the app. Every
`BACKUP_INTERVAL_SECONDS` (default `86400`, i.e. once per day) it writes
a single tarball to `./backups/` on the host:

```
backups/fahrzeugkunde-20260414T020000Z.backup
├── manifest.json     # { "format": "fahrzeugkunde-backup", "schemaVersion": 1, ... }
├── db.dump           # pg_dump --format=custom --compress=6
└── assets.tar        # raw tar of /data/assets
```

Files older than `BACKUP_RETENTION_DAYS` (default 14) are pruned at the
end of every run. The sidecar mounts `/data` **read-only** – it can
never damage live data.

| Environment variable      | Default       | Purpose                                      |
|---------------------------|---------------|----------------------------------------------|
| `BACKUP_INTERVAL_SECONDS` | `86400`       | Seconds between runs (`0` disables the loop) |
| `BACKUP_RETENTION_DAYS`   | `14`          | Delete `.backup` files older than N days     |
| `BACKUP_DIR`              | `/backups`    | Where to write archives                      |
| `ASSETS_DIR`              | `/data/assets`| Source folder for the asset tar              |
| `RUN_ONCE`                | *(unset)*     | When set, run a single backup and exit       |

### 3. Drop-in restore

To restore from a backup, pick a file from `./backups/` and rename it
to `restore.backup`:

```bash
cp backups/fahrzeugkunde-20260414T020000Z.backup backups/restore.backup
docker compose restart app
```

`startup.js` checks for `/backups/restore.backup` on every container
start. When it finds one:

1. Extracts the tarball into a temp folder
2. Verifies `manifest.json` (format + schema version)
3. Runs `pg_restore --clean --if-exists --exit-on-error --no-owner --no-privileges`
   against the live database
4. Wipes `/data/assets` and extracts `assets.tar` in its place
5. Renames the trigger to `restore.backup.done-<timestamp>` so the
   restore does not run again on the next start
6. If any step fails, the trigger is moved to `restore.backup.failed-<timestamp>`
   to avoid a restart loop – check the container logs for the cause

The app image ships with `postgresql-client-16` (via PGDG) so
`pg_restore` is available at runtime.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start Next.js dev server on :3000 |
| `npm run build` | Production build (standalone) |
| `npm run start` | Run the production build |
| `npm run test` | Vitest (unit + DB integration) |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Apply/refresh the schema |
| `npm run db:seed` | Load the HLF 20 demo data |

## Testing

Integration tests use a separate database `fahrzeugkunde_test`.
`src/__tests__/global-setup.ts` creates and migrates it automatically
on the first run. If no PostgreSQL is reachable, DB tests are skipped
and only unit tests run.

```bash
npm test
```

Connection string can be overridden via the
`POSTGRES_TEST_CONNECTION_STRING` environment variable.

## License

See [LICENSE](./LICENSE).

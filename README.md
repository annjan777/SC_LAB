# SC Lab Portal

A work management portal for laboratory environments: authentication,
role-based access control, work planning, facilities, inventory, purchase
requests, leave requests, a document repository, and notifications.

## Architecture

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS, in `src/`.
  Talks to the backend exclusively through `src/lib/api.ts` (a thin fetch
  wrapper) - there is no Supabase client anywhere in the frontend anymore.
- **Backend**: Express + TypeScript in `server/`, talking directly to
  PostgreSQL via `pg`. JWT-based auth (`server/src/middleware/auth.ts`),
  bcrypt password hashing, and an RBAC permission system enforced in the
  route handlers (`server/src/routes/`).
- **Database**: Plain PostgreSQL. The full schema lives in one file,
  `server/schema.sql` - tables, indexes, functions, and seed data for the
  default roles/permissions. No Supabase, no Row Level Security.
- **Email**: Optional, via [Resend](https://resend.com). If `RESEND_API_KEY`
  isn't set, emails are skipped and logged to the server console instead
  (handy for local dev).

`legacy-supabase/` contains everything from the project's original Supabase
backend (migrations, Edge Functions, and troubleshooting docs written at the
time). It's not used by the running app - kept only for historical reference.

## Quick Start (Docker)

```bash
./start.sh
```

This builds and runs Postgres + the server (which also serves the built
frontend) via `docker-compose.yml`. The app will be available at
`http://localhost:3001`.

## Quick Start (no Docker)

```bash
./start-local.sh
```

This installs PostgreSQL if needed (via Homebrew on macOS), creates the
`sclab` database, loads `server/schema.sql`, installs npm dependencies for
both the frontend and `server/`, and starts both dev servers:

- Frontend (Vite dev server): http://localhost:5173
- Backend (Express API): http://localhost:3001

## Manual Setup

1. **Create the database and load the schema:**
   ```bash
   createdb sclab
   psql sclab < server/schema.sql
   ```

2. **Configure environment variables.** Copy `.env.example` and fill in a
   real value for `JWT_SECRET`. See that file for what each variable does
   (DB connection, JWT secret, CORS origin, optional Resend email config).

3. **Install dependencies and run:**
   ```bash
   npm install && cd server && npm install && cd ..

   # Two dev servers (frontend + API), for local development:
   npm run dev            # in one terminal - Vite on :5173
   cd server && npm run dev   # in another - Express on :3001

   # OR build once and run a single production server that serves both:
   npm run build           # builds the frontend into dist/
   cd server && npm run build && npm start   # serves dist/ + the API on :3001
   ```

## First Admin User

On startup the server now ensures a local superadmin exists. Configure it
through `SUPERADMIN_EMAIL` and `SUPERADMIN_PASSWORD` in `server/.env`. If no
password is supplied, the server generates one and prints it in the backend
console on first boot.

After that, use the admin account to invite/create further users from
**Admin → Users** in the app.

## Permissions Model

Every non-admin action is gated by a permission (`view_inventory`,
`create_purchase_request`, `approve_leaves`, etc. - the full seed list is at
the bottom of `server/schema.sql`). A freshly-created `user` role has **no**
permissions by default; an admin must assign them from
**Admin → Settings → Roles** before regular users can see or do much beyond
managing their own profile, leave requests, and purchase requests (those
three are always available to any authenticated user, matching how a lab
member would actually use the app day-to-day).

Repository permissions are also seeded automatically on startup:
- `view_repository`
- `edit_repository_all`
- `delete_repository_all`
- `share_repository_documents`

The server also repairs older local databases on boot by:
- backfilling missing `role_id` values on user profiles
- inserting missing repository permissions
- aligning work-tracking compatibility columns
- widening the inventory category constraint to match the current UI

## Local Backups

For a local-machine deployment, both PostgreSQL data and uploaded files can be
snapshotted locally.

Create a backup:

```bash
npm run backup:local
```

Restore from a backup folder:

```bash
npm run restore:local -- /absolute/path/to/backups/20260811-120000
```

Each backup stores:
- a PostgreSQL custom-format dump
- a compressed archive of uploaded files
- a small manifest with connection details

For automatic backups, run `npm run backup:local` from `cron` or `launchd`
at your preferred interval on the same machine as PostgreSQL and the uploads
directory.

## Available Scripts

Frontend (repo root):
- `npm run dev` - Vite dev server
- `npm run build` - production build to `dist/`
- `npm run preview` - preview the production build
- `npm run lint` - ESLint
- `npm run typecheck` - TypeScript check only, no build

Backend (`server/`):
- `npm run dev` - `tsx watch` dev server with auto-reload
- `npm run build` - compiles to `server/dist/`
- `npm start` - runs the compiled server (`node dist/index.js`)

## Project Structure

```
src/
├── components/     # Reusable UI components
├── contexts/       # AuthContext (session/permissions state)
├── lib/            # api.ts (backend client), supabase.ts (legacy types only)
├── pages/          # Route-level pages
│   └── admin/      # Admin-only pages
└── utils/          # PDF/report generation, importers

server/
├── schema.sql              # Full Postgres schema + seed data
└── src/
    ├── config/database.ts  # pg Pool
    ├── middleware/auth.ts  # JWT auth, RBAC helpers
    ├── routes/              # One file per resource area
    └── utils/email.ts      # Resend wrapper (welcome/reset emails)
```

## License

MIT

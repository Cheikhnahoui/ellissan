# الموقع الرسمي للشيخ عبد الرحمن النحوي — Official Website

Arabic-first digital library and official site. Next.js (App Router) · TypeScript · Tailwind CSS 4 ·
PostgreSQL · Drizzle ORM.

> **Current status: foundation, public site, admin sign-in and material management are done; categories/tags, pages, users and the audit log are next.** See [Status](#status).

## Requirements

- Node.js 22+ and npm
- PostgreSQL 15+ (local or hosted). A hosted database is **not** provided; you must create one.

## Local setup

```bash
npm install
cp .env.example .env.local     # Next.js reads this
cp .env.example .env           # the db scripts read this (dotenv)
# edit DATABASE_URL in both files

npm run db:migrate             # applies ./drizzle/*.sql
npm run db:seed                # roles, permissions, content types, settings, empty page shells
npm run db:seed:sample         # OPTIONAL, development only: clearly-labelled sample content
npm run dev                    # http://localhost:3000
```

Quality checks:

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

Sample data is flagged `is_sample` / `sample-` slugs, is labelled «تجريبي», is never attributed to the
Sheikh, and the script refuses to run when `NODE_ENV=production`. Remove it any time with
`npm run db:purge:sample` (real content is untouched).

## Project layout

```
src/app/(site)/          public routes: /, /library, /library/[slug], /categories, /categories/[slug], /about, /privacy, /terms, /copyright
src/components/          shared UI (header, footer, search, filters, cards, pagination, states)
src/lib/content/         public queries (queries.ts), cached entry points (public.ts), URL params
src/app/admin/          admin area: /admin/login and the protected panel (dashboard)
src/lib/db/schema.ts     the whole database schema
src/lib/db/harden.ts     row-level-security hardening (runs after every migration)
src/lib/db/seed-reference.ts   idempotent reference data (no scholarly content)
src/lib/auth/            permissions, passwords (scrypt), sessions, sign-in + rate limiting, request guards
src/lib/admin/           audit log, dashboard statistics, material management (content.ts), workflow rules (workflow.ts), form validation
src/lib/search/arabic.ts       Arabic normalisation for search
src/lib/env.ts           validated environment variables
src/lib/{storage,validation}/  reserved for later phases
drizzle/                 generated SQL migrations (commit these)
scripts/                 migrate, seed and create-admin scripts
tests/                   Vitest tests (run against the real migrations)
```

## Rendering and caching (Cache Components)

`next.config.ts` enables Cache Components (the Next.js 16 default). Public reads are `'use cache'`
functions tagged `content` (see `src/lib/content/public.ts`), so `next build` needs **no database**.
Free-text searches are deliberately not cached. When the admin area publishes or edits
content it must call `updateTag("content")` so visitors see the change immediately; until then
cached pages refresh within a few minutes.

## Admin area (/admin)

Sign-in, sessions, roles and the protected panel shell are built (more admin pages follow).

- **First administrator:** after `db:migrate` and `db:seed`, run
  `npm run admin:create -- --email you@example.org --name "Your name"`. The password is typed at a
  hidden prompt (min. 12 characters). It refuses to run if a super admin already exists.
- **Production secret:** set `AUTH_SECRET` (32+ chars) in Vercel and redeploy. The public site does not
  need it; only sign-in does.
- **Security model:** scrypt password hashes; random 256-bit session tokens stored only as SHA-256
  hashes; `HttpOnly` + `SameSite=Lax` cookie (`__Host-` prefix and `Secure` in production); 7-day
  sessions revoked on logout or when an account is disabled; 5 failed attempts per account / 20 per IP
  in 15 minutes locks sign-in; identical error for unknown email, wrong password or disabled account.
  Permissions are read from the database on every request, and every protected page/action re-checks
  them on the server.

## Managing materials (/admin/content)

- **Roles:** editors create and edit drafts and send them for review; reviewers approve or send back;
  content managers and the super admin publish, unpublish and archive. A material that is approved or
  published can only be edited by someone who may publish.
- **States:** draft → in review → approved → published; archived is separate. A database rule makes
  publishing an unapproved item impossible. With `workflow.require_review` off (default in v1) an authorised
  publisher may publish a draft directly (recorded in the audit log as auto-approved); turn it on to require
  approval first.
- **Preview** shows exactly what visitors will see, even before publishing. Publishing, unpublishing,
  archiving and editing refresh the public site immediately (`updateTag("content")`).
- Every operation re-checks permissions inside the logic layer, runs in one transaction, refreshes the
  search text and writes an audit entry. Forms are validated again on the server (links must be http/https).
- Not included yet: deleting materials (archive instead), file uploads, video/audio embedding.

## Key design decisions

- **ORM:** Drizzle only. Change the schema in `schema.ts`, then `npm run db:generate`, review the SQL, commit.
- **Approval is separate from publication.** `approval_status` (draft / in_review / approved) vs
  `publication_status` (unpublished / published / archived). A database CHECK constraint makes it
  impossible to publish unapproved content. Mandatory review is the setting
  `workflow.require_review` (off in v1).
- **Safe deletes.** Categories, tags, content types and roles that are in use cannot be deleted
  (`ON DELETE RESTRICT`).
- **Arabic search.** `content_items.search_text` stores normalised text (hamza, diacritics, tatweel,
  ya/alef-maqsura, ta-marbuta, digits). Original text is untouched. A GIN index on
  `to_tsvector('simple', search_text)` backs the search; queries must be normalised with the same function.
- **No invented content.** Seed data contains only structure. Static pages (about, privacy, terms,
  copyright) are created empty and unpublished. `is_sample` marks development sample data, which must
  never reach production.
- **No default admin account.** The first administrator is created by the one-time script `npm run admin:create`.

## Status

| Area                                                                                                                                                             | State                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Next.js 16 + TS strict + Tailwind 4, RTL root layout, self-hosted IBM Plex Sans Arabic                                                                           | Done, builds                                                                                                           |
| Schema + migrations (22 tables)                                                                                                                                  | Done; verified on in-process PostgreSQL (PGlite)                                                                       |
| Reference seed, permissions catalogue, Arabic normalisation                                                                                                      | Done, tested                                                                                                           |
| Public site: home, library (search, filters, sort, pagination), item pages, categories, about/policy pages, 404/error/loading states                             | Done; tests, production build and live HTTP checks pass                                                                |
| Supabase hardening (RLS on every table, API roles revoked)                                                                                                       | Done; tested against a Supabase-like role setup                                                                        |
| Admin sign-in, sessions, roles, first-admin script, protected dashboard                                                                                          | Done; 27 dedicated tests plus a live HTTP login/logout test                                                            |
| Material management: list, create, edit, preview, review/approve/publish/archive workflow                                                                        | Done; 29 dedicated tests plus a 40-check live HTTP scenario                                                            |
| Tests                                                                                                                                                            | 120 passing (schema, permissions, Arabic search, public queries, hardening, sign-in and sessions, material management) |
| Categories and tags management, static pages editor, users management, audit-log viewer, contact form, uploads, sitemap/robots/structured data, launch checklist | Not started                                                                                                            |
| `db:migrate` / `db:seed` / `admin:create` against your **real Supabase database**                                                                                | Written and tested on in-process PostgreSQL; run them on your machine and report any error                             |

**Known limitations**

- Static pages (about, privacy, terms, copyright) show «غير متاحة حاليًا» until an admin publishes content (the page editor comes in a later admin step).
- Categories and tags cannot be created from the admin yet: tags are created while editing a material, and categories need the category manager (next step).
- A missing or unpublished item URL renders the not-found page with `noindex` but HTTP status 200 (a "soft 404"), because the page streams under Cache Components.
- Video/audio players are not embedded yet; sources appear as links. Embedding comes with source handling (Phase 5).
- Visiting `/admin` without a session returns a loading shell (HTTP 200) that then redirects to the sign-in page in the browser, rather than an HTTP redirect. No admin data is included in that response.
- Layout was verified by markup and HTTP checks only, not in a real browser or on a phone; please review it visually.

## Deploying with Supabase + Vercel

1. **Supabase:** create a project (pick a region near your visitors; use the same region for Vercel Functions).
   Choose a strong database password and keep it private.
2. **Vercel:** import the GitHub repo. Add `NEXT_PUBLIC_SITE_URL` (your site URL) and `DATABASE_URL` =
   the **Transaction pooler** string (port 6543) from Supabase's _Connect_ panel. Redeploy after changing either.
3. **Create the tables, from your computer:** put the **Session pooler** string (port 5432) in `.env` as
   `DATABASE_URL`, then run `npm run db:migrate` and `npm run db:seed`.
4. If a connection fails with `self-signed certificate in certificate chain`, append `?sslmode=no-verify`
   to that connection string (encrypted, but the server's identity is not verified).

**Security — important on Supabase.** Supabase publishes the `public` schema through an HTTP API, and tables
created by a migration tool have row-level security _off_. `npm run db:migrate` therefore always finishes by
running `hardenDatabase()` (`src/lib/db/harden.ts`): it enables RLS on every table and revokes the `anon` /
`authenticated` roles. The app connects directly as the table owner, which bypasses RLS, so it is unaffected.
Never put Supabase's `service_role` key in this project or in Vercel; the app does not use it. Re-run
`npm run db:migrate` after every schema change.

## Deployment (other hosts)

Not yet documented — completed in Phase 8 (production database, env vars, backups, first admin,
pre-launch checklist).
"# ellissan" 

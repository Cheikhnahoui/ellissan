# مجلس لسان العربي — Lisan Al-Arabi Council Management System

Next.js (App Router) · TypeScript strict · Prisma 7 · PostgreSQL.

## Status (honest)

**Built and verified** (55 automated tests against real PostgreSQL, strict typecheck, ESLint, production build):

- Schema + migration; QR token scheme; invitation workflow rules; transactional, race-safe attendance; audited corrections; attendance-rate and ranking rules.
- Authentication: Argon2id, DB-backed revocable sessions (HTTP-only cookie), brute-force lockout, closed registration, CLI bootstrap of the first admin, admin creation/deactivation, password change.
- Arabic RTL UI: login, dashboard (live stats), participants (CRUD, search, pagination, archive, profile with history, CSV/XLSX import preview and error report), activities (CRUD, close/reopen/extend), admin management.

**Not built yet** (these nav items are marked "قريبًا" and disabled):
invitation selection screen, QR display and WhatsApp/email message preparation; QR scanner screen; attendance correction UI;
analytics charts and date-range filters; recognition module; XLSX/CSV/PDF exports; Playwright end-to-end tests; backup and deployment docs.
The services behind invitations, attendance and analytics already exist and are tested; the screens are what is missing.

## Local setup

```bash
cp .env.example .env            # fill DATABASE_URL and QR_TOKEN_SECRET
npm install
npx prisma migrate deploy       # applies prisma/migrations
npx prisma generate
# first administrator (only works while no administrator exists):
ADMIN_EMAIL=you@example.org ADMIN_NAME='الاسم' ADMIN_PASSWORD='...' npm run admin:create
npm run dev
npm test                        # needs a reachable PostgreSQL (tests TRUNCATE tables: use a dedicated DB!)
```

## Key rules (see tests/)

- QR token = base64url(HMAC-SHA256(QR_TOKEN_SECRET, invitationId:version)); only its SHA-256 is stored. No personal data in the QR.
- One invitation per (participant, activity); one attendance per (activity, participant) — DB unique constraints.
- Scans lock the activity row (`FOR UPDATE`) and use a conditional status transition; concurrent scans yield exactly one success.
- Attendance is never deleted: corrections void/restore it with reason + admin in `AttendanceCorrection` and `AuditEvent`.
- Attendance rate = valid attended / finalized invitations. Cancelled, never-invited and still-open invitations are excluded.
- Invitation `PREPARED` never means delivered; only a manual `SENT_CONFIRMED` (who/when recorded) does.

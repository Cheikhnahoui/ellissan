# مجلس لسان العربي — Lisan Al-Arabi Council Management System

Next.js (App Router) · TypeScript strict · Prisma 7 · PostgreSQL.

## Status (honest)
**Done and tested against real PostgreSQL:** schema + migration, QR token scheme, invitation workflow rules,
attendance recording (transactional, race-safe), attendance corrections (audited), attendance-rate and ranking rules.
**Not yet built:** admin authentication UI, dashboard, participant/activity/invitation/attendance/recognition screens,
CSV/XLSX import, XLSX/CSV/PDF exports, QR scanner UI, Playwright e2e, deployment docs.

## Local setup
```bash
cp .env.example .env            # fill DATABASE_URL and QR_TOKEN_SECRET
npm install
npx prisma migrate deploy       # applies prisma/migrations
npx prisma generate
npm test                        # needs a reachable PostgreSQL (tests TRUNCATE tables: use a dedicated DB!)
```

## Key rules (see tests/)
- QR token = base64url(HMAC-SHA256(QR_TOKEN_SECRET, invitationId:version)); only its SHA-256 is stored. No personal data in the QR.
- One invitation per (participant, activity); one attendance per (activity, participant) — DB unique constraints.
- Scans lock the activity row (`FOR UPDATE`) and use a conditional status transition; concurrent scans yield exactly one success.
- Attendance is never deleted: corrections void/restore it with reason + admin in `AttendanceCorrection` and `AuditEvent`.
- Attendance rate = valid attended / finalized invitations. Cancelled, never-invited and still-open invitations are excluded.
- Invitation `PREPARED` never means delivered; only a manual `SENT_CONFIRMED` (who/when recorded) does.

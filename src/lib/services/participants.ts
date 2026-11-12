import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { normalizeEmail, normalizeName, normalizePhone, toWesternDigits } from "@/lib/normalize";
import { participantSchema } from "@/lib/validation";

export class DuplicateError extends Error {
  constructor(
    public field: "phone" | "email",
    public existingId: string,
  ) {
    super(field === "phone" ? "رقم الهاتف مسجل لمشارك آخر" : "البريد الإلكتروني مسجل لمشارك آخر");
  }
}
export class ValidationError extends Error {}

export type ParticipantInput = { fullName: string; phone?: string | null; email?: string | null };

function prepare(input: ParticipantInput) {
  const parsed = participantSchema.safeParse({
    fullName: input.fullName,
    phone: input.phone ?? undefined,
    email: input.email ?? undefined,
  });
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message);
  const { fullName, phone, email } = parsed.data;
  const phoneNormalized = normalizePhone(phone);
  const emailNormalized = normalizeEmail(email);
  if (phone && !phoneNormalized) throw new ValidationError("رقم الهاتف غير صالح");
  if (email && !emailNormalized) throw new ValidationError("البريد الإلكتروني غير صالح");
  return {
    fullName,
    nameNormalized: normalizeName(fullName),
    phone: phone ?? null,
    phoneNormalized,
    email: email ?? null,
    emailNormalized,
  };
}

async function assertNoDuplicate(tx: Prisma.TransactionClient, d: ReturnType<typeof prepare>, excludeId?: string) {
  const clash = await tx.participant.findFirst({
    where: {
      id: excludeId ? { not: excludeId } : undefined,
      OR: [
        ...(d.phoneNormalized ? [{ phoneNormalized: d.phoneNormalized }] : []),
        ...(d.emailNormalized ? [{ emailNormalized: d.emailNormalized }] : []),
      ],
    },
    select: { id: true, phoneNormalized: true },
  });
  if (clash)
    throw new DuplicateError(
      d.phoneNormalized && clash.phoneNormalized === d.phoneNormalized ? "phone" : "email",
      clash.id,
    );
}

export async function createParticipant(adminId: string, input: ParticipantInput) {
  const d = prepare(input);
  try {
    return await prisma.$transaction(async (tx) => {
      await assertNoDuplicate(tx, d);
      const p = await tx.participant.create({ data: d });
      await audit(tx, adminId, "participant.create", "Participant", p.id);
      return p;
    });
  } catch (e) {
    // Concurrent insert beat the pre-check: the unique index is the final authority.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new DuplicateError("phone", "");
    throw e;
  }
}

export async function updateParticipant(adminId: string, id: string, input: ParticipantInput) {
  const d = prepare(input);
  return prisma.$transaction(async (tx) => {
    await assertNoDuplicate(tx, d, id);
    const p = await tx.participant.update({ where: { id }, data: d });
    await audit(tx, adminId, "participant.update", "Participant", id);
    return p;
  });
}

/** Archiving never touches invitations, attendance or recognitions. */
export async function setParticipantArchived(adminId: string, id: string, archived: boolean) {
  return prisma.$transaction(async (tx) => {
    const p = await tx.participant.update({
      where: { id },
      data: archived ? { status: "ARCHIVED", archivedAt: new Date() } : { status: "ACTIVE", archivedAt: null },
    });
    await audit(tx, adminId, archived ? "participant.archive" : "participant.restore", "Participant", id);
    return p;
  });
}

export type ParticipantQuery = {
  q?: string;
  status?: "ACTIVE" | "ARCHIVED" | "ALL";
  sort?: "name" | "createdAt";
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

export async function listParticipants(opts: ParticipantQuery = {}) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));
  const q = opts.q?.trim();
  const looksLikePhone = !!q && /^[\d\s+\-().\u0660-\u0669\u06F0-\u06F9]+$/.test(q);
  const phoneNeedle = looksLikePhone ? (normalizePhone(q) ?? toWesternDigits(q!).replace(/\D/g, "")) : "";
  const where: Prisma.ParticipantWhereInput = {
    ...(opts.status && opts.status !== "ALL"
      ? { status: opts.status }
      : opts.status === "ALL"
        ? {}
        : { status: "ACTIVE" }),
    ...(q
      ? {
          OR: [
            { nameNormalized: { contains: normalizeName(q) } },
            { emailNormalized: { contains: q.toLowerCase() } },
            ...(phoneNeedle ? [{ phoneNormalized: { contains: phoneNeedle } }] : []),
          ],
        }
      : {}),
  };
  const orderBy: Prisma.ParticipantOrderByWithRelationInput =
    opts.sort === "createdAt" ? { createdAt: opts.dir ?? "desc" } : { nameNormalized: opts.dir ?? "asc" };
  const [total, items] = await Promise.all([
    prisma.participant.count({ where }),
    prisma.participant.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { id: true, fullName: true, phone: true, email: true, status: true, createdAt: true },
    }),
  ]);
  return { items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

// ---------- Import ----------

export const IMPORT_LIMITS = { maxBytes: 5 * 1024 * 1024, maxRows: 5000 };

export type ImportRow = {
  line: number;
  fullName: string;
  phone: string;
  email: string;
  status: "NEW" | "DUPLICATE" | "POSSIBLE_DUPLICATE" | "INVALID";
  reason?: string;
};

const HEADERS: Record<string, "fullName" | "phone" | "email"> = {
  الاسم: "fullName",
  "الاسم الكامل": "fullName",
  name: "fullName",
  "full name": "fullName",
  fullname: "fullName",
  الهاتف: "phone",
  "رقم الهاتف": "phone",
  الجوال: "phone",
  phone: "phone",
  mobile: "phone",
  البريد: "email",
  "البريد الإلكتروني": "email",
  email: "email",
  "e-mail": "email",
};

export async function parseImportFile(buf: Buffer, filename: string): Promise<string[][]> {
  if (buf.length > IMPORT_LIMITS.maxBytes) throw new ValidationError("حجم الملف يتجاوز 5 ميغابايت");
  const lower = filename.toLowerCase();
  if (lower.endsWith(".xlsx")) {
    if (buf.subarray(0, 2).toString("latin1") !== "PK") throw new ValidationError("الملف ليس بصيغة XLSX صالحة");
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(buf as unknown as ArrayBuffer);
    } catch {
      throw new ValidationError("تعذر قراءة ملف XLSX");
    }
    const ws = wb.worksheets[0];
    if (!ws) throw new ValidationError("الملف فارغ");
    const rows: string[][] = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const vals = (row.values as unknown[]).slice(1).map((v) => {
        if (v == null) return "";
        if (typeof v === "object" && "text" in (v as object)) return String((v as { text: unknown }).text);
        if (typeof v === "object" && "result" in (v as object)) return String((v as { result: unknown }).result ?? "");
        return String(v);
      });
      rows.push(vals);
    });
    return rows;
  }
  if (lower.endsWith(".csv")) {
    const Papa = (await import("papaparse")).default;
    const text = buf.toString("utf8").replace(/^\uFEFF/, "");
    return Papa.parse<string[]>(text, { skipEmptyLines: "greedy" }).data;
  }
  throw new ValidationError("الصيغة غير مدعومة: استخدم CSV أو XLSX");
}

export async function previewImport(table: string[][]): Promise<ImportRow[]> {
  if (table.length < 2) throw new ValidationError("الملف لا يحتوي على بيانات");
  if (table.length - 1 > IMPORT_LIMITS.maxRows) throw new ValidationError(`الحد الأقصى ${IMPORT_LIMITS.maxRows} صف`);
  const idx: Partial<Record<"fullName" | "phone" | "email", number>> = {};
  table[0].forEach((h, i) => {
    const key = HEADERS[h.trim().toLowerCase()];
    if (key && idx[key] === undefined) idx[key] = i;
  });
  if (idx.fullName === undefined) throw new ValidationError("عمود «الاسم» غير موجود في الصف الأول");

  const rows: ImportRow[] = table.slice(1).map((r, i) => ({
    line: i + 2,
    fullName: (r[idx.fullName!] ?? "").trim(),
    phone: idx.phone !== undefined ? (r[idx.phone] ?? "").trim() : "",
    email: idx.email !== undefined ? (r[idx.email] ?? "").trim() : "",
    status: "NEW",
  }));

  const existing = await prisma.participant.findMany({
    select: { nameNormalized: true, phoneNormalized: true, emailNormalized: true },
  });
  const phones = new Set(existing.map((e) => e.phoneNormalized).filter(Boolean));
  const emails = new Set(existing.map((e) => e.emailNormalized).filter(Boolean));
  const names = new Set(existing.map((e) => e.nameNormalized));

  for (const row of rows) {
    const bad = (reason: string) => {
      row.status = "INVALID";
      row.reason = reason;
    };
    try {
      prepare({ fullName: row.fullName, phone: row.phone || undefined, email: row.email || undefined });
    } catch (e) {
      bad((e as Error).message);
      continue;
    }
    const p = normalizePhone(row.phone),
      m = normalizeEmail(row.email),
      n = normalizeName(row.fullName);
    if ((p && phones.has(p)) || (m && emails.has(m))) {
      row.status = "DUPLICATE";
      row.reason = "مسجل مسبقًا (الهاتف أو البريد)";
    } else if (!p && !m && names.has(n)) {
      row.status = "POSSIBLE_DUPLICATE";
      row.reason = "اسم مطابق ولا توجد بيانات اتصال للتمييز";
    }
    if (row.status === "NEW" || row.status === "POSSIBLE_DUPLICATE") {
      // rows later in the same file are checked against earlier ones
      if (p) phones.add(p);
      if (m) emails.add(m);
      names.add(n);
    }
  }
  return rows;
}

/** Imports only NEW rows. Re-validates inside a transaction, so a stale preview can never create duplicates. */
export async function commitImport(adminId: string, rows: ImportRow[]) {
  const candidates = rows.filter((r) => r.status === "NEW");
  let created = 0,
    skipped = 0;
  await prisma.$transaction(async (tx) => {
    for (const r of candidates) {
      const d = prepare({ fullName: r.fullName, phone: r.phone || undefined, email: r.email || undefined });
      try {
        await assertNoDuplicate(tx, d);
      } catch (e) {
        if (e instanceof DuplicateError) {
          skipped++;
          continue;
        }
        throw e;
      }
      if (!d.phoneNormalized && !d.emailNormalized) {
        const same = await tx.participant.findFirst({
          where: { nameNormalized: d.nameNormalized },
          select: { id: true },
        });
        if (same) {
          skipped++;
          continue;
        }
      }
      await tx.participant.create({ data: d });
      created++;
    }
    await audit(tx, adminId, "participant.import", "Participant", null, { created, skipped, total: rows.length });
  });
  return { created, skipped, notImported: rows.length - candidates.length };
}

export function importErrorReport(rows: ImportRow[]): string {
  const esc = (v: string) => `"${(/^[=+\-@\t\r]/.test(v) ? "'" + v : v).replace(/"/g, '""')}"`;
  const label = { INVALID: "غير صالح", DUPLICATE: "مكرر", POSSIBLE_DUPLICATE: "تكرار محتمل", NEW: "جديد" } as const;
  const lines = rows
    .filter((r) => r.status !== "NEW")
    .map((r) =>
      [r.line, r.fullName, r.phone, r.email, label[r.status], r.reason ?? ""].map((v) => esc(String(v))).join(","),
    );
  return "\uFEFF" + ["السطر,الاسم,الهاتف,البريد,الحالة,السبب", ...lines].join("\r\n");
}

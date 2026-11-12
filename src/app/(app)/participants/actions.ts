"use server";
import { requireAdmin } from "@/lib/auth/session";
import { flashErr, flashOk } from "@/lib/flash";
import {
  DuplicateError,
  ValidationError,
  commitImport,
  createParticipant,
  importErrorReport,
  parseImportFile,
  previewImport,
  setParticipantArchived,
  updateParticipant,
  type ImportRow,
} from "@/lib/services/participants";

export type FormState = { error?: string; values?: Record<string, string> } | undefined;

const read = (fd: FormData) => ({
  fullName: String(fd.get("fullName") ?? ""),
  phone: String(fd.get("phone") ?? ""),
  email: String(fd.get("email") ?? ""),
});

function explain(e: unknown): string {
  if (e instanceof DuplicateError || e instanceof ValidationError) return e.message;
  throw e;
}

export async function createParticipantAction(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const values = read(fd);
  let id: string;
  try {
    id = (await createParticipant(admin.id, values)).id;
  } catch (e) {
    return { error: explain(e), values };
  }
  flashOk(`/participants/${id}`, "تمت إضافة المشارك");
}

export async function updateParticipantAction(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const values = read(fd);
  try {
    await updateParticipant(admin.id, id, values);
  } catch (e) {
    return { error: explain(e), values };
  }
  flashOk(`/participants/${id}`, "تم حفظ التعديلات");
}

export async function archiveAction(id: string, archived: boolean) {
  const admin = await requireAdmin();
  await setParticipantArchived(admin.id, id, archived);
  flashOk(`/participants/${id}`, archived ? "تمت أرشفة المشارك. سجلاته التاريخية محفوظة." : "تمت إعادة المشارك");
}

export type ImportState =
  { error?: string; rows?: ImportRow[]; done?: { created: number; skipped: number; notImported: number } } | undefined;

export async function previewImportAction(_: ImportState, fd: FormData): Promise<ImportState> {
  await requireAdmin();
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "اختر ملف CSV أو XLSX" };
  try {
    const rows = await previewImport(await parseImportFile(Buffer.from(await file.arrayBuffer()), file.name));
    return { rows };
  } catch (e) {
    if (e instanceof ValidationError) return { error: e.message };
    throw e;
  }
}

export async function commitImportAction(_: ImportState, fd: FormData): Promise<ImportState> {
  const admin = await requireAdmin();
  let rows: ImportRow[];
  try {
    rows = JSON.parse(String(fd.get("rows")));
  } catch {
    return { error: "بيانات المعاينة غير صالحة" };
  }
  if (!Array.isArray(rows) || rows.length > 5000) return { error: "بيانات المعاينة غير صالحة" };
  // Rows are re-validated and de-duplicated inside commitImport; the client-supplied JSON is never trusted.
  const clean: ImportRow[] = rows.map((r) => ({
    line: Number(r.line) || 0,
    fullName: String(r.fullName ?? ""),
    phone: String(r.phone ?? ""),
    email: String(r.email ?? ""),
    status: r.status === "NEW" ? "NEW" : "INVALID",
    reason: r.reason,
  }));
  return { done: await commitImport(admin.id, clean), rows };
}

export async function errorReportAction(rowsJson: string): Promise<string> {
  await requireAdmin();
  return importErrorReport(JSON.parse(rowsJson) as ImportRow[]);
}

export { flashErr };

"use server";
import { z } from "zod";
import { requireAdmin, currentToken } from "@/lib/auth/session";
import { flashErr, flashOk } from "@/lib/flash";
import { changeOwnPassword, createAdmin, setAdminActive } from "@/lib/auth/service";
import { adminSchema } from "@/lib/validation";

export type AdminFormState = { error?: string; values?: Record<string, string> } | undefined;

export async function createAdminAction(_: AdminFormState, fd: FormData): Promise<AdminFormState> {
  const actor = await requireAdmin();
  const values = { name: String(fd.get("name") ?? ""), email: String(fd.get("email") ?? "") };
  const parsed = adminSchema.safeParse({ ...values, password: String(fd.get("password") ?? "") });
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };
  try {
    await createAdmin(actor.id, parsed.data);
  } catch (e) {
    const m = (e as Error).message;
    const text =
      m === "EMAIL_EXISTS"
        ? "هذا البريد مستخدم لمشرف آخر"
        : m === "WEAK_PASSWORD"
          ? "كلمة المرور ضعيفة: 10 أحرف على الأقل وتحتوي حروفًا وأرقامًا"
          : m === "INVALID_EMAIL"
            ? "بريد إلكتروني غير صالح"
            : null;
    if (!text) throw e;
    return { error: text, values };
  }
  flashOk("/admins", "تم إنشاء حساب المشرف");
}

export async function toggleAdminAction(targetId: string, active: boolean) {
  const actor = await requireAdmin();
  try {
    await setAdminActive(actor.id, targetId, active);
  } catch (e) {
    const m = (e as Error).message;
    const text =
      m === "CANNOT_DEACTIVATE_SELF"
        ? "لا يمكنك تعطيل حسابك"
        : m === "LAST_ADMIN"
          ? "لا يمكن تعطيل آخر مشرف نشط"
          : null;
    if (!text) throw e;
    flashErr("/admins", text);
  }
  flashOk("/admins", active ? "تم تفعيل الحساب" : "تم تعطيل الحساب وإنهاء جلساته");
}

export async function changePasswordAction(_: AdminFormState, fd: FormData): Promise<AdminFormState> {
  const actor = await requireAdmin();
  const p = z
    .object({ current: z.string().min(1), next: z.string().min(10, "10 أحرف على الأقل") })
    .safeParse({ current: fd.get("current"), next: fd.get("next") });
  if (!p.success) return { error: p.error.issues[0].message };
  try {
    await changeOwnPassword(actor.id, p.data.current, p.data.next, await currentToken());
  } catch (e) {
    const m = (e as Error).message;
    if (m === "WRONG_PASSWORD") return { error: "كلمة المرور الحالية غير صحيحة" };
    if (m === "WEAK_PASSWORD") return { error: "كلمة المرور ضعيفة: حروف وأرقام، 10 أحرف على الأقل" };
    throw e;
  }
  flashOk("/admins", "تم تغيير كلمة المرور وإنهاء الجلسات الأخرى");
}

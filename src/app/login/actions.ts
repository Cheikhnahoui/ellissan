"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { login } from "@/lib/auth/service";
import { clientIp, setSessionCookie } from "@/lib/auth/session";

const schema = z.object({ email: z.string().trim().min(1).max(200), password: z.string().min(1).max(200) });

export async function loginAction(_: { error?: string } | undefined, fd: FormData) {
  const parsed = schema.safeParse({ email: fd.get("email"), password: fd.get("password") });
  if (!parsed.success) return { error: "أدخل البريد الإلكتروني وكلمة المرور" };
  let r;
  try {
    r = await login(parsed.data.email, parsed.data.password, await clientIp());
  } catch (e) {
    // Infrastructure failure (database unreachable, missing env vars...). Details go to the server log only.
    console.error(
      "[login] unexpected failure:",
      e instanceof Error ? `${e.name}: ${e.message}`.slice(0, 300) : "unknown",
    );
    return { error: "تعذر الاتصال بالخادم أو قاعدة البيانات. تحقق من إعدادات النشر (متغيرات البيئة) وسجلات الخادم." };
  }
  if (!r.ok) {
    return { error: r.code === "RATE_LIMITED" ? "محاولات كثيرة. حاول مجددًا بعد 15 دقيقة." : "بيانات الدخول غير صحيحة" };
  }
  await setSessionCookie(r.sessionToken, r.expiresAt);
  redirect("/dashboard");
}

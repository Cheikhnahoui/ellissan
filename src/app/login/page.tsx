import { redirect } from "next/navigation";
import { currentAdmin } from "@/lib/auth/session";
import { Card } from "@/components/ui";
import { LoginForm } from "./form";

export const metadata = { title: "تسجيل الدخول" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await currentAdmin()) redirect("/dashboard");
  return (
    <main className="grid min-h-screen place-items-center p-4">
      <Card className="w-full max-w-sm space-y-5">
        <div>
          <h1 className="text-xl font-semibold text-brand">مجلس اللسان العربي</h1>
          <p className="mt-1 text-sm text-muted">تسجيل دخول المشرفين. الحسابات تُنشأ من قبل مشرف فقط.</p>
        </div>
        <LoginForm />
      </Card>
    </main>
  );
}

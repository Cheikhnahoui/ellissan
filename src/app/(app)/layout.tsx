import { Suspense } from "react";
import { redirect } from "next/navigation";
import { destroySession, requireAdmin } from "@/lib/auth/session";
import { Toast, SubmitButton } from "@/components/client";
import { Nav } from "./nav";

export const dynamic = "force-dynamic";

async function logoutAction() {
  "use server";
  await destroySession();
  redirect("/login");
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="border-line bg-surface p-3 lg:sticky lg:top-0 lg:h-screen lg:border-e lg:p-4">
        <p className="mb-3 px-3 text-lg font-semibold text-brand">مجلس اللسان العربي</p>
        <Nav />
      </aside>
      <div className="min-w-0">
        <header className="app-header flex items-center justify-between border-b border-line bg-surface px-4 py-3">
          <span className="text-sm text-muted">
            مرحبًا، <strong className="text-ink">{admin.name}</strong>
          </span>
          <form action={logoutAction}>
            <SubmitButton variant="secondary" pendingText="…">
              تسجيل الخروج
            </SubmitButton>
          </form>
        </header>
        <main className="mx-auto max-w-6xl p-4 lg:p-8">{children}</main>
      </div>
      <Suspense>
        <Toast />
      </Suspense>
    </div>
  );
}

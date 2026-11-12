"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export const NAV: { href: string; label: string; ready: boolean }[] = [
  { href: "/dashboard", label: "لوحة التحكم", ready: true },
  { href: "/activities", label: "الأنشطة", ready: true },
  { href: "/participants", label: "المشاركون", ready: true },
  { href: "/invitations", label: "الدعوات", ready: false },
  { href: "/attendance", label: "الحضور", ready: false },
  { href: "/analytics", label: "التحليلات والتقارير", ready: false },
  { href: "/recognition", label: "التكريم والجوائز", ready: false },
  { href: "/admins", label: "إدارة المشرفين", ready: true },
  { href: "/settings", label: "الإعدادات", ready: false },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav aria-label="القائمة الرئيسية" className="flex gap-1 overflow-x-auto lg:flex-col">
      {NAV.map((n) =>
        n.ready ? (
          <Link
            key={n.href}
            href={n.href}
            aria-current={path.startsWith(n.href) ? "page" : undefined}
            className={cn(
              "whitespace-nowrap rounded-lg px-3 py-2 text-sm hover:bg-brand-soft",
              path.startsWith(n.href) && "bg-brand-soft font-semibold text-brand-dark",
            )}
          >
            {n.label}
          </Link>
        ) : (
          <span
            key={n.href}
            aria-disabled="true"
            title="غير متاح بعد"
            className="flex cursor-not-allowed items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm text-muted/70"
          >
            {n.label}
            <span className="rounded bg-line/70 px-1.5 text-[10px]">قريبًا</span>
          </span>
        ),
      )}
    </nav>
  );
}

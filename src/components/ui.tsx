import Link from "next/link";
import { cn } from "@/lib/utils";

export function Button({
  variant = "primary",
  className,
  ...p
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost" }) {
  const v = {
    primary: "bg-brand text-white hover:bg-brand-dark",
    secondary: "bg-surface text-ink border border-line hover:bg-brand-soft",
    danger: "bg-danger text-white hover:opacity-90",
    ghost: "text-brand hover:bg-brand-soft",
  }[variant];
  return (
    <button
      {...p}
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        v,
        className,
      )}
    />
  );
}

export function LinkButton({
  href,
  variant = "primary",
  className,
  children,
}: {
  href: string;
  variant?: "primary" | "secondary";
  className?: string;
  children: React.ReactNode;
}) {
  const v =
    variant === "primary"
      ? "bg-brand text-white hover:bg-brand-dark"
      : "bg-surface text-ink border border-line hover:bg-brand-soft";
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition",
        v,
        className,
      )}
    >
      {children}
    </Link>
  );
}

const field = "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm placeholder:text-muted/70";
export const Input = (p: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input {...p} className={cn(field, p.className)} />
);
export const Textarea = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea rows={4} {...p} className={cn(field, p.className)} />
);
export const Select = (p: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...p} className={cn(field, p.className)} />
);

export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

export const Card = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    {...p}
    className={cn("rounded-xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(0,0,0,.04)]", className)}
  />
);

export function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <Card>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </Card>
  );
}

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "good" | "warn" | "bad";
  children: React.ReactNode;
}) {
  const t = {
    neutral: "bg-line/60 text-ink",
    good: "bg-brand-soft text-brand-dark",
    warn: "bg-warn-soft text-warn",
    bad: "bg-danger-soft text-danger",
  }[tone];
  return <span className={cn("inline-block rounded-full px-2.5 py-0.5 text-xs font-medium", t)}>{children}</span>;
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-surface px-6 py-12 text-center">
      <p className="font-medium">{title}</p>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export const TableWrap = ({ children }: { children: React.ReactNode }) => (
  <div className="overflow-x-auto rounded-xl border border-line bg-surface">
    <table className="w-full min-w-[640px] text-sm">{children}</table>
  </div>
);
export const Th = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
  <th
    scope="col"
    className={cn("border-b border-line bg-bg/60 px-4 py-3 text-start font-medium text-muted", className)}
  >
    {children}
  </th>
);
export const Td = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
  <td className={cn("border-b border-line/70 px-4 py-3 align-middle", className)}>{children}</td>
);

export function Pagination({
  page,
  pages,
  total,
  base,
}: {
  page: number;
  pages: number;
  total: number;
  base: URLSearchParams;
}) {
  const href = (n: number) => {
    const q = new URLSearchParams(base);
    q.set("page", String(n));
    return `?${q}`;
  };
  return (
    <nav aria-label="التنقل بين الصفحات" className="mt-4 flex items-center justify-between text-sm">
      <span className="text-muted">الإجمالي: {total}</span>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link className="rounded-lg border border-line px-3 py-1.5 hover:bg-brand-soft" href={href(page - 1)}>
            السابق
          </Link>
        ) : (
          <span className="px-3 py-1.5 text-muted/50">السابق</span>
        )}
        <span>
          صفحة {page} من {pages}
        </span>
        {page < pages ? (
          <Link className="rounded-lg border border-line px-3 py-1.5 hover:bg-brand-soft" href={href(page + 1)}>
            التالي
          </Link>
        ) : (
          <span className="px-3 py-1.5 text-muted/50">التالي</span>
        )}
      </div>
    </nav>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
      {message}
    </p>
  );
}

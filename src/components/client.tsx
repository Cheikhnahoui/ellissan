"use client";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "./ui";

export function SubmitButton({
  children,
  variant,
  pendingText = "جارٍ الحفظ…",
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  pendingText?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending} aria-busy={pending}>
      {pending ? pendingText : children}
    </Button>
  );
}

/** Accessible confirmation dialog (native <dialog>) wrapping a server action form. */
export function ConfirmForm({
  action,
  title,
  message,
  confirmLabel,
  trigger,
  children,
  variant = "danger",
}: {
  action: (fd: FormData) => void | Promise<void>;
  title: string;
  message: string;
  confirmLabel: string;
  trigger: string;
  children?: React.ReactNode;
  variant?: "danger" | "primary";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <Button type="button" variant="secondary" onClick={() => ref.current?.showModal()}>
        {trigger}
      </Button>
      <dialog
        ref={ref}
        className="m-auto w-[min(92vw,26rem)] rounded-xl border border-line p-0 backdrop:bg-black/40"
        aria-labelledby="dlg-title"
      >
        <form action={action} className="space-y-4 p-5">
          <h2 id="dlg-title" className="text-lg font-semibold">
            {title}
          </h2>
          <p className="text-sm text-muted">{message}</p>
          {children}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => ref.current?.close()}>
              إلغاء
            </Button>
            <SubmitButton variant={variant} pendingText="جارٍ التنفيذ…">
              {confirmLabel}
            </SubmitButton>
          </div>
        </form>
      </dialog>
    </>
  );
}

/** Toast driven by ?ok= / ?err= (set by server actions after redirect). The params are stripped from the URL once shown. */
export function Toast() {
  const sp = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const key = sp.get("ok") ?? sp.get("err");
  const [prevKey, setPrevKey] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; bad: boolean } | null>(null);
  if (key !== prevKey) {
    setPrevKey(key);
    if (key) setMsg({ text: key, bad: sp.has("err") });
  }
  useEffect(() => {
    if (!key) return;
    const q = new URLSearchParams(sp);
    q.delete("ok");
    q.delete("err");
    router.replace(q.size ? `${path}?${q}` : path, { scroll: false });
    const t = setTimeout(() => setMsg(null), 6000);
    return () => clearTimeout(t);
  }, [key, sp, router, path]);
  if (!msg) return null;
  return (
    <div
      role={msg.bad ? "alert" : "status"}
      className={`fixed bottom-4 start-4 z-50 max-w-sm rounded-lg px-4 py-3 text-sm shadow-lg ${msg.bad ? "bg-danger text-white" : "bg-brand text-white"}`}
    >
      {msg.text}
      <button className="ms-3 underline" onClick={() => setMsg(null)}>
        إغلاق
      </button>
    </div>
  );
}

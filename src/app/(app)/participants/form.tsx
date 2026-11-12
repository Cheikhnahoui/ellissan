"use client";
import { useActionState } from "react";
import { Field, FormError, Input } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import type { FormState } from "./actions";

export function ParticipantForm({
  action,
  defaults,
  submitLabel,
}: {
  action: (s: FormState, fd: FormData) => Promise<FormState>;
  defaults?: { fullName?: string; phone?: string | null; email?: string | null };
  submitLabel: string;
}) {
  const [state, act] = useActionState(action, undefined);
  const v = state?.values ?? {
    fullName: defaults?.fullName ?? "",
    phone: defaults?.phone ?? "",
    email: defaults?.email ?? "",
  };
  return (
    <form action={act} className="space-y-4" key={JSON.stringify(v)}>
      <FormError message={state?.error} />
      <Field label="الاسم الكامل *" htmlFor="fullName">
        <Input id="fullName" name="fullName" defaultValue={v.fullName} required minLength={3} maxLength={150} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="رقم الهاتف (واتساب)" htmlFor="phone" hint="مع رمز الدولة، مثال: +22230000000">
          <Input id="phone" name="phone" defaultValue={v.phone} dir="ltr" className="text-start" inputMode="tel" />
        </Field>
        <Field label="البريد الإلكتروني" htmlFor="email">
          <Input id="email" name="email" type="email" defaultValue={v.email} dir="ltr" className="text-start" />
        </Field>
      </div>
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}

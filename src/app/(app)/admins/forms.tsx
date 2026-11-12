"use client";
import { useActionState } from "react";
import { Field, FormError, Input } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { changePasswordAction, createAdminAction } from "./actions";

export function CreateAdminForm() {
  const [s, act] = useActionState(createAdminAction, undefined);
  return (
    <form action={act} className="space-y-3" key={JSON.stringify(s?.values)}>
      <FormError message={s?.error} />
      <Field label="الاسم" htmlFor="name">
        <Input id="name" name="name" defaultValue={s?.values?.name} required />
      </Field>
      <Field label="البريد الإلكتروني" htmlFor="aemail">
        <Input
          id="aemail"
          name="email"
          type="email"
          defaultValue={s?.values?.email}
          required
          dir="ltr"
          className="text-start"
          autoComplete="off"
        />
      </Field>
      <Field label="كلمة مرور مؤقتة" htmlFor="apw" hint="10 أحرف على الأقل، حروف وأرقام. شاركها مع المشرف بقناة آمنة.">
        <Input
          id="apw"
          name="password"
          type="password"
          required
          minLength={10}
          dir="ltr"
          className="text-start"
          autoComplete="new-password"
        />
      </Field>
      <SubmitButton>إنشاء مشرف</SubmitButton>
    </form>
  );
}

export function ChangePasswordForm() {
  const [s, act] = useActionState(changePasswordAction, undefined);
  return (
    <form action={act} className="space-y-3">
      <FormError message={s?.error} />
      <Field label="كلمة المرور الحالية" htmlFor="cur">
        <Input
          id="cur"
          name="current"
          type="password"
          required
          dir="ltr"
          className="text-start"
          autoComplete="current-password"
        />
      </Field>
      <Field label="كلمة المرور الجديدة" htmlFor="new">
        <Input
          id="new"
          name="next"
          type="password"
          required
          minLength={10}
          dir="ltr"
          className="text-start"
          autoComplete="new-password"
        />
      </Field>
      <SubmitButton>تغيير كلمة المرور</SubmitButton>
    </form>
  );
}

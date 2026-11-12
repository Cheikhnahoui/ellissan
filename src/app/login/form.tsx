"use client";
import { useActionState } from "react";
import { loginAction } from "./actions";
import { Field, FormError, Input } from "@/components/ui";
import { SubmitButton } from "@/components/client";

export function LoginForm() {
  const [state, action] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <FormError message={state?.error} />
      <Field label="البريد الإلكتروني" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="username" required dir="ltr" className="text-start" />
      </Field>
      <Field label="كلمة المرور" htmlFor="password">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          dir="ltr"
          className="text-start"
        />
      </Field>
      <SubmitButton pendingText="جارٍ الدخول…">دخول</SubmitButton>
    </form>
  );
}

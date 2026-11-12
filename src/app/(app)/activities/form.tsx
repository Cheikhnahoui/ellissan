"use client";
import { useActionState } from "react";
import { Field, FormError, Input, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import type { ActivityFormState } from "./actions";

export type ActivityDefaults = Partial<
  Record<
    | "title"
    | "description"
    | "location"
    | "startsAt"
    | "endsAt"
    | "capacity"
    | "attendanceOpensAt"
    | "attendanceClosesAt",
    string
  >
>;

export function ActivityForm({
  action,
  defaults = {},
  submitLabel,
}: {
  action: (s: ActivityFormState, fd: FormData) => Promise<ActivityFormState>;
  defaults?: ActivityDefaults;
  submitLabel: string;
}) {
  const [state, act] = useActionState(action, undefined);
  const v = { ...defaults, ...(state?.values ?? {}) };
  return (
    <form action={act} className="space-y-4" key={JSON.stringify(state?.values ?? defaults)}>
      <FormError message={state?.error} />
      <Field label="عنوان النشاط *" htmlFor="title">
        <Input id="title" name="title" defaultValue={v.title} required maxLength={200} />
      </Field>
      <Field label="الوصف" htmlFor="description">
        <Textarea id="description" name="description" defaultValue={v.description} maxLength={5000} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="المكان *" htmlFor="location">
          <Input id="location" name="location" defaultValue={v.location} required />
        </Field>
        <Field label="السعة (اختياري)" htmlFor="capacity">
          <Input
            id="capacity"
            name="capacity"
            type="number"
            min={1}
            defaultValue={v.capacity}
            dir="ltr"
            className="text-start"
          />
        </Field>
        <Field label="بداية النشاط *" htmlFor="startsAt">
          <Input
            id="startsAt"
            name="startsAt"
            type="datetime-local"
            defaultValue={v.startsAt}
            required
            dir="ltr"
            className="text-start"
          />
        </Field>
        <Field label="نهاية النشاط *" htmlFor="endsAt">
          <Input
            id="endsAt"
            name="endsAt"
            type="datetime-local"
            defaultValue={v.endsAt}
            required
            dir="ltr"
            className="text-start"
          />
        </Field>
        <Field label="فتح تسجيل الحضور *" htmlFor="attendanceOpensAt">
          <Input
            id="attendanceOpensAt"
            name="attendanceOpensAt"
            type="datetime-local"
            defaultValue={v.attendanceOpensAt}
            required
            dir="ltr"
            className="text-start"
          />
        </Field>
        <Field
          label="إغلاق تسجيل الحضور *"
          htmlFor="attendanceClosesAt"
          hint="بعد هذا الموعد يرفض الخادم أي حضور جديد تلقائيًا"
        >
          <Input
            id="attendanceClosesAt"
            name="attendanceClosesAt"
            type="datetime-local"
            defaultValue={v.attendanceClosesAt}
            required
            dir="ltr"
            className="text-start"
          />
        </Field>
      </div>
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}

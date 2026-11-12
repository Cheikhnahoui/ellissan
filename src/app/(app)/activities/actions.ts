"use server";
import { requireAdmin } from "@/lib/auth/session";
import { flashErr, flashOk } from "@/lib/flash";
import {
  ActivityError,
  closeActivity,
  createActivity,
  extendDeadline,
  reopenActivity,
  updateActivity,
} from "@/lib/services/activities";
import { zonedInputToUtc } from "@/lib/time";

export type ActivityFormState = { error?: string; values?: Record<string, string> } | undefined;
const FIELDS = [
  "title",
  "description",
  "location",
  "startsAt",
  "endsAt",
  "capacity",
  "attendanceOpensAt",
  "attendanceClosesAt",
] as const;

function read(fd: FormData) {
  const values = Object.fromEntries(FIELDS.map((f) => [f, String(fd.get(f) ?? "")]));
  const dates = Object.fromEntries(
    (["startsAt", "endsAt", "attendanceOpensAt", "attendanceClosesAt"] as const).map((f) => [
      f,
      zonedInputToUtc(values[f]),
    ]),
  );
  return { values, input: { ...values, ...dates } };
}
const explain = (e: unknown) => {
  if (e instanceof ActivityError) return e.message;
  throw e;
};

export async function createActivityAction(_: ActivityFormState, fd: FormData): Promise<ActivityFormState> {
  const admin = await requireAdmin();
  const { values, input } = read(fd);
  let id: string;
  try {
    id = (await createActivity(admin.id, input)).id;
  } catch (e) {
    return { error: explain(e), values };
  }
  flashOk(`/activities/${id}`, "تم إنشاء النشاط");
}

export async function updateActivityAction(id: string, _: ActivityFormState, fd: FormData): Promise<ActivityFormState> {
  const admin = await requireAdmin();
  const { values, input } = read(fd);
  try {
    await updateActivity(admin.id, id, input);
  } catch (e) {
    return { error: explain(e), values };
  }
  flashOk(`/activities/${id}`, "تم حفظ التعديلات");
}

export async function closeAction(id: string) {
  const admin = await requireAdmin();
  try {
    await closeActivity(admin.id, id);
  } catch (e) {
    flashErr(`/activities/${id}`, explain(e));
  }
  flashOk(`/activities/${id}`, "تم إغلاق النشاط ولن يُقبل حضور جديد");
}

export async function reopenAction(id: string, fd: FormData) {
  const admin = await requireAdmin();
  const d = zonedInputToUtc(String(fd.get("closesAt") ?? ""));
  if (!d) flashErr(`/activities/${id}`, "حدد موعد إغلاق صالحًا");
  try {
    await reopenActivity(admin.id, id, d!);
  } catch (e) {
    flashErr(`/activities/${id}`, explain(e));
  }
  flashOk(`/activities/${id}`, "أُعيد فتح النشاط");
}

export async function extendAction(id: string, fd: FormData) {
  const admin = await requireAdmin();
  const d = zonedInputToUtc(String(fd.get("closesAt") ?? ""));
  if (!d) flashErr(`/activities/${id}`, "حدد موعدًا صالحًا");
  try {
    await extendDeadline(admin.id, id, d!);
  } catch (e) {
    flashErr(`/activities/${id}`, explain(e));
  }
  flashOk(`/activities/${id}`, "تم تمديد فترة تسجيل الحضور");
}

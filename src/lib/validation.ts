import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const participantSchema = z.object({
  fullName: z.string().trim().min(3, "الاسم الكامل مطلوب (3 أحرف على الأقل)").max(150),
  phone: optionalText(30),
  email: optionalText(150),
});

const date = z.coerce.date({ error: "تاريخ غير صالح" });

export const activitySchema = z
  .object({
    title: z.string().trim().min(3, "العنوان مطلوب").max(200),
    description: optionalText(5000),
    location: z.string().trim().min(2, "المكان مطلوب").max(200),
    startsAt: date,
    endsAt: date,
    capacity: z.preprocess(
      (v) => (v === "" || v == null ? undefined : v),
      z.coerce.number().int().positive().max(100000).optional(),
    ),
    attendanceOpensAt: date,
    attendanceClosesAt: date,
  })
  .superRefine((v, ctx) => {
    if (v.endsAt <= v.startsAt)
      ctx.addIssue({ code: "custom", path: ["endsAt"], message: "وقت النهاية يجب أن يكون بعد البداية" });
    if (v.attendanceClosesAt <= v.attendanceOpensAt)
      ctx.addIssue({ code: "custom", path: ["attendanceClosesAt"], message: "إغلاق التسجيل يجب أن يكون بعد فتحه" });
  });

export const adminSchema = z.object({
  name: z.string().trim().min(2, "الاسم مطلوب").max(100),
  email: z.string().trim().email("بريد إلكتروني غير صالح"),
  password: z.string().min(10, "10 أحرف على الأقل"),
});

export const recognitionSchema = z.object({
  participantId: z.string().min(1),
  type: z.string().trim().min(2, "نوع التكريم مطلوب").max(100),
  awardedOn: date,
  reason: z.string().trim().min(3, "سبب التكريم مطلوب").max(2000),
  notes: optionalText(2000),
});

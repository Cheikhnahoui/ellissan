import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { activityStats } from "@/lib/services/activities";
import {
  Badge,
  Card,
  EmptyState,
  Field,
  Input,
  LinkButton,
  PageHeader,
  Stat,
  TableWrap,
  Td,
  Th,
} from "@/components/ui";
import { ConfirmForm } from "@/components/client";
import { fmtDateTime, fmtNumber, suggestedDeadline } from "@/lib/time";
import { closeAction, extendAction, reopenAction } from "../actions";
import { REG_LABEL } from "../page";

const INV_LABEL = {
  DRAFT: ["مسودة", "neutral"],
  PREPARED: ["جُهّزت للإرسال", "warn"],
  SENT_CONFIRMED: ["أُكّد إرسالها يدويًا", "good"],
  ATTENDED: ["سُجّل الحضور", "good"],
  CANCELLED: ["ملغاة", "bad"],
} as const;

export default async function ActivityPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!(await prisma.activity.findUnique({ where: { id }, select: { id: true } }))) notFound();
  const s = await activityStats(id);
  const a = s.activity;
  const invitations = await prisma.invitation.findMany({
    where: { activityId: id },
    orderBy: { participant: { nameNormalized: "asc" } },
    take: 500,
    select: {
      id: true,
      status: true,
      channel: true,
      attendance: { select: { status: true, recordedAt: true, method: true } },
      participant: { select: { id: true, fullName: true } },
    },
  });
  const nextDeadline = suggestedDeadline(a.attendanceClosesAt);
  const reg = REG_LABEL[s.registration];
  return (
    <>
      <PageHeader
        title={a.title}
        description={a.description ?? undefined}
        actions={
          <>
            <LinkButton href={`/activities/${id}/edit`} variant="secondary">
              تعديل
            </LinkButton>
            {s.registration === "CLOSED" ? (
              <ConfirmForm
                action={reopenAction.bind(null, id)}
                variant="primary"
                trigger="إعادة فتح"
                title="إعادة فتح النشاط"
                message="حدد موعد إغلاق جديدًا لتسجيل الحضور."
                confirmLabel="إعادة الفتح"
              >
                <Field label="موعد الإغلاق الجديد" htmlFor="closesAt">
                  <Input
                    id="closesAt"
                    name="closesAt"
                    type="datetime-local"
                    defaultValue={nextDeadline}
                    required
                    dir="ltr"
                    className="text-start"
                  />
                </Field>
              </ConfirmForm>
            ) : (
              <>
                <ConfirmForm
                  action={extendAction.bind(null, id)}
                  variant="primary"
                  trigger="تمديد التسجيل"
                  title="تمديد فترة تسجيل الحضور"
                  message="يجب أن يكون الموعد الجديد بعد الحالي وفي المستقبل."
                  confirmLabel="تمديد"
                >
                  <Field label="موعد الإغلاق الجديد" htmlFor="closesAt">
                    <Input
                      id="closesAt"
                      name="closesAt"
                      type="datetime-local"
                      defaultValue={nextDeadline}
                      required
                      dir="ltr"
                      className="text-start"
                    />
                  </Field>
                </ConfirmForm>
                <ConfirmForm
                  action={closeAction.bind(null, id)}
                  trigger="إغلاق النشاط"
                  title="إغلاق النشاط؟"
                  message="سيرفض الخادم أي تسجيل حضور جديد فورًا، ويمكنك إعادة الفتح لاحقًا. السجلات الحالية تبقى كما هي."
                  confirmLabel="إغلاق"
                />
              </>
            )}
          </>
        }
      />
      <Card className="mb-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
        <span>
          <b>الموعد:</b> {fmtDateTime(a.startsAt)} ← {fmtDateTime(a.endsAt)}
        </span>
        <span>
          <b>المكان:</b> {a.location}
        </span>
        {a.capacity && (
          <span>
            <b>السعة:</b> {fmtNumber(a.capacity)}
          </span>
        )}
        <span>
          <b>تسجيل الحضور:</b> {fmtDateTime(a.attendanceOpensAt)} ← {fmtDateTime(a.attendanceClosesAt)}{" "}
          <Badge tone={reg[1]}>{reg[0]}</Badge>
        </span>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="المدعوون"
          value={fmtNumber(s.invited)}
          sub={s.cancelled ? `${s.cancelled} دعوة ملغاة غير محتسبة` : undefined}
        />
        <Stat label="الحضور" value={fmtNumber(s.attended)} />
        <Stat
          label="لم يحضروا"
          value={s.absent == null ? "—" : fmtNumber(s.absent)}
          sub={s.absent == null ? "لا يُحسم الغياب قبل انتهاء التسجيل" : undefined}
        />
        <Stat label="بانتظار الحسم" value={fmtNumber(s.pending)} />
      </div>
      <h2 className="mb-3 mt-8 font-semibold">قائمة الدعوات</h2>
      {invitations.length === 0 ? (
        <EmptyState
          title="لا توجد دعوات لهذا النشاط بعد"
          hint="إدارة الدعوات (اختيار المدعوين، رموز QR، واتساب والبريد) ستتوفر في المرحلة التالية."
        />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <Th>المشارك</Th>
              <Th>حالة الدعوة</Th>
              <Th>الحضور</Th>
            </tr>
          </thead>
          <tbody>
            {invitations.map((i) => (
              <tr key={i.id}>
                <Td>
                  <Link className="text-brand hover:underline" href={`/participants/${i.participant.id}`}>
                    {i.participant.fullName}
                  </Link>
                </Td>
                <Td>
                  <Badge tone={INV_LABEL[i.status][1]}>{INV_LABEL[i.status][0]}</Badge>
                </Td>
                <Td>{i.attendance?.status === "VALID" ? fmtDateTime(i.attendance.recordedAt) : "—"}</Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </>
  );
}

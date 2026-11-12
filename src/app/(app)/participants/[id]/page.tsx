import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { participantProfile, type HistoryStatus } from "@/lib/services/profile";
import { Badge, Card, EmptyState, PageHeader, Stat, TableWrap, Td, Th } from "@/components/ui";
import { ConfirmForm } from "@/components/client";
import { fmtDate, fmtDateTime, fmtNumber, fmtPercent } from "@/lib/time";
import { ParticipantForm } from "../form";
import { archiveAction, updateParticipantAction } from "../actions";

const LABEL: Record<HistoryStatus, [string, "good" | "bad" | "warn" | "neutral"]> = {
  ATTENDED: ["دُعي وحضر", "good"],
  ABSENT: ["دُعي ولم يحضر", "bad"],
  PENDING: ["بانتظار انتهاء التسجيل", "warn"],
  CANCELLED: ["دعوة ملغاة", "neutral"],
};

export default async function ParticipantPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const data = await participantProfile(id);
  if (!data) notFound();
  const { participant: p, history, stats } = data;
  const archived = p.status === "ARCHIVED";
  return (
    <>
      <PageHeader
        title={p.fullName}
        description={archived ? "مشارك مؤرشف — السجلات التاريخية محفوظة" : undefined}
        actions={
          archived ? (
            <ConfirmForm
              action={archiveAction.bind(null, p.id, false)}
              variant="primary"
              trigger="إعادة التفعيل"
              title="إعادة تفعيل المشارك؟"
              message="سيظهر مجددًا في القوائم ويمكن دعوته."
              confirmLabel="إعادة التفعيل"
            />
          ) : (
            <ConfirmForm
              action={archiveAction.bind(null, p.id, true)}
              trigger="أرشفة"
              title="أرشفة المشارك؟"
              message="لن يظهر في قوائم الدعوة الجديدة. تبقى جميع سجلات الدعوات والحضور والتكريم كما هي."
              confirmLabel="أرشفة"
            />
          )
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="إجمالي الدعوات" value={fmtNumber(stats?.invitations ?? 0)} sub="دون الملغاة" />
        <Stat label="مرات الحضور" value={fmtNumber(stats?.attended ?? 0)} />
        <Stat
          label="دعوات بلا حضور"
          value={fmtNumber(stats?.absent ?? 0)}
          sub={stats?.pending ? `و${stats.pending} لم تُحسم بعد` : "بعد انتهاء فترة التسجيل فقط"}
        />
        <Stat label="نسبة الحضور" value={fmtPercent(stats?.rate ?? null)} sub="حضور ÷ دعوات منتهية" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <h2 className="mb-3 font-semibold">البيانات الشخصية</h2>
          <ParticipantForm action={updateParticipantAction.bind(null, p.id)} defaults={p} submitLabel="حفظ التعديلات" />
          <p className="mt-3 text-xs text-muted">
            أُضيف: {fmtDate(p.createdAt)} · آخر تعديل: {fmtDate(p.updatedAt)}
          </p>
        </Card>
        <div className="space-y-6 lg:col-span-2">
          <section>
            <h2 className="mb-3 font-semibold">سجل الدعوات والحضور</h2>
            {history.length === 0 ? (
              <EmptyState title="لم تُسجَّل أي دعوة لهذا المشارك" hint="لا يُحتسب غياب لأنشطة لم يُدعَ إليها." />
            ) : (
              <TableWrap>
                <thead>
                  <tr>
                    <Th>النشاط</Th>
                    <Th>تاريخ الدعوة</Th>
                    <Th>الحالة</Th>
                    <Th>وقت الحضور</Th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.invitationId}>
                      <Td>
                        <Link href={`/activities/${h.activityId}`} className="text-brand hover:underline">
                          {h.title}
                        </Link>
                        <div className="text-xs text-muted">{fmtDateTime(h.startsAt)}</div>
                      </Td>
                      <Td>{fmtDate(h.invitedAt)}</Td>
                      <Td>
                        <Badge tone={LABEL[h.status][1]}>{LABEL[h.status][0]}</Badge>
                      </Td>
                      <Td>{fmtDateTime(h.attendedAt)}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            )}
          </section>
          <section>
            <h2 className="mb-3 font-semibold">التكريم والجوائز</h2>
            {p.recognitions.length === 0 ? (
              <EmptyState title="لا توجد تكريمات مسجلة" />
            ) : (
              <ul className="space-y-2">
                {p.recognitions.map((r) => (
                  <Card key={r.id}>
                    <div className="flex justify-between">
                      <strong>{r.type}</strong>
                      <span className="text-sm text-muted">{fmtDate(r.awardedOn)}</span>
                    </div>
                    <p className="mt-1 text-sm">{r.reason}</p>
                  </Card>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

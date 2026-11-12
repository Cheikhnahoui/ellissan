import Link from "next/link";
import { dashboardData } from "@/lib/services/dashboard";
import { Badge, Card, EmptyState, PageHeader, Stat } from "@/components/ui";
import { fmtDateTime, fmtNumber, fmtPercent } from "@/lib/time";

export const metadata = { title: "لوحة التحكم" };

export default async function Dashboard() {
  const d = await dashboardData();
  return (
    <>
      <PageHeader title="لوحة التحكم" description="ملخص حي محسوب من سجلات قاعدة البيانات" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="المشاركون النشطون" value={fmtNumber(d.participants)} />
        <Stat label="إجمالي الأنشطة" value={fmtNumber(d.activities)} />
        <Stat label="أنشطة قادمة" value={fmtNumber(d.upcoming)} />
        <Stat label="أنشطة منتهية أو مغلقة" value={fmtNumber(d.completed)} />
        <Stat
          label="الدعوات المسجلة"
          value={fmtNumber(d.invitations)}
          sub={`${fmtNumber(d.pendingInvitations)} بانتظار انتهاء فترة التسجيل`}
        />
        <Stat label="سجلات الحضور" value={fmtNumber(d.attended)} />
        <Stat
          label="نسبة الحضور العامة"
          value={fmtPercent(d.overallRate)}
          sub={d.finalized ? `من ${fmtNumber(d.finalized)} دعوة منتهية` : "لا توجد دعوات منتهية بعد"}
        />
        <Stat
          label="التكريمات المسجلة"
          value={fmtNumber(d.recognitions)}
          sub={`${fmtNumber(d.recognizedPeople)} مشاركًا مكرَّمًا`}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">آخر الأنشطة</h2>
          {d.recentActivities.length === 0 ? (
            <EmptyState title="لا توجد أنشطة بعد" hint="ابدأ بإنشاء أول نشاط." />
          ) : (
            <ul className="divide-y divide-line">
              {d.recentActivities.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 py-2">
                  <Link href={`/activities/${a.id}`} className="font-medium text-brand hover:underline">
                    {a.title}
                  </Link>
                  <span className="text-xs text-muted">{fmtDateTime(a.startsAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">آخر تسجيلات الحضور</h2>
          {d.recentAttendance.length === 0 ? (
            <EmptyState title="لا يوجد حضور مسجل" />
          ) : (
            <ul className="divide-y divide-line">
              {d.recentAttendance.map((r) => (
                <li key={r.id} className="py-2 text-sm">
                  <Link href={`/participants/${r.participant.id}`} className="font-medium hover:underline">
                    {r.participant.fullName}
                  </Link>
                  <span className="text-muted"> — {r.activity.title}</span>
                  <div className="text-xs text-muted">
                    {fmtDateTime(r.recordedAt)} · {r.method === "QR_SCAN" ? "مسح QR" : "يدوي"}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="lg:col-span-2">
          <h2 className="mb-1 font-semibold">المشاركون الأكثر انتظامًا</h2>
          <p className="mb-3 text-xs text-muted">
            الترتيب بنسبة الحضور (3 دعوات منتهية على الأقل)، ثم عدد مرات الحضور. لا درجة مركّبة مخفية.
          </p>
          {d.topEngaged.length === 0 ? (
            <EmptyState title="لا توجد بيانات كافية بعد" hint="تظهر الأسماء بعد انتهاء 3 دعوات على الأقل لكل مشارك." />
          ) : (
            <ol className="divide-y divide-line">
              {d.topEngaged.map((p, i) => (
                <li key={p.participantId} className="flex items-center justify-between py-2 text-sm">
                  <span>
                    <span className="me-2 text-muted">{fmtNumber(i + 1)}.</span>
                    <Link href={`/participants/${p.participantId}`} className="hover:underline">
                      {p.fullName}
                    </Link>
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge tone="good">{fmtPercent(p.rate)}</Badge>
                    <span className="text-xs text-muted">
                      {p.attended}/{p.finalized}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </>
  );
}

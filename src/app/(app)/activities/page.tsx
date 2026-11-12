import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { listActivities } from "@/lib/services/activities";
import {
  Badge,
  Button,
  EmptyState,
  Input,
  LinkButton,
  PageHeader,
  Pagination,
  Select,
  TableWrap,
  Td,
  Th,
} from "@/components/ui";
import { fmtDateTime, fmtNumber } from "@/lib/time";

export const metadata = { title: "الأنشطة" };
export const REG_LABEL = {
  OPEN: ["التسجيل مفتوح", "good"],
  CLOSED: ["مغلق", "neutral"],
  NOT_OPEN_YET: ["لم يبدأ التسجيل", "warn"],
  WINDOW_ENDED: ["انتهى التسجيل", "neutral"],
} as const;

export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; when?: string; page?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const when = sp.when === "past" || sp.when === "all" ? sp.when : "upcoming";
  const res = await listActivities({ q: sp.q, when, page: Number(sp.page) || 1 });
  const base = new URLSearchParams(
    Object.entries({ q: sp.q, when: sp.when }).filter(([, v]) => v) as [string, string][],
  );
  return (
    <>
      <PageHeader
        title="الأنشطة"
        description="الفعاليات واللقاءات التي ينظمها المجلس"
        actions={<LinkButton href="/activities/new">نشاط جديد</LinkButton>}
      />
      <form className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto_auto]" role="search">
        <Input name="q" defaultValue={sp.q} placeholder="بحث بالعنوان أو المكان" aria-label="بحث" />
        <Select name="when" defaultValue={when} aria-label="الفترة">
          <option value="upcoming">القادمة</option>
          <option value="past">السابقة</option>
          <option value="all">الكل</option>
        </Select>
        <Button type="submit" variant="secondary">
          تطبيق
        </Button>
      </form>
      {res.items.length === 0 ? (
        <EmptyState
          title="لا توجد أنشطة"
          hint="أنشئ نشاطًا جديدًا أو غيّر الفلتر."
          action={<LinkButton href="/activities/new">نشاط جديد</LinkButton>}
        />
      ) : (
        <>
          <TableWrap>
            <thead>
              <tr>
                <Th>النشاط</Th>
                <Th>الموعد</Th>
                <Th>المكان</Th>
                <Th>الدعوات</Th>
                <Th>الحضور</Th>
                <Th>الحالة</Th>
              </tr>
            </thead>
            <tbody>
              {res.items.map((a) => (
                <tr key={a.id}>
                  <Td>
                    <Link href={`/activities/${a.id}`} className="font-medium text-brand hover:underline">
                      {a.title}
                    </Link>
                  </Td>
                  <Td>{fmtDateTime(a.startsAt)}</Td>
                  <Td>{a.location}</Td>
                  <Td>{fmtNumber(a.invitationCount)}</Td>
                  <Td>{fmtNumber(a.attendedCount)}</Td>
                  <Td>
                    <Badge tone={REG_LABEL[a.registration][1]}>{REG_LABEL[a.registration][0]}</Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          <Pagination page={res.page} pages={res.pages} total={res.total} base={base} />
        </>
      )}
    </>
  );
}

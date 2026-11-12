import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { listParticipants } from "@/lib/services/participants";
import {
  Badge,
  EmptyState,
  Input,
  LinkButton,
  PageHeader,
  Pagination,
  Select,
  TableWrap,
  Td,
  Th,
  Button,
} from "@/components/ui";
import { fmtDate } from "@/lib/time";

export const metadata = { title: "المشاركون" };
type SP = Promise<{ q?: string; status?: string; sort?: string; dir?: string; page?: string }>;

export default async function ParticipantsPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const sp = await searchParams;
  const status = sp.status === "ARCHIVED" || sp.status === "ALL" ? sp.status : "ACTIVE";
  const res = await listParticipants({
    q: sp.q,
    status,
    sort: sp.sort === "createdAt" ? "createdAt" : "name",
    dir: sp.dir === "desc" ? "desc" : "asc",
    page: Number(sp.page) || 1,
  });
  const base = new URLSearchParams(
    Object.entries({ q: sp.q, status: sp.status, sort: sp.sort, dir: sp.dir }).filter(([, v]) => v) as [
      string,
      string,
    ][],
  );
  return (
    <>
      <PageHeader
        title="المشاركون"
        description="قاعدة بيانات المشاركين في أنشطة المجلس"
        actions={
          <>
            <LinkButton href="/participants/import" variant="secondary">
              استيراد CSV / XLSX
            </LinkButton>
            <LinkButton href="/participants/new">إضافة مشارك</LinkButton>
          </>
        }
      />
      <form className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]" role="search">
        <Input name="q" defaultValue={sp.q} placeholder="بحث بالاسم أو الهاتف أو البريد" aria-label="بحث" />
        <Select name="status" defaultValue={status} aria-label="الحالة">
          <option value="ACTIVE">النشطون</option>
          <option value="ARCHIVED">المؤرشفون</option>
          <option value="ALL">الكل</option>
        </Select>
        <Select name="sort" defaultValue={sp.sort ?? "name"} aria-label="الترتيب">
          <option value="name">حسب الاسم</option>
          <option value="createdAt">حسب تاريخ الإضافة</option>
        </Select>
        <Button type="submit" variant="secondary">
          تطبيق
        </Button>
      </form>
      {res.items.length === 0 ? (
        <EmptyState
          title={sp.q ? "لا نتائج مطابقة" : "لا يوجد مشاركون بعد"}
          hint={sp.q ? "جرّب كلمات بحث أخرى." : "أضف مشاركًا أو استورد ملفًا."}
          action={!sp.q && <LinkButton href="/participants/new">إضافة مشارك</LinkButton>}
        />
      ) : (
        <>
          <TableWrap>
            <thead>
              <tr>
                <Th>الاسم</Th>
                <Th>الهاتف</Th>
                <Th>البريد</Th>
                <Th>أُضيف</Th>
                <Th>الحالة</Th>
              </tr>
            </thead>
            <tbody>
              {res.items.map((p) => (
                <tr key={p.id}>
                  <Td>
                    <Link href={`/participants/${p.id}`} className="font-medium text-brand hover:underline">
                      {p.fullName}
                    </Link>
                  </Td>
                  <Td>
                    <bdi dir="ltr">{p.phone ?? "—"}</bdi>
                  </Td>
                  <Td>
                    <bdi dir="ltr">{p.email ?? "—"}</bdi>
                  </Td>
                  <Td>{fmtDate(p.createdAt)}</Td>
                  <Td>{p.status === "ACTIVE" ? <Badge tone="good">نشط</Badge> : <Badge>مؤرشف</Badge>}</Td>
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

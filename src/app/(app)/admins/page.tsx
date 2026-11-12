import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { Badge, Card, PageHeader, TableWrap, Td, Th } from "@/components/ui";
import { ConfirmForm } from "@/components/client";
import { fmtDate } from "@/lib/time";
import { toggleAdminAction } from "./actions";
import { ChangePasswordForm, CreateAdminForm } from "./forms";

export const metadata = { title: "إدارة المشرفين" };

export default async function AdminsPage() {
  const me = await requireAdmin();
  const admins = await prisma.admin.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, isActive: true, createdAt: true },
  });
  return (
    <>
      <PageHeader title="إدارة المشرفين" description="جميع المشرفين لهم الصلاحيات نفسها. لا يوجد تسجيل عام." />
      <TableWrap>
        <thead>
          <tr>
            <Th>الاسم</Th>
            <Th>البريد</Th>
            <Th>أُنشئ</Th>
            <Th>الحالة</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {admins.map((a) => (
            <tr key={a.id}>
              <Td>
                {a.name}
                {a.id === me.id && <span className="ms-2 text-xs text-muted">(أنت)</span>}
              </Td>
              <Td>
                <bdi dir="ltr">{a.email}</bdi>
              </Td>
              <Td>{fmtDate(a.createdAt)}</Td>
              <Td>{a.isActive ? <Badge tone="good">نشط</Badge> : <Badge>معطّل</Badge>}</Td>
              <Td>
                {a.id !== me.id &&
                  (a.isActive ? (
                    <ConfirmForm
                      action={toggleAdminAction.bind(null, a.id, false)}
                      trigger="تعطيل"
                      title="تعطيل المشرف؟"
                      message="سيُنهى دخوله فورًا ولا يستطيع تسجيل الدخول حتى يُعاد تفعيله."
                      confirmLabel="تعطيل"
                    />
                  ) : (
                    <ConfirmForm
                      action={toggleAdminAction.bind(null, a.id, true)}
                      variant="primary"
                      trigger="تفعيل"
                      title="تفعيل المشرف؟"
                      message="سيتمكن من تسجيل الدخول مجددًا."
                      confirmLabel="تفعيل"
                    />
                  ))}
              </Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">إضافة مشرف</h2>
          <CreateAdminForm />
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">تغيير كلمة مروري</h2>
          <ChangePasswordForm />
        </Card>
      </div>
    </>
  );
}

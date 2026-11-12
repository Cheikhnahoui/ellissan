import { requireAdmin } from "@/lib/auth/session";
import { Card, PageHeader } from "@/components/ui";
import { ActivityForm } from "../form";
import { createActivityAction } from "../actions";
import { defaultActivityWindow } from "@/lib/time";

export const metadata = { title: "نشاط جديد" };
export default async function NewActivity() {
  await requireAdmin();
  return (
    <>
      <PageHeader title="نشاط جديد" />
      <Card className="max-w-3xl">
        <ActivityForm action={createActivityAction} defaults={defaultActivityWindow()} submitLabel="إنشاء النشاط" />
      </Card>
    </>
  );
}

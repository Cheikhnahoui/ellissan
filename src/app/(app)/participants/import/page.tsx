import { requireAdmin } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui";
import { ImportClient } from "./client";

export const metadata = { title: "استيراد المشاركين" };
export default async function ImportPage() {
  await requireAdmin();
  return (
    <>
      <PageHeader title="استيراد المشاركين" description="معاينة وتحقق قبل الحفظ، دون إنشاء مكررات" />
      <ImportClient />
    </>
  );
}

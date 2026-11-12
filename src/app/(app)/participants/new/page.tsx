import { requireAdmin } from "@/lib/auth/session";
import { Card, PageHeader } from "@/components/ui";
import { ParticipantForm } from "../form";
import { createParticipantAction } from "../actions";

export const metadata = { title: "إضافة مشارك" };
export default async function NewParticipant() {
  await requireAdmin();
  return (
    <>
      <PageHeader title="إضافة مشارك" />
      <Card className="max-w-2xl">
        <ParticipantForm action={createParticipantAction} submitLabel="حفظ المشارك" />
      </Card>
    </>
  );
}

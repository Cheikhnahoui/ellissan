import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { Card, PageHeader } from "@/components/ui";
import { ActivityForm } from "../../form";
import { updateActivityAction } from "../../actions";
import { utcToZonedInput } from "@/lib/time";

export const metadata = { title: "تعديل النشاط" };
export default async function EditActivity({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const a = await prisma.activity.findUnique({ where: { id } });
  if (!a) notFound();
  const defaults = {
    title: a.title,
    description: a.description ?? "",
    location: a.location,
    capacity: a.capacity?.toString() ?? "",
    startsAt: utcToZonedInput(a.startsAt),
    endsAt: utcToZonedInput(a.endsAt),
    attendanceOpensAt: utcToZonedInput(a.attendanceOpensAt),
    attendanceClosesAt: utcToZonedInput(a.attendanceClosesAt),
  };
  return (
    <>
      <PageHeader title="تعديل النشاط" description={a.title} />
      <Card className="max-w-3xl">
        <ActivityForm action={updateActivityAction.bind(null, id)} defaults={defaults} submitLabel="حفظ التعديلات" />
      </Card>
    </>
  );
}

"use client";
import Link from "next/link";
import { useActionState } from "react";
import { Badge, Card, FormError, Input, TableWrap, Td, Th, Button } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { commitImportAction, errorReportAction, previewImportAction, type ImportState } from "../actions";

const TONE = {
  NEW: ["جديد", "good"],
  DUPLICATE: ["مكرر", "bad"],
  POSSIBLE_DUPLICATE: ["تكرار محتمل", "warn"],
  INVALID: ["غير صالح", "bad"],
} as const;

export function ImportClient() {
  const [prev, previewAction] = useActionState<ImportState, FormData>(previewImportAction, undefined);
  const [done, commitAction] = useActionState<ImportState, FormData>(commitImportAction, undefined);
  const rows = prev?.rows;
  const counts = rows?.reduce<Record<string, number>>((a, r) => ((a[r.status] = (a[r.status] ?? 0) + 1), a), {}) ?? {};

  async function download() {
    const csv = await errorReportAction(JSON.stringify(rows));
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "import-errors.csv" });
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <Card>
        <form action={previewAction} className="space-y-3">
          <p className="text-sm text-muted">
            الأعمدة المقبولة في الصف الأول: «الاسم» (مطلوب)، «الهاتف»، «البريد». الحد الأقصى 5 ميغابايت و5000 صف. لن
            يُنشأ أي سجل قبل تأكيدك.
          </p>
          <FormError message={prev?.error} />
          <Input type="file" name="file" accept=".csv,.xlsx" required aria-label="ملف الاستيراد" />
          <SubmitButton pendingText="جارٍ التحليل…">معاينة</SubmitButton>
        </form>
      </Card>
      {rows && !done?.done && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {Object.entries(TONE).map(([k, [l, t]]) => (
              <Badge key={k} tone={t}>
                {l}: {counts[k] ?? 0}
              </Badge>
            ))}
          </div>
          <div className="max-h-96 overflow-auto rounded-xl">
            <TableWrap>
              <thead>
                <tr>
                  <Th>السطر</Th>
                  <Th>الاسم</Th>
                  <Th>الهاتف</Th>
                  <Th>البريد</Th>
                  <Th>الحالة</Th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 500).map((r) => (
                  <tr key={r.line}>
                    <Td>{r.line}</Td>
                    <Td>{r.fullName}</Td>
                    <Td>
                      <bdi dir="ltr">{r.phone}</bdi>
                    </Td>
                    <Td>
                      <bdi dir="ltr">{r.email}</bdi>
                    </Td>
                    <Td>
                      <Badge tone={TONE[r.status][1]}>{TONE[r.status][0]}</Badge>
                      {r.reason && <span className="ms-2 text-xs text-muted">{r.reason}</span>}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          </div>
          {rows.length > 500 && <p className="text-xs text-muted">تُعرض أول 500 صف فقط؛ سيُعالج الملف كاملًا.</p>}
          <div className="flex flex-wrap gap-2">
            <form action={commitAction}>
              <input type="hidden" name="rows" value={JSON.stringify(rows)} />
              <SubmitButton pendingText="جارٍ الاستيراد…">{`استيراد ${counts.NEW ?? 0} سجل جديد`}</SubmitButton>
            </form>
            {rows.some((r) => r.status !== "NEW") && (
              <Button type="button" variant="secondary" onClick={download}>
                تنزيل تقرير الأخطاء (CSV)
              </Button>
            )}
          </div>
        </section>
      )}
      {done?.done && (
        <Card role="status">
          <p className="font-semibold text-brand-dark">اكتمل الاستيراد</p>
          <p className="mt-1 text-sm">
            أُنشئ {done.done.created} سجلًا · تخطّى {done.done.skipped} بسبب تكرار ظهر أثناء الحفظ · لم يُستورد{" "}
            {done.done.notImported} (غير صالح/مكرر).
          </p>
          <Link className="mt-2 inline-block text-sm text-brand underline" href="/participants">
            الانتقال إلى المشاركين
          </Link>
        </Card>
      )}
      <FormError message={done?.error} />
    </div>
  );
}

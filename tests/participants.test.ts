import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  commitImport,
  createParticipant,
  DuplicateError,
  importErrorReport,
  listParticipants,
  parseImportFile,
  previewImport,
  setParticipantArchived,
  updateParticipant,
} from "@/lib/services/participants";
import { resetDb, seedActivity, seedAdmin, seedInvitation } from "./helpers";

beforeEach(resetDb);

describe("participants", () => {
  it("creates, updates, and audits", async () => {
    const a = await seedAdmin();
    const p = await createParticipant(a.id, { fullName: "أحمد محمد", phone: "٠٠٢٢٢ ٣٠ ٠٠ ٠٠ ٠١", email: "A@x.org" });
    expect(p.phoneNormalized).toBe("+22230000001");
    const u = await updateParticipant(a.id, p.id, {
      fullName: "أحمد محمد الأمين",
      phone: "+22230000001",
      email: "a@x.org",
    });
    expect(u.fullName).toBe("أحمد محمد الأمين");
    expect(await prisma.auditEvent.count({ where: { targetType: "Participant" } })).toBe(2);
  });

  it("detects duplicates by normalised phone or email, on create and update", async () => {
    const a = await seedAdmin();
    await createParticipant(a.id, { fullName: "أحمد محمد", phone: "+222 30 00 00 01", email: "a@x.org" });
    await expect(createParticipant(a.id, { fullName: "شخص آخر", phone: "٠٠٢٢٢٣٠٠٠٠٠٠١" })).rejects.toBeInstanceOf(
      DuplicateError,
    );
    await expect(createParticipant(a.id, { fullName: "شخص آخر", email: "A@X.ORG" })).rejects.toBeInstanceOf(
      DuplicateError,
    );
    const b = await createParticipant(a.id, { fullName: "سالم", phone: "+22230000002" });
    await expect(updateParticipant(a.id, b.id, { fullName: "سالم", phone: "+22230000001" })).rejects.toBeInstanceOf(
      DuplicateError,
    );
    expect(await prisma.participant.count()).toBe(2);
  });

  it("rejects invalid input", async () => {
    const a = await seedAdmin();
    await expect(createParticipant(a.id, { fullName: "x" })).rejects.toThrow();
    await expect(createParticipant(a.id, { fullName: "اسم صحيح", phone: "abc" })).rejects.toThrow(
      "رقم الهاتف غير صالح",
    );
  });

  it("archiving keeps invitations and hides the participant from the default list", async () => {
    const a = await seedAdmin();
    const p = await createParticipant(a.id, { fullName: "أحمد محمد", phone: "+22230000001" });
    const act = await seedActivity();
    await seedInvitation(act.id, p.id, a.id);
    await setParticipantArchived(a.id, p.id, true);
    expect(await prisma.invitation.count({ where: { participantId: p.id } })).toBe(1);
    expect((await listParticipants()).total).toBe(0);
    expect((await listParticipants({ status: "ARCHIVED" })).total).toBe(1);
    await setParticipantArchived(a.id, p.id, false);
    expect((await listParticipants()).total).toBe(1);
  });

  it("searches Arabic names regardless of spelling variants, phones and emails; paginates", async () => {
    const a = await seedAdmin();
    for (let i = 0; i < 25; i++)
      await createParticipant(a.id, {
        fullName: `مشارك رقم ${i} أحمد`,
        phone: `+2223100${String(i).padStart(4, "0")}`,
        email: `u${i}@x.org`,
      });
    await createParticipant(a.id, { fullName: "فاطمة الزهراء", phone: "+22239999999" });
    expect((await listParticipants({ q: "فاطمه" })).total).toBe(1);
    expect((await listParticipants({ q: "9999999" })).total).toBe(1);
    expect((await listParticipants({ q: "u7@x" })).total).toBe(1);
    const page2 = await listParticipants({ page: 2, pageSize: 10 });
    expect(page2.items).toHaveLength(10);
    expect(page2.pages).toBe(3);
  });
});

describe("import", () => {
  const csv = (s: string) => Buffer.from("\uFEFF" + s, "utf8");

  it("previews valid, invalid, duplicate-in-db, duplicate-in-file and possible-duplicate rows; never creates duplicates", async () => {
    const a = await seedAdmin();
    await createParticipant(a.id, { fullName: "موجود مسبقًا", phone: "+22230000001" });
    await createParticipant(a.id, { fullName: "بلا بيانات اتصال" });
    const table = await parseImportFile(
      csv(
        [
          "الاسم,الهاتف,البريد",
          "جديد أول,+22230000010,n1@x.org",
          "مكرر في القاعدة,٠٠٢٢٢٣٠٠٠٠٠٠١,",
          "جديد أول مكرر بالملف,+22230000010,",
          "اسم,abc,",
          "بلا بيانات اتصال,,",
          "=cmd|calc,,",
        ].join("\n"),
      ),
      "p.csv",
    );
    const rows = await previewImport(table);
    expect(rows.map((r) => r.status)).toEqual([
      "NEW",
      "DUPLICATE",
      "DUPLICATE",
      "INVALID",
      "POSSIBLE_DUPLICATE",
      "NEW",
    ]);
    const res = await commitImport(a.id, rows);
    expect(res.created).toBe(2);
    expect(await prisma.participant.count()).toBe(4);
    // committing a stale preview again must not duplicate anything
    expect((await commitImport(a.id, rows)).created).toBe(0);
    expect(await prisma.participant.count()).toBe(4);
  });

  it("error report is a UTF-8 BOM CSV and neutralises formulas", async () => {
    const rows = await previewImport(await parseImportFile(csv("الاسم,الهاتف\n=HYPERLINK(1),abc"), "p.csv"));
    const report = importErrorReport(rows);
    expect(report.startsWith("\uFEFF")).toBe(true);
    expect(report).toContain(`"'=HYPERLINK(1)"`);
  });

  it("requires a name column and enforces file limits and type", async () => {
    await expect(previewImport([["x"], ["y"]])).rejects.toThrow("«الاسم»");
    await expect(parseImportFile(Buffer.alloc(6 * 1024 * 1024), "a.csv")).rejects.toThrow("5");
    await expect(parseImportFile(Buffer.from("x"), "a.exe")).rejects.toThrow("غير مدعومة");
    await expect(parseImportFile(Buffer.from("not a zip"), "a.xlsx")).rejects.toThrow("XLSX");
  });

  it("reads real XLSX files", async () => {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("s");
    ws.addRow(["الاسم", "الهاتف", "البريد"]);
    ws.addRow(["منى أحمد", "+22230000077", "mona@x.org"]);
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    const rows = await previewImport(await parseImportFile(buf, "p.xlsx"));
    expect(rows).toMatchObject([{ fullName: "منى أحمد", status: "NEW" }]);
  });
});

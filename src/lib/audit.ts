import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

/** Never put passwords, tokens or contact details in `metadata`. */
export async function audit(
  tx: Tx,
  adminId: string | null,
  action: string,
  targetType: string,
  targetId: string | null,
  metadata?: Prisma.InputJsonValue,
) {
  await tx.auditEvent.create({ data: { adminId, action, targetType, targetId, metadata } });
}

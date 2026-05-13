import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export async function getMemberVideoSermonsEnabled(): Promise<boolean> {
  const row = await prisma.appSettings.findUnique({ where: { id: 1 } });
  if (!row) {
    await prisma.appSettings.create({
      data: { id: 1, memberVideoSermonsEnabled: false },
    });
    return false;
  }
  return row.memberVideoSermonsEnabled;
}

/**
 * Persist member video access. Uses updateMany + create fallback instead of upsert
 * (more reliable on some MySQL + Prisma setups).
 */
export async function setMemberVideoSermonsEnabled(enabled: boolean): Promise<boolean> {
  const updated = await prisma.appSettings.updateMany({
    where: { id: 1 },
    data: { memberVideoSermonsEnabled: enabled },
  });
  if (updated.count === 0) {
    try {
      await prisma.appSettings.create({
        data: { id: 1, memberVideoSermonsEnabled: enabled },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        await prisma.appSettings.updateMany({
          where: { id: 1 },
          data: { memberVideoSermonsEnabled: enabled },
        });
      } else {
        throw e;
      }
    }
  }
  const row = await prisma.appSettings.findUnique({ where: { id: 1 } });
  return Boolean(row?.memberVideoSermonsEnabled);
}

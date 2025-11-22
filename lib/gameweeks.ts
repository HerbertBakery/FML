// lib/gameweeks.ts
import { prisma } from "./db";

export async function getOrCreateCurrentGameweek() {
  let gw = await prisma.gameweek.findFirst({
    where: { isActive: true },
    orderBy: { number: "asc" }
  });

  if (!gw) {
    const now = new Date();
    const deadline = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // +7 days

    gw = await prisma.gameweek.create({
      data: {
        number: 1,
        name: "Gameweek 1",
        deadlineAt: deadline,
        isActive: true
      }
    });
  }

  return gw;
}

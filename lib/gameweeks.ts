// lib/gameweeks.ts
import { prisma } from "./db";

export async function getOrCreateCurrentGameweek() {
  // 1) Prefer an explicitly active gameweek (you’ll control this via admin route)
  let gw = await prisma.gameweek.findFirst({
    where: { isActive: true },
    orderBy: { number: "asc" },
  });

  if (gw) return gw;

  // 2) Otherwise, pick the nearest future deadline
  const now = new Date();
  gw = await prisma.gameweek.findFirst({
    where: {
      deadlineAt: {
        gt: now,
      },
    },
    orderBy: {
      deadlineAt: "asc",
    },
  });

  if (gw) return gw;

  // 3) Otherwise, fall back to the latest gameweek by number
  gw = await prisma.gameweek.findFirst({
    orderBy: { number: "desc" },
  });

  if (gw) return gw;

  // 4) Absolute last resort: no gameweeks at all, create GW1
  const deadline = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // +7 days
  gw = await prisma.gameweek.create({
    data: {
      number: 1,
      name: "Gameweek 1",
      deadlineAt: deadline,
      isActive: true,
    },
  });

  return gw;
}

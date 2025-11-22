// prisma/seed.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Create or update Gameweek 1 so we always have something
  await prisma.gameweek.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: "Gameweek 1",
      // TODO: change this deadline to the real FPL GW1 deadline
      deadlineAt: new Date("2025-08-09T10:30:00.000Z"),
    },
  });

  console.log("Seed complete: Gameweek 1 created/updated");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

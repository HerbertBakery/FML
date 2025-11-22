// scripts/seed-gameweeks.js
//
// One-off script to create 38 Gameweek rows (1–38)
// in your database so scoring works for every GW.

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("Seeding 38 gameweeks...");

  // Choose a base season start date (doesn't affect scoring logic)
  const seasonStart = new Date(2025, 7, 1); // 1 Aug 2025 (months are 0-based)

  for (let number = 1; number <= 38; number++) {
    const deadlineAt = new Date(
      seasonStart.getTime() + (number - 1) * 7 * 24 * 60 * 60 * 1000
    );

    const gw = await prisma.gameweek.upsert({
      where: { number },
      update: {
        name: `Gameweek ${number}`,
        deadlineAt
      },
      create: {
        number,
        name: `Gameweek ${number}`,
        deadlineAt,
        isActive: number === 1 // only GW1 active to start
      }
    });

    console.log(
      `Upserted Gameweek ${gw.number} (${gw.name}) deadlineAt=${gw.deadlineAt.toISOString()}`
    );
  }

  console.log("Done seeding gameweeks.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

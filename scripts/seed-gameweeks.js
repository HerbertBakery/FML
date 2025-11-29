// scripts/seed-gameweeks.js
//
// One-off (or repeatable) script to create/update
// 38 Gameweek rows (1–38) in your database.

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("Seeding 38 gameweeks...");

  // Pick a season start date. This only affects deadlineAt for testing.
  // You can change this to whatever you like.
  const seasonStart = new Date(2025, 7, 1); // 1 Aug 2025 (months are 0-based)

  for (let number = 1; number <= 38; number++) {
    const deadlineAt = new Date(
      seasonStart.getTime() + (number - 1) * 7 * 24 * 60 * 60 * 1000
    );

    const existing = await prisma.gameweek.findFirst({
      where: { number },
    });

    if (!existing) {
      const created = await prisma.gameweek.create({
        data: {
          number,
          name: `Gameweek ${number}`,
          deadlineAt,
          isActive: number === 1, // start with only GW1 active
        },
      });
      console.log(
        `Created Gameweek ${created.number} (id=${created.id}) deadlineAt=${created.deadlineAt.toISOString()}`
      );
    } else {
      const updated = await prisma.gameweek.update({
        where: { id: existing.id },
        data: {
          name: existing.name ?? `Gameweek ${number}`,
          deadlineAt,
          // don't touch isActive here – we’ll control that via admin route
        },
      });
      console.log(
        `Updated Gameweek ${updated.number} (id=${updated.id}) deadlineAt=${updated.deadlineAt.toISOString()}`
      );
    }
  }

  console.log("Done seeding gameweeks 1–38.");
}

main()
  .catch((e) => {
    console.error("Error while seeding gameweeks:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

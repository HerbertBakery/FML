// scripts/unlock-gameweek.js
//
// Usage:
//   node scripts/unlock-gameweek.js 13
//
// This will:
// - find Gameweek with number = 13
// - set its deadlineAt to 7 days from now
// - set isActive = true
// - (optional) set all other gameweeks isActive = false

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const arg = process.argv[2];
  const gwNumber = arg ? Number(arg) : NaN;

  if (!Number.isInteger(gwNumber) || gwNumber <= 0) {
    console.error(
      "You must pass a valid gameweek number, e.g.:\n  node scripts/unlock-gameweek.js 13"
    );
    process.exit(1);
  }

  console.log(`Unlocking Gameweek ${gwNumber}...`);

  const gw = await prisma.gameweek.findFirst({
    where: { number: gwNumber },
  });

  if (!gw) {
    console.error(`Gameweek ${gwNumber} not found in DB.`);
    process.exit(1);
  }

  const now = new Date();
  const newDeadline = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // +7 days

  // Optional: make only this gameweek active
  await prisma.gameweek.updateMany({
    data: { isActive: false },
  });

  const updated = await prisma.gameweek.update({
    where: { id: gw.id },
    data: {
      deadlineAt: newDeadline,
      isActive: true,
    },
  });

  console.log(
    `Gameweek ${updated.number} is now active, deadlineAt=${updated.deadlineAt.toISOString()}`
  );
}

main()
  .catch((e) => {
    console.error("Error unlocking gameweek:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

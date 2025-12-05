// scripts/fixChipRemainingTries.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Find non-consumed chips that currently have 0 tries
  const chips = await prisma.userChip.findMany({
    where: {
      isConsumed: false,
      remainingTries: 0, // non-nullable, so just 0
    },
    include: {
      template: true, // needed so we can read template.maxTries
    },
  });

  console.log(`Found ${chips.length} chips to fix…`);

  for (const chip of chips) {
    const startingTries =
      typeof chip.template.maxTries === "number" && chip.template.maxTries > 0
        ? chip.template.maxTries
        : 2;

    await prisma.userChip.update({
      where: { id: chip.id },
      data: {
        remainingTries: startingTries,
      },
    });

    console.log(
      `Updated chip ${chip.id} → remainingTries=${startingTries} (template.maxTries=${chip.template.maxTries})`
    );
  }

  console.log("Done.");
}

main()
  .catch((err) => {
    console.error("Error running fixChipRemainingTries:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

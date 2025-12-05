// lib/chips.ts
import { prisma } from "@/lib/db";

export async function grantChipsToUser(opts: {
  userId: string;
  chipCode: string;
  count?: number;
}) {
  const { userId, chipCode } = opts;
  const count = !opts.count || opts.count < 1 ? 1 : Math.min(opts.count, 50);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("Target user not found.");

  const template = await prisma.chipTemplate.findUnique({
    where: { code: chipCode },
  });
  if (!template) {
    throw new Error(
      `Chip template with code '${chipCode}' not found.`
    );
  }

  // Decide starting tries based on template.maxTries (fallback to 2)
  const startingTries =
    typeof template.maxTries === "number" && template.maxTries > 0
      ? template.maxTries
      : 2;

  const created = [];
  for (let i = 0; i < count; i++) {
    const chip = await prisma.userChip.create({
      data: {
        userId: user.id,
        templateId: template.id,
        // IMPORTANT: explicitly set to avoid DB default weirdness
        remainingTries: startingTries,
      },
    });
    created.push(chip);
  }

  return created;
}

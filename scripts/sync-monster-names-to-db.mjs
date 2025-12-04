// scripts/sync-monster-names-to-db.mjs
// Sync JSON monsterName -> UserMonster.displayName for all monsters.
//
// Assumes:
// - data/monsters-2025-26.json has teams[].players[].code and .monsterName
// - UserMonster.templateCode matches that code (as a string)

import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MONSTERS_JSON_PATH = path.join(
  __dirname,
  "..",
  "data",
  "monsters-2025-26.json"
);

async function main() {
  if (!fs.existsSync(MONSTERS_JSON_PATH)) {
    console.error("Could not find monsters JSON at:", MONSTERS_JSON_PATH);
    process.exit(1);
  }

  const raw = fs.readFileSync(MONSTERS_JSON_PATH, "utf8");
  const teams = JSON.parse(raw);

  let attempted = 0;
  let updatedTotal = 0;
  let missing = 0;

  for (const team of teams) {
    if (!team.players) continue;

    for (const p of team.players) {
      const code = String(p.code || p.fplId || "").trim();
      const monsterName = p.monsterName;

      if (!code || !monsterName) {
        missing++;
        continue;
      }

      attempted++;

      // Update ALL user monsters that share this templateCode
      const result = await prisma.userMonster.updateMany({
        where: { templateCode: code },
        data: { displayName: monsterName },
      });

      updatedTotal += result.count;

      if (attempted % 50 === 0) {
        console.log(
          `Processed ${attempted} templates so far... total user monsters updated: ${updatedTotal}`
        );
      }
    }
  }

  console.log("Done syncing monster names.");
  console.log(`Templates seen in JSON:     ${attempted}`);
  console.log(`UserMonster rows updated:   ${updatedTotal}`);
  console.log(`Missing/invalid JSON rows:  ${missing}`);
}

main()
  .catch((err) => {
    console.error("Fatal error in sync script:", err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

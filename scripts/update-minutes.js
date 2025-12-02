// scripts/update-minutes.js
//
// One-off utility to annotate your monsters JSON with minutes played
// in the first N gameweeks of the current FPL season.
//
// For each player (using their fplId) we call:
//   https://fantasy.premierleague.com/api/element-summary/{fplId}/
//
// Then we sum `history[].minutes` for rounds <= MAX_GAMEWEEK and
// write that back into data/monsters-2025-26.json as `minutesFirst13`.
//
// Run with:  node scripts/update-minutes.js
//
// NOTE: Requires Node 18+ (for global fetch) or you can install node-fetch
// and swap the fetch implementation if needed.

import fs from "fs/promises";

// 👇 adjust if your path is slightly different
const DATA_PATH = "./data/monsters-2025-26.json";

// How many gameweeks to include
const MAX_GAMEWEEK = 13;

// Delay between requests to be polite to the API (ms)
const REQUEST_DELAY_MS = 200;

// Basic sleep helper
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch minutes for a single player up to MAX_GAMEWEEK.
 * Uses the official FPL element-summary endpoint.
 */
async function fetchMinutesForPlayer(fplId) {
  const url = `https://fantasy.premierleague.com/api/element-summary/${fplId}/`;

  const res = await fetch(url, {
    headers: {
      // Helps a tiny bit with not looking like a bot
      "User-Agent": "FML-minutes-script/1.0 (https://fantasy.premierleague.com/)"
    }
  });

  if (!res.ok) {
    console.warn(`  ⚠️  Failed to fetch element-summary for fplId=${fplId} (status ${res.status})`);
    return 0;
  }

  const data = await res.json();

  if (!Array.isArray(data.history)) {
    console.warn(`  ⚠️  Unexpected element-summary format for fplId=${fplId}`);
    return 0;
  }

  // data.history is per-fixture for the current season.
  // Each entry has: round (gameweek), minutes, goals_scored, etc.
  const totalMinutes = data.history
    .filter((entry) => typeof entry.round === "number" && entry.round <= MAX_GAMEWEEK)
    .reduce((sum, entry) => sum + (entry.minutes || 0), 0);

  return totalMinutes;
}

async function main() {
  console.log("🔄 Loading monsters JSON from:", DATA_PATH);

  const rawText = await fs.readFile(DATA_PATH, "utf8");
  const teams = JSON.parse(rawText);

  if (!Array.isArray(teams)) {
    throw new Error("Expected monsters JSON to be an array of teams.");
  }

  let playerCount = 0;

  // First pass: count players for progress logs
  for (const team of teams) {
    if (Array.isArray(team.players)) {
      playerCount += team.players.length;
    }
  }

  console.log(`📊 Found ${teams.length} teams and ${playerCount} players.`);
  console.log(`⏱  Fetching minutes for first ${MAX_GAMEWEEK} gameweeks...\n`);

  let processed = 0;

  // Iterate teams and players, updating minutesFirst13
  for (const team of teams) {
    if (!Array.isArray(team.players)) continue;

    for (const player of team.players) {
      processed += 1;

      const label = player.realName || player.webName || player.monsterName || `Unknown (#${processed})`;

      if (!player.fplId) {
        console.warn(
          `  ⚠️  Skipping ${label}: no fplId field present in JSON.`
        );
        continue;
      }

      console.log(
        `(${processed}/${playerCount}) ${label} [fplId=${player.fplId}]`
      );

      try {
        const minutes = await fetchMinutesForPlayer(player.fplId);
        player.minutesFirst13 = minutes;

        console.log(`      ➜ minutesFirst13 = ${minutes}`);
      } catch (err) {
        console.error(`  ❌ Error updating ${label}:`, err);
      }

      // Small delay between requests
      await sleep(REQUEST_DELAY_MS);
    }
  }

  console.log("\n💾 Writing updated JSON back to disk...");

  // Pretty-print with 2-space indent so diffs are readable
  await fs.writeFile(DATA_PATH, JSON.stringify(teams, null, 2), "utf8");

  console.log("✅ Done. monsters-2025-26.json now includes minutesFirst13 for each player.");
}

main().catch((err) => {
  console.error("Fatal error in update-minutes script:", err);
  process.exit(1);
});

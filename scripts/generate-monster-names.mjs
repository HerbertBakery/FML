// scripts/generate-monster-names.mjs
// Generate monster-style names for every player.
// Result: p.monsterName = "<UniqueFirstName> <Surname>"
// e.g. "Furnace Salah", "Cold Palmer", "Beastly Isak"

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MONSTERS_JSON_PATH = path.join(
  __dirname,
  "..",
  "data",
  "monsters-2025-26.json"
);

// Optional: hard overrides for absolute superstars.
// Store the FULL final name here, e.g. "Furnace Salah".
const SPECIAL_NAME_OVERRIDES = {
  // "Mohamed Salah": "Furnace Salah",
  // "Erling Haaland": "Beastly Haaland",
};

// ------------------------------------------------------------------
// SEED ROOTS: these are already good one-word "first names" by
// themselves. Dark / monster / soccer / FPL vibes.
// ------------------------------------------------------------------
const NAME_ROOTS = [
  // Fire / heat
  "Furnace", "Blaze", "Flame", "Ember", "Inferno", "Scorch", "Torch",
  "Ash", "Cinder", "Smolder", "Pyre", "Charred", "Kindle", "Wildfire",

  // Cold / ice
  "Cold", "Icy", "Frost", "Glacier", "Chill", "Snow", "Hail",
  "Winter", "Arctic", "Shard", "Rime", "Permafrost", "Frostbite",

  // Storm / sky
  "Storm", "Thunder", "Lightning", "Tempest", "Gale", "Cyclone",
  "Whirl", "Squall", "Gust", "Bolt", "Downpour", "Skyfall",

  // Shadow / darkness
  "Shadow", "Night", "Gloom", "Shade", "Dusk", "Noir",
  "Obsidian", "Umber", "Grim", "Duskwind", "Moonless", "Pitchblack",

  // Monster / aggression
  "Beastly", "Savage", "Feral", "Vicious", "Brutal", "Rabid",
  "Wild", "Rage", "Ruthless", "Relentless", "Fearsome", "Ferocious",

  // Speed / agility
  "Swift", "Rapid", "Blitz", "Sprint", "Dash", "Jet",
  "Flashy", "Burst", "Quick", "Electric", "Explosive",

  // Skill / flair
  "Silky", "Tricky", "Cheeky", "Clinical", "Inevitable", "Deadly",
  "Sniper", "Precise", "Cool", "Calm", "IceVeins", "Saucy", "Showboater",

  // Ghost / magic
  "Ghostly", "Wraith", "Phantom", "Spectral", "Spooky", "Mystic",
  "Arcane", "Runic", "Eerie", "Cursed", "Hexed", "Enchanted", "Occult",

  // Poison / corruption
  "Venomous", "Toxic", "Corrosive", "Acidic", "Rotten", "Blighted",
  "Plagued", "Tainted", "Septic", "Fouled",

  // Metal / stone
  "Iron", "Steel", "Stone", "Granite", "Rocky", "Onyx",
  "Bronzed", "Metallic", "Forged", "Alloy", "Anvil", "Hammerheart",

  // Power / size
  "Mighty", "Massive", "Giant", "Titanic", "Colossal",
  "Alpha", "Omega", "Prime", "Juggernaut", "Overpower",

  // Colour / aura
  "Crimson", "Scarlet", "Golden", "Silver", "Bronze",
  "Emerald", "Sapphire", "Ivory", "Jet", "Cobalt", "Amber",

  // Cosmic
  "Solar", "Lunar", "Cosmic", "Nova", "Meteor", "Comet",
  "Stellar", "Orbit", "Galaxy", "Starborn", "Nebula",

  // Energy / charge
  "Shocking", "Charged", "Magnetic", "Radiant", "Glowing",
  "Blazing", "Pulsing", "Amped", "Overcharged", "Volted",

  // Mental / attitude
  "Dire", "Grim", "Stalwart", "Loyal", "Sturdy", "Fearless",
  "Bold", "Unshaken", "Unbroken", "Focused", "Composed", "Driven",

  // GK / wall-ish
  "Immovable", "Unbeaten", "SafeHands", "Stonewall",
  "Brickwall", "LastStand", "Guardian", "Gatekeeper", "Lockdown",

  // Press / work rate
  "Pressing", "Harrier", "Hunter", "Tracker", "Marker",
  "Chaser", "Presshound",

  // Extra dark / edgy
  "Dread", "Nightmare", "Gravebound", "Skulled",
  "Reaper", "Doomed", "Hollow", "Bleak", "Ashen",

  // Spiritual / mythic
  "Totemic", "Runebound", "Elder", "Ancient", "Mythborn",
  "Fabled", "Crowned", "Chosen", "Relic", "Legendary",

  // Crowd / aura
  "Noisy", "Roaring", "Chanting", "TerraceKing", "Ultras",
  "Tifo", "Drumline", "Rabble", "Chorus",

  // Animal-ish & footballer nick flavour
  "Lionheart", "Wolfish", "HawkEye", "Foxlike", "Panther",
  "Rhino", "Bullish", "Shark", "Viper", "Cobra",
];

// ------------------------------------------------------------------
// SUFFIX SUITES: used to generate extra one-word fantasy adjectives
// like "Stormborn", "Nightbound", "Flameforged", etc.
// All still single words, no CamelCase mash like "FurnaceFang".
// ------------------------------------------------------------------
const NAME_SUFFIXES = [
  "born", "bound", "forged", "scarred", "grim", "dark",
  "shade", "gloom", "fall", "storm", "flare", "brand",
  "vein", "fang", "claw", "wing", "heart", "soul",
  "geist", "ward", "warden", "watch", "strike", "burst",
  "blast", "spark", "crest", "rise", "run", "step",
  "stride", "dash", "rush", "fire", "flame", "shard",
  "stone", "lock", "wall", "shield", "glass", "field",
  "mark", "press", "howl", "roar",
];

// How many first names we aim to have available.
// You want ~750; we'll generate ~800 so we’re safe.
const TARGET_FIRST_NAME_POOL_SIZE = 800;

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function getSurname(realName) {
  if (!realName) return "";
  const parts = realName.trim().split(/\s+/);
  return parts[parts.length - 1];
}

// Build a big pool of single-word first names.
// 1) Start with all NAME_ROOTS (already good one-word nicknames).
// 2) Add Root+suffix variants like "Stormborn", "Nightward", etc.
//    until we reach TARGET_FIRST_NAME_POOL_SIZE or run out.
function buildFirstNamePool() {
  const pool = [];
  const used = new Set();

  // First: all the roots as-is.
  for (const root of NAME_ROOTS) {
    if (!used.has(root)) {
      used.add(root);
      pool.push(root);
    }
  }

  // Then generate fantasy-style adjectives until we hit our target.
  outer: for (const root of NAME_ROOTS) {
    for (const suf of NAME_SUFFIXES) {
      if (pool.length >= TARGET_FIRST_NAME_POOL_SIZE) break outer;

      const name = root + suf; // e.g. "Stormborn", "Shadowward"
      if (!used.has(name)) {
        used.add(name);
        pool.push(name);
      }
    }
  }

  return pool;
}

// ------------------------------------------------------------------
// Main generator
// ------------------------------------------------------------------

function main() {
  if (!fs.existsSync(MONSTERS_JSON_PATH)) {
    console.error("Could not find monsters JSON at:", MONSTERS_JSON_PATH);
    process.exit(1);
  }

  const raw = fs.readFileSync(MONSTERS_JSON_PATH, "utf8");
  const teams = JSON.parse(raw);

  // Flatten players so we can assign names sequentially + deterministically.
  const players = [];
  for (const team of teams) {
    if (!team.players) continue;
    for (const p of team.players) {
      const realName = p.realName || p.name || p.playerName;
      if (!realName) {
        console.warn("Player missing realName field, skipping:", p);
        continue;
      }
      players.push({ player: p, realName });
    }
  }

  const totalPlayers = players.length;
  console.log(`Players needing names: ${totalPlayers}`);

  const firstNamePool = buildFirstNamePool();
  console.log(`First-name pool generated: ${firstNamePool.length}`);

  if (firstNamePool.length < totalPlayers) {
    console.warn(
      "WARNING: first-name pool smaller than number of players. " +
        "Some first names will be reused. Increase TARGET_FIRST_NAME_POOL_SIZE " +
        "or add more roots/suffixes if you want strict uniqueness."
    );
  }

  // Track which first names we've actually assigned, including overrides.
  const usedFirstNames = new Set();

  // Reserve first names that appear in overrides so they’re not re-used.
  for (const [realName, fullName] of Object.entries(SPECIAL_NAME_OVERRIDES)) {
    const firstToken = fullName.split(" ")[0];
    usedFirstNames.add(firstToken);
  }

  let poolIndex = 0;

  for (const { player, realName } of players) {
    // 1) Exact manual override?
    const overrideFullName = SPECIAL_NAME_OVERRIDES[realName];
    if (overrideFullName) {
      player.monsterName = overrideFullName;
      continue;
    }

    const surname = getSurname(realName);

    // 2) Pick next available first name from the pool that isn’t used.
    let firstName = null;
    let safety = 0;

    while (!firstName && safety < firstNamePool.length * 2) {
      const candidate = firstNamePool[poolIndex % firstNamePool.length];
      poolIndex++;
      safety++;

      if (!usedFirstNames.has(candidate)) {
        firstName = candidate;
        usedFirstNames.add(candidate);
      }
    }

    if (!firstName) {
      // Absolute last resort: fall back to something derived from surname.
      firstName = "Mystic";
      console.warn(
        `Fallback name used for ${realName}; consider increasing name pool.`
      );
    }

    player.monsterName = `${firstName} ${surname}`;
  }

  fs.writeFileSync(
    MONSTERS_JSON_PATH,
    JSON.stringify(teams, null, 2),
    "utf8"
  );

  console.log(
    `Updated monsterName for players. Total players processed: ${players.length}`
  );
  console.log(
    `Distinct first names actually used: ${usedFirstNames.size}`
  );
}

main();

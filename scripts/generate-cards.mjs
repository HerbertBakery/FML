// scripts/generate-cards.mjs
// Batch-generate monster card art using OpenAI images API
// Reads data/monsters-2025-26.json and writes images to public/cards/base/{code}.png

import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import path from "path";
import OpenAI from "openai";
import { fileURLToPath } from "url";

// Debug: check env loaded
console.log(
  "[dotenv] OPENAI_API_KEY prefix:",
  (process.env.OPENAI_API_KEY || "undefined").slice(0, 8)
);

// ---------- Optional: special archetypes for key players ----------
// Keyed by player.code or player.fplId (as a string).
// These describe a *fantasy creature archetype*, NOT a real person's face.
const SPECIAL_ARCHETYPES = {
  // Example (fill in with real codes from your JSON if you want special treatment):
  // "220566": "a storm-charged striker titan with Nordic vibes, lean but powerful build, crackling blue energy mane, clearly non-human face",
};

// ---------- Setup paths ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MONSTERS_JSON_PATH = path.join(
  __dirname,
  "..",
  "data",
  "monsters-2025-26.json"
);
const OUTPUT_DIR = path.join(__dirname, "..", "public", "cards", "base");

// ---------- OpenAI client ----------
if (!process.env.OPENAI_API_KEY) {
  console.error("ERROR: OPENAI_API_KEY is not set in .env");
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ---------- Helper: load JSON ----------
function loadMonstersJson() {
  if (!fs.existsSync(MONSTERS_JSON_PATH)) {
    console.error("ERROR: monsters JSON not found at:", MONSTERS_JSON_PATH);
    process.exit(1);
  }
  const raw = fs.readFileSync(MONSTERS_JSON_PATH, "utf-8");
  const teams = JSON.parse(raw); // array of teams

  const players = teams.flatMap((team) => {
    return (team.players || []).map((p) => ({
      ...p,
      teamShortName: team.teamShortName || p.teamShortName,
      teamName: team.teamName || p.teamName,
    }));
  });

  return players;
}

// ---------- Helper: ensure output dir ----------
function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

// ---------- Helper: team colour palette (club identity) ----------
function getTeamPalette(shortName, fullName) {
  const key = (shortName || fullName || "").toUpperCase();

  const map = {
    ARS: "red and white",
    MCI: "sky blue and white",
    MUN: "red and black",
    LIV: "bright red",
    CHE: "royal blue and white",
    TOT: "white and navy blue",
    NEW: "black and white stripes",
    BHA: "blue and white",
    WHU: "claret and blue",
    AVL: "claret and light blue",
    WOL: "gold and black",
    FUL: "white and black",
    BRE: "red and white",
    CRY: "red and blue",
    EVE: "blue and white",
    NFO: "red and white",
    BOU: "red and black",
    IPS: "blue and white",
    LEI: "blue and gold",
    SOU: "red and white stripes",
  };

  if (map[key]) return map[key];
  return "vibrant team colours from their home kit";
}

// ---------- Random helper ----------
function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// ---------- Helper: position archetype with special overrides ----------
function getPositionArchetype(player) {
  const codeKey = String(player.code || player.fplId || "");
  if (SPECIAL_ARCHETYPES[codeKey]) {
    // Custom “vibe” for this specific star player
    return SPECIAL_ARCHETYPES[codeKey];
  }

  const pos = (player.position || "").toUpperCase();

  // Pools intentionally mix animals, elementals, mechs, spirits, plants, etc.
  const GK_ARCHETYPES = [
    "a towering crystal golem goalkeeper, semi-translucent stone body, huge shield-like forearms and glowing core",
    "a floating owl-like guardian spirit made of light and mist, long spectral gloves stretching to stop shots",
    "a sleek mech goalkeeper with rounded armour plates, holographic wings and magnetic glove fields",
  ];

  const DEF_ARCHETYPES = [
    "a chunky rhino-turtle defender beast, heavy shell plates and a shield arm, stomping forward",
    "a living stone wall golem with glowing cracks, broad shoulders and shield-shaped chest armour",
    "a plant-knight creature, part treant and part dinosaur, with vine-wrapped armour and a massive root shield",
  ];

  const MID_ARCHETYPES = [
    "an agile fox-dragon hybrid field mage, slim athletic build, spinning glowing orbs around it",
    "a floating rune spirit with a semi-humanoid body, energy trails linking its hands and feet like passing lines",
    "a stylish cyber-sorcerer monster with sleek armour, neon lines and a hovering energy ball at its feet",
  ];

  const FWD_ARCHETYPES = [
    "a panther-raptor striker creature, long legs, lean muscles, mid-sprint with an energy ball",
    "a fiery comet spirit in humanoid form, blazing hair trail, about to blast the ball like a meteor",
    "a sleek dragon-mech striker with jet boosters on its boots, lunging forward to smash a shot",
  ];

  switch (pos) {
    case "GK":
      return pickRandom(GK_ARCHETYPES);
    case "DEF":
      return pickRandom(DEF_ARCHETYPES);
    case "MID":
      return pickRandom(MID_ARCHETYPES);
    case "FWD":
      return pickRandom(FWD_ARCHETYPES);
    default:
      return "a stylish fantasy football creature from an original monster species";
  }
}

// ---------- Prompt builder (bright, stylish, varied monsters) ----------
function buildPrompt(player) {
  const monsterName = player.monsterName; // your custom monsterized name
  const position = player.position;       // "GK" | "DEF" | "MID" | "FWD"
  const teamShort = player.teamShortName;
  const teamName = player.teamName;
  const realName = player.realName;

  const teamPalette = getTeamPalette(teamShort, teamName);
  const archetype = getPositionArchetype(player);

  return `
Create an appealing, stylish fantasy monster football character illustration for trading-card art.

The creature:
- Is ${archetype}.
- Represents a ${position} from a ${teamPalette} football team in the top English league.
- Its hairstyle, body language, and overall vibe should loosely echo a famous ${position}
  for ${teamName} named ${realName}, so fans can sense who it is inspired by,
  BUT do NOT copy any real person's face or exact likeness.
- The head and face must be clearly non-human (monster, mask, beak, skull, robot visor, elemental face),
  not a realistic human portrait.

Creature variety:
- Across the collection, creatures should come from many species:
  dragons, reptiles, big cats, wolves, birds, golems, robots, spirits, slime creatures, plant beasts, etc.
- For this monster, pick whichever creature type best matches the role and vibe,
  and make sure its silhouette is distinct (different head shape, limbs, posture) from a generic horned demon.
- Do NOT default to big curved horns on every design. Many monsters should have no horns;
  instead use crests, fins, plates, mechanical parts, glowing masks, or other shapes.

Kit / branding:
- Use colours inspired by ${teamPalette}, but design a completely original fantasy kit:
  made-up crest, made-up sponsor symbol, and fictional patterns.
- Absolutely NO real logos, badges, sponsor names, or trademarks.
- Do not write any readable text or numbers on the kit.

Art style:
- Bright, saturated, collectible-card style illustration.
- A mix of Pokémon-style clarity (cute, readable shapes) and modern action-RPG monster polish.
- Clean graphic shapes, sharp silhouette, and eye-catching colour palettes that feel fun and premium.
- Stylish rather than scary: avoid gore, horror, or heavy grim darkness.
- Use soft shading and highlights, with crisp line work where needed.

Framing / composition:
- The monster is the main focus, full body or 3/4 view, clearly readable.
- Use a bright or mid-tone background with simple shapes, colour bursts, motion streaks, or abstract stadium hints,
  not a dark, muddy, ultra-realistic environment.
- Vary poses and camera angles between monsters:
  some mid-run, some leaping, some bracing with a shield, some striking the ball or casting an ability.
- Leave some visual space near the bottom area so a card frame and stats could be overlaid later.
- No borders, UI, or card frame; only the character and background.
- Do NOT render any text, names, or numbers in the image.

Name reference:
- The design should feel like it fits a monster called "${monsterName}",
  but do NOT render the name as text in the image.
`;
}

// ---------- Helper: generate a single image ----------
async function generateImageForPlayer(player, index, total) {
  const code = player.code || player.fplId;
  if (!code) {
    console.warn("Skipping player with no code:", player.realName);
    return;
  }

  const outPath = path.join(OUTPUT_DIR, `${code}.png`);

  // Skip if file already exists (resumable)
  if (fs.existsSync(outPath)) {
    console.log(
      `[${index + 1}/${total}] Skipping ${code} (${player.monsterName}) - already exists.`
    );
    return;
  }

  const prompt = buildPrompt(player);
  console.log(
    `[${index + 1}/${total}] Generating image for ${code} - ${player.monsterName}...`
  );

  try {
    const response = await openai.images.generate({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024", // valid sizes: "1024x1024", "1024x1536", "1536x1024", "auto"
      n: 1,
    });

    const imageObj = response.data?.[0];
    if (!imageObj) {
      console.error(
        `No image object returned for ${code} (${player.monsterName}).`
      );
      return;
    }

    let buffer;

    if (imageObj.b64_json) {
      buffer = Buffer.from(imageObj.b64_json, "base64");
    } else if (imageObj.url) {
      const res = await fetch(imageObj.url);
      if (!res.ok) {
        console.error(
          `Failed to download image from URL for ${code} (${player.monsterName}).`
        );
        return;
      }
      const arrayBuffer = await res.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else {
      console.error(
        `Image response had neither b64_json nor url for ${code} (${player.monsterName}).`
      );
      return;
    }

    fs.writeFileSync(outPath, buffer);
    console.log(`Saved: ${outPath}`);
  } catch (err) {
    console.error(
      `Error generating image for ${code} (${player.monsterName}):`,
      err?.message || err
    );
  }
}

// ---------- Main ----------
async function main() {
  ensureOutputDir();
  const players = loadMonstersJson();

  console.log(`Loaded ${players.length} players from JSON.`);
  console.log(`Output directory: ${OUTPUT_DIR}`);

  // While testing, just do a few to check style & quality:
const subset = players.slice(11); // start at the 12th monster
  // const subset = players; // full run once you're happy

  const total = subset.length;
  const delayMs = 1500; // simple rate limit between calls

  for (let i = 0; i < total; i++) {
    const player = subset[i];
    await generateImageForPlayer(player, i, total);

    if (i < total - 1 && delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  console.log("Done generating cards.");
}

main().catch((err) => {
  console.error("Fatal error in generator:", err);
  process.exit(1);
});

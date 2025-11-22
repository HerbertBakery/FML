// scripts/generate-monsters-from-fpl.mjs
// Usage:
//   node scripts/generate-monsters-from-fpl.mjs
//
// It reads data/fpl-bootstrap.json and writes:
//   data/monsters-2025-26.json

import fs from "fs";
import path from "path";
import url from "url";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_PATH = path.join(__dirname, "..", "data", "fpl-bootstrap.json");
const OUTPUT_PATH = path.join(__dirname, "..", "data", "monsters-2025-26.json");

function loadFplData() {
  if (!fs.existsSync(INPUT_PATH)) {
    throw new Error(
      `Missing ${INPUT_PATH}. Run:\n  curl -o data/fpl-bootstrap.json https://fantasy.premierleague.com/api/bootstrap-static/`
    );
  }

  const raw = fs.readFileSync(INPUT_PATH, "utf8");
  return JSON.parse(raw);
}

// Map FPL element_type -> our positions
function mapPosition(elementType) {
  switch (elementType) {
    case 1:
      return "GK";
    case 2:
      return "DEF";
    case 3:
      return "MID";
    case 4:
      return "FWD";
    default:
      return "MID";
  }
}

// Monster name prefixes by position
const PREFIXES = {
  GK: ["Spectral", "Wall", "Phantom", "Gargoyle", "Ghostly"],
  DEF: ["Iron", "Bone", "Spine", "Rampart", "Shielded"],
  MID: ["Hexed", "Arcane", "Mystic", "Cursed", "Enchanted"],
  FWD: ["Fang", "Claw", "Howler", "Haunt", "Beastly"],
  DEFAULT: ["Ghoul", "Shadow", "Dark", "Night"]
};

function makeMonsterName(playerId, position, baseName) {
  const list = PREFIXES[position] || PREFIXES.DEFAULT;
  const prefix = list[playerId % list.length];
  return `${prefix} ${baseName}`;
}

function buildMonsterData(fpl) {
  const teams = fpl.teams || [];
  const players = fpl.elements || [];

  // Build team map for quick lookup
  const teamMap = new Map();
  for (const t of teams) {
    teamMap.set(t.id, {
      id: t.id,
      name: t.name,
      short_name: t.short_name
    });
  }

  // Group players by team
  const grouped = new Map();

  for (const p of players) {
    const teamId = p.team; // numeric team ID
    const teamInfo = teamMap.get(teamId);
    if (!teamInfo) continue;

    const position = mapPosition(p.element_type);
    const realName = `${p.first_name} ${p.second_name}`.trim();
    const baseName = p.web_name || p.second_name || p.first_name;
    const monsterName = makeMonsterName(p.id, position, baseName);

    const playerEntry = {
      fplId: p.id,
      code: p.code,
      realName,
      webName: p.web_name,
      monsterName,
      position,
      teamId: teamInfo.id,
      teamName: teamInfo.name,
      teamShortName: teamInfo.short_name,
      photo: p.photo // useful later if you want faces
    };

    if (!grouped.has(teamId)) {
      grouped.set(teamId, {
        teamId: teamInfo.id,
        teamName: teamInfo.name,
        teamShortName: teamInfo.short_name,
        players: []
      });
    }

    grouped.get(teamId).players.push(playerEntry);
  }

  // Sort teams by id, players by webName
  const result = Array.from(grouped.values())
    .sort((a, b) => a.teamId - b.teamId)
    .map((team) => ({
      ...team,
      players: team.players.sort((a, b) =>
        a.webName.localeCompare(b.webName)
      )
    }));

  return result;
}

function main() {
  try {
    console.log("Reading FPL data from:", INPUT_PATH);
    const fpl = loadFplData();
    console.log("Building monsterized Premier League data...");
    const monsters = buildMonsterData(fpl);
    fs.writeFileSync(
      OUTPUT_PATH,
      JSON.stringify(monsters, null, 2),
      "utf8"
    );
    console.log(`Wrote monster data to: ${OUTPUT_PATH}`);
    console.log(
      "You can now open this file and manually tweak key monster names."
    );
  } catch (err) {
    console.error("Error generating monsters:", err.message);
    process.exit(1);
  }
}

main();

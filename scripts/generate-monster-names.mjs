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
// ONE-WORD FIRST NAMES ONLY
// Every entry is a single "first name" token, no spaces.
// We ONLY use this pool now (no suffix combos).
// This pool is 800+ names so we easily cover 753 players.
// ------------------------------------------------------------------
const NAME_ROOTS = [
  // Fire / heat
  "Furnace", "Blaze", "Flame", "Ember", "Inferno", "Scorch", "Torch",
  "Ash", "Cinder", "Smolder", "Pyre", "Charred", "Kindle", "Wildfire",
  "Firebrand", "Matchstick", "Sparkplug", "Bonfire", "Campfire",
  "Kindling", "Flareup", "Hothead", "Heatwave", "Sunflame",

  // Cold / ice
  "Cold", "Icy", "Frost", "Glacier", "Chill", "Snow", "Hail",
  "Winter", "Arctic", "Shard", "Rime", "Permafrost", "Frostbite",
  "Icebox", "Snowdrift", "Snowball", "Snowshoe", "Frostfang",
  "Coldfront", "Icepick", "Icicle", "Snowstorm", "Whiteout",

  // Storm / sky
  "Storm", "Thunder", "Lightning", "Tempest", "Gale", "Cyclone",
  "Whirl", "Squall", "Gust", "Bolt", "Downpour", "Skyfall",
  "Thunderclap", "Rainmaker", "Cloudburst", "Drizzle",
  "Mistborn", "Fogbank", "Fogwalker", "Blizzard", "Downburst",
  "Twister", "Sandstorm", "Headwind", "Tailwind", "Crosswind",

  // Shadow / darkness
  "Shadow", "Night", "Gloom", "Shade", "Dusk", "Noir",
  "Obsidian", "Umber", "Grim", "Duskwind", "Moonless", "Pitchblack",
  "Midnight", "Nightfall", "Nightwatch", "Nightstep", "Darkwing",
  "Blackout", "Voidstep", "Gravelight", "Nightveil", "Nightsting",

  // Monster / aggression
  "Beastly", "Savage", "Feral", "Vicious", "Brutal", "Rabid",
  "Wild", "Rage", "Ruthless", "Relentless", "Fearsome", "Ferocious",
  "Bruiser", "Mauler", "Maulclaw", "Headcrusher", "Clobber",
  "Smackdown", "Piledriver", "Roughneck", "Thrasher", "Brawler",

  // Speed / agility
  "Swift", "Rapid", "Blitz", "Sprint", "Dash", "Jet",
  "Flashy", "Burst", "Quick", "Electric", "Explosive",
  "Zoom", "Whiplash", "Zipline", "Zoomer", "Quickstep",
  "Speedster", "Fastlane", "Turbo", "Nitro", "Slipstream",

  // Skill / flair
  "Silky", "Tricky", "Cheeky", "Clinical", "Inevitable", "Deadly",
  "Sniper", "Precise", "Cool", "Calm", "IceVeins", "Saucy",
  "Showboater", "Flairborn", "Rabona", "Elastico", "JogaBonito",
  "Magician", "Wizard", "Maestro", "Artist", "Painter",
  "Freestyler", "Skillmoves", "NutmegKing", "SauceLord", "Samba",

  // Ghost / magic
  "Ghostly", "Wraith", "Phantom", "Spectral", "Spooky", "Mystic",
  "Arcane", "Runic", "Eerie", "Cursed", "Hexed", "Enchanted", "Occult",
  "Ghastly", "Haunting", "Banshee", "Soulbound", "Seance",
  "Spiritwalk", "Grimspell", "Hexslinger", "RuneSinger", "SoulSnap",
  "Netherborn", "Abyssal", "Underworld", "Gravemist", "Dreadlock",

  // Poison / corruption
  "Venomous", "Toxic", "Corrosive", "Acidic", "Rotten", "Blighted",
  "Plagued", "Tainted", "Septic", "Fouled", "Poisonfoot",
  "Stingfoot", "Venomstrike", "Snakebite", "Rotfang", "Rotclaw",
  "Mireborn", "Swampy", "Sludgy", "Slimecoat", "Toxin",

  // Metal / stone
  "Iron", "Steel", "Stone", "Granite", "Rocky", "Onyx",
  "Bronzed", "Metallic", "Forged", "Alloy", "Anvil", "Hammerheart",
  "Ironbark", "Stonebark", "Steeltoe", "Ironhide", "Shieldback",
  "Anvilboot", "Metalfang", "Oreheart", "Quartz", "Basalt",
  "Marble", "Ironclad", "Steelwall", "Stonewall", "Hardrock",

  // Power / size
  "Mighty", "Massive", "Giant", "Titanic", "Colossal",
  "Alpha", "Omega", "Prime", "Juggernaut", "Overpower",
  "Powerhouse", "Tanky", "Bulldozer", "Bulwark", "Rampage",
  "Overdrive", "FullContact", "FullThrottle", "PeakForm", "BigGame",
  "Roadroller", "Steamroll", "HammerKick", "HeadSmash", "Battering",

  // Colour / aura
  "Crimson", "Scarlet", "Golden", "Silver", "Bronze",
  "Emerald", "Sapphire", "Ivory", "Jet", "Cobalt", "Amber",
  "Rosegold", "Platinum", "OnyxGlow", "Copper", "Teal",
  "Indigo", "Lilac", "Violet", "Magenta", "Azure",

  // Cosmic
  "Solar", "Lunar", "Cosmic", "Nova", "Meteor", "Comet",
  "Stellar", "Orbit", "Galaxy", "Starborn", "Nebula",
  "Asteroid", "Moondust", "Starforge", "CosmosKid", "Orbitrunner",
  "Voidwalker", "StarDust", "Warpdrive", "Hyperdrive", "EventHorizon",
  "Singularity", "BlackHole", "Supernova", "RedGiant", "BlueDwarf",

  // Energy / charge
  "Shocking", "Charged", "Magnetic", "Radiant", "Glowing",
  "Blazing", "Pulsing", "Amped", "Overcharged", "Volted",
  "StaticStorm", "WhiteNoise", "Frequency", "Shockwave",
  "Voltage", "Sparkline", "ChargeUp", "Wired", "Buzzing",
  "PowerSurge", "Current", "Livewire", "Shocklock", "Brightcore",

  // Mental / attitude
  "Dire", "Grimmind", "Stalwart", "Loyal", "Sturdy", "Fearless",
  "Bold", "Unshaken", "Unbroken", "Focused", "Composed", "Driven",
  "Relent", "Unyielding", "IceCold", "NoNerves", "IronMind",
  "Unfazed", "Steeled", "Resilient", "Calmheart", "StoneNerves",

  // GK / wall-ish
  "Immovable", "Unbeaten", "SafeHands", "Stonewall",
  "Brickwall", "LastStand", "Guardian", "Gatekeeper", "Lockdown",
  "ShotStopper", "CrossCatcher", "PenaltyKing", "CleanSheet",
  "Netminder", "Wallkeeper", "LineGuard", "BoxBoss", "Glovework",

  // Press / work rate
  "Pressing", "Harrier", "Hunter", "Tracker", "Marker",
  "Chaser", "Presshound", "EngineRoom", "Workhorse", "NeverStop",
  "GrindKing", "BallChaser", "HardRunner", "PressMonster",
  "RelentPress", "PressMachine", "ShadowRunner", "ManMarker", "Clogger",

  // Extra dark / edgy
  "Dread", "Nightmare", "Gravebound", "Skulled",
  "Reaper", "Doomed", "Hollow", "Bleak", "Ashen",
  "Gravelord", "Gravemind", "CoffinKid", "CoffinRunner",
  "Tombstone", "Cryptic", "Catacomb", "Coffinborn", "Mausoleum",
  "Skullface", "Bonecracker", "Boneyard", "Bonepile", "Gravewalker",

  // Spiritual / mythic
  "Totemic", "Runebound", "Elder", "Ancient", "Mythborn",
  "Fabled", "Crowned", "Chosen", "Relic", "Legendary",
  "Oracle", "Seer", "Prophet", "Runeseer", "Relicbearer",
  "Totemheart", "Mythweaver", "Lorekeeper", "Mythic", "Shrineborn",

  // Crowd / aura
  "Noisy", "Roaring", "Chanting", "TerraceKing", "Ultras",
  "Tifo", "Drumline", "Rabble", "Chorus", "Limbs",
  "FlareKid", "PyroFan", "BannerWaver", "Standside", "ChantLord",
  "CrowdSurf", "HomeEnd", "AwayEnd", "Rivalry", "FullHouse",

  // Animal-ish & footballer nick flavour
  "Lionheart", "Wolfish", "HawkEye", "Foxlike", "Panther",
  "Rhino", "Bullish", "Shark", "Viper", "Cobra",
  "HyenaLaugh", "Jackal", "Coyote", "Stingray", "Piranha",
  "Barracuda", "Krakened", "Octofang", "Tentacled", "Chimera",
  "Hydra", "Wyvern", "Drakeborn", "Ravenwing", "CrowCall",
  "EagleEye", "OwlEyes", "Bearcub", "Badger", "Weasel",

  // Fun / silly
  "Goofy", "Bouncy", "Wobbly", "Wonky", "Zany", "Loopy",
  "Bonkers", "Giggly", "Snazzy", "Quirky", "Tipsy", "Wacky",
  "Dozy", "Sleepy", "Grumpy", "Smirking", "Chuckling", "Greedy",
  "Sneaky", "Cheesy", "Spicy", "Salty", "Peppery", "Tangy",
  "Sizzly", "Crackling", "Crunchy", "Crispy", "Toasty", "Buttery",
  "Snackish", "Gremlinish", "Gremlin", "GremlinKing", "GremlinKid",
  "GremlinLord", "Mischief", "Shifty", "Prankish", "Jester",
  "Clownish", "Skittish", "Fizzy", "Bubblebrain", "Sillyboots",

  // Vibes / attitude
  "Irritated", "TriggerHappy", "Jittery", "Reckless", "Rowdy",
  "Riotous", "Feisty", "Spirited", "Boisterous", "Hyper",
  "Overcaffeinated", "ChaosBorn", "ChaosKid", "ChaosLord",
  "Wildcard", "Madcap", "Headloss", "Shithouse", "Rascal",
  "Scoundrel", "Streetwise", "BackAlley", "Cagey", "Clutch",
  "IcyCool", "NoChill", "FullSend", "Bossmode", "BigMood",

  // Football-y / meme
  "TopBins", "BarDown", "Crossbar", "VolleyKid", "VolleyLord",
  "VolleyMaster", "HalfVolley", "Knuckleball", "Curler", "OutsideBoot",
  "InsideBoot", "Travela", "Nutmeg", "MegMachine", "MegDealer",
  "Shinbreaker", "SlideTackle", "StudsUp", "LastDitch", "Sweeper",
  "BallWinner", "BallCarrier", "Playmaker", "Treble", "Brace",
  "HatTrick", "Poacher", "FoxBox", "BoxRaider", "NearPost",
  "FarPost", "SixYard", "Dugout", "Stoppage", "InjuryTime",
  "ExtraTime", "SpotKick", "Panenka", "ChipShot", "Pinged",
  "Switcher", "LongRanger", "Whippage", "PingMaster", "Diagonal",
  "Overlap", "Underlap", "FalseNine", "Inverted", "PressKing",
  "Gegenpress", "HighLine", "LowBlock", "PivotMan", "Anchor",
  "Regista", "Destroyer", "Metronome", "Playbook", "GamePlan",

  // Dark / spooky / horror-comedy (extra)
  "Cobweb", "Dusty", "Tombborn", "Graveyard", "Skulldrum",
  "Ghoulstep", "Shriek", "Screamer", "Howler", "Nightcrawl",
  "Witchy", "Occultist", "SoulFlip", "SoulSpin", "Abyssgaze",
  "PitDweller", "Hellfire", "DemonBoot", "Impish", "Devilish",
  "Sinister", "Malevolent", "Moonfang", "Moonshade", "Moonstrike",

  // Nature / earth / extra
  "Quake", "Aftershock", "Faultline", "Landslide", "Avalanche",
  "Mudslide", "Wildroot", "Thorny", "Bramble", "Rootbound",
  "Overgrown", "Pinefang", "Vinewhip", "Leafstep", "Branchclaw",
  "Rockgarden", "Earthshift", "Tremor", "Seismic", "Quarryborn",

  // Power / size / impact (extra)
  "Jugger", "TankLord", "Bodycheck", "PowerLeg", "IronShoulder",
  "BigUnit", "BigLad", "Enforcer", "Hitman", "Hammerfist",
  "Stronghold", "Fortress", "Rampart", "IronRamp", "Meatshield",

  // Comedy / internet / meme-ish
  "MemeLord", "MemeGoblin", "Bantersaurus", "BanterLord",
  "Shithouser", "StatPadder", "FraudWatch", "Agenda", "Narrative",
  "Scripted", "StoryMode", "PatchNotes", "MetaPick", "OPBuild",
  "Sweaty", "TryHard", "Smurfing", "Highlight", "Thumbnail",
  "Clickbait", "Viral", "OutOfContext", "Clipped", "Laggy",
  "Glitched", "Bugged", "Desynced", "Hardstuck", "Tilted",

  // Cute / animal / creature (extra)
  "PuppyFang", "KittenClaw", "Mousetrap", "Ferret", "Otterish",
  "Ocelot", "Cougar", "Lynx", "Puma", "KoiFang",
  "Stingtail", "Shellback", "Crabclaw", "Turtleback", "Gator",
  "Croc", "Mantis", "Scorpion", "Hornet", "Firefly",

  // Cosmic / time / weird (extra)
  "Timeskip", "TimeWarp", "Rewind", "FastForward", "LagSwitch",
  "Glitchstep", "Pixelated", "Scanline", "NoSignal", "ChannelFlip",
  "Timeline", "Chrono", "Clockwork", "Hourglass", "NightClock",
  "Dimension", "Portalrun", "Slipspace", "PhaseShift", "Backrooms",

  // Pure silly sound / vibe (extra)
  "Boink", "Boof", "Bop", "Splat", "Thunk", "Whoosh", "Zing",
  "Zap", "Zonked", "Bonk", "Doink", "Wobble", "Squiggle",
  "Squishy", "SoggyBoots", "MudBoots", "GrassStains", "ShinPads",
  "Bibbed", "Studded", "Sideline", "BallBoy", "BallGirl", "Mascot",
  "Benchkid", "Waterboy", "BibKing", "ConeMover", "FlagRunner"
];

// We keep NAME_SUFFIXES only for future ideas; not used now.
const NAME_SUFFIXES = [
  "born", "bound", "forged", "scarred", "grim", "dark",
  "shade", "gloom", "fall", "storm", "flare", "brand",
  "vein", "fang", "claw", "wing", "heart", "soul",
  "geist", "ward", "warden", "watch", "strike", "burst",
  "blast", "spark", "crest", "rise", "run", "step",
  "stride", "dash", "rush", "fire", "flame", "shard",
  "stone", "lock", "wall", "shield", "glass", "field",
  "mark", "press", "howl", "roar"
];

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function getSurname(realName) {
  if (!realName) return "";
  const parts = realName.trim().split(/\s+/);
  return parts[parts.length - 1];
}

// Build the pool of single-word first names.
// We now ONLY use NAME_ROOTS (no suffix variants).
function buildFirstNamePool() {
  const pool = [];
  const used = new Set();

  for (const root of NAME_ROOTS) {
    if (!used.has(root)) {
      used.add(root);
      pool.push(root);
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
  console.log(`First-name pool generated (roots only): ${firstNamePool.length}`);

  if (firstNamePool.length < totalPlayers) {
    console.warn(
      "WARNING: first-name pool smaller than number of players.\n" +
        "Some players may fallback to 'Mystic <Surname>'.\n" +
        "Add more entries to NAME_ROOTS if you want strict uniqueness."
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
      // Absolute last resort: fallback. With this pool size,
      // you shouldn't actually hit this for 753 players.
      firstName = "Mystic";
      console.warn(
        `Fallback name used for ${realName}; consider adding more NAME_ROOTS.`
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

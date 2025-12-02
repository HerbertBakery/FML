// lib/mythicals.ts
//
// Central config for your ultra-rare Mythical monsters.
// You currently have 7 Mythicals. Add the 8th later when ready.
//
// IMPORTANT:
// These MUST link to real FPL players so scoring works.
// Just fill in real fplId + code correctly (same as in your JSON).
// Art paths: place the PNGs in /public/cards/mythical/.

export type MythicalMonsterConfig = {
  fplId: number;
  code: number;
  realName: string;
  webName: string;
  monsterName: string;
  position: "GK" | "DEF" | "MID" | "FWD";
  teamId: number;
  teamName: string;
  teamShortName: string;
  photo: string;
  artBasePath: string;

  // Mythicals use hand-tuned stats
  baseAttack: number;
  baseMagic: number;
  baseDefense: number;
};

// -------------------------------------------------------------
// THE SEVEN MYTHICALS YOU PROVIDED
// -------------------------------------------------------------

export const MYTHICAL_MONSTERS: MythicalMonsterConfig[] = [

  // 1) Mohamed Salah → "Enraged Gyptian"
  {
    fplId: 316,                      // make sure correct
    code: 118748,                    // must match JSON
    realName: "Mohamed Salah",
    webName: "Salah",
    monsterName: "Enraged Gyptian",
    position: "MID",
    teamId: 12,
    teamName: "Liverpool",
    teamShortName: "LIV",
    photo: "118748.jpg",
    artBasePath: "/cards/mythical/enraged-gyptian.png",
    baseAttack: 98,
    baseMagic: 94,
    baseDefense: 82,
  },

  // 2) Cole Palmer → "Cold Palm"
  {
    fplId: 358,
    code: 231372,
    realName: "Cole Palmer",
    webName: "Palmer",
    monsterName: "Cold Palm",
    position: "MID",
    teamId: 3,
    teamName: "Chelsea",
    teamShortName: "CHE",
    photo: "231372.jpg",
    artBasePath: "/cards/mythical/cold-palm.png",
    baseAttack: 96,
    baseMagic: 99,
    baseDefense: 80,
  },

  // 3) Bukayo Saka → "Kayo"
  {
    fplId: 452,
    code: 432423,
    realName: "Bukayo Saka",
    webName: "Saka",
    monsterName: "Kayo",
    position: "MID",
    teamId: 1,
    teamName: "Arsenal",
    teamShortName: "ARS",
    photo: "432423.jpg",
    artBasePath: "/cards/mythical/kayo.png",
    baseAttack: 97,
    baseMagic: 93,
    baseDefense: 78,
  },

  // 4) Bruno Fernandes → "Deviled Fern"
  {
    fplId: 474,
    code: 103955,
    realName: "Bruno Fernandes",
    webName: "Fernandes",
    monsterName: "Deviled Fern",
    position: "MID",
    teamId: 13,
    teamName: "Manchester United",
    teamShortName: "MUN",
    photo: "103955.jpg",
    artBasePath: "/cards/mythical/deviled-fern.png",
    baseAttack: 95,
    baseMagic: 98,
    baseDefense: 79,
  },

  // 5) Gabriel (Arsenal DEF) → "GabROOT"
  {
    fplId: 182,
    code: 553741,
    realName: "Gabriel Magalhães",
    webName: "Gabriel",
    monsterName: "GabROOT",
    position: "DEF",
    teamId: 1,
    teamName: "Arsenal",
    teamShortName: "ARS",
    photo: "553741.jpg",
    artBasePath: "/cards/mythical/gabroot.png",
    baseAttack: 85,
    baseMagic: 76,
    baseDefense: 98,
  },

  // 6) William Saliba → "Mech Iba"
  {
    fplId: 489,
    code: 505407,
    realName: "William Saliba",
    webName: "Saliba",
    monsterName: "Mech Iba",
    position: "DEF",
    teamId: 1,
    teamName: "Arsenal",
    teamShortName: "ARS",
    photo: "505407.jpg",
    artBasePath: "/cards/mythical/mech-iba.png",
    baseAttack: 88,
    baseMagic: 80,
    baseDefense: 99,
  },

  // 7) Erling Haaland → "Dark Viking"
  {
    fplId: 674,
    code: 101123,
    realName: "Erling Haaland",
    webName: "Haaland",
    monsterName: "Dark Viking",
    position: "FWD",
    teamId: 11,
    teamName: "Manchester City",
    teamShortName: "MCI",
    photo: "101123.jpg",
    artBasePath: "/cards/mythical/dark-viking.png",
    baseAttack: 99,
    baseMagic: 84,
    baseDefense: 75,
  }

  // Add #8 later
];

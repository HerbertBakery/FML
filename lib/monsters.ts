// lib/monsters.ts

export type Position = "GK" | "DEF" | "MID" | "FWD";
export type Rarity = "COMMON" | "RARE" | "EPIC" | "LEGENDARY";

export type MonsterTemplate = {
  code: string;
  displayName: string;
  realPlayerName: string;
  position: Position;
  club: string;
  rarity: Rarity;
  baseAttack: number;
  baseMagic: number;
  baseDefense: number;
};

export const MONSTER_TEMPLATES: MonsterTemplate[] = [
  {
    code: "HAUNTLAND",
    displayName: "Erling Haunt",
    realPlayerName: "Erling Haaland",
    position: "FWD",
    club: "Manchester City",
    rarity: "LEGENDARY",
    baseAttack: 96,
    baseMagic: 82,
    baseDefense: 60
  },
  {
    code: "SALIZARD",
    displayName: "Mo SaLizard",
    realPlayerName: "Mohamed Salah",
    position: "FWD",
    club: "Liverpool",
    rarity: "EPIC",
    baseAttack: 92,
    baseMagic: 88,
    baseDefense: 62
  },
  {
    code: "BRUNOCLAW",
    displayName: "Bruno Clawnandes",
    realPlayerName: "Bruno Fernandes",
    position: "MID",
    club: "Manchester United",
    rarity: "EPIC",
    baseAttack: 87,
    baseMagic: 91,
    baseDefense: 68
  },
  {
    code: "SPIDERKEEPER",
    displayName: "ArachnEderson",
    realPlayerName: "Ederson",
    position: "GK",
    club: "Manchester City",
    rarity: "RARE",
    baseAttack: 40,
    baseMagic: 85,
    baseDefense: 92
  },
  {
    code: "ROCKBACK",
    displayName: "Virgil Van Dread",
    realPlayerName: "Virgil van Dijk",
    position: "DEF",
    club: "Liverpool",
    rarity: "RARE",
    baseAttack: 70,
    baseMagic: 78,
    baseDefense: 94
  },
  {
    code: "GREMLISH",
    displayName: "Jack Gremlish",
    realPlayerName: "Jack Grealish",
    position: "MID",
    club: "Manchester City",
    rarity: "COMMON",
    baseAttack: 80,
    baseMagic: 82,
    baseDefense: 65
  },
  {
    code: "SAKAWRAITH",
    displayName: "Ghostly Saka",
    realPlayerName: "Bukayo Saka",
    position: "FWD",
    club: "Arsenal",
    rarity: "RARE",
    baseAttack: 89,
    baseMagic: 86,
    baseDefense: 68
  }
];

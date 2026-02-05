import type { BossDefinition, BossAbility, MinionDefinition } from '../types/game';

// Minion definitions for bosses that can spawn minions
const MOLLY_MINION: MinionDefinition = {
  name: 'Bar Regular',
  attributes: {
    maxHealth: 35,
    maxAP: 2,
    strength: 8,
    shieldCapacity: 1,
    shieldStrength: 4,
    dexterity: 40,
    evasiveness: 35,
  },
};

const LAST_CALL_MINION: MinionDefinition = {
  name: 'Last Call Patron',
  attributes: {
    maxHealth: 50,
    maxAP: 3,
    strength: 12,
    shieldCapacity: 2,
    shieldStrength: 6,
    dexterity: 50,
    evasiveness: 30,
  },
};

// Boss 1: Molly the Matron (Swarm Master)
const MOLLY_THE_MATRON: BossDefinition = {
  id: 'molly_the_matron',
  name: 'Molly the Matron',
  level: 1,
  archetype: 'swarmMaster',
  attributes: {
    maxHealth: 150,
    maxAP: 4,
    strength: 10,
    shieldCapacity: 3,
    shieldStrength: 5,
    dexterity: 50,
    evasiveness: 20,
  },
  abilities: [
    {
      id: 'rallying_call',
      name: 'Rallying Call',
      cost: 2,
      targetType: 'self',
      hits: 1,
      effects: [],
      selfEffects: [{ type: 'spawnMinion', amount: 1, minionCount: 1 }],
      special: 'spawnMinion',
    },
    {
      id: 'bar_tab_beatdown',
      name: 'Bar Tab Beatdown',
      cost: 1,
      targetType: 'random',
      hits: 1,
      effects: [{ type: 'damage', amount: 6 }],
      selfEffects: [],
    },
    {
      id: 'mass_rally',
      name: 'Mass Rally',
      cost: 3,
      targetType: 'self',
      hits: 1,
      effects: [],
      selfEffects: [{ type: 'spawnMinion', amount: 2, minionCount: 2 }],
      special: 'spawnMinion2',
    },
    {
      id: 'innkeepers_blessing',
      name: "Innkeeper's Blessing",
      cost: 2,
      targetType: 'allEnemies', // Heals self and all minions (enemies from player perspective)
      hits: 1,
      effects: [{ type: 'heal', amount: 8 }],
      selfEffects: [{ type: 'heal', amount: 8 }],
    },
  ],
  minion: MOLLY_MINION,
};

// Boss 2: Iron Knuckles McGee (Executioner)
const IRON_KNUCKLES_MCGEE: BossDefinition = {
  id: 'iron_knuckles_mcgee',
  name: 'Iron Knuckles McGee',
  level: 2,
  archetype: 'executioner',
  attributes: {
    maxHealth: 180,
    maxAP: 4,
    strength: 15,
    shieldCapacity: 4,
    shieldStrength: 6,
    dexterity: 60,
    evasiveness: 15,
  },
  abilities: [
    {
      id: 'haymaker',
      name: 'Haymaker',
      cost: 2,
      targetType: 'random',
      hits: 1,
      effects: [{ type: 'damage', amount: 18 }],
      selfEffects: [],
    },
    {
      id: 'death_mark',
      name: 'Death Mark',
      cost: 1,
      targetType: 'random',
      hits: 1,
      effects: [{ type: 'damage', amount: 5 }],
      selfEffects: [],
      // Note: Mark mechanic would need additional state tracking
    },
    {
      id: 'knockout_punch',
      name: 'Knockout Punch',
      cost: 3,
      targetType: 'random',
      hits: 1,
      effects: [{ type: 'damage', amount: 35 }],
      selfEffects: [],
      special: 'requiresMark',
    },
    {
      id: 'sizing_up',
      name: 'Sizing Up',
      cost: 1,
      targetType: 'self',
      hits: 1,
      effects: [],
      selfEffects: [{ type: 'modifyAP', amount: 2 }],
    },
    {
      id: 'bouncers_shove',
      name: "Bouncer's Shove",
      cost: 1,
      targetType: 'random',
      hits: 1,
      effects: [
        { type: 'damage', amount: 8 },
        { type: 'modifyAP', amount: -1 },
      ],
      selfEffects: [],
    },
  ],
};

// Boss 3: Blast Barrel Betty (Devastator)
const BLAST_BARREL_BETTY: BossDefinition = {
  id: 'blast_barrel_betty',
  name: 'Blast Barrel Betty',
  level: 3,
  archetype: 'devastator',
  attributes: {
    maxHealth: 170,
    maxAP: 5,
    strength: 12,
    shieldCapacity: 3,
    shieldStrength: 5,
    dexterity: 55,
    evasiveness: 25,
  },
  abilities: [
    {
      id: 'explosive_round',
      name: 'Explosive Round',
      cost: 2,
      targetType: 'allParty',
      hits: 1,
      effects: [{ type: 'damage', amount: 7 }],
      selfEffects: [],
    },
    {
      id: 'barrel_toss',
      name: 'Barrel Toss',
      cost: 3,
      targetType: 'allParty',
      hits: 1,
      effects: [{ type: 'damage', amount: 12 }],
      selfEffects: [],
    },
    {
      id: 'fuse_lit',
      name: 'Fuse Lit',
      cost: 1,
      targetType: 'self',
      hits: 1,
      effects: [],
      selfEffects: [{ type: 'modifyAP', amount: 3 }],
    },
    {
      id: 'cellar_surprise',
      name: 'Cellar Surprise',
      cost: 5,
      targetType: 'allParty',
      hits: 1,
      effects: [{ type: 'damage', amount: 20 }],
      selfEffects: [],
    },
    {
      id: 'powder_keg_shield',
      name: 'Powder Keg Shield',
      cost: 2,
      targetType: 'self',
      hits: 1,
      effects: [],
      selfEffects: [{ type: 'addShield', amount: 4 }],
    },
  ],
};

// Boss 4: Pickled Pete (Tank Buster)
const PICKLED_PETE: BossDefinition = {
  id: 'pickled_pete',
  name: 'Pickled Pete',
  level: 4,
  archetype: 'tankBuster',
  attributes: {
    maxHealth: 200,
    maxAP: 4,
    strength: 14,
    shieldCapacity: 3,
    shieldStrength: 6,
    dexterity: 55,
    evasiveness: 20,
  },
  abilities: [
    {
      id: 'acid_spit',
      name: 'Acid Spit',
      cost: 2,
      targetType: 'random',
      hits: 1,
      effects: [{ type: 'damage', amount: 15, piercing: true }],
      selfEffects: [],
    },
    {
      id: 'corrosive_splash',
      name: 'Corrosive Splash',
      cost: 3,
      targetType: 'allParty',
      hits: 1,
      effects: [{ type: 'damage', amount: 8, piercing: true }],
      selfEffects: [],
    },
    {
      id: 'dissolving_touch',
      name: 'Dissolving Touch',
      cost: 1,
      targetType: 'random',
      hits: 1,
      effects: [{ type: 'removeShield', amount: 999 }], // Remove all shields
      selfEffects: [],
    },
    {
      id: 'toxic_fortitude',
      name: 'Toxic Fortitude',
      cost: 2,
      targetType: 'self',
      hits: 1,
      effects: [],
      selfEffects: [
        { type: 'addShield', amount: 3 },
        { type: 'heal', amount: 10 },
      ],
    },
    {
      id: 'pickled_rage',
      name: 'Pickled Rage',
      cost: 4,
      targetType: 'random',
      hits: 3,
      effects: [{ type: 'damage', amount: 10, piercing: true }],
      selfEffects: [],
    },
  ],
};

// Boss 5: The Jukebox Jinx (Tempo Manipulator)
const JUKEBOX_JINX: BossDefinition = {
  id: 'jukebox_jinx',
  name: 'The Jukebox Jinx',
  level: 5,
  archetype: 'tempoManipulator',
  attributes: {
    maxHealth: 190,
    maxAP: 6,
    strength: 11,
    shieldCapacity: 3,
    shieldStrength: 5,
    dexterity: 60,
    evasiveness: 30,
  },
  abilities: [
    {
      id: 'tempo_drain',
      name: 'Tempo Drain',
      cost: 2,
      targetType: 'random',
      hits: 1,
      effects: [
        { type: 'damage', amount: 8 },
        { type: 'modifyAP', amount: -2 },
      ],
      selfEffects: [],
    },
    {
      id: 'discordant_chord',
      name: 'Discordant Chord',
      cost: 3,
      targetType: 'allParty',
      hits: 1,
      effects: [
        { type: 'damage', amount: 5 },
        { type: 'modifyAP', amount: -1 },
      ],
      selfEffects: [],
    },
    {
      id: 'encore',
      name: 'Encore!',
      cost: 2,
      targetType: 'self',
      hits: 1,
      effects: [],
      selfEffects: [{ type: 'modifyAP', amount: 4 }],
    },
    {
      id: 'vinyl_slash',
      name: 'Vinyl Slash',
      cost: 1,
      targetType: 'random',
      hits: 2,
      effects: [{ type: 'damage', amount: 7 }],
      selfEffects: [],
    },
    {
      id: 'bass_drop',
      name: 'Bass Drop',
      cost: 4,
      targetType: 'allParty',
      hits: 1,
      effects: [
        { type: 'damage', amount: 15 },
        { type: 'modifyAP', amount: -2 },
      ],
      selfEffects: [],
    },
  ],
};

// Boss 6: Old Nan the Nightmare (Regenerator)
const OLD_NAN: BossDefinition = {
  id: 'old_nan_nightmare',
  name: 'Old Nan the Nightmare',
  level: 6,
  archetype: 'regenerator',
  attributes: {
    maxHealth: 220,
    maxAP: 5,
    strength: 13,
    shieldCapacity: 2,
    shieldStrength: 5,
    dexterity: 55,
    evasiveness: 25,
  },
  abilities: [
    {
      id: 'drain_life',
      name: 'Drain Life',
      cost: 2,
      targetType: 'random',
      hits: 1,
      effects: [{ type: 'damage', amount: 12 }],
      selfEffects: [{ type: 'heal', amount: 12, drain: true }],
    },
    {
      id: 'spirit_siphon',
      name: 'Spirit Siphon',
      cost: 3,
      targetType: 'allParty',
      hits: 1,
      effects: [{ type: 'damage', amount: 6 }],
      selfEffects: [{ type: 'heal', amount: 6, drain: true }], // Heals per target hit
    },
    {
      id: 'eternal_rest',
      name: 'Eternal Rest',
      cost: 2,
      targetType: 'self',
      hits: 1,
      effects: [],
      selfEffects: [{ type: 'heal', amount: 25 }],
    },
    {
      id: 'vengeful_spirits',
      name: 'Vengeful Spirits',
      cost: 3,
      targetType: 'random',
      hits: 4,
      effects: [{ type: 'damage', amount: 8 }],
      selfEffects: [],
    },
    {
      id: 'nightmare_fuel',
      name: 'Nightmare Fuel',
      cost: 4,
      targetType: 'allParty',
      hits: 1,
      effects: [{ type: 'damage', amount: 10 }],
      selfEffects: [{ type: 'heal', amount: 10, drain: true }], // Heals equal to total damage
    },
  ],
};

// Boss 7: The Last Call (Hybrid Nightmare)
const THE_LAST_CALL: BossDefinition = {
  id: 'the_last_call',
  name: 'The Last Call',
  level: 7,
  archetype: 'hybridNightmare',
  attributes: {
    maxHealth: 280,
    maxAP: 6,
    strength: 16,
    shieldCapacity: 4,
    shieldStrength: 7,
    dexterity: 65,
    evasiveness: 20,
  },
  abilities: [
    {
      id: 'closing_time',
      name: 'Closing Time',
      cost: 3,
      targetType: 'random',
      hits: 1,
      effects: [{ type: 'damage', amount: 25 }],
      selfEffects: [],
    },
    {
      id: 'bar_brawl',
      name: 'Bar Brawl',
      cost: 4,
      targetType: 'allParty',
      hits: 1,
      effects: [{ type: 'damage', amount: 12 }],
      selfEffects: [],
    },
    {
      id: 'last_orders',
      name: 'Last Orders',
      cost: 2,
      targetType: 'self',
      hits: 1,
      effects: [],
      selfEffects: [{ type: 'spawnMinion', amount: 1, minionCount: 1 }],
      special: 'spawnMinion',
    },
    {
      id: 'landlords_decree',
      name: "Landlord's Decree",
      cost: 2,
      targetType: 'random',
      hits: 1,
      effects: [
        { type: 'damage', amount: 15, piercing: true },
        { type: 'modifyAP', amount: -1 },
      ],
      selfEffects: [],
    },
    {
      id: 'spirit_surge',
      name: 'Spirit Surge',
      cost: 3,
      targetType: 'self',
      hits: 1,
      effects: [],
      selfEffects: [
        { type: 'heal', amount: 20 },
        { type: 'addShield', amount: 3 },
      ],
    },
    {
      id: 'happy_hour',
      name: 'Happy Hour',
      cost: 1,
      targetType: 'self',
      hits: 1,
      effects: [],
      selfEffects: [{ type: 'modifyAP', amount: 3 }],
    },
    {
      id: 'final_bell',
      name: 'Final Bell',
      cost: 6,
      targetType: 'allParty',
      hits: 1,
      effects: [{ type: 'damage', amount: 18, piercing: true }],
      selfEffects: [],
    },
  ],
  minion: LAST_CALL_MINION,
};

// All boss definitions in order
export const BOSS_DEFINITIONS: BossDefinition[] = [
  MOLLY_THE_MATRON,
  IRON_KNUCKLES_MCGEE,
  BLAST_BARREL_BETTY,
  PICKLED_PETE,
  JUKEBOX_JINX,
  OLD_NAN,
  THE_LAST_CALL,
];

/**
 * Get the boss definition for a specific level
 * @param level - Level 1-7
 * @returns The boss definition for that level, or undefined if invalid level
 */
export function getBossForLevel(level: number): BossDefinition | undefined {
  return BOSS_DEFINITIONS.find((boss) => boss.level === level);
}

/**
 * Get a boss definition by ID
 * @param id - The boss ID
 * @returns The boss definition, or undefined if not found
 */
export function getBossById(id: string): BossDefinition | undefined {
  return BOSS_DEFINITIONS.find((boss) => boss.id === id);
}

// Minion definitions for bosses that can spawn minions
const MOLLY_MINION = {
    name: 'Bar Regular',
    attributes: {
        maxHealth: 3,
        maxAP: 2,
        power: 0,
        shieldCapacity: 0,
        shieldStrength: 0,
        dexterity: 40,
        evasiveness: 20,
    },
};
const LAST_CALL_MINION = {
    name: 'Last Call Patron',
    attributes: {
        maxHealth: 6,
        maxAP: 2,
        power: 1,
        shieldCapacity: 1,
        shieldStrength: 2,
        dexterity: 50,
        evasiveness: 20,
    },
};
// Boss 1: Molly the Matron (Swarm Master)
const MOLLY_THE_MATRON = {
    id: 'molly_the_matron',
    name: 'Molly the Matron',
    level: 1,
    archetype: 'swarmMaster',
    attributes: {
        maxHealth: 30,
        maxAP: 3,
        power: 1,
        shieldCapacity: 0,
        shieldStrength: 0,
        dexterity: 50,
        evasiveness: 15,
    },
    abilities: [
        {
            id: 'bar_tab_beatdown',
            name: 'Bar Tab Beatdown',
            cost: 1,
            targetType: 'random',
            hits: 1,
            effects: [{ type: 'damage', amount: 2 }],
            selfEffects: [],
        },
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
            id: 'innkeepers_blessing',
            name: "Innkeeper's Blessing",
            cost: 2,
            targetType: 'allEnemies',
            hits: 1,
            effects: [{ type: 'heal', amount: 2 }],
            selfEffects: [],
        },
    ],
    minion: MOLLY_MINION,
};
// Boss 2: Iron Knuckles McGee (Executioner)
const IRON_KNUCKLES_MCGEE = {
    id: 'iron_knuckles_mcgee',
    name: 'Iron Knuckles McGee',
    level: 2,
    archetype: 'executioner',
    attributes: {
        maxHealth: 77,
        maxAP: 3,
        power: 2,
        shieldCapacity: 0,
        shieldStrength: 0,
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
            effects: [{ type: 'damage', amount: 4 }],
            selfEffects: [],
        },
        {
            id: 'jab',
            name: 'Jab',
            cost: 1,
            targetType: 'random',
            hits: 1,
            effects: [{ type: 'damage', amount: 1 }],
            selfEffects: [],
        },
        {
            id: 'knockout_punch',
            name: 'Knockout Punch',
            cost: 3,
            targetType: 'random',
            hits: 1,
            effects: [{ type: 'damage', amount: 4, piercing: true }],
            selfEffects: [],
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
    ],
};
// Boss 3: Blast Barrel Betty (Devastator)
const BLAST_BARREL_BETTY = {
    id: 'blast_barrel_betty',
    name: 'Blast Barrel Betty',
    level: 3,
    archetype: 'devastator',
    attributes: {
        maxHealth: 108,
        maxAP: 3,
        power: 1,
        shieldCapacity: 1,
        shieldStrength: 2,
        dexterity: 55,
        evasiveness: 20,
    },
    abilities: [
        {
            id: 'explosive_round',
            name: 'Explosive Round',
            cost: 2,
            targetType: 'allParty',
            hits: 1,
            effects: [{ type: 'damage', amount: 1 }],
            selfEffects: [],
        },
        {
            id: 'barrel_toss',
            name: 'Barrel Toss',
            cost: 3,
            targetType: 'allParty',
            hits: 1,
            effects: [{ type: 'damage', amount: 2 }],
            selfEffects: [],
        },
        {
            id: 'fuse_lit',
            name: 'Fuse Lit',
            cost: 1,
            targetType: 'self',
            hits: 1,
            effects: [],
            selfEffects: [{ type: 'modifyAP', amount: 2 }],
        },
        {
            id: 'cellar_surprise',
            name: 'Cellar Surprise',
            cost: 4,
            targetType: 'allParty',
            hits: 1,
            effects: [{ type: 'damage', amount: 4 }],
            selfEffects: [],
        },
        {
            id: 'powder_keg_shield',
            name: 'Powder Keg Shield',
            cost: 1,
            targetType: 'self',
            hits: 1,
            effects: [],
            selfEffects: [{ type: 'addShield', amount: 2 }],
        },
    ],
};
// Boss 4: Pickled Pete (Tank Buster)
const PICKLED_PETE = {
    id: 'pickled_pete',
    name: 'Pickled Pete',
    level: 4,
    archetype: 'tankBuster',
    attributes: {
        maxHealth: 98,
        maxAP: 3,
        power: 1,
        shieldCapacity: 1,
        shieldStrength: 2,
        dexterity: 55,
        evasiveness: 15,
    },
    abilities: [
        {
            id: 'acid_spit',
            name: 'Acid Spit',
            cost: 2,
            targetType: 'random',
            hits: 1,
            effects: [{ type: 'damage', amount: 3, piercing: true }],
            selfEffects: [],
        },
        {
            id: 'corrosive_splash',
            name: 'Corrosive Splash',
            cost: 3,
            targetType: 'allParty',
            hits: 1,
            effects: [{ type: 'damage', amount: 1, piercing: true }],
            selfEffects: [],
        },
        {
            id: 'dissolving_touch',
            name: 'Dissolving Touch',
            cost: 1,
            targetType: 'random',
            hits: 1,
            effects: [{ type: 'removeShield', amount: 999 }],
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
                { type: 'heal', amount: 3 },
                { type: 'addShield', amount: 1 },
            ],
        },
        {
            id: 'pickled_rage',
            name: 'Pickled Rage',
            cost: 3,
            targetType: 'random',
            hits: 3,
            effects: [{ type: 'damage', amount: 2, piercing: true }],
            selfEffects: [],
        },
    ],
};
// Boss 5: The Jukebox Jinx (Tempo Manipulator)
const JUKEBOX_JINX = {
    id: 'jukebox_jinx',
    name: 'The Jukebox Jinx',
    level: 5,
    archetype: 'tempoManipulator',
    attributes: {
        maxHealth: 84,
        maxAP: 4,
        power: 1,
        shieldCapacity: 0,
        shieldStrength: 0,
        dexterity: 60,
        evasiveness: 25,
    },
    abilities: [
        {
            id: 'tempo_drain',
            name: 'Tempo Drain',
            cost: 2,
            targetType: 'random',
            hits: 1,
            effects: [
                { type: 'damage', amount: 2 },
                { type: 'modifyAP', amount: -1 },
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
                { type: 'damage', amount: 1 },
                { type: 'modifyAP', amount: -1 },
            ],
            selfEffects: [],
        },
        {
            id: 'encore',
            name: 'Encore!',
            cost: 1,
            targetType: 'self',
            hits: 1,
            effects: [],
            selfEffects: [{ type: 'modifyAP', amount: 3 }],
        },
        {
            id: 'vinyl_slash',
            name: 'Vinyl Slash',
            cost: 1,
            targetType: 'random',
            hits: 2,
            effects: [{ type: 'damage', amount: 1 }],
            selfEffects: [],
        },
        {
            id: 'bass_drop',
            name: 'Bass Drop',
            cost: 4,
            targetType: 'allParty',
            hits: 1,
            effects: [
                { type: 'damage', amount: 3 },
                { type: 'modifyAP', amount: -1 },
            ],
            selfEffects: [],
        },
    ],
};
// Boss 6: Old Nan the Nightmare (Regenerator)
const OLD_NAN = {
    id: 'old_nan_nightmare',
    name: 'Old Nan the Nightmare',
    level: 6,
    archetype: 'regenerator',
    attributes: {
        maxHealth: 42,
        maxAP: 3,
        power: 1,
        shieldCapacity: 0,
        shieldStrength: 0,
        dexterity: 55,
        evasiveness: 20,
    },
    abilities: [
        {
            id: 'drain_life',
            name: 'Drain Life',
            cost: 2,
            targetType: 'random',
            hits: 1,
            effects: [{ type: 'damage', amount: 3 }],
            selfEffects: [{ type: 'heal', amount: 3, drain: true }],
        },
        {
            id: 'spirit_siphon',
            name: 'Spirit Siphon',
            cost: 3,
            targetType: 'allParty',
            hits: 1,
            effects: [{ type: 'damage', amount: 2 }],
            selfEffects: [{ type: 'heal', amount: 2, drain: true }],
        },
        {
            id: 'eternal_rest',
            name: 'Eternal Rest',
            cost: 2,
            targetType: 'self',
            hits: 1,
            effects: [],
            selfEffects: [{ type: 'heal', amount: 4 }],
        },
        {
            id: 'vengeful_spirits',
            name: 'Vengeful Spirits',
            cost: 3,
            targetType: 'random',
            hits: 3,
            effects: [{ type: 'damage', amount: 3 }],
            selfEffects: [],
        },
        {
            id: 'nightmare_fuel',
            name: 'Nightmare Fuel',
            cost: 3,
            targetType: 'allParty',
            hits: 1,
            effects: [{ type: 'damage', amount: 3 }],
            selfEffects: [{ type: 'heal', amount: 3, drain: true }],
        },
    ],
};
// Boss 7: The Last Call (Hybrid Nightmare)
const THE_LAST_CALL = {
    id: 'the_last_call',
    name: 'The Last Call',
    level: 7,
    archetype: 'hybridNightmare',
    attributes: {
        maxHealth: 108,
        maxAP: 4,
        power: 2,
        shieldCapacity: 2,
        shieldStrength: 2,
        dexterity: 65,
        evasiveness: 15,
    },
    abilities: [
        {
            id: 'closing_time',
            name: 'Closing Time',
            cost: 2,
            targetType: 'random',
            hits: 1,
            effects: [{ type: 'damage', amount: 3 }],
            selfEffects: [],
        },
        {
            id: 'bar_brawl',
            name: 'Bar Brawl',
            cost: 3,
            targetType: 'allParty',
            hits: 1,
            effects: [{ type: 'damage', amount: 3 }],
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
                { type: 'damage', amount: 3, piercing: true },
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
                { type: 'heal', amount: 5 },
                { type: 'addShield', amount: 2 },
            ],
        },
        {
            id: 'happy_hour',
            name: 'Happy Hour',
            cost: 1,
            targetType: 'self',
            hits: 1,
            effects: [],
            selfEffects: [{ type: 'modifyAP', amount: 2 }],
        },
        {
            id: 'final_bell',
            name: 'Final Bell',
            cost: 5,
            targetType: 'allParty',
            hits: 1,
            effects: [{ type: 'damage', amount: 4, piercing: true }],
            selfEffects: [],
        },
    ],
    minion: LAST_CALL_MINION,
};
// All boss definitions in order
export const BOSS_DEFINITIONS = [
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
export function getBossForLevel(level) {
    return BOSS_DEFINITIONS.find((boss) => boss.level === level);
}
/**
 * Get a boss definition by ID
 * @param id - The boss ID
 * @returns The boss definition, or undefined if not found
 */
export function getBossById(id) {
    return BOSS_DEFINITIONS.find((boss) => boss.id === id);
}

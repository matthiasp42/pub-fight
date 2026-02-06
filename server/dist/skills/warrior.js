export const WARRIOR_SKILLS = [
    // ── Level 1 ──────────────────────────────────────────────────────────────
    // SINGLE-TARGET PATH
    {
        id: 'precision',
        name: 'Precision',
        description: 'Your basic Attack lets you choose the target.',
        class: 'warrior',
        levelRequired: 1,
        type: 'passive',
        passive: {
            trigger: 'always',
            effect: { type: 'precision' },
        },
    },
    // AoE PATH
    {
        id: 'flurry',
        name: 'Flurry',
        description: '3 hits, 1 damage each (random targets).',
        class: 'warrior',
        levelRequired: 1,
        type: 'ability',
        ability: {
            cost: 2,
            targetType: 'random',
            hits: 3,
            effects: [{ type: 'damage', amount: 1 }],
            selfEffects: [],
        },
    },
    // FLOATING UTILITY
    {
        id: 'desperation_shield',
        name: 'Desperation Shield',
        description: 'When hit below 30% HP, gain 1 shield.',
        class: 'warrior',
        levelRequired: 1,
        type: 'passive',
        passive: {
            trigger: 'onTakeDamage',
            effect: { type: 'gainShield', amount: 1, condition: { hpBelow: 30 } },
        },
    },
    // ── Level 3 ──────────────────────────────────────────────────────────────
    // SINGLE-TARGET (floating - no prereq)
    {
        id: 'heavy_strike',
        name: 'Heavy Strike',
        description: '4 damage to chosen target.',
        class: 'warrior',
        levelRequired: 3,
        type: 'ability',
        ability: {
            cost: 2,
            targetType: 'manual',
            hits: 1,
            effects: [{ type: 'damage', amount: 4 }],
            selfEffects: [],
        },
    },
    // AoE PATH
    {
        id: 'whirlwind',
        name: 'Whirlwind',
        description: '2 damage to all enemies.',
        class: 'warrior',
        levelRequired: 3,
        requires: 'flurry',
        type: 'ability',
        ability: {
            cost: 2,
            targetType: 'allEnemies',
            hits: 1,
            effects: [{ type: 'damage', amount: 2 }],
            selfEffects: [],
        },
    },
    // FLOATING UTILITY
    {
        id: 'second_wind',
        name: 'Second Wind',
        description: 'When you Rest, also heal 2 HP.',
        class: 'warrior',
        levelRequired: 3,
        type: 'passive',
        passive: {
            trigger: 'always',
            effect: { type: 'secondWind', amount: 2 },
        },
    },
    // ── Level 5 ──────────────────────────────────────────────────────────────
    // SINGLE-TARGET (floating)
    {
        id: 'piercing_strike',
        name: 'Piercing Strike',
        description: '3 piercing damage to chosen target.',
        class: 'warrior',
        levelRequired: 5,
        type: 'ability',
        ability: {
            cost: 2,
            targetType: 'manual',
            hits: 1,
            effects: [{ type: 'damage', amount: 3, piercing: true }],
            selfEffects: [],
        },
    },
    // AoE PATH
    {
        id: 'blade_storm',
        name: 'Blade Storm',
        description: '3 damage to all enemies.',
        class: 'warrior',
        levelRequired: 5,
        requires: 'whirlwind',
        type: 'ability',
        ability: {
            cost: 3,
            targetType: 'allEnemies',
            hits: 1,
            effects: [{ type: 'damage', amount: 3 }],
            selfEffects: [],
        },
    },
    // ── Level 7 ──────────────────────────────────────────────────────────────
    // SINGLE-TARGET
    {
        id: 'executioner',
        name: 'Executioner',
        description: '7 piercing damage to chosen target.',
        class: 'warrior',
        levelRequired: 7,
        requires: 'heavy_strike',
        type: 'ability',
        ability: {
            cost: 3,
            targetType: 'manual',
            hits: 1,
            effects: [{ type: 'damage', amount: 7, piercing: true }],
            selfEffects: [],
        },
    },
    // AoE PATH
    {
        id: 'rampage',
        name: 'Rampage',
        description: '4 piercing damage to all enemies.',
        class: 'warrior',
        levelRequired: 7,
        requires: 'blade_storm',
        type: 'ability',
        ability: {
            cost: 3,
            targetType: 'allEnemies',
            hits: 1,
            effects: [{ type: 'damage', amount: 4, piercing: true }],
            selfEffects: [],
        },
    },
];

export const ALCHEMIST_SKILLS = [
    // ── Level 1 ──────────────────────────────────────────────────────────────
    // HEALING PATH
    {
        id: 'healing_potion',
        name: 'Healing Potion',
        description: 'Heal target 3 HP. Everyone affected drinks a shot.',
        class: 'alchemist',
        levelRequired: 1,
        type: 'ability',
        ability: {
            cost: 2,
            targetType: 'manual',
            hits: 1,
            effects: [{ type: 'heal', amount: 3 }],
            selfEffects: [],
        },
    },
    // AP BATTERY PATH
    {
        id: 'energize',
        name: 'Energize',
        description: 'Target ally gains 2 AP. They drink a beer.',
        class: 'alchemist',
        levelRequired: 1,
        type: 'ability',
        ability: {
            cost: 1,
            targetType: 'manual',
            hits: 1,
            effects: [{ type: 'modifyAP', amount: 2 }],
            selfEffects: [],
        },
    },
    // DEBUFF PATH (floating)
    {
        id: 'brew_mastery',
        name: 'Brew Mastery',
        description: 'Your heals restore 1 extra HP.',
        class: 'alchemist',
        levelRequired: 1,
        type: 'passive',
        passive: {
            trigger: 'always',
            effect: { type: 'healBonus', amount: 1 },
        },
    },
    // ── Level 3 ──────────────────────────────────────────────────────────────
    // HEALING PATH
    {
        id: 'mass_heal',
        name: 'Mass Heal',
        description: 'Heal all party 2 HP. A round of shots!',
        class: 'alchemist',
        levelRequired: 3,
        requires: 'healing_potion',
        type: 'ability',
        ability: {
            cost: 3,
            targetType: 'allParty',
            hits: 1,
            effects: [{ type: 'heal', amount: 2 }],
            selfEffects: [],
        },
    },
    // AP BATTERY PATH
    {
        id: 'adrenaline_shot',
        name: 'Adrenaline Shot',
        description: 'Target ally gains 3 AP but takes 1 damage. Strong stuff.',
        class: 'alchemist',
        levelRequired: 3,
        requires: 'energize',
        type: 'ability',
        ability: {
            cost: 1,
            targetType: 'manual',
            hits: 1,
            effects: [
                { type: 'modifyAP', amount: 3 },
                { type: 'damage', amount: 1 },
            ],
            selfEffects: [],
        },
    },
    // DEBUFF PATH (floating)
    {
        id: 'blinding_powder',
        name: 'Blinding Powder',
        description: 'Throw powder at boss. Dexterity -10. 1 use per fight.',
        class: 'alchemist',
        levelRequired: 3,
        type: 'ability',
        ability: {
            cost: 2,
            targetType: 'allEnemies',
            hits: 1,
            effects: [{ type: 'modifyAttribute', amount: -10, attribute: 'dexterity' }],
            selfEffects: [],
            maxUses: 1,
        },
    },
    // ── Level 5 ──────────────────────────────────────────────────────────────
    // HEALING PATH
    {
        id: 'elixir_of_life',
        name: 'Elixir of Life',
        description: 'Revive dead ally at 4 HP. Costs a shot of the strong stuff.',
        class: 'alchemist',
        levelRequired: 5,
        requires: 'mass_heal',
        type: 'ability',
        ability: {
            cost: 3,
            targetType: 'manual',
            hits: 1,
            effects: [{ type: 'revive', amount: 4 }],
            selfEffects: [],
        },
    },
    // AP BATTERY PATH
    {
        id: 'haste_potion',
        name: 'Haste Potion',
        description: 'All party gain 1 AP. A round of beers!',
        class: 'alchemist',
        levelRequired: 5,
        requires: 'adrenaline_shot',
        type: 'ability',
        ability: {
            cost: 3,
            targetType: 'allParty',
            hits: 1,
            effects: [{ type: 'modifyAP', amount: 1 }],
            selfEffects: [],
        },
    },
    // DEBUFF PATH (floating)
    {
        id: 'acid_flask',
        name: 'Acid Flask',
        description: '3 piercing damage + reduce target evasiveness by 10.',
        class: 'alchemist',
        levelRequired: 5,
        type: 'ability',
        ability: {
            cost: 2,
            targetType: 'manual',
            hits: 1,
            effects: [
                { type: 'damage', amount: 3, piercing: true },
                { type: 'modifyAttribute', amount: -10, attribute: 'evasiveness' },
            ],
            selfEffects: [],
        },
    },
    {
        id: 'weakening_toxin',
        name: 'Weakening Toxin',
        description: 'Reduce boss power by 1. 1 use per fight.',
        class: 'alchemist',
        levelRequired: 5,
        type: 'ability',
        ability: {
            cost: 2,
            targetType: 'allEnemies',
            hits: 1,
            effects: [{ type: 'modifyAttribute', amount: -1, attribute: 'power' }],
            selfEffects: [],
            maxUses: 1,
        },
    },
    // ── Level 7 ──────────────────────────────────────────────────────────────
    // HEALING PATH
    {
        id: 'panacea',
        name: 'Panacea',
        description: 'Heal target to full HP.',
        class: 'alchemist',
        levelRequired: 7,
        requires: 'elixir_of_life',
        type: 'ability',
        ability: {
            cost: 3,
            targetType: 'manual',
            hits: 1,
            effects: [{ type: 'heal', amount: 999 }],
            selfEffects: [],
        },
    },
    // AP BATTERY PATH
    {
        id: 'philosophers_stone',
        name: "Philosopher's Stone",
        description: 'All party +1 AP on first turn of each fight.',
        class: 'alchemist',
        levelRequired: 7,
        requires: 'haste_potion',
        type: 'passive',
        passive: {
            trigger: 'onFightStart',
            effect: { type: 'restoreAP', amount: 1 },
        },
    },
    // DEBUFF PATH
    {
        id: 'blinding_powder_2',
        name: 'Blinding Powder II',
        description: 'Boss dexterity -10. Upgrades to 3 uses per fight.',
        class: 'alchemist',
        levelRequired: 7,
        requires: 'blinding_powder',
        type: 'ability',
        ability: {
            cost: 2,
            targetType: 'allEnemies',
            hits: 1,
            effects: [{ type: 'modifyAttribute', amount: -10, attribute: 'dexterity' }],
            selfEffects: [],
            maxUses: 3,
        },
    },
];

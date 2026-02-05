import { SkillNode } from '../types/game.js';

export const WARRIOR_SKILLS: SkillNode[] = [
  // Level 1
  {
    id: 'power_strike',
    name: 'Power Strike',
    description: '15 damage to target.',
    class: 'warrior',
    levelRequired: 1,
    type: 'ability',
    ability: {
      cost: 2,
      targetType: 'manual',
      hits: 1,
      effects: [{ type: 'damage', amount: 15 }],
      selfEffects: [],
    },
  },
  {
    id: 'flurry',
    name: 'Flurry',
    description: '4 hits, 4 damage each (random targets).',
    class: 'warrior',
    levelRequired: 1,
    type: 'ability',
    ability: {
      cost: 3,
      targetType: 'random',
      hits: 4,
      effects: [{ type: 'damage', amount: 4 }],
      selfEffects: [],
    },
  },
  {
    id: 'battle_cry',
    name: 'Battle Cry',
    description: 'First attack each fight deals +5 damage.',
    class: 'warrior',
    levelRequired: 1,
    type: 'passive',
    passive: {
      trigger: 'onFightStart',
      effect: { type: 'modifyDamage', amount: 5 },
    },
  },

  // Level 3
  {
    id: 'crushing_blow',
    name: 'Crushing Blow',
    description: '20 damage, target loses 1 AP.',
    class: 'warrior',
    levelRequired: 3,
    requires: 'power_strike',
    type: 'ability',
    ability: {
      cost: 3,
      targetType: 'manual',
      hits: 1,
      effects: [
        { type: 'damage', amount: 20 },
        { type: 'modifyAP', amount: -1 },
      ],
      selfEffects: [],
    },
  },
  {
    id: 'whirlwind',
    name: 'Whirlwind',
    description: '8 damage to all enemies.',
    class: 'warrior',
    levelRequired: 3,
    requires: 'flurry',
    type: 'ability',
    ability: {
      cost: 3,
      targetType: 'allEnemies',
      hits: 1,
      effects: [{ type: 'damage', amount: 8 }],
      selfEffects: [],
    },
  },
  {
    id: 'bloodlust',
    name: 'Bloodlust',
    description: 'Killing an enemy restores 2 AP.',
    class: 'warrior',
    levelRequired: 3,
    type: 'passive',
    passive: {
      trigger: 'onKill',
      effect: { type: 'restoreAP', amount: 2 },
    },
  },

  // Level 5
  {
    id: 'execute',
    name: 'Execute',
    description: '30 damage to target below 25% HP, else 10.',
    class: 'warrior',
    levelRequired: 5,
    requires: 'crushing_blow',
    type: 'ability',
    ability: {
      cost: 3,
      targetType: 'manual',
      hits: 1,
      effects: [{ type: 'damage', amount: 30 }], // conditional handled by engine
      selfEffects: [],
    },
  },
  {
    id: 'blade_storm',
    name: 'Blade Storm',
    description: '6 hits, 5 damage each (all random).',
    class: 'warrior',
    levelRequired: 5,
    requires: 'whirlwind',
    type: 'ability',
    ability: {
      cost: 4,
      targetType: 'random',
      hits: 6,
      effects: [{ type: 'damage', amount: 5 }],
      selfEffects: [],
    },
  },
  {
    id: 'vampiric_strike',
    name: 'Vampiric Strike',
    description: '12 damage, heal self for 6.',
    class: 'warrior',
    levelRequired: 5,
    requires: 'bloodlust',
    type: 'ability',
    ability: {
      cost: 3,
      targetType: 'manual',
      hits: 1,
      effects: [{ type: 'damage', amount: 12 }],
      selfEffects: [{ type: 'heal', amount: 6 }],
    },
  },

  // Level 7
  {
    id: 'decimator',
    name: 'Decimator',
    description: 'Execute threshold increased to 40% HP.',
    class: 'warrior',
    levelRequired: 7,
    requires: 'execute',
    type: 'passive',
    passive: {
      trigger: 'always',
      effect: { type: 'modifyDamage', amount: 0 }, // special flag for execute
    },
  },
  {
    id: 'berserker_rage',
    name: 'Berserker Rage',
    description: 'Next 3 attacks deal double damage.',
    class: 'warrior',
    levelRequired: 7,
    requires: 'blade_storm',
    type: 'ability',
    ability: {
      cost: 4,
      targetType: 'self',
      hits: 1,
      effects: [],
      selfEffects: [{ type: 'modifyAP', amount: 0 }], // buff handled by engine
    },
  },
];

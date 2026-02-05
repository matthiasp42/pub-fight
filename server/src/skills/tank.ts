import { SkillNode } from '../types/game.js';

export const TANK_SKILLS: SkillNode[] = [
  // Level 1
  {
    id: 'taunt',
    name: 'Taunt',
    description: 'Force enemies to target you. Gain 3 shield.',
    class: 'tank',
    levelRequired: 1,
    type: 'ability',
    ability: {
      cost: 2,
      targetType: 'self',
      hits: 1,
      effects: [],
      selfEffects: [{ type: 'addShield', amount: 3 }],
    },
  },
  {
    id: 'shield_bash',
    name: 'Shield Bash',
    description: 'Deal 6 damage + stun (skip target\'s next turn).',
    class: 'tank',
    levelRequired: 1,
    type: 'ability',
    ability: {
      cost: 2,
      targetType: 'manual',
      hits: 1,
      effects: [{ type: 'damage', amount: 6 }],
      selfEffects: [],
    },
  },
  {
    id: 'iron_skin',
    name: 'Iron Skin',
    description: 'All damage taken reduced by 2.',
    class: 'tank',
    levelRequired: 1,
    type: 'passive',
    passive: {
      trigger: 'always',
      effect: { type: 'damageReduction', amount: 2 },
    },
  },

  // Level 3
  {
    id: 'shield_wall',
    name: 'Shield Wall',
    description: 'All party members gain 2 shield.',
    class: 'tank',
    levelRequired: 3,
    requires: 'taunt',
    type: 'ability',
    ability: {
      cost: 3,
      targetType: 'allParty',
      hits: 1,
      effects: [{ type: 'addShield', amount: 2 }],
      selfEffects: [],
    },
  },
  {
    id: 'fortress',
    name: 'Fortress',
    description: 'Gain 5 shield.',
    class: 'tank',
    levelRequired: 3,
    requires: 'iron_skin',
    type: 'ability',
    ability: {
      cost: 2,
      targetType: 'self',
      hits: 1,
      effects: [],
      selfEffects: [{ type: 'addShield', amount: 5 }],
    },
  },
  {
    id: 'counter_stance',
    name: 'Counter Stance',
    description: 'When hit, deal 3 damage back to attacker.',
    class: 'tank',
    levelRequired: 3,
    type: 'passive',
    passive: {
      trigger: 'onTakeDamage',
      effect: { type: 'reflectDamage', amount: 3 },
    },
  },

  // Level 5
  {
    id: 'unbreakable_wall',
    name: 'Unbreakable Wall',
    description: 'All party gain 4 shield + you gain 3.',
    class: 'tank',
    levelRequired: 5,
    requires: 'shield_wall',
    type: 'ability',
    ability: {
      cost: 4,
      targetType: 'allParty',
      hits: 1,
      effects: [{ type: 'addShield', amount: 4 }],
      selfEffects: [{ type: 'addShield', amount: 3 }],
    },
  },
  {
    id: 'thorns',
    name: 'Thorns',
    description: 'Reflected damage increased to 6.',
    class: 'tank',
    levelRequired: 5,
    requires: 'counter_stance',
    type: 'passive',
    passive: {
      trigger: 'onTakeDamage',
      effect: { type: 'reflectDamage', amount: 6 },
    },
  },
  {
    id: 'last_stand',
    name: 'Last Stand',
    description: 'Below 25% HP: shield gains doubled.',
    class: 'tank',
    levelRequired: 5,
    requires: 'iron_skin',
    type: 'passive',
    passive: {
      trigger: 'always',
      effect: {
        type: 'modifyShieldGain',
        amount: 2, // multiplier
        condition: { hpBelow: 25 },
      },
    },
  },

  // Level 7
  {
    id: 'titans_resolve',
    name: "Titan's Resolve",
    description: 'Shield capacity +3, shield strength +2.',
    class: 'tank',
    levelRequired: 7,
    requires: 'fortress',
    type: 'passive',
    passive: {
      trigger: 'always',
      effect: { type: 'modifyShieldCapacity', amount: 3 },
    },
  },
  {
    id: 'undying',
    name: 'Undying',
    description: 'Once per fight: survive killing blow with 1 HP.',
    class: 'tank',
    levelRequired: 7,
    requires: 'last_stand',
    type: 'passive',
    passive: {
      trigger: 'onFatalDamage',
      effect: { type: 'surviveFatal' },
    },
  },
];

import { SkillNode } from '../types/game.js';

export const TANK_SKILLS: SkillNode[] = [
  // ── Level 1 ──────────────────────────────────────────────────────────────
  {
    id: 'taunt',
    name: 'Taunt',
    description: 'Brace for impact. Gain 2 shield.',
    class: 'tank',
    levelRequired: 1,
    type: 'ability',
    ability: {
      cost: 1,
      targetType: 'self',
      hits: 1,
      effects: [],
      selfEffects: [{ type: 'addShield', amount: 2 }],
    },
  },
  {
    id: 'iron_skin',
    name: 'Iron Skin',
    description: 'All damage taken reduced by 1.',
    class: 'tank',
    levelRequired: 1,
    type: 'passive',
    passive: {
      trigger: 'always',
      effect: { type: 'damageReduction', amount: 1 },
    },
  },
  {
    id: 'counter_stance',
    name: 'Counter Stance',
    description: 'When hit, deal 1 damage back to attacker.',
    class: 'tank',
    levelRequired: 1,
    type: 'passive',
    passive: {
      trigger: 'onTakeDamage',
      effect: { type: 'reflectDamage', amount: 1 },
    },
  },

  // ── Level 3 ──────────────────────────────────────────────────────────────
  {
    id: 'provoke',
    name: 'Provoke',
    description: 'You become the biggest target. Evasiveness -20.',
    class: 'tank',
    levelRequired: 3,
    type: 'passive',
    passive: {
      trigger: 'always',
      effect: { type: 'provoke', amount: -20 },
    },
  },
  {
    id: 'shield_wall',
    name: 'Shield Wall',
    description: 'All party members gain 1 shield.',
    class: 'tank',
    levelRequired: 3,
    requires: 'taunt',
    type: 'ability',
    ability: {
      cost: 2,
      targetType: 'allParty',
      hits: 1,
      effects: [{ type: 'addShield', amount: 1 }],
      selfEffects: [],
    },
  },
  {
    id: 'fortress',
    name: 'Fortress',
    description: 'Gain 3 shield.',
    class: 'tank',
    levelRequired: 3,
    requires: 'iron_skin',
    type: 'ability',
    ability: {
      cost: 2,
      targetType: 'self',
      hits: 1,
      effects: [],
      selfEffects: [{ type: 'addShield', amount: 3 }],
    },
  },

  // ── Level 5 ──────────────────────────────────────────────────────────────
  {
    id: 'unbreakable_wall',
    name: 'Unbreakable Wall',
    description: 'All party gain 2 shield + you gain 1 extra.',
    class: 'tank',
    levelRequired: 5,
    requires: 'shield_wall',
    type: 'ability',
    ability: {
      cost: 3,
      targetType: 'allParty',
      hits: 1,
      effects: [{ type: 'addShield', amount: 2 }],
      selfEffects: [{ type: 'addShield', amount: 1 }],
    },
  },
  {
    id: 'thorns',
    name: 'Thorns',
    description: 'When hit, deal 2 damage back to attacker.',
    class: 'tank',
    levelRequired: 5,
    requires: 'counter_stance',
    type: 'passive',
    passive: {
      trigger: 'onTakeDamage',
      effect: { type: 'reflectDamage', amount: 2 },
    },
  },
  {
    id: 'last_stand',
    name: 'Last Stand',
    description: 'Below 25% HP: shield gains doubled.',
    class: 'tank',
    levelRequired: 5,
    type: 'passive',
    passive: {
      trigger: 'always',
      effect: {
        type: 'modifyShieldGain',
        amount: 2,
        condition: { hpBelow: 25 },
      },
    },
  },

  // ── Level 7 ──────────────────────────────────────────────────────────────
  {
    id: 'titans_resolve',
    name: "Titan's Resolve",
    description: 'Shield capacity +2, shield strength +1.',
    class: 'tank',
    levelRequired: 7,
    requires: 'fortress',
    type: 'passive',
    passive: {
      trigger: 'always',
      effect: { type: 'modifyShieldCapacity', amount: 2 },
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

import { SkillNode } from '../types/game.js';

export const WIZARD_SKILLS: SkillNode[] = [
  // ── Level 1 ──────────────────────────────────────────────────────────────

  // PRECISION PATH
  {
    id: 'arcane_bolt',
    name: 'Arcane Bolt',
    description: '2 damage to chosen target.',
    class: 'wizard',
    levelRequired: 1,
    type: 'ability',
    ability: {
      cost: 1,
      targetType: 'manual',
      hits: 1,
      effects: [{ type: 'damage', amount: 2 }],
      selfEffects: [],
    },
  },

  // AoE BLASTER PATH
  {
    id: 'fireball',
    name: 'Fireball',
    description: '1 damage to all enemies.',
    class: 'wizard',
    levelRequired: 1,
    type: 'ability',
    ability: {
      cost: 2,
      targetType: 'allEnemies',
      hits: 1,
      effects: [{ type: 'damage', amount: 1 }],
      selfEffects: [],
    },
  },

  // UTILITY (floating)
  {
    id: 'glass_cannon',
    name: 'Glass Cannon',
    description: 'All your abilities deal +1 damage, but you take +1 from all attacks.',
    class: 'wizard',
    levelRequired: 1,
    type: 'passive',
    passive: {
      trigger: 'always',
      effect: { type: 'glassCannon', amount: 1 },
    },
  },

  // ── Level 3 ──────────────────────────────────────────────────────────────

  // PRECISION (floating)
  {
    id: 'chain_lightning',
    name: 'Chain Lightning',
    description: '3 hits, 1 damage each (random targets).',
    class: 'wizard',
    levelRequired: 3,
    type: 'ability',
    ability: {
      cost: 2,
      targetType: 'random',
      hits: 3,
      effects: [{ type: 'damage', amount: 1 }],
      selfEffects: [],
    },
  },

  // AoE BLASTER
  {
    id: 'inferno',
    name: 'Inferno',
    description: '2 damage to all enemies.',
    class: 'wizard',
    levelRequired: 3,
    requires: 'fireball',
    type: 'ability',
    ability: {
      cost: 3,
      targetType: 'allEnemies',
      hits: 1,
      effects: [{ type: 'damage', amount: 2 }],
      selfEffects: [],
    },
  },

  // UTILITY (floating)
  {
    id: 'frost_armor',
    name: 'Frost Armor',
    description: 'Attackers take 1 damage when they hit you.',
    class: 'wizard',
    levelRequired: 3,
    type: 'passive',
    passive: {
      trigger: 'onTakeDamage',
      effect: { type: 'reflectDamage', amount: 1 },
    },
  },

  // ── Level 5 ──────────────────────────────────────────────────────────────

  // PRECISION — targeting upgrade from Chain Lightning
  {
    id: 'thunderbolt',
    name: 'Thunderbolt',
    description: '3 hits, 1 damage each (choose target).',
    class: 'wizard',
    levelRequired: 5,
    requires: 'chain_lightning',
    type: 'ability',
    ability: {
      cost: 2,
      targetType: 'manual',
      hits: 3,
      effects: [{ type: 'damage', amount: 1 }],
      selfEffects: [],
    },
  },

  // AoE BLASTER
  {
    id: 'meteor',
    name: 'Meteor',
    description: '5 damage to one target.',
    class: 'wizard',
    levelRequired: 5,
    requires: 'inferno',
    type: 'ability',
    ability: {
      cost: 4,
      targetType: 'manual',
      hits: 1,
      effects: [{ type: 'damage', amount: 5 }],
      selfEffects: [],
    },
  },

  // UTILITY (floating)
  {
    id: 'arcane_mastery',
    name: 'Arcane Mastery',
    description: 'All abilities cost 1 less AP (min 1).',
    class: 'wizard',
    levelRequired: 5,
    type: 'passive',
    passive: {
      trigger: 'always',
      effect: { type: 'modifyAbilityCost', amount: -1 },
    },
  },

  // ── Level 7 ──────────────────────────────────────────────────────────────

  // AoE BLASTER
  {
    id: 'cataclysm',
    name: 'Cataclysm',
    description: '3 piercing damage to all enemies.',
    class: 'wizard',
    levelRequired: 7,
    requires: 'meteor',
    type: 'ability',
    ability: {
      cost: 4,
      targetType: 'allEnemies',
      hits: 1,
      effects: [{ type: 'damage', amount: 3, piercing: true }],
      selfEffects: [],
    },
  },

  // UTILITY (floating) — super Rest
  {
    id: 'time_warp',
    name: 'Time Warp',
    description: 'Gain 4 AP immediately.',
    class: 'wizard',
    levelRequired: 7,
    type: 'ability',
    ability: {
      cost: 2,
      targetType: 'self',
      hits: 1,
      effects: [],
      selfEffects: [{ type: 'modifyAP', amount: 4 }],
    },
  },
];

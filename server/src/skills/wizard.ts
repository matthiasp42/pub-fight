import { SkillNode } from '../types/game.js';

export const WIZARD_SKILLS: SkillNode[] = [
  // Level 1
  {
    id: 'arcane_bolt',
    name: 'Arcane Bolt',
    description: '10 damage to target.',
    class: 'wizard',
    levelRequired: 1,
    type: 'ability',
    ability: {
      cost: 2,
      targetType: 'manual',
      hits: 1,
      effects: [{ type: 'damage', amount: 10 }],
      selfEffects: [],
    },
  },
  {
    id: 'fireball',
    name: 'Fireball',
    description: '8 damage to all enemies.',
    class: 'wizard',
    levelRequired: 1,
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
    id: 'mana_shield',
    name: 'Mana Shield',
    description: 'Spend 2 AP to negate 10 damage.',
    class: 'wizard',
    levelRequired: 1,
    type: 'passive',
    passive: {
      trigger: 'onTakeDamage',
      effect: { type: 'damageReduction', amount: 10 },
    },
  },

  // Level 3
  {
    id: 'chain_lightning',
    name: 'Chain Lightning',
    description: '6 damage, hits 3 random enemies.',
    class: 'wizard',
    levelRequired: 3,
    requires: 'arcane_bolt',
    type: 'ability',
    ability: {
      cost: 3,
      targetType: 'random',
      hits: 3,
      effects: [{ type: 'damage', amount: 6 }],
      selfEffects: [],
    },
  },
  {
    id: 'inferno',
    name: 'Inferno',
    description: '12 damage to all enemies.',
    class: 'wizard',
    levelRequired: 3,
    requires: 'fireball',
    type: 'ability',
    ability: {
      cost: 4,
      targetType: 'allEnemies',
      hits: 1,
      effects: [{ type: 'damage', amount: 12 }],
      selfEffects: [],
    },
  },
  {
    id: 'frost_armor',
    name: 'Frost Armor',
    description: 'Attackers take 4 damage.',
    class: 'wizard',
    levelRequired: 3,
    requires: 'mana_shield',
    type: 'passive',
    passive: {
      trigger: 'onTakeDamage',
      effect: { type: 'reflectDamage', amount: 4 },
    },
  },

  // Level 5
  {
    id: 'thunderstorm',
    name: 'Thunderstorm',
    description: '5 damage, hits ALL enemies 2x.',
    class: 'wizard',
    levelRequired: 5,
    requires: 'chain_lightning',
    type: 'ability',
    ability: {
      cost: 5,
      targetType: 'allEnemies',
      hits: 2,
      effects: [{ type: 'damage', amount: 5 }],
      selfEffects: [],
    },
  },
  {
    id: 'meteor',
    name: 'Meteor',
    description: '20 damage to one target, 8 to all others.',
    class: 'wizard',
    levelRequired: 5,
    requires: 'inferno',
    type: 'ability',
    ability: {
      cost: 5,
      targetType: 'manual',
      hits: 1,
      effects: [{ type: 'damage', amount: 20 }],
      selfEffects: [],
    },
  },
  {
    id: 'arcane_mastery',
    name: 'Arcane Mastery',
    description: 'All abilities cost 1 less AP.',
    class: 'wizard',
    levelRequired: 5,
    type: 'passive',
    passive: {
      trigger: 'always',
      effect: { type: 'modifyAbilityCost', amount: -1 },
    },
  },

  // Level 7
  {
    id: 'cataclysm',
    name: 'Cataclysm',
    description: '15 damage to all enemies, piercing.',
    class: 'wizard',
    levelRequired: 7,
    requires: 'meteor',
    type: 'ability',
    ability: {
      cost: 6,
      targetType: 'allEnemies',
      hits: 1,
      effects: [{ type: 'damage', amount: 15, piercing: true }],
      selfEffects: [],
    },
  },
  {
    id: 'time_stop',
    name: 'Time Stop',
    description: 'Take 2 extra turns.',
    class: 'wizard',
    levelRequired: 7,
    requires: 'arcane_mastery',
    type: 'ability',
    ability: {
      cost: 6,
      targetType: 'self',
      hits: 1,
      effects: [],
      selfEffects: [{ type: 'modifyAP', amount: 0 }], // special effect handled by engine
    },
  },
];

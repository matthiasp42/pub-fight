export type TargetType = 'self' | 'manual' | 'random' | 'allParty' | 'allEnemies';
export type EffectType = 'damage' | 'heal' | 'addShield' | 'modifyAP';
export type CharacterClass = 'tank' | 'alchemist' | 'wizard' | 'warrior';

export interface Effect {
  type: EffectType;
  amount: number;
  piercing?: boolean;
}

export type PassiveTrigger =
  | 'always'
  | 'onHit'
  | 'onTakeDamage'
  | 'onLowHP'
  | 'onTurnStart'
  | 'onKill'
  | 'onFightStart'
  | 'onFatalDamage';

export type PassiveEffectType =
  | 'damageReduction'
  | 'reflectDamage'
  | 'modifyShieldGain'
  | 'modifyDamage'
  | 'restoreAP'
  | 'modifyAbilityCost'
  | 'modifyMaxAP'
  | 'modifyShieldCapacity'
  | 'modifyShieldStrength'
  | 'surviveFatal';

export interface PassiveEffect {
  type: PassiveEffectType;
  amount?: number;
  condition?: {
    hpBelow?: number; // percentage (e.g., 25 for 25%)
  };
}

export interface AbilityData {
  cost: number;
  targetType: TargetType;
  hits: number;
  effects: Effect[];
  selfEffects: Effect[];
}

export interface PassiveData {
  trigger: PassiveTrigger;
  effect: PassiveEffect;
}

export interface SkillNode {
  id: string;
  name: string;
  description: string;
  class: CharacterClass;
  levelRequired: number; // 1, 3, 5, or 7
  requires?: string; // ID of prerequisite skill (optional)
  type: 'ability' | 'passive';
  ability?: AbilityData;
  passive?: PassiveData;
}

// Utility type for validating skill data
export interface SkillTreeValidation {
  class: CharacterClass;
  skills: SkillNode[];
}

export type TargetType = 'self' | 'manual' | 'random' | 'allParty' | 'allEnemies';
export type EffectType = 'damage' | 'heal' | 'addShield' | 'modifyAP';
export type CharacterClass = 'tank' | 'alchemist' | 'wizard' | 'warrior';
export interface Effect {
    type: EffectType;
    amount: number;
    piercing?: boolean;
}
export type PassiveTrigger = 'always' | 'onHit' | 'onTakeDamage' | 'onLowHP' | 'onTurnStart' | 'onKill' | 'onFightStart' | 'onFatalDamage';
export type PassiveEffectType = 'damageReduction' | 'reflectDamage' | 'modifyShieldGain' | 'modifyDamage' | 'restoreAP' | 'modifyAbilityCost' | 'modifyMaxAP' | 'modifyShieldCapacity' | 'modifyShieldStrength' | 'surviveFatal';
export interface PassiveEffect {
    type: PassiveEffectType;
    amount?: number;
    condition?: {
        hpBelow?: number;
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
    levelRequired: number;
    requires?: string;
    type: 'ability' | 'passive';
    ability?: AbilityData;
    passive?: PassiveData;
}
export interface SkillTreeValidation {
    class: CharacterClass;
    skills: SkillNode[];
}

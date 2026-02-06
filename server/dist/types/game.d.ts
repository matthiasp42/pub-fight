export type TargetType = 'self' | 'manual' | 'random' | 'allParty' | 'allEnemies';
export type EffectType = 'damage' | 'heal' | 'addShield' | 'modifyAP' | 'spawnMinion' | 'removeShield' | 'revive' | 'modifyAttribute';
export type CharacterClass = 'tank' | 'alchemist' | 'wizard' | 'warrior';
export type BossArchetype = 'swarmMaster' | 'executioner' | 'devastator' | 'tankBuster' | 'tempoManipulator' | 'regenerator' | 'hybridNightmare';
export type GamePhase = 'lobby' | 'map' | 'fight' | 'levelup' | 'victory';
export interface Effect {
    type: EffectType;
    amount: number;
    piercing?: boolean;
    drain?: boolean;
    minionCount?: number;
    attribute?: string;
}
export type PassiveTrigger = 'always' | 'onHit' | 'onTakeDamage' | 'onLowHP' | 'onTurnStart' | 'onKill' | 'onFightStart' | 'onFatalDamage';
export type PassiveEffectType = 'damageReduction' | 'reflectDamage' | 'modifyShieldGain' | 'modifyDamage' | 'restoreAP' | 'modifyAbilityCost' | 'modifyMaxAP' | 'modifyShieldCapacity' | 'modifyShieldStrength' | 'surviveFatal' | 'precision' | 'provoke' | 'glassCannon' | 'healBonus' | 'secondWind' | 'gainShield';
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
    maxUses?: number;
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
export interface CharacterAttributes {
    maxHealth: number;
    maxAP: number;
    power: number;
    shieldCapacity: number;
    shieldStrength: number;
    dexterity: number;
    evasiveness: number;
}
export interface BossAbility {
    id: string;
    name: string;
    cost: number;
    targetType: TargetType;
    hits: number;
    effects: Effect[];
    selfEffects: Effect[];
    special?: 'spawnMinion' | 'spawnMinion2' | 'requiresMark';
}
export interface MinionDefinition {
    name: string;
    attributes: CharacterAttributes;
}
export interface BossDefinition {
    id: string;
    name: string;
    level: number;
    archetype: BossArchetype;
    attributes: CharacterAttributes;
    abilities: BossAbility[];
    minion?: MinionDefinition;
}
export interface PlayerCharacter {
    id: string;
    name: string;
    class: CharacterClass;
    level: number;
    attributePoints: number;
    perkPoints: number;
    ownedSkillIds: string[];
    attributes: CharacterAttributes;
    baseAttributes: CharacterAttributes;
    controlledBy: string | null;
}
export interface DungeonDefinition {
    id: string;
    bossId: string;
    level: number;
    name: string;
    lat: number;
    lng: number;
    radiusMeters: number;
}
export interface GameState {
    version: number;
    phase: GamePhase;
    clearedDungeons: string[];
    activeDungeonId: string | null;
    fightState: any | null;
    fightVersion: number;
    players: Record<string, PlayerCharacter>;
}

export type TargetType = 'self' | 'manual' | 'random' | 'allParty' | 'allEnemies';
export type EffectType = 'damage' | 'heal' | 'addShield' | 'modifyAP' | 'spawnMinion' | 'removeShield' | 'revive' | 'modifyAttribute';
export type CharacterClass = 'tank' | 'alchemist' | 'wizard' | 'warrior';
export type BossArchetype = 'swarmMaster' | 'executioner' | 'devastator' | 'tankBuster' | 'tempoManipulator' | 'regenerator' | 'hybridNightmare';
export type GamePhase = 'lobby' | 'map' | 'fight' | 'levelup' | 'victory';

export interface Effect {
  type: EffectType;
  amount: number;
  piercing?: boolean;
  drain?: boolean; // For heal effects: heal equals damage dealt
  minionCount?: number; // For spawnMinion effects: number of minions to spawn
  attribute?: string; // For modifyAttribute effects: which attribute to change
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
  | 'surviveFatal'
  | 'precision'
  | 'provoke'
  | 'glassCannon'
  | 'healBonus'
  | 'secondWind'
  | 'gainShield';

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
  maxUses?: number; // once-per-fight abilities
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

// Boss-specific types
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

export interface LevelupSnapshot {
  attributes: CharacterAttributes;
  ownedSkillIds: string[];
  attributePoints: number;
  perkPoints: number;
}

export interface GameState {
  version: number;
  phase: GamePhase;
  clearedDungeons: string[];
  activeDungeonId: string | null;
  fightState: any | null;
  fightVersion: number;
  players: Record<string, PlayerCharacter>;
  levelupSnapshots?: Record<string, LevelupSnapshot>;
}

export interface GameInstance {
  gameCode: string;
  gameState: GameState;
  dungeons: DungeonDefinition[];
  createdAt: number;
  lastActivity: number;
}

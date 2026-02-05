# Pub Fight Game Bible

## Abstract

Web App Mobile Game that is hosted on Railway.

## State Management and Communication

## Gameplay

This is a bit of a Dungeon Crawler. The Real Life group moves from pub to pub. Each pub they encounter a Boss they need
to fight.

TOOD For now we just implement a simple fight. No movements between the levels etc.

### Players

When people log in they can choose a name and a player Class.

Each character has:

- Health
- Action Points
- Level
- Shield (current shield points)

#### Level

Characters gain a level after each boss kill (7 levels total = 7 fights). On level up:
- Gain 3 attribute points to distribute among stats
- Gain 1 perk point to spend on the skill tree

### Skill Tree

Each class has a skill tree with ~11 skills split between **abilities** (active actions) and **passives** (always-on effects).

#### Unlocking Skills

- Skills unlock at level tiers: 1, 3, 5, 7
- Some skills require a prerequisite skill (chains like Fireball → Inferno → Meteor)
- Every skill costs exactly **1 perk point**
- You get **1 perk point per level** (7 levels = 7 points total)
- You can buy any skill where you meet the level requirement AND have the prerequisite (if any)

#### Skill Types

**Abilities** follow the Action Model - they have an AP cost, target type, and effects. Unlocked abilities appear in your action bar during fights.

**Passives** are always-on effects with triggers:
- `always` - permanent stat modifier (e.g., "All damage taken reduced by 2")
- `onTakeDamage` - triggers when hit (e.g., "Reflect 3 damage to attacker")
- `onKill` - triggers on killing blow (e.g., "Restore 2 AP")
- `onFightStart` - triggers at fight start (e.g., "Start with +3 AP")
- `onFatalDamage` - triggers when you'd die (e.g., "Survive with 1 HP once per fight")

#### Build Variety

Players won't unlock all 11 skills - with 7 points you must choose. Different players of the same class can have very different builds based on which chains they invest in.

### Player Attributes

1. Max Health
   More health points means you live longer.
2. Max Action Points
   Action points let you do more things in a fight.
3. Strength
   Modifier on your standard damage or your abilities.
4. Shield Capacity
   Maximum number of shield points you can have.
5. Shield Strength
   How much damage each shield point can absorb (see Shield Mechanics below).
6. Dexterity
   Offense accuracy. Determines the size of empty/friendly-fire sectors on the Attack Aim Wheel. Higher dexterity = more likely to hit your intended target.
7. Evasiveness
   Defense stat. Determines how small your sector is on the Attack Aim Wheel. Higher evasiveness = harder to be hit.

### Shield Mechanics

Shields act as a damage buffer before health is affected.

- Players start with 0 shield points
- Shield points can be gained via the "Shield Self" action or abilities
- Maximum shield points = Shield Capacity

**Damage Calculation:**
- Each shield point absorbs up to Shield Strength damage
- Any attack destroys at least 1 shield point
- Remaining damage after shields are depleted hits Health

**Example:** Shield Strength = 5, current shields = 3, incoming attack = 12
- Shield point 1 absorbs 5 damage (7 remaining)
- Shield point 2 absorbs 5 damage (2 remaining)
- Shield point 3 absorbs 2 damage (0 remaining)
- Result: All 3 shields destroyed, 0 HP damage

**Example:** Shield Strength = 5, current shields = 2, incoming attack = 12
- Shield point 1 absorbs 5 damage (7 remaining)
- Shield point 2 absorbs 5 damage (2 remaining)
- No shields left, 2 damage goes to HP
- Result: All 2 shields destroyed, 2 HP damage

**Piercing Attacks:** Some abilities bypass shields entirely (to be defined per ability).

### Action Model

This defines the atomic mechanic for any action in the game. Every action (common actions, abilities, boss actions) follows this model.

#### Action Definition

```
Action {
  cost: number                  // AP cost, always deducted from actor
  targetType: TargetType        // how targets are selected
  hits: number                  // for 'random': spin wheel N times (default 1)
  effects: Effect[]             // applied to resolved target(s)
  selfEffects: Effect[]         // applied to actor
}

TargetType = 'self' | 'manual' | 'random' | 'allParty' | 'allEnemies'
```

**Target Types:**
- `self` - actor targets themselves
- `manual` - player picks one target
- `random` - Attack Aim Wheel spins (dexterity/evasiveness apply)
- `allParty` - all friendly characters
- `allEnemies` - all hostile characters

#### Effect Types

```
{ type: 'damage', amount: number, piercing?: boolean }
{ type: 'heal', amount: number }
{ type: 'addShield', amount: number }
{ type: 'modifyAP', amount: number }
```

- **damage**: Reduces target HP (goes through shield calculation unless `piercing: true`)
- **heal**: Increases target HP (capped at Max Health)
- **addShield**: Adds shield points (capped at Shield Capacity)
- **modifyAP**: Adds or removes AP (can be negative for debuffs)

#### Action Execution Flow

Pure function: `executeAction(gameState, actor, action) → newGameState`

1. Deduct `action.cost` from actor's AP
2. Resolve targets based on `targetType`:
   - `self` → [actor]
   - `manual` → [selected target]
   - `random` → spin wheel `hits` times → 0 to N targets (misses produce no target)
   - `allParty` / `allEnemies` → all characters in that group
3. Apply `action.effects` to each resolved target
4. Apply `action.selfEffects` to actor
5. Return new game state

**Note:** If the wheel lands on an empty sector (miss), AP is still spent but no effect is applied for that hit.

#### Common Actions as Action Model

**Attack:**
```
{ cost: 1, targetType: 'random', hits: 1, effects: [{ type: 'damage', amount: TBD }], selfEffects: [] }
```

**Rest:**
```
{ cost: 0, targetType: 'self', hits: 1, effects: [], selfEffects: [{ type: 'modifyAP', amount: TBD }] }
```

**Shield Self:**
```
{ cost: 1, targetType: 'self', hits: 1, effects: [], selfEffects: [{ type: 'addShield', amount: TBD }] }
```

#### Example Ability: Vampiric Strike

Damages an enemy and heals self:
```
{
  cost: 2,
  targetType: 'manual',
  hits: 1,
  effects: [{ type: 'damage', amount: 8 }],
  selfEffects: [{ type: 'heal', amount: 4 }]
}
```

#### Example Ability: Flurry (Multi-Attack)

Spins the wheel 4 times, each hit deals damage:
```
{
  cost: 3,
  targetType: 'random',
  hits: 4,
  effects: [{ type: 'damage', amount: 5 }],
  selfEffects: []
}
```

### Classes

There are several classes

- Tank
- Alchemist
- Wizard
- Warrior

### Class Abilities & Perks

See **Skill Tree** section above. Abilities and perks are unlocked via the skill tree using perk points earned on level up.

### Fights

Fights are turn based. Whose turn it is and who is next is indicated by the Turn Bar.

**Turn Order:** Randomized at the start of each fight and remains fixed for the duration of the fight.

In General: Any Character turn will perform an Action that affects the other Characters.

#### Player Status

During a Fight each character status is indicated on their Avatar.

Here's how they work:

##### Health

Players start with their full health. When they get attacked or hurt themselves they lose health.

##### Action Points

Players start with full Action Points. Each Action they take has a cost that comes with it.
How to replenish:

- The Alchemist has actions that replenishes AP of the Party.
- Each Character has a 'Rest' Action that slightly replenishes AP

##### Shield

Players start by default with no shield.

#### Character Turn

Any Character (Party member or enemy) can execute Actions on their turn.
Each action costs Action Points.

#### Player Actions

Players have common actions and then abilities. Abilities are unique to each class.

###### Common Actions

1. Attack
   Launches the Attack Aim Wheel and then deals damage to that Character.
2. Rest
   Replenishes AP.
3. Shield Self (1 AP)
   Grants shield points. Button is disabled when shield is at Shield Capacity.

#### Death

- When a player reaches 0 HP, they are knocked out and sit out the rest of the fight.
- If the entire party is knocked out, the fight is lost. The party leader sees a "Restart Fight" button to try again.

#### Bosses

A Boss has clear playing rules. There are no algorithms or so, each boss has a playbook of actions they do.

##### Boss Actions

- Heal Self
- Heal self and minions
- Attack on Player
- Attack all Players
- Spawn Minion
- Shield self

###### Minions

Minions also show up in the Turn Bar.

When it is the Minions turn they execute one of their Minion Actions.

###### Minion Actions

- Heal Self
- Heal self and other minions and Boss
- Attack on Player
- Attack all Players
- Shield self

## Glossary

### Turn Bar

The bar on the left side of the screen shows the current and which characters next turn it is.

### Player

A human player.

### Character

Either a Player, a Boss or a Minion.

### Attack Aim Wheel

When a player attacks (via ability or standard Attack Action) the wheel spins to determine WHO they hit.

The wheel is divided into sectors:
- **Target sectors:** One for each potential target (enemies, allies, self). Size determined by each character's Evasiveness (higher evasiveness = smaller sector = harder to hit).
- **Empty sectors:** Misses. Size determined by attacker's Dexterity (higher dexterity = smaller empty sectors = fewer misses/misfires).

The attacker's Dexterity affects how much of the wheel is "miss" or "friendly fire" territory.
Each potential target's Evasiveness affects how big their slice of the wheel is.

import { SkillNode, CharacterClass } from '../types/game.js';
import { TANK_SKILLS } from './tank.js';
import { WIZARD_SKILLS } from './wizard.js';
import { ALCHEMIST_SKILLS } from './alchemist.js';
import { WARRIOR_SKILLS } from './warrior.js';

export const ALL_SKILLS: SkillNode[] = [
  ...TANK_SKILLS,
  ...WIZARD_SKILLS,
  ...ALCHEMIST_SKILLS,
  ...WARRIOR_SKILLS,
];

export const SKILLS_BY_CLASS: Record<CharacterClass, SkillNode[]> = {
  tank: TANK_SKILLS,
  wizard: WIZARD_SKILLS,
  alchemist: ALCHEMIST_SKILLS,
  warrior: WARRIOR_SKILLS,
};

export function getSkillById(id: string): SkillNode | undefined {
  return ALL_SKILLS.find((skill) => skill.id === id);
}

export function getSkillsByClass(characterClass: CharacterClass): SkillNode[] {
  return SKILLS_BY_CLASS[characterClass] || [];
}

export { TANK_SKILLS, WIZARD_SKILLS, ALCHEMIST_SKILLS, WARRIOR_SKILLS };

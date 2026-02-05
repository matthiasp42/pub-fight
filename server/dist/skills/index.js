import { TANK_SKILLS } from './tank.js';
import { WIZARD_SKILLS } from './wizard.js';
import { ALCHEMIST_SKILLS } from './alchemist.js';
import { WARRIOR_SKILLS } from './warrior.js';
export const ALL_SKILLS = [
    ...TANK_SKILLS,
    ...WIZARD_SKILLS,
    ...ALCHEMIST_SKILLS,
    ...WARRIOR_SKILLS,
];
export const SKILLS_BY_CLASS = {
    tank: TANK_SKILLS,
    wizard: WIZARD_SKILLS,
    alchemist: ALCHEMIST_SKILLS,
    warrior: WARRIOR_SKILLS,
};
export function getSkillById(id) {
    return ALL_SKILLS.find((skill) => skill.id === id);
}
export function getSkillsByClass(characterClass) {
    return SKILLS_BY_CLASS[characterClass] || [];
}
export { TANK_SKILLS, WIZARD_SKILLS, ALCHEMIST_SKILLS, WARRIOR_SKILLS };

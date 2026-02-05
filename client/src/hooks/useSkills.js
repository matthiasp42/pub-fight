import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';

/**
 * Hook to fetch and manage skills from the server
 * @returns {{
 *   skills: import('../game/types').SkillNode[],
 *   loading: boolean,
 *   error: Error | null,
 *   refetch: () => Promise<void>,
 *   getSkillsForClass: (characterClass: string) => import('../game/types').SkillNode[],
 *   getAvailableSkills: (characterClass: string, level: number, ownedSkillIds: string[]) => import('../game/types').SkillNode[],
 *   canUnlockSkill: (skill: import('../game/types').SkillNode, level: number, ownedSkillIds: string[]) => boolean
 * }}
 */
export function useSkills() {
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSkills = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getSkills();
      setSkills(data);
    } catch (err) {
      setError(err);
      console.error('Failed to fetch skills:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  /**
   * Get all skills for a specific class
   * @param {string} characterClass
   * @returns {import('../game/types').SkillNode[]}
   */
  const getSkillsForClass = useCallback(
    (characterClass) => {
      return skills.filter((skill) => skill.class === characterClass);
    },
    [skills]
  );

  /**
   * Check if a skill can be unlocked
   * @param {import('../game/types').SkillNode} skill
   * @param {number} level - Character's current level
   * @param {string[]} ownedSkillIds - IDs of skills already owned
   * @returns {boolean}
   */
  const canUnlockSkill = useCallback((skill, level, ownedSkillIds) => {
    // Already owned
    if (ownedSkillIds.includes(skill.id)) {
      return false;
    }

    // Level requirement not met
    if (level < skill.levelRequired) {
      return false;
    }

    // Prerequisite not met
    if (skill.requires && !ownedSkillIds.includes(skill.requires)) {
      return false;
    }

    return true;
  }, []);

  /**
   * Get skills that can be unlocked right now
   * @param {string} characterClass
   * @param {number} level
   * @param {string[]} ownedSkillIds
   * @returns {import('../game/types').SkillNode[]}
   */
  const getAvailableSkills = useCallback(
    (characterClass, level, ownedSkillIds) => {
      const classSkills = getSkillsForClass(characterClass);
      return classSkills.filter((skill) => canUnlockSkill(skill, level, ownedSkillIds));
    },
    [getSkillsForClass, canUnlockSkill]
  );

  /**
   * Get skill status for UI display
   * @param {import('../game/types').SkillNode} skill
   * @param {number} level
   * @param {string[]} ownedSkillIds
   * @returns {'owned' | 'available' | 'locked'}
   */
  const getSkillStatus = useCallback(
    (skill, level, ownedSkillIds) => {
      if (ownedSkillIds.includes(skill.id)) {
        return 'owned';
      }
      if (canUnlockSkill(skill, level, ownedSkillIds)) {
        return 'available';
      }
      return 'locked';
    },
    [canUnlockSkill]
  );

  /**
   * Get skills organized by level for tree display
   * @param {string} characterClass
   * @returns {Record<number, import('../game/types').SkillNode[]>}
   */
  const getSkillsByLevel = useCallback(
    (characterClass) => {
      const classSkills = getSkillsForClass(characterClass);
      const byLevel = { 1: [], 3: [], 5: [], 7: [] };

      classSkills.forEach((skill) => {
        if (byLevel[skill.levelRequired]) {
          byLevel[skill.levelRequired].push(skill);
        }
      });

      return byLevel;
    },
    [getSkillsForClass]
  );

  return {
    skills,
    loading,
    error,
    refetch: fetchSkills,
    getSkillsForClass,
    getAvailableSkills,
    canUnlockSkill,
    getSkillStatus,
    getSkillsByLevel,
  };
}

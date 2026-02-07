import { useState, useEffect, useRef } from 'react';
import { GiShield, GiSwordWound, GiWizardStaff, GiCauldron } from 'react-icons/gi';
import { LuX } from 'react-icons/lu';
import { SkillTreeDialog } from './SkillTreeDialog';
import { api } from '../api/client';

const CLASS_ICON_MAP = { tank: GiShield, warrior: GiSwordWound, wizard: GiWizardStaff, alchemist: GiCauldron };
const PORTRAITS = { ehsan: '/portraits/ehsan.png', dennis: '/portraits/dennis.png', budde: '/portraits/budde.png', matthias: '/portraits/matthias.png' };

const ATTR_LABELS = {
  maxHealth: { name: 'Health', icon: '\u2764', color: '#10b981' },
  maxAP: { name: 'AP', icon: '\u26A1', color: '#3b82f6' },
  power: { name: 'Power', icon: '\uD83D\uDCAA', color: '#f59e0b' },
  shieldCapacity: { name: 'Shield Cap', icon: '\uD83D\uDEE1', color: '#a8a095' },
  shieldStrength: { name: 'Shield Str', icon: '\uD83D\uDEE1', color: '#a8a095' },
  dexterity: { name: 'Dexterity', icon: '\uD83C\uDFAF', color: '#f59e0b' },
  evasiveness: { name: 'Evasion', icon: '\uD83D\uDCA8', color: '#3b82f6' },
};

/**
 * Full-screen overlay showing player stats, owned skills, and a button to open the skill tree.
 * Used on both MapScreen and FightScreen.
 *
 * @param {{ player: object, onClose: () => void }} props
 *   player — must have { name, class, level, attributes, ownedSkillIds }
 */
export function PlayerDetailOverlay({ player, onClose }) {
  const [skillTreePlayer, setSkillTreePlayer] = useState(null);
  const skillsRef = useRef(null);
  const [, forceUpdate] = useState(0);

  // Fetch skill definitions once
  useEffect(() => {
    if (skillsRef.current) return;
    api.getSkills().then(data => {
      const map = {};
      data.forEach(s => { map[s.id] = s; });
      skillsRef.current = map;
      forceUpdate(n => n + 1);
    }).catch(() => {});
  }, []);

  if (!player) return null;

  const portrait = PORTRAITS[player.name.toLowerCase()];
  const ClassIcon = CLASS_ICON_MAP[player.class];
  const ownedSkills = (player.ownedSkillIds || [])
    .map(id => skillsRef.current?.[id])
    .filter(Boolean);

  return (
    <>
      <div style={styles.overlay} onClick={onClose}>
        <div style={styles.panel} onClick={e => e.stopPropagation()}>
          {/* Close */}
          <button style={styles.closeBtn} onClick={onClose}>
            <LuX size={18} />
          </button>

          {/* Header */}
          <div style={styles.header}>
            <div style={{
              ...styles.avatar,
              ...(portrait ? {
                backgroundImage: `url(${portrait})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              } : {}),
            }}>
              {!portrait && ClassIcon && <ClassIcon size={24} color="#f5f0e8" />}
            </div>
            <div>
              <div style={styles.name}>{player.name}</div>
              <div style={styles.classLabel}>
                {player.class} &middot; Lv.{player.level}
              </div>
            </div>
          </div>

          {/* Attributes */}
          <div style={styles.section}>
            <div style={styles.sectionLabel}>Attributes</div>
            <div style={styles.attrGrid}>
              {Object.entries(ATTR_LABELS).map(([key, { name, icon, color }]) => (
                <div key={key} style={styles.attrItem}>
                  <span style={{ ...styles.attrIcon, color }}>{icon}</span>
                  <span style={styles.attrName}>{name}</span>
                  <span style={styles.attrVal}>{player.attributes?.[key] ?? 0}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Owned skills */}
          <div style={styles.section}>
            <div style={styles.sectionLabel}>Skills ({ownedSkills.length})</div>
            {ownedSkills.length === 0 ? (
              <div style={styles.noSkills}>No skills unlocked yet</div>
            ) : (
              <div style={styles.skillList}>
                {ownedSkills.map(skill => (
                  <div key={skill.id} style={styles.skillItem}>
                    <span style={{
                      ...styles.skillDot,
                      background: skill.type === 'ability' ? '#f59e0b' : '#a855f6',
                    }} />
                    <div style={styles.skillInfo}>
                      <span style={styles.skillName}>{skill.name}</span>
                      <span style={styles.skillDesc}>{skill.description}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* View Skill Tree button */}
          <button
            style={styles.skillTreeBtn}
            onClick={() => setSkillTreePlayer(player)}
          >
            View Skill Tree
          </button>
        </div>
      </div>

      {/* Skill Tree Dialog (read-only) */}
      {skillTreePlayer && (
        <SkillTreeDialog
          open={true}
          onClose={() => setSkillTreePlayer(null)}
          characterClass={skillTreePlayer.class}
          characterLevel={skillTreePlayer.level}
          ownedSkillIds={skillTreePlayer.ownedSkillIds || []}
          perkPoints={0}
          readOnly
        />
      )}
    </>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    zIndex: 1200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
  },
  panel: {
    background: '#2d2418',
    borderRadius: '16px',
    border: '2px solid rgba(245,158,11,0.3)',
    padding: '16px',
    width: '100%',
    maxWidth: 360,
    maxHeight: '80vh',
    overflowY: 'auto',
    position: 'relative',
    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    background: 'transparent',
    border: 'none',
    color: '#a8a095',
    cursor: 'pointer',
    padding: 4,
    display: 'flex',
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '14px',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    border: '2px solid rgba(245,158,11,0.4)',
    background: 'rgba(255,255,255,0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  name: {
    fontSize: '1.1rem',
    fontWeight: 'bold',
    color: '#f5f0e8',
  },
  classLabel: {
    fontSize: '0.8rem',
    color: '#a8a095',
    textTransform: 'capitalize',
  },
  section: {
    marginBottom: '12px',
  },
  sectionLabel: {
    fontSize: '0.7rem',
    color: '#f59e0b',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: '8px',
    fontWeight: 'bold',
  },
  attrGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '6px',
  },
  attrItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.8rem',
    padding: '4px 8px',
    borderRadius: '6px',
    background: 'rgba(255,255,255,0.04)',
  },
  attrIcon: {
    fontSize: '0.85rem',
    flexShrink: 0,
  },
  attrName: {
    color: '#a8a095',
    flex: 1,
    fontSize: '0.75rem',
  },
  attrVal: {
    fontWeight: 'bold',
    color: '#f5f0e8',
    fontSize: '0.85rem',
  },
  noSkills: {
    fontSize: '0.8rem',
    color: '#a8a095',
    fontStyle: 'italic',
  },
  skillList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  skillItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    padding: '6px 8px',
    borderRadius: '6px',
    background: 'rgba(255,255,255,0.04)',
  },
  skillDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
    marginTop: 4,
  },
  skillInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1px',
    minWidth: 0,
  },
  skillName: {
    fontSize: '0.8rem',
    fontWeight: 'bold',
    color: '#f5f0e8',
  },
  skillDesc: {
    fontSize: '0.7rem',
    color: '#a8a095',
    lineHeight: 1.3,
  },
  skillTreeBtn: {
    width: '100%',
    padding: '10px',
    fontSize: '0.85rem',
    borderRadius: '8px',
    background: 'transparent',
    color: '#f59e0b',
    fontWeight: 'bold',
    border: '1px solid rgba(245,158,11,0.3)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    minHeight: 44,
  },
};

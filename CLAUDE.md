# Pub Fight — Design System & Conventions

## Color Palette

All colors live in `client/src/theme.js` as MUI theme tokens. **Never hardcode hex values** — use `theme.palette.*` or the `sx` prop with token strings (e.g. `color: 'primary.main'`).

| Role            | Token                  | Hex       | Usage                        |
|-----------------|------------------------|-----------|------------------------------|
| Background      | `background.default`   | `#1a1a2e` | Page background              |
| Surface         | `background.paper`     | `#2d2418` | Cards, dialogs, paper        |
| Primary (gold)  | `primary.main`         | `#f59e0b` | CTAs, highlights, XP/gold    |
| Secondary (red) | `secondary.main`       | `#dc2626` | Combat, damage, enemies      |
| Success (green) | `success.main`         | `#10b981` | Health, healing, party        |
| Info (blue)     | `info.main`            | `#3b82f6` | Mana, buffs, informational   |
| Text primary    | `text.primary`         | `#f5f0e8` | Main text (warm off-white)   |
| Text secondary  | `text.secondary`       | `#a8a095` | Captions, disabled           |

## Icons

Use **`react-icons`** for all new icons:
- `Gi*` (Game Icons) for RPG/fantasy: swords, shields, potions, skulls
- `Lu*` (Lucide) for UI chrome: menus, arrows, settings, close

```jsx
import { GiSwordWound, GiHealthPotion } from 'react-icons/gi';
import { LuSettings, LuChevronRight } from 'react-icons/lu';
```

**Never** add new `@mui/icons-material` imports. Existing usages will be migrated separately.

## Animation

Use **`framer-motion`** for:
- Screen transitions (`AnimatePresence` + fade/slide)
- Combat effects (damage numbers, shake, flash)
- UI micro-interactions (button press, card hover)

```jsx
import { motion, AnimatePresence } from 'framer-motion';
```

## Mobile-First

- All screens must work at **360px** viewport width
- Minimum touch target: **44×44px** (already enforced in theme for buttons)
- Use MUI responsive breakpoints (`sx={{ flexDirection: { xs: 'column', md: 'row' } }}`)
- Test on mobile before desktop

## Component Patterns

- Use the `sx` prop with theme tokens — never inline `style` with hardcoded colors
- Prefer `Box` with `sx` over custom styled-components
- Use `theme.spacing()` for consistent spacing (8px grid)
- Shape: `borderRadius: 12` is the global default

## File Structure

- Theme: `client/src/theme.js`
- Screens: `client/src/screens/`
- Components: `client/src/components/`
- Game engine (pure logic): `client/src/game/`
- Server types: `server/src/types/game.ts`

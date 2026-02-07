import { test, expect, type Page, type APIRequestContext } from '@playwright/test';

const BASE = 'http://localhost:3001';

// Warrior skill unlock order — one skill per level-up, following the AoE chain
const WARRIOR_SKILLS = [
  'flurry',       // level 1 (lobby, 1 perk point)
  'precision',    // level 2 (after dungeon 1)
  'whirlwind',    // level 3 (requires flurry)
  'heavy_strike', // level 4
  'blade_storm',  // level 5 (requires whirlwind)
  'second_wind',  // level 6
  'rampage',      // level 7 (requires blade_storm)
];

const DUNGEON_IDS = [
  'dungeon_1', 'dungeon_2', 'dungeon_3', 'dungeon_4',
  'dungeon_5', 'dungeon_6', 'dungeon_7',
];

/** Helper: call server API with session + game headers */
async function apiPost(
  request: APIRequestContext,
  path: string,
  sessionId: string,
  gameId: string,
  body: Record<string, unknown> = {},
) {
  const res = await request.post(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      'X-Session-Id': sessionId,
      'X-Game-Id': gameId,
    },
    data: body,
  });
  return res.json();
}

test('full 7-level campaign playthrough', async ({ page, request }) => {
  test.setTimeout(300_000); // 5 min max

  // ─── Login ───
  await page.goto('/');
  await page.getByPlaceholder('Enter password').fill('pubfight');
  await page.getByRole('button', { name: 'Enter' }).click();

  // Wait for game select screen
  await expect(page.getByRole('button', { name: 'Create Game' })).toBeVisible({ timeout: 10_000 });

  // ─── Create Game ───
  await page.getByRole('button', { name: 'Create Game' }).click();

  // Wait for lobby
  await expect(page.getByText('Pick your fighter')).toBeVisible({ timeout: 10_000 });

  // ─── Get session ID and game ID from localStorage ───
  const sessionId = await page.evaluate(() => localStorage.getItem('sessionId')) as string;
  const gameId = await page.evaluate(() => localStorage.getItem('gameId')) as string;
  expect(sessionId).toBeTruthy();
  expect(gameId).toBeTruthy();

  // ─── Disable GPS by setting all dungeon coords to 0,0 ───
  await apiPost(request, '/api/admin/set-dungeon-coords', sessionId, gameId, {
    dungeonUpdates: DUNGEON_IDS.map(id => ({ id, lat: 0, lng: 0 })),
  });

  // ─── Create player ───
  await page.getByRole('button', { name: 'New Player' }).click();
  await page.getByPlaceholder('Enter your name').fill('E2E Bot');

  // Warrior is selected by default — just click Create
  await page.getByRole('button', { name: 'Create' }).click();

  // Wait for player to appear in the list
  await expect(page.getByText('E2E Bot')).toBeVisible({ timeout: 5_000 });

  // ─── Get player ID from server ───
  const playerId = await page.evaluate(
    ({ sid, gid }) => {
      return fetch('/api/state', {
        headers: { 'X-Session-Id': sid, 'X-Game-Id': gid },
      })
        .then(r => r.json())
        .then(data => {
          const players = Object.values(data.players) as Array<{ id: string; name: string }>;
          return players.find(p => p.name === 'E2E Bot')?.id;
        });
    },
    { sid: sessionId, gid: gameId },
  ) as string;
  expect(playerId).toBeTruthy();

  // ─── Unlock initial skill (level 1, 1 perk point) ───
  const unlockResult = await apiPost(request, '/api/unlock-skill', sessionId, gameId, {
    playerId,
    skillId: WARRIOR_SKILLS[0],
  });
  expect(unlockResult.success).toBe(true);

  // ─── Start Game ───
  await page.getByRole('button', { name: /Start Game/ }).click();

  // Wait for map screen
  await expect(page.getByText('Pub Crawl')).toBeVisible({ timeout: 10_000 });

  // ─── Loop through 7 dungeons ───
  for (let i = 0; i < 7; i++) {
    console.log(`\n=== Dungeon ${i + 1}/7 ===`);

    // ── Map Screen ──
    await expect(page.getByText('GPS not configured')).toBeVisible({ timeout: 10_000 });

    // Click "Enter" on the first available dungeon
    await page.getByRole('button', { name: 'Enter' }).first().click();

    // ── Fight Screen ──
    // Wait for fight to initialize
    await expect(
      page.getByText(/Your Turn|Waiting for/),
    ).toBeVisible({ timeout: 15_000 });

    // Use Admin → "Cripple Boss" button to set all enemy HP to 1 client-side.
    // This directly modifies localFight (the authoritative state), avoiding
    // the race condition of server-side weaken-boss getting overwritten.
    await crippleBossViaAdmin(page);

    // Fight until victory
    await fightUntilVictory(page);
    console.log(`  Fight ${i + 1} complete`);

    // ── Level Up Screen ──
    await expect(page.getByText('Level Up!')).toBeVisible({ timeout: 15_000 });

    // Allocate attribute points via API (more reliable than UI clicks)
    const attrResult = await apiPost(request, '/api/distribute-attributes', sessionId, gameId, {
      playerId,
      deltas: { maxHealth: 2 },
    });
    expect(attrResult.success).toBe(true);

    // Unlock skill via API
    const skillIndex = i + 1; // skill 0 was unlocked in lobby
    if (skillIndex < WARRIOR_SKILLS.length) {
      const skillResult = await apiPost(request, '/api/unlock-skill', sessionId, gameId, {
        playerId,
        skillId: WARRIOR_SKILLS[skillIndex],
      });
      expect(skillResult.success).toBe(true);
    }

    // Wait for client to poll and show "You're Ready!"
    await expect(page.getByText("You're Ready!")).toBeVisible({ timeout: 10_000 });
    console.log(`  Level up ${i + 1} complete`);

    // Click continue (or claim victory on last level)
    if (i < 6) {
      await page.getByRole('button', { name: 'Continue Exploring' }).click();
      await expect(page.getByText('Pub Crawl')).toBeVisible({ timeout: 10_000 });
    } else {
      await page.getByRole('button', { name: 'Claim Victory!' }).click();
    }
  }

  // ─── Victory Screen ───
  await expect(page.getByText('VICTORY!')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('All 7 dungeons conquered!')).toBeVisible();
});

/**
 * Open Admin modal, click "Cripple Boss (Set HP to 1)", wait for it to close.
 * This modifies the client's localFight directly — no server race condition.
 */
async function crippleBossViaAdmin(page: Page) {
  // Click the Admin button (top-right of fight screen)
  await page.getByRole('button', { name: 'Admin' }).click();

  // Click "Cripple Boss (Set HP to 1)"
  await page.getByRole('button', { name: /Cripple Boss/ }).click();

  // The modal auto-closes after clicking. Wait a tick for state to update.
  await page.waitForTimeout(500);
}

/**
 * Keep clicking Attack/Rest whenever it's our turn until VICTORY! appears.
 * If defeated, retry the fight and re-cripple.
 */
async function fightUntilVictory(page: Page) {
  const maxAttempts = 60;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Check if fight is done
    if (await isFightDone(page)) return;

    // Check for DEFEAT — click Retry and re-cripple
    const defeat = page.getByText('DEFEAT');
    if (await defeat.isVisible().catch(() => false)) {
      await page.getByRole('button', { name: 'Retry' }).click();
      await page.waitForTimeout(2_000);
      await crippleBossViaAdmin(page);
      continue;
    }

    // Wait for our turn
    const yourTurn = page.getByText('Your Turn', { exact: false });
    try {
      await yourTurn.waitFor({ state: 'visible', timeout: 10_000 });
    } catch {
      if (await isFightDone(page)) return;
      await page.waitForTimeout(1_000);
      continue;
    }

    // Attack if we have AP, otherwise Rest
    const attackBtn = page.getByRole('button', { name: /Attack/ }).first();
    const restBtn = page.getByRole('button', { name: /Rest/ });

    const attackEnabled = await attackBtn.isEnabled().catch(() => false);
    if (attackEnabled) {
      try { await attackBtn.click({ timeout: 3_000 }); } catch { continue; }
    } else {
      try { await restBtn.click({ timeout: 3_000 }); } catch { continue; }
    }

    // Wait for action to process
    await page.waitForTimeout(500);
  }

  // Final check
  if (!(await isFightDone(page))) {
    await expect(page.getByText('VICTORY!')).toBeVisible({ timeout: 15_000 });
  }
}

/** Check if the fight is done (victory text or level-up screen) */
async function isFightDone(page: Page): Promise<boolean> {
  const hasVictory = await page.getByText('VICTORY!').isVisible().catch(() => false);
  if (hasVictory) return true;
  const hasLevelUp = await page.getByText('Level Up!').isVisible().catch(() => false);
  return hasLevelUp;
}

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startServer } from './helpers.js';

const TIMEOUT = 5_000;

let srv, browser, page;

before(async () => {
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
});

// ── Helper: fresh server + page per describe block ──────

async function setup() {
  srv = await startServer();
  const ctx = await browser.newContext();
  await ctx.addCookies([srv.authCookie]);
  page = await ctx.newPage();
  page.setDefaultTimeout(TIMEOUT);
  await page.goto(srv.slugURL);
  // Wait for Alpine to render the phase names (proves API data loaded + hydrated)
  await page.waitForFunction(() => {
    const names = document.querySelectorAll('.space-y-4 .font-bold.text-white');
    return names.length >= 2;
  }, { timeout: TIMEOUT });
}

async function teardown() {
  await page?.context()?.close();
  await srv?.close();
}

// Scoped locator for phase card N (0-indexed)
const card = (n = 0) => page.locator('.space-y-4 > div').nth(n);

// ── Chargement & affichage ──────────────────────────────

describe('Chargement & affichage', () => {
  before(setup);
  after(teardown);

  it('affiche les deux phases avec leur nom', async () => {
    const names = await page.locator('.space-y-4 .font-bold.text-white').allTextContents();
    assert.ok(names.some(n => n.includes('Phase Alpha')));
    assert.ok(names.some(n => n.includes('Phase Beta')));
  });

  it('affiche les périodes calculées depuis les dates des tâches', async () => {
    const textAlpha = await card(0).textContent();
    assert.ok(textAlpha.includes('avril → mai'), 'Phase Alpha devrait afficher "avril → mai"');
    const textBeta = await card(1).textContent();
    assert.ok(textBeta.includes('juillet → août'), 'Phase Beta devrait afficher "juillet → août"');
  });

  it('affiche la barre de progression globale', async () => {
    // Use text-sm to exclude the h1 (text-xl)
    const pct = await page.locator('header span.text-base.font-bold').textContent();
    assert.equal(pct, '25%');
  });
});

// ── Édition de phase ────────────────────────────────────

describe('Édition de phase', () => {
  before(setup);
  after(teardown);

  it('clic crayon → champ nom inline apparaît', async () => {
    await card(0).getByTitle('Modifier').click();
    await card(0).locator('input[x-model="editPhaseData.name"]').waitFor({ state: 'visible', timeout: TIMEOUT });
  });

  it('Save → changement persisté après reload', async () => {
    await card(0).locator('input[x-model="editPhaseData.name"]').fill('Phase Alpha Modifiée');
    await card(0).getByTitle('Enregistrer').click();
    await page.locator('.font-bold.text-white', { hasText: 'Modifiée' }).waitFor({ timeout: TIMEOUT });

    await page.reload();
    await page.waitForFunction(() => {
      const names = document.querySelectorAll('.space-y-4 .font-bold.text-white');
      return [...names].some(n => n.textContent.includes('Modifiée'));
    }, { timeout: TIMEOUT });
  });

  it('Cancel → pas de changement', async () => {
    await card(0).getByTitle('Modifier').click();
    await card(0).locator('input[x-model="editPhaseData.name"]').fill('NE PAS SAUVER');
    await card(0).getByTitle('Annuler').first().click();
    const name = await card(0).locator('div.font-bold.text-white').textContent();
    assert.ok(!name.includes('NE PAS SAUVER'));
  });
});

// ── Édition de tâche ────────────────────────────────────

describe('Édition de tâche', () => {
  before(setup);
  after(teardown);

  it('clic sur tâche → champs inline apparaissent', async () => {
    // Expand phase 1
    await card(0).locator('.cursor-pointer.select-none').click();
    const row = card(0).locator('.task-row').first();
    await row.waitFor({ state: 'visible', timeout: TIMEOUT });
    await row.click();
    await row.locator('input[x-model="editTaskData.text"]').waitFor({ state: 'visible', timeout: TIMEOUT });
    await row.locator('textarea[x-model="editTaskData.notes"]').waitFor({ state: 'visible', timeout: TIMEOUT });
  });

  it('Save → persisté après reload', async () => {
    const row = card(0).locator('.task-row').first();
    await row.locator('input[x-model="editTaskData.text"]').fill('Tâche un modifiée');
    await row.getByTitle('Enregistrer').click();
    await card(0).locator('.task-row', { hasText: 'modifiée' }).waitFor({ timeout: TIMEOUT });

    await page.reload();
    await page.waitForFunction(() => {
      const names = document.querySelectorAll('.space-y-4 .font-bold.text-white');
      return names.length >= 2;
    }, { timeout: TIMEOUT });
    await card(0).locator('.cursor-pointer.select-none').click();
    await card(0).locator('.task-row').first().waitFor({ state: 'visible', timeout: TIMEOUT });
    const texts = await card(0).locator('.task-row').allTextContents();
    assert.ok(texts.some(t => t.includes('Tâche un modifiée')));
  });

  it('Cancel → pas de changement', async () => {
    const row = card(0).locator('.task-row').first();
    await row.click();
    await row.locator('input[x-model="editTaskData.text"]').fill('NE PAS SAUVER');
    await row.getByTitle('Annuler').click();
    const texts = await card(0).locator('.task-row').allTextContents();
    assert.ok(!texts.some(t => t.includes('NE PAS SAUVER')));
  });
});

// ── Toggle tâche ────────────────────────────────────────

describe('Toggle tâche', () => {
  before(setup);
  after(teardown);

  it('clic checkbox → bascule done, progression se met à jour', async () => {
    const progressBefore = await page.locator('header span.text-base.font-bold').textContent();
    await card(0).locator('.cursor-pointer.select-none').click();
    const row = card(0).locator('.task-row').first();
    await row.waitFor({ state: 'visible', timeout: TIMEOUT });
    await row.locator('.custom-check').click();
    await page.waitForFunction((before) => {
      const el = document.querySelector('header span.text-base.font-bold');
      return el && el.textContent !== before;
    }, progressBefore, { timeout: TIMEOUT });
    const progressAfter = await page.locator('header span.text-base.font-bold').textContent();
    assert.equal(progressAfter, '50%');
  });
});

// ── Escape annule l'édition ─────────────────────────────

describe('Escape annule l\'édition', () => {
  before(setup);
  after(teardown);

  it('édition phase → Escape → retour en lecture', async () => {
    await card(0).getByTitle('Modifier').click();
    const inp = card(0).locator('input[x-model="editPhaseData.name"]');
    await inp.waitFor({ state: 'visible', timeout: TIMEOUT });
    await page.keyboard.press('Escape');
    await inp.waitFor({ state: 'hidden', timeout: TIMEOUT });
  });

  it('édition tâche → Escape → retour en lecture', async () => {
    await card(0).locator('.cursor-pointer.select-none').click();
    const row = card(0).locator('.task-row').first();
    await row.waitFor({ state: 'visible', timeout: TIMEOUT });
    await row.click();
    const inp = row.locator('input[x-model="editTaskData.text"]');
    await inp.waitFor({ state: 'visible', timeout: TIMEOUT });
    await page.keyboard.press('Escape');
    await inp.waitFor({ state: 'hidden', timeout: TIMEOUT });
  });
});

// ── Click-away annule l'édition ─────────────────────────

describe('Click-away annule l\'édition', () => {
  before(setup);
  after(teardown);

  it('édition phase → clic dans les marges → retour en lecture', async () => {
    await card(0).getByTitle('Modifier').click();
    const inp = card(0).locator('input[x-model="editPhaseData.name"]');
    await inp.waitFor({ state: 'visible', timeout: TIMEOUT });
    await page.evaluate(() => document.body.click());
    await inp.waitFor({ state: 'hidden', timeout: TIMEOUT });
  });

  it('édition tâche → clic dans les marges → retour en lecture', async () => {
    await card(0).locator('.cursor-pointer.select-none').click();
    const row = card(0).locator('.task-row').first();
    await row.waitFor({ state: 'visible', timeout: TIMEOUT });
    await row.click();
    const inp = row.locator('input[x-model="editTaskData.text"]');
    await inp.waitFor({ state: 'visible', timeout: TIMEOUT });
    await page.evaluate(() => document.body.click());
    await inp.waitFor({ state: 'hidden', timeout: TIMEOUT });
  });
});

// ── Exclusivité mutuelle ────────────────────────────────

describe('Exclusivité mutuelle', () => {
  before(setup);
  after(teardown);

  it('éditer phase → cliquer tâche → phase fermée, tâche ouverte', async () => {
    // Expand phase first, THEN enter edit mode
    // (header click ignores toggle when editingPhase === phase.id)
    await card(0).locator('.cursor-pointer.select-none').click();
    const row = card(0).locator('.task-row').first();
    await row.waitFor({ state: 'visible', timeout: TIMEOUT });

    await card(0).getByTitle('Modifier').click();
    const phaseInput = card(0).locator('input[x-model="editPhaseData.name"]');
    await phaseInput.waitFor({ state: 'visible', timeout: TIMEOUT });

    // Click a task → should close phase edit, open task edit
    await row.click();
    await phaseInput.waitFor({ state: 'hidden', timeout: TIMEOUT });
    await row.locator('input[x-model="editTaskData.text"]').waitFor({ state: 'visible', timeout: TIMEOUT });
  });

  it('éditer tâche → cliquer crayon phase → tâche fermée, phase ouverte', async () => {
    // Task is still in edit from previous test
    const row = card(0).locator('.task-row').first();
    const taskInput = row.locator('input[x-model="editTaskData.text"]');
    await taskInput.waitFor({ state: 'visible', timeout: TIMEOUT });

    await card(0).getByTitle('Modifier').click();

    await taskInput.waitFor({ state: 'hidden', timeout: TIMEOUT });
    await card(0).locator('input[x-model="editPhaseData.name"]').waitFor({ state: 'visible', timeout: TIMEOUT });
  });
});

// ── Enter sauvegarde ────────────────────────────────────

describe('Enter sauvegarde les phases et tâches', () => {
  before(setup);
  after(teardown);

  it('édition phase → Enter → sauvegarde et retour en lecture', async () => {
    await card(0).getByTitle('Modifier').click();
    const inp = card(0).locator('input[x-model="editPhaseData.name"]');
    await inp.waitFor({ state: 'visible', timeout: TIMEOUT });
    await inp.fill('Phase Alpha Enter');
    await inp.press('Enter');
    await inp.waitFor({ state: 'hidden', timeout: TIMEOUT });
    const name = await card(0).locator('div.font-bold.text-white').textContent();
    assert.ok(name.includes('Phase Alpha Enter'));
  });

  it('édition phase → Enter → persisté après reload', async () => {
    await page.reload();
    await page.waitForFunction(() => {
      const names = document.querySelectorAll('.space-y-4 .font-bold.text-white');
      return names.length >= 2;
    }, { timeout: TIMEOUT });
    const names = await page.locator('.space-y-4 .font-bold.text-white').allTextContents();
    assert.ok(names.some(n => n.includes('Phase Alpha Enter')));
  });

  it('édition tâche (champ texte) → Enter → sauvegarde et retour en lecture', async () => {
    await card(0).locator('.cursor-pointer.select-none').click();
    const row = card(0).locator('.task-row').first();
    await row.waitFor({ state: 'visible', timeout: TIMEOUT });
    await row.click();
    const inp = row.locator('input[x-model="editTaskData.text"]');
    await inp.waitFor({ state: 'visible', timeout: TIMEOUT });
    await inp.fill('Tâche Enter texte');
    await inp.press('Enter');
    await inp.waitFor({ state: 'hidden', timeout: TIMEOUT });
    const texts = await card(0).locator('.task-row').allTextContents();
    assert.ok(texts.some(t => t.includes('Tâche Enter texte')));
  });

  it('édition tâche (champ notes) → Cmd+Enter → sauvegarde et retour en lecture', async () => {
    const row = card(0).locator('.task-row').first();
    await row.click();
    const inp = row.locator('textarea[x-model="editTaskData.notes"]');
    await inp.waitFor({ state: 'visible', timeout: TIMEOUT });
    await inp.fill('Note via Enter');
    await inp.press('Meta+Enter');
    await inp.waitFor({ state: 'hidden', timeout: TIMEOUT });

    // Re-open to verify the note was saved
    await row.click();
    const val = await row.locator('textarea[x-model="editTaskData.notes"]').inputValue();
    assert.equal(val, 'Note via Enter');
    await page.keyboard.press('Escape');
  });

  it('création phase → Enter → phase créée', async () => {
    const countBefore = await page.locator('.space-y-4 > div').count();
    await page.locator('button:visible', { hasText: '+ Nouvelle phase' }).click();
    const inp = page.locator('input[placeholder="ex: 1 — Production"]');
    await inp.fill('Phase Enter');
    await inp.press('Enter');

    await page.waitForFunction((before) => {
      return document.querySelectorAll('.space-y-4 > div').length > before;
    }, countBefore, { timeout: TIMEOUT });
    const names = await page.locator('.space-y-4 .font-bold.text-white').allTextContents();
    assert.ok(names.some(n => n.includes('Phase Enter')));
  });

  it('ajout tâche (champ notes) → Cmd+Enter → tâche créée', async () => {
    await card(0).locator('.cursor-pointer.select-none').click();
    await card(0).locator('.task-row').first().waitFor({ state: 'visible', timeout: TIMEOUT });
    const countBefore = await card(0).locator('.task-row').count();

    await card(0).getByText('+ Ajouter une tâche').click();
    await card(0).locator('input[placeholder="Description de la tâche"]').fill('Tâche ajoutée via Enter notes');
    const notesInp = card(0).locator('textarea[placeholder="Notes (optionnel, markdown supporté)"]');
    await notesInp.fill('Note test');
    await notesInp.press('Meta+Enter');

    await page.waitForFunction((args) => {
      const cards = document.querySelectorAll('.space-y-4 > div');
      if (!cards[0]) return false;
      return cards[0].querySelectorAll('.task-row').length > args;
    }, countBefore, { timeout: TIMEOUT });
    const texts = await card(0).locator('.task-row').allTextContents();
    assert.ok(texts.some(t => t.includes('Tâche ajoutée via Enter notes')));
  });
});

// ── Ajout de tâche ──────────────────────────────────────

describe('Ajout de tâche', () => {
  before(setup);
  after(teardown);

  it('clic "+ Ajouter" → formulaire → submit → tâche apparaît', async () => {
    await card(0).locator('.cursor-pointer.select-none').click();
    await card(0).locator('.task-row').first().waitFor({ state: 'visible', timeout: TIMEOUT });
    const countBefore = await card(0).locator('.task-row').count();

    await card(0).getByText('+ Ajouter une tâche').click();
    await card(0).locator('input[placeholder="Description de la tâche"]').fill('Nouvelle tâche E2E');
    await card(0).locator('textarea[placeholder="Notes (optionnel, markdown supporté)"]').fill('Notes E2E');
    await card(0).getByTitle('Ajouter').click();

    await page.waitForFunction((args) => {
      const cards = document.querySelectorAll('.space-y-4 > div');
      if (!cards[0]) return false;
      return cards[0].querySelectorAll('.task-row').length > args;
    }, countBefore, { timeout: TIMEOUT });
    const texts = await card(0).locator('.task-row').allTextContents();
    assert.ok(texts.some(t => t.includes('Nouvelle tâche E2E')));
  });
});

// ── Création de phase ───────────────────────────────────

describe('Création de phase', () => {
  before(setup);
  after(teardown);

  it('clic "+ Nouvelle phase" → formulaire → submit → phase apparaît', async () => {
    const countBefore = await page.locator('.space-y-4 > div').count();

    // The visible button (x-show="phases.length > 0 && !creatingPhase")
    await page.locator('button:visible', { hasText: '+ Nouvelle phase' }).click();
    await page.locator('input[placeholder="ex: 1 — Production"]').fill('Phase Gamma');
    await page.getByTitle('Créer').click();

    await page.waitForFunction((before) => {
      return document.querySelectorAll('.space-y-4 > div').length > before;
    }, countBefore, { timeout: TIMEOUT });
    const names = await page.locator('.space-y-4 .font-bold.text-white').allTextContents();
    assert.ok(names.some(n => n.includes('Phase Gamma')));
  });
});

// ── Couleurs de contributeurs ─────────────────────────────

describe('Couleurs de contributeurs', () => {
  before(setup);
  after(teardown);

  // The contributor management panel (inside x-collapse)
  const contribPanel = () => page.locator('[x-collapse]').first();
  // A contributor badge wrapper (the <div class="relative"> containing the badge span)
  const contribBadge = (name) => contribPanel().locator(`span.rounded-full.border:has(span:text("${name}"))`);

  it('les contributeurs migrés ont chacun une couleur distincte', async () => {
    // Open contributors section
    await page.locator('button', { hasText: 'Contributeurs' }).click();
    await contribPanel().waitFor({ state: 'visible', timeout: TIMEOUT });

    // Both seed contributors should be visible
    await contribBadge('Alice').waitFor({ state: 'visible', timeout: TIMEOUT });
    await contribBadge('Bob').waitFor({ state: 'visible', timeout: TIMEOUT });

    // Each badge should have an inline style with a color
    const aliceStyle = await contribBadge('Alice').getAttribute('style');
    assert.ok(aliceStyle && aliceStyle.includes('color:'), 'Alice badge should have inline color style');
    const bobStyle = await contribBadge('Bob').getAttribute('style');
    assert.ok(bobStyle && bobStyle.includes('color:'), 'Bob badge should have inline color style');

    // Colors should be different
    assert.notEqual(aliceStyle, bobStyle, 'Alice and Bob should have different colors');
  });

  it('ajout d\'un contributeur → couleur auto-assignée', async () => {
    const input = contribPanel().locator('input[placeholder="Ajouter un contributeur..."]');
    await input.fill('Charlie');
    await input.press('Enter');
    await contribBadge('Charlie').waitFor({ state: 'visible', timeout: TIMEOUT });

    const style = await contribBadge('Charlie').getAttribute('style');
    assert.ok(style && style.includes('color:'), 'New contributor should have a color');
  });

  it('color picker s\'ouvre et permet de changer la couleur', async () => {
    const styleBefore = await contribBadge('Alice').getAttribute('style');

    // Click the small color dot button inside Alice's badge
    await contribBadge('Alice').locator('button.rounded-full').first().click();

    // Color picker dropdown should appear — it's a sibling div inside the same parent <div class="relative">
    const aliceWrapper = contribBadge('Alice').locator('..');
    const picker = aliceWrapper.locator('div.flex.gap-1\\.5');
    await picker.waitFor({ state: 'visible', timeout: TIMEOUT });

    // Should have 10 color options
    const colorButtons = picker.locator('button.rounded-full');
    const count = await colorButtons.count();
    assert.equal(count, 10, 'Should have 10 color options');

    // Click the last color
    await colorButtons.last().click();
    await picker.waitFor({ state: 'hidden', timeout: TIMEOUT });

    const styleAfter = await contribBadge('Alice').getAttribute('style');
    assert.notEqual(styleBefore, styleAfter, 'Color should have changed');
  });

  it('couleurs persistent après reload', async () => {
    const styleBefore = await contribBadge('Alice').getAttribute('style');

    await page.reload();
    await page.waitForFunction(() => {
      const names = document.querySelectorAll('.space-y-4 .font-bold.text-white');
      return names.length >= 2;
    }, { timeout: TIMEOUT });

    // Re-open contributors section
    await page.locator('button', { hasText: 'Contributeurs' }).click();
    await contribPanel().waitFor({ state: 'visible', timeout: TIMEOUT });

    const styleAfter = await contribBadge('Alice').getAttribute('style');
    assert.equal(styleBefore, styleAfter, 'Color should persist after reload');
  });

  it('suppression et ajout → nouveau contributeur reçoit une couleur', async () => {
    // Remove Charlie
    await contribBadge('Charlie').locator('button:text("×")').click();
    await contribBadge('Charlie').waitFor({ state: 'hidden', timeout: TIMEOUT });

    // Add Dave
    const input = contribPanel().locator('input[placeholder="Ajouter un contributeur..."]');
    await input.fill('Dave');
    await input.press('Enter');
    await contribBadge('Dave').waitFor({ state: 'visible', timeout: TIMEOUT });

    const daveStyle = await contribBadge('Dave').getAttribute('style');
    assert.ok(daveStyle && daveStyle.includes('color:'), 'Dave should have a color');
  });
});

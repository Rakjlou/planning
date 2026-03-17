import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import { chromium } from 'playwright';
import { createProject } from '../create-project.js';
import { createServer } from '../server.js';

const TIMEOUT = 5_000;

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

describe('create-project E2E', () => {
  let dataDir, handle, baseURL, page;

  before(async () => {
    dataDir = join(tmpdir(), `retroplanning-create-test-${randomBytes(6).toString('hex')}`);
    await mkdir(dataDir, { recursive: true });

    // Create project via the script
    await createProject('myproject', 'secret42', dataDir);

    // Start server pointing to that dataDir
    handle = createServer({ port: 0, dataDir, allowCreate: true });
    await new Promise(resolve => handle.server.on('listening', resolve));
    baseURL = `http://localhost:${handle.port()}`;

    const ctx = await browser.newContext();
    page = await ctx.newPage();
    page.setDefaultTimeout(TIMEOUT);
  });

  after(async () => {
    await page?.context()?.close();
    await handle?.close();
    try { await rm(dataDir, { recursive: true }); } catch {}
  });

  it('le slug créé affiche la page de login', async () => {
    await page.goto(`${baseURL}/myproject`);
    await page.locator('input[name="password"]').waitFor({ state: 'visible', timeout: TIMEOUT });
    const button = page.locator('button[type="submit"]');
    assert.equal((await button.textContent()).trim(), 'Entrer');
  });

  it('login avec le bon mot de passe → dashboard vide', async () => {
    await page.locator('input[name="password"]').fill('secret42');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(`${baseURL}/myproject`, { timeout: TIMEOUT });
    // Dashboard should show empty state
    await page.locator('text=Aucune phase créée').waitFor({ state: 'visible', timeout: TIMEOUT });
  });

  it('login avec mauvais mot de passe → erreur', async () => {
    // Open a fresh page without cookie
    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    page2.setDefaultTimeout(TIMEOUT);
    await page2.goto(`${baseURL}/myproject`);
    await page2.locator('input[name="password"]').fill('wrongpass');
    await page2.locator('button[type="submit"]').click();
    await page2.locator('text=Mot de passe incorrect').waitFor({ state: 'visible', timeout: TIMEOUT });
    await ctx2.close();
  });

  it('un slug non créé affiche le formulaire de création', async () => {
    const ctx3 = await browser.newContext();
    const page3 = await ctx3.newPage();
    page3.setDefaultTimeout(TIMEOUT);
    await page3.goto(`${baseURL}/otherproject`);
    await page3.locator('text=Nouveau projet').waitFor({ state: 'visible', timeout: TIMEOUT });
    await ctx3.close();
  });
});

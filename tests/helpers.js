import { writeFile, unlink, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes, scryptSync, createHmac } from 'crypto';
import { createServer } from '../server.js';

export const TEST_SLUG = 'test';
export const TEST_PASSWORD = 'testpass';

export const SEED_DATA = {
  contributors: ['Alice', 'Bob'],
  phases: [
    { id: 'phase-1', name: 'Phase Alpha' },
    { id: 'phase-2', name: 'Phase Beta' },
  ],
  tasks: [
    { id: 't-1', phase: 'phase-1', text: 'Tâche un', deadlineDate: '2026-04-15', notes: 'Note alpha', done: false, decisions: [{ status: 'open', notes: '' }] },
    { id: 't-2', phase: 'phase-1', text: 'Tâche deux', deadlineDate: '2026-05-01', notes: '', done: false, decisions: [] },
    { id: 't-3', phase: 'phase-2', text: 'Tâche trois', deadlineDate: '2026-07-10', notes: 'Note beta', done: true, decisions: [] },
    { id: 't-4', phase: 'phase-2', text: 'Tâche quatre', deadlineDate: '2026-08-20', notes: '', done: false, decisions: [] },
  ],
  decisionLog: [
    { date: '1 mars 2026', text: 'Décision initiale de test.' },
  ],
};

export async function startServer(seedData = SEED_DATA) {
  const id = randomBytes(6).toString('hex');
  const dataDir = join(tmpdir(), `retroplanning-test-${id}`);
  await mkdir(dataDir, { recursive: true });

  // Write slug data file
  await writeFile(join(dataDir, `${TEST_SLUG}.json`), JSON.stringify(seedData, null, 2));

  // Write app secret
  const secret = randomBytes(32).toString('hex');
  await writeFile(join(dataDir, '.secret'), secret);

  // Write password entry
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(TEST_PASSWORD, salt, 64).toString('hex');
  await writeFile(join(dataDir, 'passwords.json'), JSON.stringify({ [TEST_SLUG]: { hash, salt } }, null, 2));

  // Generate auth cookie value
  const ts = Date.now().toString(36);
  const hmac = createHmac('sha256', secret).update(TEST_SLUG + ':' + ts).digest('hex');
  const authToken = ts + ':' + hmac;

  const handle = createServer({ port: 0, dataDir });
  await new Promise(resolve => handle.server.on('listening', resolve));

  const baseURL = `http://localhost:${handle.port()}`;

  return {
    baseURL,
    slugURL: `${baseURL}/${TEST_SLUG}`,
    dataDir,
    authCookie: { name: `auth_${TEST_SLUG}`, value: encodeURIComponent(authToken), url: baseURL },
    async close() {
      await handle.close();
      try { await rm(dataDir, { recursive: true }); } catch {}
    },
  };
}

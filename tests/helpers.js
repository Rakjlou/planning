import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import { createServer } from '../server.js';

export const SEED_DATA = {
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
  const dataFile = join(tmpdir(), `retroplanning-test-${id}.json`);
  await writeFile(dataFile, JSON.stringify(seedData, null, 2));

  const handle = createServer({ port: 0, dataFile });
  // wait for the server to be listening
  await new Promise(resolve => handle.server.on('listening', resolve));

  return {
    baseURL: `http://localhost:${handle.port()}`,
    dataFile,
    async close() {
      await handle.close();
      try { await unlink(dataFile); } catch {}
    },
  };
}

import express from 'express';
import { readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, 'data.json');
const PORT = process.env.PORT || 3000;

// ── Empty database template ──────────────────────────────

const EMPTY_DATA = {
  releaseDate: '',
  releaseDateLabel: '',
  phases: [],
  tasks: [],
  decisions: [],
  decisionLog: [],
  risks: [],
};

// ── JSON read/write with sequential write queue ──────────

async function readData() {
  try {
    return JSON.parse(await readFile(DATA_FILE, 'utf-8'));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    await writeFile(DATA_FILE, JSON.stringify(EMPTY_DATA, null, 2));
    return structuredClone(EMPTY_DATA);
  }
}

let writeQueue = Promise.resolve();

function enqueueWrite(fn) {
  writeQueue = writeQueue.then(fn).catch(err => {
    console.error('Write error:', err);
    throw err;
  });
  return writeQueue;
}

async function mutate(transformFn) {
  return enqueueWrite(async () => {
    const data = await readData();
    const result = transformFn(data);
    await writeFile(DATA_FILE, JSON.stringify(data, null, 2));
    return result;
  });
}

// ── ID generation ────────────────────────────────────────

function nextId(collection, prefix) {
  const nums = collection
    .map(item => parseInt(item.id.replace(prefix, ''), 10))
    .filter(n => !isNaN(n));
  return prefix + (nums.length ? Math.max(...nums) + 1 : 1);
}

// ── Express app ──────────────────────────────────────────

const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// ── GET all data ─────────────────────────────────────────

app.get('/api/data', async (_req, res) => {
  res.json(await readData());
});

// ── Settings ─────────────────────────────────────────────

app.put('/api/settings', async (req, res) => {
  await mutate(data => {
    if (req.body.releaseDate !== undefined) data.releaseDate = req.body.releaseDate;
    if (req.body.releaseDateLabel !== undefined) data.releaseDateLabel = req.body.releaseDateLabel;
  });
  res.json({ ok: true });
});

// ── Phases CRUD ──────────────────────────────────────────

app.post('/api/phases', async (req, res) => {
  const phase = await mutate(data => {
    const phase = {
      id: nextId(data.phases, 'phase-'),
      name: req.body.name || '',
      period: req.body.period || '',
      milestones: req.body.milestones || '',
    };
    data.phases.push(phase);
    return phase;
  });
  res.status(201).json(phase);
});

app.put('/api/phases/:id', async (req, res) => {
  const updated = await mutate(data => {
    const phase = data.phases.find(p => p.id === req.params.id);
    if (!phase) return null;
    Object.assign(phase, req.body, { id: phase.id });
    return phase;
  });
  if (!updated) return res.status(404).json({ error: 'Phase not found' });
  res.json(updated);
});

app.delete('/api/phases/:id', async (req, res) => {
  await mutate(data => {
    data.phases = data.phases.filter(p => p.id !== req.params.id);
    data.tasks = data.tasks.filter(t => t.phase !== req.params.id);
  });
  res.json({ ok: true });
});

// ── Tasks CRUD ───────────────────────────────────────────

app.post('/api/tasks', async (req, res) => {
  const task = await mutate(data => {
    const task = {
      id: nextId(data.tasks, 't-'),
      phase: req.body.phase || '',
      text: req.body.text || '',
      deadline: req.body.deadline || '',
      deadlineDate: req.body.deadlineDate || '',
      notes: req.body.notes || '',
      key: req.body.key || false,
      done: false,
    };
    data.tasks.push(task);
    return task;
  });
  res.status(201).json(task);
});

app.put('/api/tasks/:id', async (req, res) => {
  const updated = await mutate(data => {
    const task = data.tasks.find(t => t.id === req.params.id);
    if (!task) return null;
    Object.assign(task, req.body, { id: task.id });
    return task;
  });
  if (!updated) return res.status(404).json({ error: 'Task not found' });
  res.json(updated);
});

app.delete('/api/tasks/:id', async (req, res) => {
  await mutate(data => {
    data.tasks = data.tasks.filter(t => t.id !== req.params.id);
  });
  res.json({ ok: true });
});

// ── Decisions CRUD ───────────────────────────────────────

app.post('/api/decisions', async (req, res) => {
  const decision = await mutate(data => {
    const decision = {
      id: nextId(data.decisions, 'd-'),
      label: req.body.label || '',
      impact: req.body.impact || '',
      urgency: req.body.urgency || 'moyenne',
      deadline: req.body.deadline || '',
      status: 'open',
      notes: '',
    };
    data.decisions.push(decision);
    return decision;
  });
  res.status(201).json(decision);
});

app.put('/api/decisions/:id', async (req, res) => {
  const updated = await mutate(data => {
    const d = data.decisions.find(d => d.id === req.params.id);
    if (!d) return null;
    Object.assign(d, req.body, { id: d.id });
    return d;
  });
  if (!updated) return res.status(404).json({ error: 'Decision not found' });
  res.json(updated);
});

app.delete('/api/decisions/:id', async (req, res) => {
  await mutate(data => {
    data.decisions = data.decisions.filter(d => d.id !== req.params.id);
  });
  res.json({ ok: true });
});

// ── Decision log (append-only) ───────────────────────────

app.post('/api/decision-log', async (req, res) => {
  const entry = await mutate(data => {
    const entry = {
      date: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
      text: req.body.text || '',
    };
    data.decisionLog.push(entry);
    return entry;
  });
  res.status(201).json(entry);
});

// ── Risks CRUD ───────────────────────────────────────────

app.post('/api/risks', async (req, res) => {
  const risk = await mutate(data => {
    const risk = {
      id: nextId(data.risks, 'r-'),
      risk: req.body.risk || '',
      impact: req.body.impact || '',
      mitigation: req.body.mitigation || '',
      status: 'active',
    };
    data.risks.push(risk);
    return risk;
  });
  res.status(201).json(risk);
});

app.put('/api/risks/:id', async (req, res) => {
  const updated = await mutate(data => {
    const r = data.risks.find(r => r.id === req.params.id);
    if (!r) return null;
    Object.assign(r, req.body, { id: r.id });
    return r;
  });
  if (!updated) return res.status(404).json({ error: 'Risk not found' });
  res.json(updated);
});

app.delete('/api/risks/:id', async (req, res) => {
  await mutate(data => {
    data.risks = data.risks.filter(r => r.id !== req.params.id);
  });
  res.json({ ok: true });
});

// ── Start ────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Retroplanning server → http://localhost:${PORT}`);
});

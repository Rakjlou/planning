import express from 'express';
import { readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, 'data.json');
const PORT = process.env.PORT || 3000;

// ── Empty database template ──────────────────────────────

const EMPTY_DATA = {
  phases: [],
  tasks: [],
  decisionLog: [],
};

// ── ID generation ────────────────────────────────────────

function nextId(collection, prefix) {
  const nums = collection
    .map(item => parseInt(item.id.replace(prefix, ''), 10))
    .filter(n => !isNaN(n));
  return prefix + (nums.length ? Math.max(...nums) + 1 : 1);
}

// ── Server factory ───────────────────────────────────────

export function createServer({ port = PORT, dataFile = DATA_FILE } = {}) {

  // ── JSON read/write with sequential write queue ──────

  async function readData() {
    try {
      return JSON.parse(await readFile(dataFile, 'utf-8'));
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      await writeFile(dataFile, JSON.stringify(EMPTY_DATA, null, 2));
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
      await writeFile(dataFile, JSON.stringify(data, null, 2));
      return result;
    });
  }

  // ── Express app ────────────────────────────────────────

  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', join(__dirname, 'views'));
  app.enable('view cache');
  app.use(express.json());
  app.use(express.static(join(__dirname, 'public')));

  // ── Icon helper for EJS templates ──────────────────────

  const ICON_PATHS = {
    edit:   'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z',
    delete: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
    check:  'M5 13l4 4L19 7',
    cancel: 'M6 18L18 6M6 6l12 12',
  };
  const ICON_SIZES = { sm: 'w-3.5 h-3.5', md: 'w-4 h-4', lg: 'w-5 h-5' };

  function icon(name, size = 'sm') {
    return `<svg class="${ICON_SIZES[size]}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${ICON_PATHS[name]}"/></svg>`;
  }

  app.get('/', (_req, res) => {
    res.render('dashboard', { icon });
  });

  // ── GET all data ───────────────────────────────────────

  app.get('/api/data', async (_req, res) => {
    res.json(await readData());
  });

  // ── Phases CRUD ────────────────────────────────────────

  app.post('/api/phases', async (req, res) => {
    const phase = await mutate(data => {
      const phase = {
        id: nextId(data.phases, 'phase-'),
        name: req.body.name || '',
        period: req.body.period || '',
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

  // ── Tasks CRUD ─────────────────────────────────────────

  app.post('/api/tasks', async (req, res) => {
    try {
      const task = await mutate(data => {
        if (req.body.isReleaseDate && data.tasks.some(t => t.isReleaseDate)) {
          throw new Error('Une tâche est déjà marquée comme date de sortie');
        }
        const task = {
          id: nextId(data.tasks, 't-'),
          phase: req.body.phase || '',
          text: req.body.text || '',
          deadlineDate: req.body.deadlineDate || '',
          notes: req.body.notes || '',
          isReleaseDate: req.body.isReleaseDate || false,
          done: false,
          decisions: req.body.decisions || [],
        };
        data.tasks.push(task);
        return task;
      });
      res.status(201).json(task);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/tasks/:id', async (req, res) => {
    try {
      const updated = await mutate(data => {
        const task = data.tasks.find(t => t.id === req.params.id);
        if (!task) return null;
        if (req.body.isReleaseDate && !task.isReleaseDate && data.tasks.some(t => t.isReleaseDate)) {
          throw new Error('Une tâche est déjà marquée comme date de sortie');
        }
        Object.assign(task, req.body, { id: task.id });
        return task;
      });
      if (!updated) return res.status(404).json({ error: 'Task not found' });
      res.json(updated);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/tasks/:id', async (req, res) => {
    await mutate(data => {
      data.tasks = data.tasks.filter(t => t.id !== req.params.id);
    });
    res.json({ ok: true });
  });

  // ── Decision log (append-only) ─────────────────────────

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

  // ── Listen ─────────────────────────────────────────────

  const server = app.listen(port, () => {
    const addr = server.address();
    console.log(`Retroplanning server → http://localhost:${addr.port}`);
  });

  return {
    server,
    app,
    port: () => server.address().port,
    close: () => new Promise(resolve => server.close(resolve)),
  };
}

// ── Direct execution ─────────────────────────────────────

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createServer();
}

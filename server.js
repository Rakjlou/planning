import express from 'express';
import { readFile, writeFile, mkdir, access } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';
import {
  CONTRIBUTOR_COLORS, EMPTY_DATA,
  hashPassword, verifyPassword,
  makeAuthToken, verifyAuthToken,
  isValidSlug, parseCookie,
} from './lib/shared.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
const PORT = process.env.PORT || 3000;
const ALLOW_CREATE = process.env.ALLOW_CREATE === 'true';

// ── ID generation ────────────────────────────────────────

function nextId(collection, prefix) {
  const nums = collection
    .map(item => parseInt(item.id.replace(prefix, ''), 10))
    .filter(n => !isNaN(n));
  return prefix + (nums.length ? Math.max(...nums) + 1 : 1);
}

// ── Server factory ───────────────────────────────────────

export function createServer({ port = PORT, dataDir = DATA_DIR, allowCreate = ALLOW_CREATE } = {}) {

  // ── Ensure data directory exists ─────────────────────

  const ready = mkdir(dataDir, { recursive: true });

  // ── App secret (created once, persisted) ─────────────

  const secretFile = join(dataDir, '.secret');
  const secretP = ready.then(async () => {
    try {
      return await readFile(secretFile, 'utf-8');
    } catch {
      const secret = randomBytes(32).toString('hex');
      await writeFile(secretFile, secret);
      return secret;
    }
  });

  // ── Passwords file ───────────────────────────────────

  const passwordsFile = join(dataDir, 'passwords.json');

  async function readPasswords() {
    try {
      return JSON.parse(await readFile(passwordsFile, 'utf-8'));
    } catch {
      return {};
    }
  }

  async function writePasswords(passwords) {
    await writeFile(passwordsFile, JSON.stringify(passwords, null, 2));
  }

  // ── Slug data read/write with per-slug write queues ──

  const writeQueues = new Map();

  function slugFile(slug) {
    return join(dataDir, `${slug}.json`);
  }

  async function slugExists(slug) {
    try { await access(slugFile(slug)); return true; } catch { return false; }
  }

  function migrateContributors(data) {
    if (!data.contributors) { data.contributors = []; return; }
    const usedColors = new Set(data.contributors.filter(c => typeof c === 'object' && c.color).map(c => c.color));
    data.contributors = data.contributors.map(c => {
      if (typeof c === 'string') {
        const color = CONTRIBUTOR_COLORS.find(col => !usedColors.has(col)) || CONTRIBUTOR_COLORS[0];
        usedColors.add(color);
        return { name: c, color };
      }
      return c;
    });
  }

  async function readData(slug) {
    try {
      const data = JSON.parse(await readFile(slugFile(slug), 'utf-8'));
      migrateContributors(data);
      return data;
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      const data = structuredClone(EMPTY_DATA);
      await writeFile(slugFile(slug), JSON.stringify(data, null, 2));
      return data;
    }
  }

  function enqueueWrite(slug, fn) {
    const prev = writeQueues.get(slug) || Promise.resolve();
    const next = prev.then(fn).catch(err => {
      console.error('Write error:', err);
      throw err;
    });
    writeQueues.set(slug, next);
    return next;
  }

  async function mutate(slug, transformFn) {
    return enqueueWrite(slug, async () => {
      const data = await readData(slug);
      const result = transformFn(data);
      await writeFile(slugFile(slug), JSON.stringify(data, null, 2));
      return result;
    });
  }

  // ── Express app ────────────────────────────────────────

  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', join(__dirname, 'views'));
  if (!process.argv.includes('--dev')) app.enable('view cache');
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
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

  // ── Auth middleware for API routes ─────────────────────

  async function requireAuth(req, res, next) {
    const { slug } = req.params;
    const secret = await secretP;
    const token = parseCookie(req.headers.cookie, 'auth_' + slug);
    if (verifyAuthToken(token, slug, secret)) return next();
    res.status(401).json({ error: 'Non autorisé' });
  }

  // ── Root page ──────────────────────────────────────────

  app.get('/', (_req, res) => {
    res.render('home', { error: null });
  });

  // ── Slug pages ─────────────────────────────────────────

  app.get('/:slug', async (req, res) => {
    const { slug } = req.params;
    if (!isValidSlug(slug)) return res.status(404).render('home', { error: 'Page introuvable.' });

    const passwords = await readPasswords();
    const hasPassword = !!passwords[slug];

    if (!hasPassword) {
      if (!allowCreate) return res.status(404).render('home', { error: 'Page introuvable.' });
      return res.render('create', { slug, error: null });
    }

    const secret = await secretP;
    const token = parseCookie(req.headers.cookie, 'auth_' + slug);
    if (!verifyAuthToken(token, slug, secret)) {
      return res.render('login', { slug, error: null });
    }

    const data = await readData(slug);
    res.render('dashboard', { icon, slug, initialData: JSON.stringify(data), apiBase: '/' + slug + '/api' });
  });

  app.post('/:slug/create', async (req, res) => {
    if (!allowCreate) return res.status(403).render('home', { error: 'Création de pages désactivée.' });
    const { slug } = req.params;
    if (!isValidSlug(slug)) return res.status(400).render('home', { error: 'Slug invalide.' });

    const passwords = await readPasswords();
    if (passwords[slug]) return res.redirect('/' + slug);

    const password = (req.body.password || '').trim();
    const confirm = (req.body.confirm || '').trim();
    if (!password || password.length < 4) {
      return res.render('create', { slug, error: 'Le mot de passe doit faire au moins 4 caractères.' });
    }
    if (password !== confirm) {
      return res.render('create', { slug, error: 'Les mots de passe ne correspondent pas.' });
    }

    passwords[slug] = hashPassword(password);
    await writePasswords(passwords);

    const exists = await slugExists(slug);
    if (!exists) {
      await writeFile(slugFile(slug), JSON.stringify(EMPTY_DATA, null, 2));
    }

    const secret = await secretP;
    const token = makeAuthToken(slug, secret);
    res.setHeader('Set-Cookie', `auth_${slug}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${7 * 86400}`);
    res.redirect('/' + slug);
  });

  app.post('/:slug/login', async (req, res) => {
    const { slug } = req.params;
    if (!isValidSlug(slug)) return res.status(400).render('home', { error: 'Slug invalide.' });

    const exists = await slugExists(slug);
    if (!exists) return res.redirect('/' + slug);

    const password = (req.body.password || '').trim();
    const passwords = await readPasswords();
    const cred = passwords[slug];

    if (!cred || !verifyPassword(password, cred)) {
      return res.render('login', { slug, error: 'Mot de passe incorrect.' });
    }

    const secret = await secretP;
    const token = makeAuthToken(slug, secret);
    res.setHeader('Set-Cookie', `auth_${slug}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${7 * 86400}`);
    res.redirect('/' + slug);
  });

  app.post('/:slug/logout', (req, res) => {
    const { slug } = req.params;
    res.setHeader('Set-Cookie', `auth_${slug}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
    res.redirect('/' + slug);
  });

  // ── API routes (slug-scoped, auth-protected) ───────────

  app.get('/:slug/api/data', requireAuth, async (req, res) => {
    res.json(await readData(req.params.slug));
  });

  // ── Phases CRUD ────────────────────────────────────────

  app.post('/:slug/api/phases', requireAuth, async (req, res) => {
    const phase = await mutate(req.params.slug, data => {
      const phase = {
        id: nextId(data.phases, 'phase-'),
        name: req.body.name || '',
      };
      data.phases.push(phase);
      return phase;
    });
    res.status(201).json(phase);
  });

  app.put('/:slug/api/phases/:id', requireAuth, async (req, res) => {
    const updated = await mutate(req.params.slug, data => {
      const phase = data.phases.find(p => p.id === req.params.id);
      if (!phase) return null;
      Object.assign(phase, req.body, { id: phase.id });
      return phase;
    });
    if (!updated) return res.status(404).json({ error: 'Phase not found' });
    res.json(updated);
  });

  app.delete('/:slug/api/phases/:id', requireAuth, async (req, res) => {
    await mutate(req.params.slug, data => {
      data.phases = data.phases.filter(p => p.id !== req.params.id);
      data.tasks = data.tasks.filter(t => t.phase !== req.params.id);
    });
    res.json({ ok: true });
  });

  // ── Tasks CRUD ─────────────────────────────────────────

  app.post('/:slug/api/tasks', requireAuth, async (req, res) => {
    try {
      const task = await mutate(req.params.slug, data => {
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
          contributors: req.body.contributors || [],
        };
        data.tasks.push(task);
        return task;
      });
      res.status(201).json(task);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/:slug/api/tasks/:id', requireAuth, async (req, res) => {
    try {
      const updated = await mutate(req.params.slug, data => {
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

  app.delete('/:slug/api/tasks/:id', requireAuth, async (req, res) => {
    await mutate(req.params.slug, data => {
      data.tasks = data.tasks.filter(t => t.id !== req.params.id);
    });
    res.json({ ok: true });
  });

  // ── Decision log (append-only) ─────────────────────────

  app.post('/:slug/api/decision-log', requireAuth, async (req, res) => {
    const entry = await mutate(req.params.slug, data => {
      const entry = {
        date: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
        text: req.body.text || '',
      };
      data.decisionLog.push(entry);
      return entry;
    });
    res.status(201).json(entry);
  });

  // ── Contributors CRUD ──────────────────────────────────

  app.post('/:slug/api/contributors', requireAuth, async (req, res) => {
    const name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Name required' });
    let color = req.body.color || null;
    if (color && !CONTRIBUTOR_COLORS.includes(color)) color = null;
    const result = await mutate(req.params.slug, data => {
      if (!data.contributors) data.contributors = [];
      if (data.contributors.some(c => c.name === name)) return null;
      const usedColors = new Set(data.contributors.map(c => c.color));
      if (!color) color = CONTRIBUTOR_COLORS.find(c => !usedColors.has(c)) || CONTRIBUTOR_COLORS[0];
      const contributor = { name, color };
      data.contributors.push(contributor);
      return contributor;
    });
    if (result === null) return res.status(409).json({ error: 'Already exists' });
    res.status(201).json(result);
  });

  app.put('/:slug/api/contributors/:name', requireAuth, async (req, res) => {
    const name = decodeURIComponent(req.params.name);
    const color = req.body.color;
    if (!color || !CONTRIBUTOR_COLORS.includes(color)) return res.status(400).json({ error: 'Invalid color' });
    const result = await mutate(req.params.slug, data => {
      if (!data.contributors) data.contributors = [];
      const contributor = data.contributors.find(c => c.name === name);
      if (!contributor) return null;
      contributor.color = color;
      return contributor;
    });
    if (result === null) return res.status(404).json({ error: 'Not found' });
    res.json(result);
  });

  app.delete('/:slug/api/contributors/:name', requireAuth, async (req, res) => {
    const name = decodeURIComponent(req.params.name);
    await mutate(req.params.slug, data => {
      if (!data.contributors) data.contributors = [];
      data.contributors = data.contributors.filter(c => c.name !== name);
      for (const task of data.tasks) {
        if (task.contributors) {
          task.contributors = task.contributors.filter(c => c !== name);
        }
      }
    });
    res.json({ ok: true });
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

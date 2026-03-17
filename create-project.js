import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomBytes, scryptSync } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

export async function createProject(slug, password, dataDir = join(__dirname, 'data')) {
  if (!slug || !password) throw new Error('slug et password requis');
  if (!SLUG_RE.test(slug)) throw new Error('Slug invalide (3-30 chars, a-z 0-9 et tirets)');
  if (password.length < 4) throw new Error('Le mot de passe doit faire au moins 4 caractères');

  await mkdir(dataDir, { recursive: true });

  // Data file
  const dataFile = join(dataDir, `${slug}.json`);
  let existed = false;
  try {
    await readFile(dataFile);
    existed = true;
  } catch {
    await writeFile(dataFile, JSON.stringify({ contributors: [], phases: [], tasks: [], decisionLog: [] }, null, 2));
  }

  // Password entry
  const passwordsFile = join(dataDir, 'passwords.json');
  let passwords = {};
  try { passwords = JSON.parse(await readFile(passwordsFile, 'utf-8')); } catch {}

  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  passwords[slug] = { hash, salt };
  await writeFile(passwordsFile, JSON.stringify(passwords, null, 2));

  return { existed };
}

// ── CLI ──────────────────────────────────────────────────

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [slug, password] = process.argv.slice(2);
  try {
    const { existed } = await createProject(slug, password);
    console.log(existed ? `data/${slug}.json existe déjà, pas écrasé` : `data/${slug}.json créé`);
    console.log(`Mot de passe pour "${slug}" enregistré`);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

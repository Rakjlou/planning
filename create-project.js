import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { isValidSlug, hashPassword, EMPTY_DATA } from './lib/shared.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function createProject(slug, password, dataDir = join(__dirname, 'data')) {
  if (!slug || !password) throw new Error('slug et password requis');
  if (!isValidSlug(slug)) throw new Error('Slug invalide (3-30 chars, a-z 0-9 et tirets, pas un mot réservé)');
  if (password.length < 4) throw new Error('Le mot de passe doit faire au moins 4 caractères');

  await mkdir(dataDir, { recursive: true });

  // Data file
  const dataFile = join(dataDir, `${slug}.json`);
  let existed = false;
  try {
    await readFile(dataFile);
    existed = true;
  } catch {
    await writeFile(dataFile, JSON.stringify(EMPTY_DATA, null, 2));
  }

  // Password entry
  const passwordsFile = join(dataDir, 'passwords.json');
  let passwords = {};
  try { passwords = JSON.parse(await readFile(passwordsFile, 'utf-8')); } catch {}

  passwords[slug] = hashPassword(password);
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

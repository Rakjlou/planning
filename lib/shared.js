import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'crypto';

// ── Contributor color palette ────────────────────────────

export const CONTRIBUTOR_COLORS = [
  '#a78bfa', // violet
  '#f472b6', // pink
  '#22d3ee', // cyan
  '#2dd4bf', // teal
  '#fb7185', // rose
  '#818cf8', // indigo
  '#a3e635', // lime
  '#e879f9', // fuchsia
  '#38bdf8', // sky
  '#fcd34d', // amber
];

// ── Empty database template ──────────────────────────────

export const EMPTY_DATA = {
  contributors: [],
  phases: [],
  tasks: [],
  decisionLog: [],
};

// ── Slug validation ──────────────────────────────────────

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;
const SLUG_BLOCKLIST = new Set(['api', 'js', 'css', 'public', 'favicon', 'data']);

export function isValidSlug(slug) {
  return SLUG_RE.test(slug) && !SLUG_BLOCKLIST.has(slug);
}

// ── Password hashing ─────────────────────────────────────

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

export function verifyPassword(password, { hash, salt }) {
  const buf = scryptSync(password, salt, 64);
  return timingSafeEqual(buf, Buffer.from(hash, 'hex'));
}

// ── Auth tokens (HMAC cookie) ────────────────────────────

export function makeAuthToken(slug, secret) {
  const ts = Date.now().toString(36);
  const hmac = createHmac('sha256', secret).update(slug + ':' + ts).digest('hex');
  return ts + ':' + hmac;
}

export function verifyAuthToken(token, slug, secret, maxAgeMs = 7 * 24 * 3600 * 1000) {
  if (!token) return false;
  const parts = token.split(':');
  if (parts.length !== 2) return false;
  const [ts, hmac] = parts;
  const timestamp = parseInt(ts, 36);
  if (isNaN(timestamp) || Date.now() - timestamp > maxAgeMs) return false;
  const expected = createHmac('sha256', secret).update(slug + ':' + ts).digest('hex');
  if (hmac.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(hmac), Buffer.from(expected));
}

// ── Cookie parsing ───────────────────────────────────────

export function parseCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  const match = cookieHeader.split(';').map(s => s.trim()).find(s => s.startsWith(name + '='));
  return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : null;
}

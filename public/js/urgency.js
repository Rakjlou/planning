// ── Urgency thresholds ──────────────────────────────────
//
// Every urgency function uses the same breakpoints:
//   < 14 days  → red    (overdue or imminent)
//   < 30 days  → orange (approaching)
//   < 60 days  → accent (on the horizon)
//   >= 60 days → green  (comfortable)
//
// A single lookup drives all representations (text color,
// badge, glow class) so the thresholds stay in sync.

const URGENCY_TIERS = [
  { max: 14,       text: 'text-cod-red',    badge: 'bg-cod-red/20 text-cod-red',       glow: 'urgency-glow-red' },
  { max: 30,       text: 'text-cod-orange',  badge: 'bg-cod-orange/20 text-cod-orange', glow: 'urgency-glow-orange' },
  { max: 60,       text: 'text-cod-accent',  badge: 'bg-cod-accent/20 text-cod-accent', glow: 'urgency-glow-yellow' },
  { max: Infinity, text: 'text-cod-green',   badge: 'bg-cod-green/20 text-cod-green',   glow: 'urgency-glow-green' },
];

function daysUntil(dateStr) {
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
}

function urgencyTier(days) {
  return URGENCY_TIERS.find(t => days < t.max);
}

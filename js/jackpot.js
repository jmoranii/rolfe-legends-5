// Rolfe Legends 5 — the Jackpot (Wyatt's design, exact; DESIGN.md §5). Pure + seeded.
// Three slots, two faces each: Stella|Corn · Lucy|Tomato · Delilah|Onion.
// 45% all three cousins → the Cousin Card · 45% all three crops → a fight ·
// 10% mixed → the Cactus. One free spin per world; you may walk past.
// The outcome is picked FIRST, then the faces are drawn to match it.

export const SLOTS = [
  { cousin: { key: 'stella', name: 'Stella', emoji: '👑' }, crop: { key: 'corn', name: 'Corn', emoji: '🌽' } },
  { cousin: { key: 'lucy', name: 'Lucy', emoji: '🫧' }, crop: { key: 'tomato', name: 'Tomato', emoji: '🍅' } },
  { cousin: { key: 'delilah', name: 'Delilah', emoji: '💅' }, crop: { key: 'onion', name: 'Onion', emoji: '🧅' } },
];
export const ODDS = { cousins: 0.45, crops: 0.45, mixed: 0.10 };

export function spinOutcome(rng, odds = ODDS) {
  const r = rng.random();
  if (r < odds.cousins) return 'cousins';
  if (r < odds.cousins + odds.crops) return 'crops';
  return 'mixed';
}

// faces: for each slot, 'cousin' or 'crop'
export function facesFor(outcome, rng) {
  if (outcome === 'cousins') return ['cousin', 'cousin', 'cousin'];
  if (outcome === 'crops') return ['crop', 'crop', 'crop'];
  for (let g = 0; g < 20; g++) {
    const f = SLOTS.map(() => (rng.random() < 0.5 ? 'cousin' : 'crop'));
    if (!f.every((x) => x === f[0])) return f;
  }
  return ['cousin', 'crop', 'crop'];
}

export function spin(rng, odds = ODDS) {
  const outcome = spinOutcome(rng, odds);
  const faces = facesFor(outcome, rng);
  return { outcome, faces, shown: faces.map((f, i) => SLOTS[i][f]) };
}

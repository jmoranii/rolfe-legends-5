// Rolfe Legends 5 — card text (pure). Fills {d} {b} {n} {t} {pg} {s} {now} placeholders.
// With a live combat state the numbers are LIVE (Strong/Weak, Touches, Gears, the
// Book Meter) and a changed number is marked up/down — the StS trick that makes
// buffs visibly matter. Plain words only.

import { nValue, touchValue, pageValue, scaleValue, firstDmgIdx } from './cards.js';
import * as C from './combat.js';

function mark(live, base, markup) {
  if (!markup || live === base) return String(live);
  return `<b class="${live > base ? 'val-up' : 'val-down'}">${live}</b>`;
}

export function cardText(info, state = null, { markup = true } = {}) {
  const fx = info.fx || [];
  const di = firstDmgIdx(info);
  const dmgOp = di >= 0 ? fx[di] : null;
  const blockOp = fx.find((o) => o.block != null);
  // {d}: the card's damage per hit (base number on reward/shop screens; live in a fight)
  let dText = '?';
  if (dmgOp) {
    const base = dmgOp.bookStorm ? (state ? C.bookStormDamage(state) : dmgOp.dmg) : dmgOp.dmg;
    if (state) {
      // the per-Touch / per-gear part is shown separately, so {d} leaves it out
      const live = C.attackValue(C.opBase(state, { ...dmgOp, shot: 0, downshift: 0 }), state.hero);
      dText = mark(live, base, markup);
    } else dText = String(base);
  }
  let bText = blockOp ? String(blockOp.block) : '?';
  if (state && blockOp) bText = mark(blockOp.block + C.gearBonus(state), blockOp.block, markup);
  // {now}: the live total, only during a fight; nothing on reward/shop screens
  let nowText = '';
  if (state) {
    if (dmgOp && (dmgOp.shot || dmgOp.downshift)) nowText = ` (right now: ${C.attackValue(C.opBase(state, dmgOp), state.hero)})`;
    const bpg = fx.find((o) => o.blockPerGear != null);
    if (bpg) nowText = ` (right now: ${bpg.blockPerGear * state.gear})`;
  }
  let body = (info.text || '')
    .replace('{now}', nowText)
    .replace('{d}', dText)
    .replace('{b}', bText)
    .replace('{n}', String(nValue(info) ?? '?'))
    .replace('{t}', String(touchValue(info) ?? '?'))
    .replace('{pg}', String(pageValue(info) ?? '?'))
    .replace('{s}', String(scaleValue(info) ?? '?'));
  if (info.type === 'power') body += ' Lasts the whole fight!';
  return body;
}

export function plainText(info, state = null) {
  return cardText(info, state, { markup: false }).replace(/<[^>]*>/g, '');
}

// Rolfe Legends 5 — selfplay balance harness. Simulates FULL runs (3 crop worlds,
// one deck) with hero-aware bots that genuinely play Touches/SHOT, Tractor Gears/
// Downshift, and the Book Meter/BOOK STORM!, aim the Cousin Card's "Nuh-uh!" at the
// biggest incoming hit, and follow four strategies: Jackpot spin vs walk past ×
// saved-cards normal vs hoard. Reports every GOAL.md Phase 4 rail; exits non-zero
// on a rail failure.
//   node test/selfplay.mjs [runs-per-hero-per-strategy] [--hl N]

import { makeRng } from '../js/rng.js';
import { CARDS, HEROES, cardInfo, makeCard, upgradableCards, COUSIN_ID, BOOK_STORM_ID } from '../js/cards.js';
import { WORLDS } from '../js/worlds.js';
import * as C from '../js/combat.js';
import * as R from '../js/run.js';

const args = process.argv.slice(2);
const RUNS = Number(args.find((a) => /^\d+$/.test(a)) ?? 60);
if (!Number.isFinite(RUNS) || RUNS < 1) { console.log(`RAIL FAIL: bad run count ${args[0]}`); process.exit(1); }
const HL = args.includes('--hl') ? Number(args[args.indexOf('--hl') + 1]) : 0;
export const HERO_IDS = ['wyatt', 'aaron', 'liam'];
export const STRATS = ['spin/normal', 'spin/hoard', 'walk/normal', 'walk/hoard'];

// ---------- card tier list (the harness measures; data gets tuned) ----------
export const PICK = {
  give_and_go: 6, dribble_past: 6, header: 6, chip_shot: 6, step_over: 5, wall_pass: 6,
  bicycle_kick: 7, corner_kick: 7, rainbow_flick: 6, sliding_save: 6, keepy_uppy: 7, through_ball: 6,
  golden_boot: 8, fast_break: 7, penalty_kick: 8,
  rev_it: 6, mud_spray: 6, bumper: 6, big_wheels: 6, gear_grind: 6, tow_hitch: 6,
  tractor_horn: 6, hay_wagon: 7, second_gear: 7, plow_through: 7, roll_bar: 6, engine_roar: 6,
  full_throttle: 8, last_furrow: 8, big_red_charge: 7,
  story_time: 7, pop_up_book: 7, dinosaur_book: 6, space_book: 6, picture_book: 6, bedtime_story: 6,
  library_day: 7, sequel: 6, page_turner: 7, big_book_bonk: 6, read_aloud: 7, book_fort: 5,
  the_end: 7, bookworm: 8, overdue_book: 6,
};
const BOSS_PREF = ['golden_corn', 'grain_bin', 'blue_ribbon', 'tomato_cage', 'county_trophy'];

// ---------- the turn policy ----------
function incoming(state) {
  let t = 0;
  for (const e of C.livingEnemies(state)) { const p = C.intentPreview(state, e); if (p) t += p.per * p.times; }
  return t;
}
function effHp(e) { return e.hp + (e.block || 0) + (e.shield || 0); }

function scoreCard(state, c, ctx) {
  const info = cardInfo(c);
  const h = state.hero;
  const cost = C.effectiveCost(state, c);
  const enemies = C.targetableEnemies(state);
  if (!enemies.length) return { s: -1 };
  let target = enemies.slice().sort((a, b) => effHp(a) - effHp(b))[0];
  let s = 0;
  if (info.type === 'power') s += state.turn <= 3 ? 14 : 6;
  const scaling = (info.fx || []).find((o) => o.shot || o.downshift);
  if (info.type === 'attack') {
    const per = C.previewCardDamage(state, info);
    const allE = (info.fx || []).some((o) => o.allEnemies);
    if (allE) { for (const e of enemies) { s += Math.min(per, effHp(e)); if (per >= effHp(e)) s += 6; } }
    else { s += Math.min(per, effHp(target)); if (per >= effHp(target)) s += 8; }
    // the Ripe Tomato: big hits beat lots of little ones (each hit ripens it)
    if (target.key === 'ripe_tomato') s -= ((info.fx || []).reduce((a, o) => a + (o.dmg != null ? (o.times || 1) : 0), 0) - 1) * 3;
    // SHOT / Downshift: wait for a bigger wind-up unless it's lethal or the meter's full
    if (scaling && scaling.shot && state.touches < 3 && per < effHp(target)) s -= 6;
    if (scaling && scaling.downshift && state.gear < 3 && per < effHp(target)) s -= 6;
  }
  const blk = C.previewBlock(state, info);
  const need = Math.max(0, ctx.incoming - h.block);
  s += Math.min(blk, need) * 1.15 + Math.max(0, blk - need) * 0.08;
  for (const o of info.fx || []) {
    if (o.draw) s += 2.2 * o.draw;
    if (o.touch) s += o.touch * (state.touches + o.touch <= C.touchCap(state) ? 2.2 : 0.3);
    if (o.shift) s += state.gear < 3 ? 6 : 0.5;
    if (o.page) s += o.page * 2 + (state.pages + o.page >= 4 ? 4 + 8 * enemies.length : 0);
    if (o.fillBook) s += 6 + 8 * enemies.length;
    if (o.sequel) s += 6;
    if (o.status && o.status.k === 'strong') s += o.status.n * 3;
    if (o.status && o.status.k === 'weak') s += Math.min(ctx.incoming, 14) * 0.25 * o.status.n;
    if (o.status && o.status.k === 'bruised') s += 3;
    if (o.cancel) {
      // aim Delilah's "Nuh-uh!" at the biggest incoming attack
      let best = null, bv = 0;
      for (const e of enemies) { const p = C.intentPreview(state, e); const v = p ? p.per * p.times : 0; if (v > bv) { bv = v; best = e; } }
      if (best) { target = best; s += bv * 1.2; } else s -= 4; // nothing to cancel yet: hold it
    }
  }
  return { s: s - cost * 0.6, target };
}

export function playTurn(state, hoard = false) {
  let guard = 60;
  while (!state.over && guard-- > 0 && state.phase === 'hero') {
    const playable = state.hand.filter((c) => C.canPlay(state, c));
    const ctx = { incoming: incoming(state) };
    let best = null, bestS = 0.5;
    for (const c of playable) {
      const r = scoreCard(state, c, ctx);
      if (r.s > bestS) { bestS = r.s; best = { c, target: r.target, s: r.s }; }
    }
    if (!best) break;
    // hoard: when one enemy is left and a lethal attack is in hand, finish it with the
    // cheapest-to-lose card so the good ones carry into the next fight
    if (hoard && C.livingEnemies(state).length === 1) {
      const foe = C.livingEnemies(state)[0];
      const lethal = playable.filter((c) => cardInfo(c).type === 'attack' && C.targetable(state, foe) && C.previewCardDamage(state, cardInfo(c)) >= effHp(foe));
      if (lethal.length) { lethal.sort((a, b) => (PICK[a.id] ?? 2) - (PICK[b.id] ?? 2)); C.playCard(state, lethal[0], foe); continue; }
    }
    C.playCard(state, best.c, best.target);
  }
}

export function fight(run, encounter, kind, seed, stats, hoard = false) {
  const st = C.startCombat(run, encounter, makeRng(seed), { kind });
  let turns = 0;
  const hp0 = st.hero.hp;
  while (!st.over && turns < 60) { playTurn(st, hoard); if (st.over) break; C.endTurn(st); turns++; }
  if (!st.over) { st.over = true; st.won = false; st.hero.hp = 0; st.killedBy = { name: 'STALEMATE' }; }
  if (stats) {
    stats.turnsBy[kind].push(st.turn);
    stats.hpLost[kind].push(hp0 - st.hero.hp);
  }
  return st;
}

// ---------- run-level decisions ----------
function bestUpgrade(run) {
  const ups = upgradableCards(run.deck);
  ups.sort((a, b) => (PICK[b.id] ?? 3) - (PICK[a.id] ?? 3));
  return ups[0];
}
function worstCard(run) {
  const v = (c) => PICK[c.id] ?? (CARDS[c.id].rarity === 'starter' ? (['read_book', 'power_shot', 'shift_up', 'hay_bale_launch'].includes(c.id) ? 5 : 1) : 3);
  const cands = run.deck.slice();
  cands.sort((a, b) => v(a) - v(b));
  return cands[0];
}
let taste = {};
function setTaste(seed) {
  const g = makeRng(seed ^ 0x7A57E);
  taste = {};
  for (const k of Object.keys(PICK)) taste[k] = PICK[k] + (g.random() * 4 - 2);
}
const pv = (id) => taste[id] ?? PICK[id] ?? 4;
function pickCard(run, ids) {
  let best = null, bs = 5.4;
  const counts = {};
  for (const c of run.deck) counts[c.id] = (counts[c.id] || 0) + 1;
  for (const id of ids) { const s = pv(id) - (counts[id] || 0) * 1.2; if (s > bs) { bs = s; best = id; } }
  return best;
}
function doShop(run, shop) {
  let guard = 10;
  while (guard-- > 0) {
    if (!shop.removed && run.coins >= shop.removePrice && run.deck.length > 9) { const w = worstCard(run); if (w && R.shopRemoveCard(run, shop, w.uid)) continue; }
    const ti = shop.treasures.findIndex((x) => x.price <= run.coins);
    if (ti >= 0 && R.shopBuyTreasure(run, shop, ti)) continue;
    const ci = shop.cards.findIndex((x) => x.price <= run.coins && pickCard(run, [x.id]));
    if (ci >= 0 && R.shopBuyCard(run, shop, ci)) continue;
    break;
  }
}
function chooseNode(run) {
  const opts = R.nextNodes(run);
  const hpPct = run.hp / run.maxHp;
  const score = (n) => (n.type === 'treasure' ? 3 : n.type === 'fight' ? (hpPct > 0.5 ? 2 : 0) : 1);
  return opts.slice().sort((a, b) => score(b) - score(a))[0];
}

export function simulateRun(hero, strat, seed, stats, harvestLevel = HL) {
  const run = R.newRun(hero, seed, { harvestLevel });
  const rng = makeRng(seed ^ 0xBEEF);
  setTaste(seed);
  const [jack, saveMode] = strat.split('/');
  const hoard = saveMode === 'hoard';
  const log = { hero, strat, won: false, world: 1, killer: null };
  for (;;) {
    const node = chooseNode(run);
    const res = R.enterMapNode(run, node.id);
    let kind = res.type;
    let encounter = res.encounter;
    if (res.type === 'shop') { doShop(run, res.shop); continue; }
    if (res.type === 'treasure') continue;
    if (res.type === 'rest') {
      if (run.hp / run.maxHp < 0.6) R.restHeal(run); else { const u = bestUpgrade(run); if (u) R.restPractice(run, u.uid); else R.restHeal(run); }
      continue;
    }
    if (res.type === 'jackpot') {
      if (jack === 'walk') { R.walkPastJackpot(run); continue; }
      const j = R.spinJackpot(run, rng);
      stats.jackpot[j.outcome] += 1;
      if (j.outcome !== 'crops') continue;
      kind = 'medley'; encounter = j.encounter;
    }
    const keyBase = `${run.world}:${kind}`;
    stats.reach[keyBase] = (stats.reach[keyBase] || 0) + 1;
    const st = fight(run, encounter, kind, (seed * 31 + run.world * 1009 + run.floor * 97) >>> 0, stats, hoard);
    const encKey = `${kind}:${encounter.enemies.join('+')}`;
    if (kind === 'boss' || kind === 'elite') {
      const k = `${run.world}:${kind}`;
      const d = stats.dmgTo[k] || (stats.dmgTo[k] = []);
      d.push(st.hpLostThisFight || 0);
    }
    if (!st.won) {
      log.killer = encKey; log.world = run.world;
      stats.deaths[encKey] = (stats.deaths[encKey] || 0) + 1;
      break;
    }
    stats.won[keyBase] = (stats.won[keyBase] || 0) + 1;
    R.applyCombatResult(run, st, kind);
    stats.savedPer.push(run.saved.length);
    const rw = R.fightRewards(run, kind, rng);
    const id = pickCard(run, rw.cards);
    if (id) run.deck.push(makeCard(id));
    if (kind === 'boss') {
      if (run.world >= 3) { log.won = true; log.world = 3; break; }
      R.afterBoss(run);
      if (rw.bossTreasures && rw.bossTreasures.length) { const t = BOSS_PREF.find((x) => rw.bossTreasures.includes(x)) || rw.bossTreasures[0]; R.gainTreasure(run, t); }
      R.advanceWorld(run);
    }
  }
  stats.turnsTotal.push(run.stats.turns);
  stats.cousinPlays.push(run.stats.cousinPlays);
  if (log.won) { stats.wins += 1; stats.winTurns.push(run.stats.turns); }
  return log;
}

export function newStats() {
  const k = () => ({ fight: [], elite: [], medley: [], boss: [] });
  return { turnsBy: k(), hpLost: k(), deaths: {}, reach: {}, won: {}, dmgTo: {}, turnsTotal: [], winTurns: [], wins: 0,
    savedPer: [], cousinPlays: [], jackpot: { cousins: 0, crops: 0, mixed: 0 } };
}
export const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
export const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const pct = (x) => `${(x * 100).toFixed(1)}%`;

// ---------- main (skipped when imported) ----------
if (import.meta.url === `file://${process.argv[1]}`) {
  const all = newStats();
  const table = {};
  const byHero = {};
  const seedBase = 1000 + HL * 100000;
  for (const hero of HERO_IDS) {
    byHero[hero] = { runs: 0, wins: 0 };
    for (const strat of STRATS) {
      let wins = 0;
      for (let i = 0; i < RUNS; i++) {
        const log = simulateRun(hero, strat, (seedBase + i * 7907 + hero.length * 13 + strat.length * 101) >>> 0, all);
        if (log.won) wins++;
        byHero[hero].runs++; if (log.won) byHero[hero].wins++;
      }
      table[`${hero}/${strat}`] = wins / RUNS;
    }
  }
  // starter decks vs every World-1 normal fight (fresh HP) — >90% each
  const starterRes = {};
  for (const hero of HERO_IDS) {
    const enc = WORLDS[1].encounters;
    for (const group of [...enc.easy, ...enc.hard]) {
      let w = 0; const N = 40;
      for (let i = 0; i < N; i++) {
        const run = R.newRun(hero, 7 + i, { harvestLevel: HL });
        if (fight(run, { enemies: group }, 'fight', 99 + i * 17, null).won) w++;
      }
      starterRes[`${hero}:${group.join('+')}`] = w / N;
    }
  }
  const out = [];
  const P = (s) => out.push(s);
  P(`RL5 selfplay — ${RUNS} runs per hero per strategy (${RUNS * HERO_IDS.length * STRATS.length} runs)${HL ? ` · Harvest Level ${HL}` : ''}`);
  for (const hero of HERO_IDS) P(`  ${hero.padEnd(6)} ${pct(byHero[hero].wins / byHero[hero].runs)}   ` + STRATS.map((s) => `${s} ${pct(table[`${hero}/${s}`])}`).join(' · '));
  const heroRates = HERO_IDS.map((h) => byHero[h].wins / byHero[h].runs);
  const sr = (pred) => mean(HERO_IDS.flatMap((h) => STRATS.filter(pred).map((s) => table[`${h}/${s}`])));
  const spinR = sr((s) => s.startsWith('spin')), walkR = sr((s) => s.startsWith('walk'));
  const hoardR = sr((s) => s.endsWith('hoard')), normR = sr((s) => s.endsWith('normal'));
  P(`  Jackpot: spin ${pct(spinR)} vs walk past ${pct(walkR)} · outcomes cousins ${all.jackpot.cousins} / crops ${all.jackpot.crops} / mixed ${all.jackpot.mixed}`);
  P(`  saved cards: hoard ${pct(hoardR)} vs normal ${pct(normR)} · median saved per fight ${median(all.savedPer)} (mean ${mean(all.savedPer).toFixed(2)}) · Cousin Card plays/run ${mean(all.cousinPlays).toFixed(1)}`);
  P(`  median turns: fight ${median(all.turnsBy.fight)} · mini boss ${median(all.turnsBy.elite)} · medley ${median(all.turnsBy.medley)} · boss ${median(all.turnsBy.boss)}`);
  P(`  avg HP lost: fight ${mean(all.hpLost.fight).toFixed(1)} · mini boss ${mean(all.hpLost.elite).toFixed(1)} · medley ${mean(all.hpLost.medley).toFixed(1)} · boss ${mean(all.hpLost.boss).toFixed(1)}`);
  const condRows = [];
  const bossVsElite = [];
  for (const w of [1, 2, 3]) {
    const r = (k) => (all.reach[`${w}:${k}`] ? (all.won[`${w}:${k}`] || 0) / all.reach[`${w}:${k}`] : null);
    const d = (k) => mean(all.dmgTo[`${w}:${k}`] || []);
    const eR = r('elite'), bR = r('boss');
    condRows.push(`W${w} mini boss ${eR == null ? '—' : pct(eR)} (${d('elite').toFixed(0)} dmg) · boss ${bR == null ? '—' : pct(bR)} (${d('boss').toFixed(0)} dmg)`);
    if (eR != null && bR != null && (all.reach[`${w}:boss`] || 0) >= 20) bossVsElite.push({ w, eR, bR, eD: d('elite'), bD: d('boss') });
  }
  P(`  win rate when reached: ${condRows.join(' | ')}`);
  const winTurns = mean(all.winTurns);
  const estMin = (winTurns * 15) / 60 + 8;
  P(`  completed-run turns ${winTurns.toFixed(0)} → est ${estMin.toFixed(1)} min (15 s/turn + 8 min scenes & choices)`);
  const deathTotal = Object.values(all.deaths).reduce((a, b) => a + b, 0) || 1;
  const topDeaths = Object.entries(all.deaths).sort((a, b) => b[1] - a[1]).slice(0, 8);
  P(`  top deaths: ` + topDeaths.map(([k, n]) => `${k} ${pct(n / deathTotal)}`).join(' · '));
  const starterFails = Object.entries(starterRes).filter(([, r]) => r < 0.9);
  P(`  starter vs W1 normals: ${Object.keys(starterRes).length - starterFails.length}/${Object.keys(starterRes).length} ≥90%` + (starterFails.length ? ` · FAIL ${starterFails.map(([k, r]) => `${k} ${pct(r)}`).join(', ')}` : ''));
  const fails = [];
  if (!HL) heroRates.forEach((r, i) => { if (r < 0.17 || r > 0.27) fails.push(`${HERO_IDS[i]} winrate ${pct(r)} outside 17–27%`); });
  if (!HL && Math.max(...heroRates) - Math.min(...heroRates) > 0.08) fails.push(`hero parity spread ${pct(Math.max(...heroRates) - Math.min(...heroRates))} > 8 pts`);
  if (!HL && (spinR - walkR > 0.10 || spinR - walkR < -0.03)) fails.push(`Jackpot spin−walk ${pct(spinR - walkR)} outside 0–10 pts`);
  if (!HL && hoardR - normR > 0.05) fails.push(`hoarding beats normal by ${pct(hoardR - normR)} > 5 pts`);
  for (const x of bossVsElite) {
    if (x.bR >= x.eR) fails.push(`W${x.w} boss (${pct(x.bR)}) not harder than its mini boss (${pct(x.eR)})`);
    if (x.bD <= x.eD) fails.push(`W${x.w} boss deals ${x.bD.toFixed(0)} ≤ mini boss ${x.eD.toFixed(0)}`);
  }
  const mf = median(all.turnsBy.fight), me = median(all.turnsBy.elite), mb = median(all.turnsBy.boss);
  if (mf < 3 || mf > 6) fails.push(`median normal fight ${mf} turns (3–6)`);
  if (me < 6 || me > 10) fails.push(`median mini boss ${me} turns (6–10)`);
  if (mb < 8 || mb > 14) fails.push(`median boss ${mb} turns (8–14)`);
  if (starterFails.length) fails.push(`starter decks lose W1 normals: ${starterFails.length}`);
  if (topDeaths.length && topDeaths[0][1] / deathTotal > 0.35) fails.push(`death spike: ${topDeaths[0][0]} ${pct(topDeaths[0][1] / deathTotal)} > 35%`);
  if (!HL && all.winTurns.length && (estMin < 30 || estMin > 45)) fails.push(`run length est ${estMin.toFixed(1)} min outside 30–45`);
  P(fails.length ? `RAILS: ${fails.length} FAIL\n  - ${fails.join('\n  - ')}` : 'RAILS: ALL CLEAR');
  console.log(out.join('\n'));
  process.exitCode = fails.length ? 1 : 0;
}

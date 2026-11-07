// Rolfe Legends 5 — run layer (pure, no DOM): one run, one deck, three crop worlds.
// The Jackpot (Wyatt), saved cards (Wyatt), shops, treasures, rest, boss → next world.
// DESIGN.md §4–§5.

import { HEROES, CARDS, makeCard, draftPool, RARITY_WEIGHTS, upgradableCards, bumpUid } from './cards.js';
import { TREASURES, treasurePool, bossTreasurePool } from './treasures.js';
import { WORLDS, WORLD_COUNT } from './worlds.js';
import { makeRng } from './rng.js';
import { generateWorldMap, reachableIds, BOSS_ID } from './map.js';
import { spin, ODDS } from './jackpot.js';
import { savedHandUids } from './combat.js';

export const START_COINS = 60;
export const RUN_VERSION = 5;

// ---------- run creation ----------
export function newRun(heroId, seed, { harvestLevel = 0 } = {}) {
  const hero = HEROES[heroId];
  const maxHp = hero.hp - (harvestLevel >= 8 ? 5 : 0);
  return {
    v: RUN_VERSION, seed, rngCalls: 0,
    hero: heroId, hp: maxHp, maxHp,
    coins: START_COINS,
    deck: hero.starter.map((id) => makeCard(id)),
    relics: [hero.relic],
    saved: [],               // uids carried into the next fight (Wyatt's saved cards)
    cousinCard: false,       // won at this world's Jackpot; leaves with the world boss
    jackpotDone: false,      // this world's spin used (or walked past)
    world: 1, floor: 0,
    map: generateWorldMap(seed, 1),
    pos: null, trail: [],
    removeUses: 0,
    harvestLevel,
    stats: { fights: 0, elites: 0, medleys: 0, turns: 0, spins: 0, walkedPast: 0, jackpot: { cousins: 0, crops: 0, mixed: 0 },
      cousinPlays: 0, nuhUhs: 0, savedIn: 0, savedFights: 0, coins: 0, spent: 0 },
  };
}

export function runRng(run) {
  run.rngCalls += 1;
  return makeRng((run.seed ^ (run.world * 7919) ^ (run.floor * 104729) ^ Math.imul(run.rngCalls, 0x27D4EB2F)) >>> 0);
}

// ---------- the map ----------
export function nextNodes(run) {
  return reachableIds(run.map, run.pos).map((id) => ({ id, ...run.map.nodes[id] }));
}

export function enterMapNode(run, id) {
  if (!reachableIds(run.map, run.pos).includes(id)) return null;
  const node = run.map.nodes[id];
  run.pos = id;
  run.trail.push(id);
  run.floor = node.f;
  return resolveNode(run, node.type);
}

export function resolveNode(run, type) {
  const rng = runRng(run);
  const enc = WORLDS[run.world].encounters;
  switch (type) {
    case 'fight': {
      const pool = run.floor <= 2 ? enc.easy : (rng.chance(0.3) ? enc.easy : enc.hard);
      return { type: 'fight', encounter: { enemies: rng.pick(pool) } };
    }
    case 'elite': return { type: 'elite', encounter: { enemies: rng.pick(enc.elite) } };
    case 'boss': return { type: 'boss', encounter: { enemies: rng.pick(enc.boss) } };
    case 'jackpot': return { type: 'jackpot', done: run.jackpotDone };
    case 'shop': return { type: 'shop', shop: makeShop(run, rng) };
    case 'treasure': {
      const p = treasurePool(run.relics);
      const t = p.length ? rng.pick(p) : null;
      if (t) gainTreasure(run, t);
      return { type: 'treasure', treasure: t };
    }
    case 'rest': return { type: 'rest' };
    default: return { type };
  }
}

// ---------- the Jackpot (Wyatt's design; DESIGN.md §5) ----------
export function jackpotOdds(run) {
  return run.harvestLevel >= 10 ? { cousins: 0.35, crops: 0.55, mixed: 0.10 } : ODDS;
}
// One free spin per world. Returns { outcome, faces, shown, encounter? }.
export function spinJackpot(run, rng = runRng(run)) {
  if (run.jackpotDone) return null;
  run.jackpotDone = true;
  const res = spin(rng, jackpotOdds(run));
  run.stats.spins += 1;
  run.stats.jackpot[res.outcome] += 1;
  if (res.outcome === 'cousins') run.cousinCard = true;
  if (res.outcome === 'mixed' && !run.relics.includes('cactus')) run.relics.push('cactus');
  if (res.outcome === 'crops') res.encounter = { enemies: [...WORLDS[run.world].encounters.medley] };
  return res;
}
export function walkPastJackpot(run) {
  if (run.jackpotDone) return false;
  run.jackpotDone = true;
  run.stats.walkedPast += 1;
  return true;
}

// ---------- treasures ----------
export function gainTreasure(run, id) {
  if (!TREASURES[id] || run.relics.includes(id)) return false;
  run.relics.push(id);
  if (id === 'piggy_jar') { run.coins += 60; run.stats.coins += 60; }
  if (id === 'county_trophy') { run.maxHp += 12; run.hp += 12; }
  return true;
}

// ---------- combat rewards ----------
const PRICE = { common: 45, uncommon: 70, rare: 140 };
const TREASURE_PRICE = 120;
export function pickRarity(rng) {
  const total = RARITY_WEIGHTS.common + RARITY_WEIGHTS.uncommon + RARITY_WEIGHTS.rare;
  let r = rng.int(total);
  if ((r -= RARITY_WEIGHTS.common) < 0) return 'common';
  if ((r -= RARITY_WEIGHTS.uncommon) < 0) return 'uncommon';
  return 'rare';
}
export function cardDraft(run, rng, n = 3, force = null) {
  const pool = draftPool(run.hero);
  const picks = [];
  const used = new Set();
  for (let i = 0; i < n; i++) {
    const rarity = force || pickRarity(rng);
    let cands = pool.filter((id) => CARDS[id].rarity === rarity && !used.has(id));
    if (!cands.length) cands = pool.filter((id) => !used.has(id));
    if (!cands.length) break;
    const id = rng.pick(cands);
    used.add(id); picks.push(id);
  }
  return picks;
}

// kind: fight | elite | medley | boss
export function fightRewards(run, kind, rng) {
  const r = { coins: 0, cards: [], treasure: null, bossTreasures: null };
  if (kind === 'fight') r.coins = rng.range(13, 19);
  if (kind === 'elite') r.coins = 32;
  if (kind === 'medley') r.coins = 45;
  if (kind === 'boss') r.coins = 70;
  run.coins += r.coins; run.stats.coins += r.coins;
  const n = run.relics.includes('farm_bell') ? 4 : 3;
  if (kind === 'fight' || kind === 'elite') r.cards = cardDraft(run, rng, n);
  if (kind === 'medley') r.cards = cardDraft(run, rng, n, 'rare');
  if (kind === 'elite') {
    const p = treasurePool(run.relics);
    if (p.length) { r.treasure = rng.pick(p); gainTreasure(run, r.treasure); }
  }
  if (kind === 'boss' && run.world < WORLD_COUNT) r.bossTreasures = rng.shuffle(bossTreasurePool(run.relics)).slice(0, 3);
  return r;
}

export function applyCombatResult(run, st, kind) {
  run.hp = st.hero.hp;
  run.stats.turns += st.turn;
  run.stats.cousinPlays += st.cousinPlays || 0;
  run.stats.nuhUhs += st.nuhUhs || 0;
  run.stats.savedIn += st.savedIn || 0;
  if (st.savedIn) run.stats.savedFights += 1;
  if (kind === 'fight') run.stats.fights += 1;
  if (kind === 'elite') run.stats.elites += 1;
  if (kind === 'medley') run.stats.medleys += 1;
  let healed = 0;
  if (st.won) {
    run.saved = savedHandUids(st).filter((u) => run.deck.some((c) => c.uid === u));
    if (run.relics.includes('watering_can') && run.hp > 0) { healed = Math.min(3, run.maxHp - run.hp); run.hp += healed; }
  }
  return { healed, saved: run.saved.length };
}

export function takeCard(run, id) {
  if (!CARDS[id]) return false;
  run.deck.push(makeCard(id));
  return true;
}

// ---------- shop: Grampa Flaj's Seed Shed ----------
function priceMult(run) { return run.harvestLevel >= 7 ? 1.15 : 1; }
export function makeShop(run, rng) {
  const m = priceMult(run);
  const cards = cardDraft(run, rng, 5).map((id) => ({ id, price: Math.round(PRICE[CARDS[id].rarity] * (0.9 + rng.random() * 0.2) * m) }));
  const treasures = rng.shuffle(treasurePool(run.relics)).slice(0, 2).map((id) => ({ id, price: Math.round(TREASURE_PRICE * (0.9 + rng.random() * 0.2) * m) }));
  return { cards, treasures, removePrice: Math.round((60 + 15 * run.removeUses) * m), removed: false };
}
export function shopBuyCard(run, shop, i) {
  const item = shop.cards[i];
  if (!item || run.coins < item.price) return false;
  run.coins -= item.price; run.stats.spent += item.price;
  run.deck.push(makeCard(item.id));
  shop.cards.splice(i, 1);
  return true;
}
export function shopBuyTreasure(run, shop, i) {
  const item = shop.treasures[i];
  if (!item || run.coins < item.price || run.relics.includes(item.id)) return false;
  run.coins -= item.price; run.stats.spent += item.price;
  gainTreasure(run, item.id);
  shop.treasures.splice(i, 1);
  return true;
}
export function shopRemoveCard(run, shop, uid) {
  if (shop.removed || run.coins < shop.removePrice) return false;
  const i = run.deck.findIndex((c) => c.uid === uid);
  if (i < 0) return false;
  run.coins -= shop.removePrice; run.stats.spent += shop.removePrice;
  run.deck.splice(i, 1);
  run.saved = run.saved.filter((u) => u !== uid);
  shop.removed = true; run.removeUses += 1;
  return true;
}

// ---------- rest: Mom's Snack Break ----------
export function restHealAmount(run) { return Math.floor(run.maxHp * (run.harvestLevel >= 9 ? 0.2 : 0.3)); }
export function restHeal(run) {
  const h = Math.min(restHealAmount(run), run.maxHp - run.hp);
  run.hp += h;
  return h;
}
export function restPractice(run, uid) {
  const c = run.deck.find((x) => x.uid === uid && !x.up && CARDS[x.id].up);
  if (!c) return false;
  c.up = true;
  return true;
}

// ---------- boss → next world ----------
// Heal half of what's missing (HL5: a quarter). The Cousin Card and the Cactus leave
// with the world boss (Wyatt); the next world's Jackpot can win them back.
export function afterBoss(run) {
  const missing = run.maxHp - run.hp;
  run.hp += Math.floor(missing * (run.harvestLevel >= 5 ? 0.75 : 1));
  run.cousinCard = false;
  run.relics = run.relics.filter((r) => r !== 'cactus');
}
export function advanceWorld(run) {
  if (run.world >= WORLD_COUNT) return false;
  run.world += 1;
  run.floor = 0;
  run.map = generateWorldMap(run.seed, run.world);
  run.pos = null;
  run.trail = [];
  run.jackpotDone = false;
  return true;
}

// ---------- save / load ----------
export function serializeRun(run) { return JSON.stringify(run); }
export function deserializeRun(json) {
  try {
    const run = JSON.parse(json);
    if (!run || run.v !== RUN_VERSION || !HEROES[run.hero]) return null;
    if (!Array.isArray(run.deck) || !run.deck.every((c) => CARDS[c.id])) return null;
    if (!run.map || !run.map.nodes || !run.map.nodes[BOSS_ID]) return null;
    if (!Array.isArray(run.relics) || !run.relics.every((r) => TREASURES[r])) return null;
    if (!Array.isArray(run.saved)) run.saved = [];
    if (run.pending && (!run.pending.encounter || !Array.isArray(run.pending.encounter.enemies))) run.pending = null;
    for (const c of run.deck) bumpUid(c.uid);
    return run;
  } catch { return null; }
}
export { upgradableCards };

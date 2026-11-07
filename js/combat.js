// Rolfe Legends 5 — pure combat engine (no DOM). Slay-the-Spire rules kept
// (3 ⚡, draw 5, block expires, telegraphed intents, exhaust) with RL5's systems:
// Wyatt's Touches + SHOT, Aaron's Tractor Gears + Downshift, Liam's Book Meter +
// BOOK STORM!, the Cousin Card ("Nuh-uh!"), the Cactus, saved cards, Teary, Grabbed,
// Stinky, Burning, Husk, and the enemy meters (Heat, Ripeness, onion layers).

import { cardInfo, makeCard, TOUCH_MAX, GEAR_MAX, GEAR_BONUS, BOOK_PAGES, BOOK_STORM_DMG, BOOK_STORM_ID, COUSIN_ID, STINKY_ID, neverSaved } from './cards.js';
import { ENEMIES } from './enemies.js';

export const HAND_SIZE = 5;
export const ENERGY_BASE = 3;
export const MAX_HAND = 10;
export const JUNK_CAP = 3;

// ---------- Harvest Levels (post-win ascension) — each level stacks ----------
export const HARVEST_LEVELS = [
  null,
  'Crops have 8% more health.',
  'Mini bosses hit 10% harder.',
  'Mini bosses have 12% more health.',
  'Big bosses have 10% more health.',
  'After a big boss you heal most of the way, not all the way.',
  'Regular crops hit 10% harder.',
  'The Seed Shed costs 15% more.',
  'Start the run with 5 less max HP.',
  'Snack Breaks heal 20% instead of 30%.',
  'Big bosses hit 10% harder, and the Jackpot is 35% cousins / 55% crops.',
];
function hpMult(state, def) {
  const L = state.harvestLevel || 0;
  let m = 1;
  if (L >= 1) m *= 1.08;
  if (L >= 3 && def.elite && !def.boss) m *= 1.12;
  if (L >= 4 && def.boss) m *= 1.10;
  return m;
}
function dmgMult(state, e) {
  const L = state.harvestLevel || 0;
  let m = 1;
  if (L >= 2 && e.isElite && !e.isBoss) m *= 1.10;
  if (L >= 6 && !e.isElite && !e.isBoss) m *= 1.10;
  if (L >= 10 && e.isBoss) m *= 1.10;
  return m;
}

// ---------- damage math ----------
export function attackValue(base, attacker) {
  let d = base + (attacker.strong || 0);
  if ((attacker.weak || 0) > 0) d = Math.floor(d * 0.75);
  return Math.max(0, d);
}
function incomingMult(target) { return (target.bruised || 0) > 0 ? 1.5 : 1; }

// Aaron's Tractor Gears: +2 to attacks and block for every gear above 1.
export function gearBonus(state) { return state.heroId === 'aaron' ? GEAR_BONUS * Math.max(0, state.gear - 1) : 0; }

export function targetable(state, e) {
  return !!e && e.hp > 0 && !e.gone && !e.dissolved;
}
export function livingEnemies(state) {
  return state.enemies.filter((e) => e.hp > 0 && !e.gone);
}
export function targetableEnemies(state) {
  return livingEnemies(state).filter((e) => targetable(state, e));
}

// Deal damage. Returns HP actually lost. Every resolved packet is logged for floaties.
export function dealDamage(state, target, amount, { attacker = null, isAttack = true, src = null, pierce = false, fromHero = false } = {}) {
  if (!target || target.hp <= 0 || target.gone) return 0;
  const tIdx = target === state.hero ? 'hero' : state.enemies.indexOf(target);
  if (target !== state.hero && !targetable(state, target)) {
    state.log.push({ t: 'immune', target: tIdx, src });
    return 0;
  }
  const heroSide = fromHero || attacker === state.hero;
  // the Bruised Onion's Bruised Spot: the first hero hit each turn does extra
  if (heroSide && isAttack && amount > 0 && target !== state.hero && target.def.firstHitBonus && !target.state.hitThisTurn) {
    amount += target.def.firstHitBonus;
    state.log.push({ t: 'spot', target: tIdx, amount: target.def.firstHitBonus });
  }
  // a HIT is each positive attack packet, including a fully absorbed one
  if (heroSide && isAttack && amount > 0 && target !== state.hero && target.onHit) target.onHit(target, state);
  let dmg = Math.floor(amount * (isAttack ? incomingMult(target) : 1));
  let broke = false;
  // the Mega Corn's Husk: absorbs first, keeps its damage across turns
  if (target.shield > 0 && dmg > 0) {
    const a = Math.min(target.shield, dmg);
    target.shield -= a; dmg -= a;
    state.log.push({ t: 'husk', target: tIdx, amount: a, left: target.shield });
    if (target.shield <= 0) broke = true;
  }
  const absorbed = pierce ? 0 : Math.min(target.block || 0, dmg);
  target.block = (target.block || 0) - absorbed;
  dmg -= absorbed;
  state.log.push({ t: dmg > 0 ? 'dmg' : (absorbed > 0 ? 'blocked' : 'miss'), target: tIdx, amount: dmg, absorbed, src });
  if (target !== state.hero && heroSide) target.state.hitThisTurn = true;
  if (dmg > 0) {
    const before = target.hp;
    target.hp = Math.max(0, target.hp - dmg);
    if (target.onDamaged) target.onDamaged(target, state, dmg);
    if (target === state.hero) {
      state.hpLostThisFight = (state.hpLostThisFight || 0) + dmg;
      if (target.hp <= 0 && !state.killedBy) {
        state.killedBy = attacker && attacker !== state.hero && attacker.name
          ? { name: attacker.name, emoji: attacker.emoji, artKey: attacker.artKey } : { src: src || 'oops' };
      }
      if (hasRelic(state, 'compost_bin') && !state.flags.compost && before >= target.maxHp / 2 && target.hp < target.maxHp / 2 && target.hp > 0) {
        state.flags.compost = true; target.block += 10; relicProc(state, 'compost_bin');
      }
    }
  }
  // the Cactus: every enemy attack that hits you, it pokes back for 1
  if (target === state.hero && isAttack && amount > 0 && attacker && attacker !== state.hero && attacker.hp > 0 && hasRelic(state, 'cactus')) {
    state.log.push({ t: 'cactus', target: state.enemies.indexOf(attacker) });
    dealDamage(state, attacker, 1, { isAttack: false, src: 'cactus', fromHero: true });
  }
  if (broke) {
    applyStatus(state, target, 'bruised', 1);
    state.log.push({ t: 'huskBreak', target: tIdx });
  }
  if (target.hp <= 0 && target !== state.hero) handleEnemyDeath(state, target);
  checkCombatEnd(state);
  return dmg;
}

function handleEnemyDeath(state, enemy) {
  if (enemy.deathHandled) return;
  enemy.deathHandled = true;
  if (enemy.onDeath) enemy.onDeath(enemy, state);
}

export function checkCombatEnd(state) {
  if (state.over) return;
  if (state.hero.hp <= 0) { state.hero.hp = 0; state.over = true; state.won = false; return; }
  if (livingEnemies(state).length === 0) { state.over = true; state.won = true; }
}

// ---------- statuses ----------
export function applyStatus(state, target, k, n) {
  if (!target || (target.hp <= 0 && target !== state.hero)) return;
  if (k === 'burning' && target === state.hero && hasRelic(state, 'rain_barrel')) { relicProc(state, 'rain_barrel'); return; }
  if (k === 'strong') { target.strong = (target.strong || 0) + n; return; }
  target[k] = Math.max(0, (target[k] || 0) + n);
}
function tickDebuffs(c) {
  for (const k of ['weak', 'bruised']) if ((c[k] || 0) > 0) c[k] -= 1;
}

// ---------- deck & hand ----------
export function drawCards(state, n) {
  for (let i = 0; i < n; i++) {
    if (state.hand.length >= MAX_HAND) return;
    if (state.draw.length === 0) {
      if (state.discard.length === 0) return;
      state.draw = state.rng.shuffle(state.discard);
      state.discard = [];
    }
    const c = state.draw.pop();
    state.hand.push(c);
    (state.lastDrawn || (state.lastDrawn = [])).push(c.uid);
  }
}
function removeFromHand(state, inst) {
  const i = state.hand.indexOf(inst);
  if (i >= 0) state.hand.splice(i, 1);
}

// Stinky: fight-only junk, at most 3 at a time, shuffled into the draw pile.
export function junkCount(state) {
  return [...state.hand, ...state.draw, ...state.discard].filter((c) => c.id === STINKY_ID).length;
}
export function addJunk(state, why = 'stink') {
  if (junkCount(state) >= JUNK_CAP) { state.log.push({ t: 'junkCapped', why }); return false; }
  const c = makeCard(STINKY_ID);
  state.draw.splice(state.rng.int(state.draw.length + 1), 0, c);
  state.log.push({ t: 'stinky', why });
  return true;
}
// Teary + Grabbed are applied to the NEXT hand you draw (named on the intent).
export function queueTeary(state, n) { state.pendingTeary = (state.pendingTeary || 0) + n; }
export function queueGrab(state, n) { state.pendingGrab = (state.pendingGrab || 0) + n; }
function applyPending(state) {
  const pool = () => state.hand.filter((c) => !cardInfo(c).special);
  if (state.pendingTeary) {
    const p = state.rng.shuffle(pool().filter((c) => !state.teary.includes(c.uid)));
    for (const c of p.slice(0, state.pendingTeary)) state.teary.push(c.uid);
    if (p.length) state.log.push({ t: 'teary', n: Math.min(p.length, state.pendingTeary) });
    state.pendingTeary = 0;
  }
  if (state.pendingGrab) {
    const p = state.rng.shuffle(pool().filter((c) => cardInfo(c).cost !== null));
    for (const c of p.slice(0, state.pendingGrab)) state.grabbed.push(c.uid);
    if (p.length) state.log.push({ t: 'grabbed', n: Math.min(p.length, state.pendingGrab) });
    state.pendingGrab = 0;
  }
}
export function isTeary(state, inst) { return state.teary.includes(inst.uid); }
export function isGrabbed(state, inst) { return state.grabbed.includes(inst.uid); }

// ---------- treasures (combat hooks) ----------
export function hasRelic(state, id) { return state.relics.includes(id); }
function relicProc(state, id) { state.log.push({ t: 'relic', id }); }

// ---------- enemy spawning ----------
export function spawnEnemy(state, key, opts = {}) {
  const def = ENEMIES[key];
  if (!def) throw new Error(`unknown enemy: ${key}`);
  const mult = hpMult(state, def);
  const e = {
    key, name: def.name, emoji: def.emoji, artKey: def.artKey || key,
    maxHp: Math.round((opts.hp ?? state.rng.range(def.hp[0], def.hp[1])) * mult),
    block: 0, strong: 0, weak: 0, bruised: 0, shield: 0, nuhUh: false,
    gone: false, dissolved: false, state: {}, isElite: !!def.elite, isBoss: !!def.boss, hpMult: mult, meter: null,
  };
  e.hp = e.maxHp;
  e.def = def;
  if (def.init) def.init(e, state);
  if (def.onDamaged) e.onDamaged = (self, st, dmg) => def.onDamaged(self, st, dmg);
  if (def.onDeath) e.onDeath = (self, st) => def.onDeath(self, st);
  if (def.onHit) e.onHit = (self, st) => def.onHit(self, st);
  state.enemies.push(e);
  if (hasRelic(state, 'bug_spray') && state.turn === 0) e.weak = (e.weak || 0) + 1;
  return e;
}
function setIntent(state, e) { e.intent = e.def.nextMove(e, state, state.rng); }

// ---------- combat setup ----------
// run: { hero, hp, maxHp, deck, relics, harvestLevel, saved?, cousinCard? } · encounter: { enemies }
export function startCombat(run, encounter, rng, { kind = 'fight' } = {}) {
  const enemyKeys = Array.isArray(encounter) ? encounter : encounter.enemies;
  const state = {
    rng, kind,
    hero: { isHero: true, hp: run.hp, maxHp: run.maxHp, block: 0, energy: 0, strong: 0, weak: 0, bruised: 0, burning: 0, powers: {} },
    heroId: run.hero,
    enemies: [], draw: [], hand: [], discard: [], exhaust: [],
    relics: run.relics || [],
    turn: 0, over: false, won: false, phase: 'hero', queue: [], log: [], flags: {},
    cardsThisTurn: 0, attacksThisTurn: 0, cardsPlayed: 0,
    touches: 0, gear: 1, pages: 0, sequel: false, bookStorms: 0, shots: 0, downshifts: 0, cousinPlays: 0, nuhUhs: 0,
    teary: [], grabbed: [], pendingTeary: 0, pendingGrab: 0, cardTax: 0, cardTaxNext: 0,
    harvestLevel: run.harvestLevel || 0,
    savedIn: 0,
  };
  for (const k of enemyKeys) spawnEnemy(state, k);
  const deck = run.deck.map((c) => ({ ...c }));
  // saved cards (Wyatt): last fight's leftover hand starts in your hand
  const savedUids = new Set(run.saved || []);
  const saved = deck.filter((c) => savedUids.has(c.uid) && !neverSaved(c.id));
  state.draw = rng.shuffle(deck.filter((c) => !saved.includes(c)));
  state.hand.push(...saved.slice(0, MAX_HAND));
  state.savedIn = Math.min(saved.length, MAX_HAND);
  // the Cousin Card (the Jackpot): once per fight, never in the deck
  if (run.cousinCard && state.hand.length < MAX_HAND) state.hand.push(makeCard(COUSIN_ID));
  // combat-start treasures
  const h = state.hero;
  if (hasRelic(state, 'shin_guards')) { state.touches = 1; relicProc(state, 'shin_guards'); }
  if (hasRelic(state, 'library_card')) { state.pages = 2; relicProc(state, 'library_card'); }
  if (hasRelic(state, 'straw_hat')) { h.block += 7; relicProc(state, 'straw_hat'); }
  if (hasRelic(state, 'pitchfork')) { h.strong += 1; relicProc(state, 'pitchfork'); }
  if (hasRelic(state, 'blue_ribbon')) { h.strong += 2; relicProc(state, 'blue_ribbon'); }
  if (hasRelic(state, 'bug_spray')) relicProc(state, 'bug_spray');
  for (const e of livingEnemies(state)) setIntent(state, e);
  startHeroTurn(state);
  return state;
}

// ---------- turn flow ----------
export function startHeroTurn(state) {
  if (state.over) return;
  state.turn += 1;
  state.lastDrawn = [];
  const h = state.hero;
  if (state.turn > 1) h.block = 0;
  h.energy = ENERGY_BASE;
  state.cardsThisTurn = 0; state.attacksThisTurn = 0;
  state.cardTax = state.cardTaxNext || 0; state.cardTaxNext = 0;
  for (const e of livingEnemies(state)) e.state.hitThisTurn = false;
  // turn-start treasures
  if (hasRelic(state, 'golden_corn')) h.energy += 1;
  if (state.turn === 1 && hasRelic(state, 'seed_packet')) { h.energy += 1; relicProc(state, 'seed_packet'); }
  if (hasRelic(state, 'morning_glory') && state.turn % 3 === 0) { h.energy += 1; relicProc(state, 'morning_glory'); }
  if (hasRelic(state, 'tomato_cage')) { h.block += 5; relicProc(state, 'tomato_cage'); }
  // turn-start powers
  if (h.powers.keepy_uppy) addTouch(state, h.powers.keepy_uppy);
  if (h.powers.full_throttle) shiftGear(state, h.powers.full_throttle);
  drawCards(state, HAND_SIZE + (hasRelic(state, 'grain_bin') ? 1 : 0));
  if (h.powers.bookworm) addPage(state, h.powers.bookworm);
  applyPending(state);
}

// ---------- hero mechanics ----------
export function touchCap(state) { return state.hero.powers.fast_break || TOUCH_MAX; }
export function addTouch(state, n) {
  if (n <= 0) return;
  state.touches = Math.min(touchCap(state), state.touches + n);
  state.log.push({ t: 'touch', n, now: state.touches });
}
export function shiftGear(state, n) {
  for (let i = 0; i < n; i++) {
    if (state.gear >= GEAR_MAX) break;
    state.gear += 1;
    state.log.push({ t: 'gear', now: state.gear });
    if (state.hero.powers.roll_bar) state.hero.block += state.hero.powers.roll_bar;
    if (hasRelic(state, 'tractor_keys') && !state.flags.tractorKeys) { state.flags.tractorKeys = true; relicProc(state, 'tractor_keys'); drawCards(state, 1); }
  }
}
export function addPage(state, n) {
  if (n <= 0) return;
  state.pages += n;
  state.log.push({ t: 'page', n, now: Math.min(BOOK_PAGES, state.pages) });
  if (state.pages >= BOOK_PAGES) {
    state.pages = 0; // overflow discarded; the meter can fill again
    const c = makeCard(BOOK_STORM_ID);
    state.hand.push(c); // a BOOK STORM! always fits (it may push the hand past 10 for a moment)
    state.log.push({ t: 'bookFull', uid: c.uid });
  }
}
export function bookStormDamage(state) { return BOOK_STORM_DMG + (state.hero.powers.library_day || 0); }

// ---------- costs ----------
export function effectiveCost(state, inst) {
  const info = cardInfo(inst);
  if (info.cost === null) return null;
  let cost = info.cost;
  if (info.pageDiscount) cost -= state.pages;
  if (state.cardsThisTurn === 0 && state.cardTax) cost += state.cardTax;
  if (hasRelic(state, 'garden_gloves') && !state.flags.gloves) cost = 0;
  return Math.max(0, cost);
}

export function canPlay(state, inst) {
  if (state.over || state.phase === 'enemy') return false;
  const info = cardInfo(inst);
  if (!info || info.unplayable) return false;
  if (isGrabbed(state, inst)) return false;
  if (cardNeedsTarget(info) && targetableEnemies(state).length === 0) return false;
  return state.hero.energy >= effectiveCost(state, inst);
}

export function cardNeedsTarget(info) {
  const walk = (fx) => (fx || []).some((op) => (op.dmg != null && !op.allEnemies) || op.cancel
    || (op.status && op.status.target === 'target') || (op.ifGear && walk(op.ifGear.fx)));
  return walk(info.fx);
}

// One dmg op's base number right now (before the attacker's Strong/Weak).
export function opBase(state, op) {
  let b = op.dmg + gearBonus(state);
  if (op.shot) b += op.shot * state.touches;
  if (op.downshift) b += op.downshift * Math.max(0, state.gear - 1);
  if (op.bookStorm) b = bookStormDamage(state);
  return b;
}

// Damage a card would deal to one target right now (the number the UI shows).
export function previewCardDamage(state, info) {
  const h = state.hero;
  let total = 0;
  const walk = (fx) => {
    for (const o of fx || []) {
      if (o.dmg != null) total += attackValue(opBase(state, o), h) * (o.times || 1) * (o.bookStorm && state.sequel ? 2 : 1);
      if (o.ifGear && state.gear >= o.ifGear.n) walk(o.ifGear.fx);
    }
  };
  walk(info.fx);
  return total;
}
export function previewBlock(state, info) {
  let b = 0;
  const walk = (fx) => {
    for (const o of fx || []) {
      if (o.block != null) b += o.block + gearBonus(state);
      if (o.blockPerGear != null) b += o.blockPerGear * state.gear;
      if (o.ifGear && state.gear >= o.ifGear.n) walk(o.ifGear.fx);
    }
  };
  walk(info.fx);
  return b;
}

// ---------- playing cards ----------
export function playCard(state, inst, target = null) {
  if (!canPlay(state, inst)) return false;
  const info = cardInfo(inst);
  if (cardNeedsTarget(info) && (!target || !targetable(state, target))) {
    target = targetableEnemies(state)[0] || null;
  }
  const cost = effectiveCost(state, inst);
  state.hero.energy -= cost;
  if (hasRelic(state, 'garden_gloves') && !state.flags.gloves) { state.flags.gloves = true; relicProc(state, 'garden_gloves'); }
  removeFromHand(state, inst);
  state.teary = state.teary.filter((u) => u !== inst.uid);
  state.lastDrawn = [];
  state.cardsThisTurn += 1;
  state.cardsPlayed += 1;
  if (info.type === 'attack') state.attacksThisTurn += 1;
  if (inst.id === COUSIN_ID) state.cousinPlays += 1;
  state.log.push({ t: 'play', id: inst.id, uid: inst.uid });

  runEffects(state, info, inst, target);
  if (info.power) state.hero.powers[info.power] = info.pn ?? true;

  if (info.type === 'power') { /* consumed */ }
  else if (info.exhausts) state.exhaust.push(inst);
  else state.discard.push(inst);
  checkCombatEnd(state);
  return true;
}

function runEffects(state, info, inst, target) {
  const h = state.hero;
  const hit = (base, tgt) => { if (tgt) dealDamage(state, tgt, attackValue(base, h), { attacker: h }); };
  const walk = (fx) => {
    for (const op of fx || []) {
      if (state.over) break;
      if (op.dmg != null) {
        const reps = op.bookStorm && state.sequel ? 2 : 1;
        if (op.bookStorm) { state.sequel = false; state.bookStorms += 1; state.log.push({ t: 'bookStorm', dmg: bookStormDamage(state), reps }); }
        const base = opBase(state, op);
        for (let r = 0; r < reps; r++) {
          for (let t = 0; t < (op.times || 1); t++) {
            if (state.over) break;
            if (op.allEnemies) for (const e of targetableEnemies(state)) hit(base, e);
            else { if (!targetable(state, target)) target = targetableEnemies(state)[0]; hit(base, target); }
          }
        }
        if (op.shot) {
          const left = Math.min(state.touches, h.powers.golden_boot || 0);
          state.log.push({ t: 'shot', spent: state.touches - left, dmg: base });
          state.shots += 1; state.touches = left;
        }
        if (op.downshift) {
          state.log.push({ t: 'downshift', dropped: state.gear - 1, dmg: base });
          state.downshifts += 1; state.gear = 1;
        }
      }
      if (op.block != null) h.block += op.block + gearBonus(state);
      if (op.blockPerGear != null) h.block += op.blockPerGear * state.gear;
      if (op.draw) drawCards(state, op.draw);
      if (op.energy) h.energy += op.energy;
      if (op.status) {
        const { k, n, target: tg } = op.status;
        if (tg === 'self') applyStatus(state, h, k, n);
        else if (tg === 'all') for (const e of targetableEnemies(state)) applyStatus(state, e, k, n);
        else if (targetable(state, target)) applyStatus(state, target, k, n);
      }
      if (op.touch) addTouch(state, op.touch);
      if (op.shift) shiftGear(state, op.shift);
      if (op.page) addPage(state, op.page);
      if (op.fillBook) addPage(state, BOOK_PAGES - state.pages);
      if (op.sequel) state.sequel = true;
      if (op.cancel && targetable(state, target)) {
        target.nuhUh = true;
        state.log.push({ t: 'nuhUhSet', target: state.enemies.indexOf(target) });
      }
      if (op.ifGear && state.gear >= op.ifGear.n) walk(op.ifGear.fx);
    }
  };
  walk(info.fx);
}

// ---------- enemy phase (steppable for the UI; endTurn runs it synchronously) ----------
export function beginEnemyPhase(state) {
  if (state.over || state.phase === 'enemy') return false;
  const h = state.hero;
  // Burning ticks at the end of your turn
  if ((h.burning || 0) > 0) {
    state.log.push({ t: 'burn', amount: h.burning });
    dealDamage(state, h, h.burning, { isAttack: false, src: 'burning', pierce: true });
    h.burning = Math.max(0, h.burning - 1);
    if (state.over) return true;
  }
  tickDebuffs(h);
  state.teary = []; state.grabbed = [];
  const keep = state.hand.filter((c) => cardInfo(c).retain);
  state.discard.push(...state.hand.filter((c) => !keep.includes(c)));
  state.hand = keep;
  state.phase = 'enemy';
  for (const e of livingEnemies(state)) e.block = 0; // group-wide, before anyone acts (StS)
  state.queue = [...state.enemies]; // snapshot: summons act NEXT cycle
  return true;
}

export function stepEnemyAction(state) {
  while (state.phase === 'enemy' && state.queue.length) {
    if (state.over) break;
    const e = state.queue.shift();
    if (e.gone || e.hp <= 0) continue;
    if (e.def.beforeAct) e.def.beforeAct(e, state);
    executeIntent(state, e);
    if (e.def.afterAct) e.def.afterAct(e, state);
    tickDebuffs(e);
    if (!state.over && e.hp > 0) setIntent(state, e);
    return e;
  }
  state.phase = 'hero';
  state.queue = [];
  checkCombatEnd(state);
  if (!state.over) startHeroTurn(state);
  return null;
}

export function endTurn(state) {
  if (!beginEnemyPhase(state)) return;
  while (state.phase === 'enemy') stepEnemyAction(state);
}

function executeIntent(state, e) {
  const it = e.intent;
  if (!it) return;
  // Delilah's "Nuh-uh!": the next attack does nothing at all
  if (e.nuhUh && it.dmg != null) {
    e.nuhUh = false; state.nuhUhs += 1;
    state.log.push({ t: 'nuhUh', target: state.enemies.indexOf(e), was: it.name });
    if (it.reset) it.reset(state, e); // a cancelled POP!/SPLAT! still resets its meter
    return;
  }
  if (it.pre) it.pre(state, e);
  if (it.dmg != null) {
    const mult = dmgMult(state, e);
    for (let t = 0; t < (it.times || 1); t++) {
      if (state.over || e.hp <= 0) break;
      dealDamage(state, state.hero, Math.floor(attackValue(it.dmg, e) * mult), { attacker: e });
    }
  }
  if (it.block) e.block += it.block;
  if (it.reset) it.reset(state, e);
  if (it.fn && !state.over) it.fn(state, e);
}

// What the UI shows for an attack intent — matches what will actually hit.
export function intentPreview(state, e) {
  const it = e.intent;
  if (!it || it.dmg == null) return null;
  if (e.nuhUh) return { per: 0, times: it.times || 1, cancelled: true };
  const per = Math.floor(Math.floor(attackValue(it.dmg, e) * dmgMult(state, e)) * incomingMult(state.hero));
  return { per, times: it.times || 1 };
}

// Saved cards (Wyatt): what's in your hand the moment a fight ends.
export function savedHandUids(state) {
  return state.hand.filter((c) => !neverSaved(c.id)).map((c) => c.uid);
}

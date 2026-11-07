// Rolfe Legends 5 — unit tests. Run: node test/test.mjs
// Covers the hero mechanics, the Jackpot + Cousin Card + Cactus (Wyatt's rules,
// exactly), saved cards, every crop boss mechanic, maps, saves, the no-port rule,
// card text, and the shared-origin service worker.
import { makeRng } from '../js/rng.js';
import { CARDS, HEROES, makeCard, cardInfo, draftPool, BOOK_STORM_ID, COUSIN_ID, STINKY_ID } from '../js/cards.js';
import { TREASURES } from '../js/treasures.js';
import { ENEMIES } from '../js/enemies.js';
import { WORLDS } from '../js/worlds.js';
import { spin, spinOutcome, SLOTS } from '../js/jackpot.js';
import { plainText } from '../js/text.js';
import * as C from '../js/combat.js';
import * as R from '../js/run.js';
import { generateWorldMap, validateMap, allPaths, BOSS_ID } from '../js/map.js';
import { readFileSync, existsSync } from 'fs';
import vm from 'vm';

let passed = 0, failed = 0;
const fails = [];
function ok(cond, msg) { if (cond) passed++; else { failed++; fails.push(msg); } }
function eq(a, b, msg) { ok(a === b, `${msg} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`); }

function combatVs(keys, { hero = 'aaron', seed = 7, run = null } = {}) {
  const r = run || R.newRun(hero, seed);
  return { run: r, st: C.startCombat(r, { enemies: keys }, makeRng(seed)) };
}
function forceHand(st, ids) { st.hand = ids.map((id) => makeCard(id)); st.draw = []; st.discard = []; return st.hand; }
const card = (st, id) => st.hand.find((c) => c.id === id);
const foe = (st, i = 0) => st.enemies[i];
const calm = (e) => { e.intent = { name: 'nap', kind: 'defend' }; };

// ---------- data integrity ----------
{
  for (const [id, c] of Object.entries(CARDS)) {
    ok(c.name && c.emoji && c.type && c.rarity && c.src, `card ${id} has name/emoji/type/rarity/src`);
    ok(c.type === 'status' || typeof c.cost === 'number', `card ${id} cost is a number`);
    for (const up of [false, true]) {
      const t = plainText(cardInfo(makeCard(id, up)));
      ok(!/[{}]|\?/.test(t), `card ${id}${up ? '+' : ''} text resolves every placeholder: "${t}"`);
    }
    // infinite-turn guard: every 0-cost card that draws or makes energy is Used up
    const info = cardInfo(makeCard(id));
    if (info.cost === 0 && (info.fx || []).some((o) => o.draw || o.energy)) ok(info.exhausts, `0-cost draw card ${id} is Used up`);
  }
  for (const h of Object.values(HEROES)) {
    eq(h.starter.length, 10, `${h.name} starts with 10 cards`);
    ok(TREASURES[h.relic] && TREASURES[h.relic].starter === h.id, `${h.name} starter treasure`);
    const pool = draftPool(h.id);
    eq(pool.length, 15, `${h.name} reward pool is 15 cards`);
    const by = (r) => pool.filter((id) => CARDS[id].rarity === r).length;
    ok(by('common') >= 6 && by('uncommon') >= 6 && by('rare') === 3, `${h.name} pool rarities 6+/6+/3`);
    ok(pool.some((id) => CARDS[id].rarity === 'common' && (CARDS[id].fx || []).some((o) => o.allEnemies)), `${h.name} has a common hit-everyone card`);
  }
  for (const w of [1, 2, 3]) {
    const enc = WORLDS[w].encounters;
    for (const g of [...enc.easy, ...enc.hard, ...enc.elite, ...enc.boss, [enc.medley[0]]]) for (const k of g) ok(ENEMIES[k], `world ${w} enemy ${k} exists`);
  }
  for (const [k, e] of Object.entries(ENEMIES)) {
    ok(e.name && e.emoji && Array.isArray(e.hp) && typeof e.nextMove === 'function', `enemy ${k} is complete`);
    const { st } = combatVs([k], { seed: 3 });
    for (let i = 0; i < 6; i++) { const it = e.nextMove(st.enemies[0], st, st.rng); ok(it && it.name, `enemy ${k} move ${i} has a name`); }
  }
  for (const [id, t] of Object.entries(TREASURES)) ok(t.name && t.emoji && t.text, `treasure ${id} is complete`);
  eq(C.HARVEST_LEVELS.length, 11, 'Harvest Levels 1–10');
}

// ---------- the no-port rule: nothing visible carries over from RL1–RL4 ----------
{
  const names = new Set();
  for (const repo of ['rolfe-legends', 'rolfe-legends-2', 'rolfe-legends-3', 'rolfe-legends-4']) {
    for (const f of ['cards', 'enemies', 'relics', 'treasures', 'events', 'pets', 'stickers']) {
      const p = `${process.env.HOME}/code/${repo}/js/${f}.js`;
      if (!existsSync(p)) continue;
      const src = readFileSync(p, 'utf8');
      for (const m of src.matchAll(/name:\s*'([^']+)'/g)) names.add(m[1].toLowerCase().replace(/\+$/, ''));
      for (const m of src.matchAll(/name:\s*"([^"]+)"/g)) names.add(m[1].toLowerCase());
    }
  }
  ok(names.size > 200, `no-port test read RL1–RL4 (${names.size} names)`);
  const callbacks = new Set([...Object.values(HEROES).map((h) => h.name.toLowerCase()), 'stella', 'lucy', 'delilah', 'goldie']);
  const ours = [...Object.values(CARDS).map((c) => c.name), ...Object.values(ENEMIES).map((e) => e.name), ...Object.values(TREASURES).map((t) => t.name)];
  const clashes = ours.filter((n) => names.has(n.toLowerCase()) && !callbacks.has(n.toLowerCase()));
  eq(clashes.join(', '), '', 'no RL5 card/enemy/treasure name matches RL1–RL4 (no-port rule)');
}

// ---------- Wyatt: Touches + SHOT ----------
{
  const { st } = combatVs(['couch_potato'], { hero: 'wyatt' });
  calm(foe(st));
  eq(st.touches, 1, 'Shin Guards: start with 1 Touch');
  forceHand(st, ['pass', 'pass', 'power_shot']);
  st.hero.energy = 9;
  const hp0 = foe(st).hp;
  C.playCard(st, card(st, 'pass'), foe(st));
  eq(st.touches, 2, 'Pass adds a Touch');
  eq(hp0 - foe(st).hp, 7, 'Pass deals 7');
  C.playCard(st, card(st, 'pass'), foe(st));
  const before = foe(st).hp;
  C.playCard(st, card(st, 'power_shot'), foe(st));
  eq(before - foe(st).hp, 5 + 5 * 3, 'Power Shot: 5 + 5 per Touch');
  eq(st.touches, 0, 'a SHOT spends every Touch');
  C.addTouch(st, 9);
  eq(st.touches, 5, 'Touches cap at 5');
  st.hero.powers.fast_break = 10; C.addTouch(st, 9);
  eq(st.touches, 10, 'Fast Break raises the cap to 10');
  st.hero.powers.golden_boot = 1; forceHand(st, ['chip_shot']); st.hero.energy = 3;
  C.playCard(st, card(st, 'chip_shot'), foe(st));
  eq(st.touches, 1, 'Golden Boot leaves 1 Touch behind');
}

// ---------- Aaron: Tractor Gears + Downshift ----------
{
  const { st } = combatVs(['couch_potato'], { hero: 'aaron' });
  calm(foe(st));
  eq(st.gear, 1, 'Aaron starts every fight in Gear 1');
  forceHand(st, ['shift_up', 'rev_it', 'plow', 'hay_bale', 'hay_bale_launch']);
  st.hero.energy = 9;
  C.playCard(st, card(st, 'shift_up'));
  eq(st.gear, 2, 'Shift Up: Gear 2');
  eq(st.flags.tractorKeys, true, 'Tractor Keys fires on the first shift');
  C.playCard(st, card(st, 'rev_it'));
  C.shiftGear(st, 5);
  eq(st.gear, 3, 'Gears cap at 3');
  const b0 = st.hero.block;
  C.playCard(st, card(st, 'hay_bale'));
  eq(st.hero.block - b0, 5 + 4, 'Gear 3: Hay Bale gets +2 per gear above 1');
  const hp0 = foe(st).hp;
  C.playCard(st, card(st, 'plow'), foe(st));
  eq(hp0 - foe(st).hp, 6 + 4, 'Gear 3: Plow deals +4');
  const hp1 = foe(st).hp;
  C.playCard(st, card(st, 'hay_bale_launch'), foe(st));
  eq(hp1 - foe(st).hp, 6 + 4 + 8 * 2, 'Downshift: base + gear bonus + 8 per gear dropped');
  eq(st.gear, 1, 'Downshift drops back to Gear 1');
  st.hero.powers.roll_bar = 4; const b1 = st.hero.block; C.shiftGear(st, 1);
  eq(st.hero.block - b1, 4, 'Roll Bar: block on every shift');
}

// ---------- Liam: the Book Meter (Wyatt's design) ----------
{
  const { st } = combatVs(['radish', 'radish'], { hero: 'liam' });
  for (const e of st.enemies) calm(e);
  eq(st.pages, 2, 'Library Card: start with 2 pages');
  forceHand(st, ['read_book', 'read_book']);
  st.hero.energy = 9;
  C.playCard(st, card(st, 'read_book'));
  eq(st.pages, 3, 'Read a Book: +1 page');
  C.playCard(st, card(st, 'read_book'));
  eq(st.pages, 0, 'a full meter resets');
  const storm = card(st, BOOK_STORM_ID);
  ok(storm, 'a full Book Meter puts BOOK STORM! in your hand');
  eq(C.effectiveCost(st, storm), 0, 'BOOK STORM! costs 0');
  const hps = st.enemies.map((e) => e.hp);
  C.playCard(st, storm);
  ok(st.enemies.every((e, i) => hps[i] - e.hp === 15 || e.hp === 0), 'BOOK STORM! hits EVERY enemy for 15 (Wyatt)');
  ok(st.exhaust.some((c) => c.id === BOOK_STORM_ID), 'BOOK STORM! is used up');
  const { st: s2 } = combatVs(['couch_potato'], { hero: 'liam' });
  calm(foe(s2));
  s2.hero.powers.library_day = 5; s2.sequel = true;
  forceHand(s2, [BOOK_STORM_ID]);
  const h0 = foe(s2).hp;
  C.playCard(s2, card(s2, BOOK_STORM_ID));
  eq(h0 - foe(s2).hp, (15 + 5) * 2, 'Library Day +5 and The Sequel twice');
  const { st: s3 } = combatVs(['couch_potato'], { hero: 'liam' });
  forceHand(s3, ['overdue_book']); s3.pages = 3;
  eq(C.effectiveCost(s3, card(s3, 'overdue_book')), 0, 'Overdue Book costs 1 less per page');
}

// ---------- the Jackpot (Wyatt: 45 / 45 / 10, three slots, two faces each) ----------
{
  const rng = makeRng(42);
  const n = { cousins: 0, crops: 0, mixed: 0 };
  const N = 100000;
  for (let i = 0; i < N; i++) n[spinOutcome(rng)]++;
  ok(Math.abs(n.cousins / N - 0.45) < 0.02, `cousins ≈45% (${(n.cousins / N * 100).toFixed(1)})`);
  ok(Math.abs(n.crops / N - 0.45) < 0.02, `crops ≈45% (${(n.crops / N * 100).toFixed(1)})`);
  ok(Math.abs(n.mixed / N - 0.10) < 0.02, `mixed ≈10% (${(n.mixed / N * 100).toFixed(1)})`);
  eq(SLOTS.map((s) => `${s.cousin.name}|${s.crop.name}`).join(' '), 'Stella|Corn Lucy|Tomato Delilah|Onion', 'slot faces are Wyatt\'s');
  for (let i = 0; i < 500; i++) {
    const r = spin(rng);
    const same = r.faces.every((f) => f === r.faces[0]);
    if (r.outcome === 'mixed') ok(!same, 'mixed reels never all match');
    else ok(same && r.faces[0] === (r.outcome === 'cousins' ? 'cousin' : 'crop'), `${r.outcome} reels all match`);
  }
  const run = R.newRun('wyatt', 5);
  let res = null;
  for (let s = 0; s < 50 && (!res || res.outcome !== 'cousins'); s++) { run.jackpotDone = false; run.cousinCard = false; res = R.spinJackpot(run, makeRng(s)); }
  eq(res.outcome, 'cousins', 'found a cousins spin');
  ok(run.cousinCard, 'three cousins → the Cousin Card');
  eq(R.spinJackpot(run, makeRng(1)), null, 'one spin per world');
  ok(!R.walkPastJackpot(run), 'can\'t walk past a spin you already used');
  // the Cousin Card: in every fight's opening hand, once, never in the deck
  const st = C.startCombat(run, { enemies: ['mini_corn', 'bossy_squash'] }, makeRng(9));
  eq(st.hand.filter((c) => c.id === COUSIN_ID).length, 1, 'the Cousin Card is in hand, once');
  ok(!run.deck.some((c) => c.id === COUSIN_ID), 'the Cousin Card is never in the deck');
  const big = st.enemies[1];
  big.intent = { name: 'SQUASH!', kind: 'attack', dmg: 20 };
  st.enemies[0].intent = { name: 'nap', kind: 'defend' };
  const strong0 = st.hero.strong;
  C.playCard(st, card(st, COUSIN_ID), big);
  eq(st.hero.strong - strong0, 2, 'Stella\'s Barbie: +2 Strong');
  eq(big.weak, 2, 'Lucy\'s squish: Weak 2');
  ok(big.nuhUh && C.intentPreview(st, big).cancelled, 'Delilah: the next attack shows as cancelled');
  ok(!st.hand.some((c) => c.id === COUSIN_ID), 'the Cousin Card is used up');
  st.hero.block = 0;
  const hp0 = st.hero.hp;
  forceHand(st, []);
  C.endTurn(st);
  eq(st.hero.hp, hp0, '"Nuh-uh!": the cancelled attack does nothing');
  ok(!big.nuhUh, 'the cancel is spent');
  ok(!st.hand.some((c) => c.id === COUSIN_ID), 'never twice in one fight');
  // it leaves with the world boss; so does the Cactus
  run.relics.push('cactus');
  R.afterBoss(run);
  ok(!run.cousinCard && !run.relics.includes('cactus'), 'the Cousin Card and the Cactus leave with the world boss');
  R.advanceWorld(run);
  ok(!run.jackpotDone, 'the next world has its own Jackpot');
  // crops → the Veggie Medley for this world; mixed → the Cactus
  const r2 = R.newRun('liam', 8);
  let crop = null;
  for (let s = 0; s < 60 && (!crop || crop.outcome !== 'crops'); s++) { r2.jackpotDone = false; crop = R.spinJackpot(r2, makeRng(s)); }
  eq(crop.encounter.enemies.join(), 'medley_1', 'three crops → the Veggie Medley fight');
  let mix = null;
  for (let s = 0; s < 400 && (!mix || mix.outcome !== 'mixed'); s++) { r2.jackpotDone = false; mix = R.spinJackpot(r2, makeRng(1000 + s)); }
  eq(mix.outcome, 'mixed', 'found a mixed spin');
  ok(r2.relics.includes('cactus'), 'mixed → the Cactus');
  const odds10 = R.jackpotOdds({ harvestLevel: 10 });
  eq(odds10.cousins, 0.35, 'Harvest Level 10 shifts the Jackpot to 35% cousins');
}

// ---------- the Cactus ----------
{
  const run = R.newRun('aaron', 4); run.relics.push('cactus');
  const st = C.startCombat(run, { enemies: ['mini_corn'] }, makeRng(2));
  const e = foe(st);
  e.intent = { name: 'pokes', kind: 'attack', dmg: 2, times: 3 };
  forceHand(st, []);
  const h0 = e.hp;
  C.endTurn(st);
  eq(h0 - e.hp, 3, 'the Cactus pokes back 1 per hit');
}

// ---------- saved cards (Wyatt) ----------
{
  const run = R.newRun('wyatt', 12);
  const st = C.startCombat(run, { enemies: ['popcorn_puff'] }, makeRng(3));
  const keep = st.hand.filter((c) => c.id !== 'pass').map((c) => c.uid);
  const pass = st.hand.find((c) => c.id === 'pass') || st.hand[0];
  st.hand.push(makeCard(STINKY_ID));
  st.hero.energy = 9;
  C.playCard(st, pass, foe(st));
  if (!st.over) { foe(st).hp = 1; C.dealDamage(st, foe(st), 5, { attacker: st.hero }); }
  ok(st.won, 'won the fight');
  const left = st.hand.filter((c) => c.id !== STINKY_ID).map((c) => c.uid);
  R.applyCombatResult(run, st, 'fight');
  eq(run.saved.slice().sort().join(), left.slice().sort().join(), 'the hand at the end of the fight is saved');
  ok(!run.saved.some((u) => !run.deck.some((c) => c.uid === u)), 'Stinky is never saved');
  const st2 = C.startCombat(run, { enemies: ['couch_potato'] }, makeRng(4));
  ok(run.saved.every((u) => st2.hand.some((c) => c.uid === u)), 'saved cards start in your hand next fight');
  eq(st2.hand.length, Math.min(10, run.saved.length + 5), 'then you draw 5 as usual');
  const all = [...st2.hand, ...st2.draw, ...st2.discard].map((c) => c.uid);
  eq(new Set(all).size, all.length, 'no card is duplicated by saving');
  ok(keep.length >= 0, 'ok');
}

// ---------- Teary, Grabbed, Stinky, Burning ----------
{
  const { st } = combatVs(['couch_potato'], { hero: 'wyatt' });
  calm(foe(st));
  C.queueTeary(st, 2); C.queueGrab(st, 1);
  forceHand(st, []); st.draw = ['pass', 'pass', 'juke_left', 'juke_left', 'toe_tap'].map((id) => makeCard(id));
  C.endTurn(st);
  eq(st.teary.length, 2, 'Teary 2 blurs two cards');
  eq(st.grabbed.length, 1, 'Vine Grab wraps a card');
  const g = st.hand.find((c) => C.isGrabbed(st, c));
  ok(!C.canPlay(st, g), 'a Grabbed card can\'t be played');
  const t = st.hand.find((c) => C.isTeary(st, c) && !C.isGrabbed(st, c));
  if (t) ok(C.canPlay(st, t) || st.hero.energy < C.effectiveCost(st, t), 'a Teary card can still be played');
  calm(foe(st)); C.endTurn(st);
  eq(st.teary.length + st.grabbed.length, 0, 'Teary and Grabbed clear after the turn');
  for (let i = 0; i < 6; i++) C.addJunk(st);
  eq(C.junkCount(st), 3, 'Stinky caps at 3');
  ok(!C.canPlay(st, makeCard(STINKY_ID)), 'Stinky can\'t be played');
  st.hero.burning = 3; const hp0 = st.hero.hp; st.hero.block = 99; calm(foe(st)); C.endTurn(st);
  eq(hp0 - st.hero.hp, 3, 'Burning ignores block and ticks at the end of your turn');
  eq(st.hero.burning, 2, 'Burning goes down by 1');
}

// ---------- World 1: the Cornstalk + the Mega Corn ----------
{
  const { st } = combatVs(['cornstalk']);
  const e = foe(st);
  forceHand(st, []); C.endTurn(st);
  ok(e.block >= 3, 'Deep Roots regrows block every turn');
  const { st: s2 } = combatVs(['mega_corn'], { hero: 'aaron', seed: 11 });
  const mc = foe(s2);
  eq(mc.meter.max, 4, 'the Heat Meter fills to 4');
  let popped = false, guard = 0;
  while (!popped && guard++ < 8) {
    forceHand(s2, []); s2.hero.block = 999; s2.hero.hp = 999;
    if (mc.intent.name.includes('POP')) { C.endTurn(s2); popped = true; break; }
    C.endTurn(s2);
  }
  ok(popped, 'the Mega Corn POPs when the Heat Meter fills');
  ok(mc.state.heat <= 1, 'POP! resets the heat');
  ok(s2.enemies.filter((x) => x.key === 'popcorn_puff' && x.hp > 0).length === 2, 'POP! makes 2 Popcorn Puffs');
  mc.shield = 10; mc.block = 0;
  forceHand(s2, ['plow']); s2.hero.energy = 3;
  C.playCard(s2, card(s2, 'plow'), mc);
  eq(mc.shield, 4, 'the Husk soaks damage first and keeps the rest');
  mc.shield = 0; mc.block = 0; mc.hp = 60; C.dealDamage(s2, mc, 1, { isAttack: false, fromHero: true });
  ok(mc.state.kettle, 'KETTLE CORN at half health');
  // a cancelled POP! resets heat and makes no Puffs
  const { st: s3 } = combatVs(['mega_corn'], { seed: 13 });
  const m3 = foe(s3);
  m3.state.heat = 3; m3.intent = m3.def.nextMove(m3, s3, s3.rng);
  ok(m3.intent.name.includes('POP'), 'heat 4 → POP intent');
  m3.nuhUh = true; forceHand(s3, []); const hp3 = s3.hero.hp; C.endTurn(s3);
  ok(s3.hero.hp === hp3 && m3.state.heat <= 1 && !s3.enemies.some((x) => x.key === 'popcorn_puff'), 'a cancelled POP! still cools down, no Puffs');
}

// ---------- World 2: the Ripe Tomato + the Rotten Tomato ----------
{
  const { st } = combatVs(['ripe_tomato'], { hero: 'wyatt' });
  const rt = foe(st);
  forceHand(st, ['header']); st.hero.energy = 3;
  C.playCard(st, card(st, 'header'), rt);
  eq(rt.state.ripe, 2, 'every hit ripens the Ripe Tomato');
  eq(rt.strong, 1, 'every 2 Ripeness adds +1 to its attacks');
  rt.state.ripe = 10; rt.strong = 5; rt.intent = rt.def.nextMove(rt, st, st.rng);
  ok(rt.intent.name.includes('TOO RIPE'), 'at 10 Ripeness it warns a turn early');
  forceHand(st, []); st.hero.hp = 999; st.hero.maxHp = 999; C.endTurn(st);
  ok(rt.intent.name.includes('SPLAT'), 'then SPLAT!');
  eq(C.intentPreview(st, rt).per, 30, 'SPLAT! hits for 30');
  forceHand(st, []); C.endTurn(st);
  eq(rt.state.ripe, 0, 'after SPLAT! it goes back to green');
  const { st: s2 } = combatVs(['rotten_tomato']);
  const r = foe(s2); r.hp = 1; s2.hero.block = 0; const hp0 = s2.hero.hp;
  forceHand(s2, ['plow']); s2.hero.energy = 3; C.playCard(s2, card(s2, 'plow'), r);
  eq(hp0 - s2.hero.hp, 6, 'the Rotten Tomato bursts for 6 when beaten');
}

// ---------- World 3: the Bruised Onion, the Carrot Drill, the Huge Onion ----------
{
  const { st } = combatVs(['bruised_onion']);
  const b = foe(st); calm(b);
  forceHand(st, ['plow', 'plow']); st.hero.energy = 3;
  const h0 = b.hp; C.playCard(st, st.hand[0], b);
  eq(h0 - b.hp, 6 + 5, 'Bruised Spot: the first hit each turn does +5');
  const h1 = b.hp; C.playCard(st, st.hand[0], b);
  eq(h1 - b.hp, 6, 'only the first hit');
  eq(b.strong, 2, 'it gets 1 angrier every hit');
  const { st: s2 } = combatVs(['carrot_drill']);
  const d = foe(s2); forceHand(s2, []); s2.hero.hp = 999; C.endTurn(s2);
  ok(d.dissolved && !C.targetable(s2, d), 'Dig Down: underground, can\'t be hit');
  forceHand(s2, []); C.endTurn(s2);
  ok(!d.dissolved, 'it pops back up to DRILL');
  const { st: s3 } = combatVs(['huge_onion']);
  const o = foe(s3);
  eq(o.maxHp, 140, 'Layer 1 Papery Skin');
  C.dealDamage(s3, o, 500, { isAttack: false, fromHero: true });
  ok(!s3.over && o.state.layer === 2 && o.hp === 120, 'PEEL → the Stinky Layer, damage never carries through');
  C.dealDamage(s3, o, 500, { isAttack: false, fromHero: true });
  ok(!s3.over && o.state.layer === 3 && o.hp === 105, 'PEEL → the HEART of the Onion');
  C.dealDamage(s3, o, 500, { isAttack: false, fromHero: true });
  ok(s3.over && s3.won, 'peel all three layers to win');
}

// ---------- maps ----------
{
  let bad = 0;
  for (let s = 1; s <= 300; s++) for (const w of [1, 2, 3]) if (validateMap(generateWorldMap(s * 104729, w)).length) bad++;
  eq(bad, 0, 'every map meets every quota (one Jackpot per path, F4–F7)');
  const m = generateWorldMap(99, 2);
  ok(allPaths(m).every((p) => p[p.length - 1] === BOSS_ID), 'every path ends at the boss');
  const m2 = generateWorldMap(99, 2);
  eq(JSON.stringify(m), JSON.stringify(m2), 'maps are seeded');
}

// ---------- saves ----------
{
  const run = R.newRun('liam', 77);
  run.saved = [run.deck[0].uid]; run.cousinCard = true;
  const back = R.deserializeRun(R.serializeRun(run));
  eq(JSON.stringify(back), JSON.stringify(run), 'a run survives save/load');
  eq(R.deserializeRun('{bad'), null, 'garbage → null');
  eq(R.deserializeRun(JSON.stringify({ ...run, v: 4 })), null, 'an RL4 save is not an RL5 save');
}

// ---------- run layer ----------
{
  const run = R.newRun('aaron', 31);
  const rw = R.fightRewards(run, 'elite', makeRng(1));
  ok(rw.treasure && run.relics.includes(rw.treasure), 'a mini boss drops a treasure');
  const rm = R.fightRewards(run, 'medley', makeRng(2));
  ok(rm.cards.every((id) => CARDS[id].rarity === 'rare'), 'beating the Veggie Medley offers rare cards');
  run.hp = 10; R.afterBoss(run);
  eq(run.hp, run.maxHp, 'after a big boss you heal back up');
}

// ---------- sw.js: offline shell + shared-origin cache hygiene ----------
{
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const gamePath = new URL('../js/game.js', import.meta.url);
  const game = readFileSync(gamePath, 'utf8');
  const imports = new Set([...game.matchAll(/from '\.\/(\w+\.js)'/g)].map((m) => `js/${m[1]}`));
  for (const f of ['combat', 'run', 'map', 'cards', 'enemies', 'worlds', 'jackpot']) imports.add(`js/${f}.js`);
  const missing = [...imports].filter((f) => !sw.includes(`'${f}'`));
  eq(missing.join(','), '', 'sw.js SHELL precaches every module (offline boot)');
  const CACHE = (/const CACHE = '([^']+)'/.exec(sw) || [])[1] || '';
  ok(/^rolfe-legends-5-v\d+$/.test(CACHE), `sw CACHE uses RL5's own name scheme (got ${CACHE})`);
  const SIBLINGS = ['rolfe-legends-v3', 'rolfe-legends-2-v35', 'rolfe-legends-3-v3', 'rolfe-legends-4-v2', 'rolfe-legends-50-v1', 'some-other-app'];
  const prev = CACHE.replace(/\d+$/, (n) => String(Math.max(0, n - 1)));
  const store = new Set([CACHE, 'rolfe-legends-5-v0', prev, ...SIBLINGS]);
  const on = {};
  vm.runInNewContext(sw, {
    self: { addEventListener: (t, fn) => { on[t] = fn; }, skipWaiting: async () => {}, clients: { claim: async () => {} } },
    caches: { keys: async () => [...store], delete: async (k) => store.delete(k), open: async () => ({ put: async () => {} }), match: async () => undefined },
    fetch: async () => ({ ok: false }),
    location: { origin: 'https://jmoranii.github.io' }, URL,
  });
  let pending;
  on.activate({ waitUntil: (p) => { pending = p; } });
  await pending;
  eq([...store].sort().join(','), [CACHE, ...SIBLINGS].sort().join(','), "sw activate deletes only RL5's own stale caches (RL1–4 survive)");
  const fetchEv = (path, headers = {}) => { let used = false; on.fetch({ request: { method: 'GET', url: `https://jmoranii.github.io/rolfe-legends-5/${path}`, headers: new Map(Object.entries(headers)), mode: 'no-cors' }, respondWith: (p) => { used = true; Promise.resolve(p).catch(() => {}); } }); return used; };
  ok(!fetchEv('assets/video/ending.mp4'), 'sw leaves the ending video to the network');
  ok(!fetchEv('assets/audio/ending.mp3', { range: 'bytes=0-' }), 'sw passes byte-range requests straight through');
  ok(fetchEv('assets/cards/pass.jpg'), 'sw serves art cache-first');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) { for (const f of fails) console.log('  ✗ ' + f); process.exit(1); }

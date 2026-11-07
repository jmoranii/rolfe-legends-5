// Rolfe Legends 5 — THE CROPS ATTACK bestiary. All new (no-port rule).
// Bosses and mini bosses are Wyatt's (names) + Hugo's powers (approved in chat);
// regular crops are Hugo's roster. Numbers are DESIGN.md §6 starting points; the
// selfplay harness tunes them. Crops are funny-angry, never gross or scary.
// Move AI: nextMove(self, state, rng) → intent {name, kind, dmg?, times?, block?, fn?, pre?}
// kinds: attack | defend | buff | debuff | special | summon | countdown
// Every intent shows exact numbers (kid-fair pillar); fn effects are named in the intent.

import { applyStatus, spawnEnemy, livingEnemies, addJunk, dealDamage, queueTeary, queueGrab } from './combat.js';

const A = (name, dmg, times, extra = {}) => ({ name, kind: 'attack', dmg, ...(times ? { times } : {}), ...extra });
const summonNow = (st, key) => { const d = spawnEnemy(st, key); d.intent = d.def.nextMove(d, st, st.rng); return d; };
const countLiving = (st, key) => livingEnemies(st).filter((e) => e.key === key).length;
const tick = (self) => { self.state.n = (self.state.n || 0) + 1; return self.state.n; };

export const ENEMIES = {
  // ======================= WORLD 1 — Corn World =======================
  mini_corn: { // StS1 Jaw Worm-ish mixer
    name: 'Mini Corn', emoji: '🌽', hp: [42, 46], world: 1,
    nextMove(self) {
      return tick(self) % 2 === 1 ? A('Kernel Pop', 2, 3) : A('Cob Bonk (+4 Block)', 5, 0, { block: 4 });
    },
  },
  soybean_pod: { // StS1 Louse trio
    name: 'Soybean Pod', emoji: '🫛', hp: [18, 20], world: 1,
    nextMove(self) {
      return tick(self) % 3 === 0 ? { name: 'Curl Up', kind: 'defend', block: 6 } : A('Bean Bop', 2);
    },
  },
  pumpkin_roller: { // StS1 charge-then-hit
    name: 'Pumpkin Roller', emoji: '🎃', hp: [58, 62], world: 1,
    nextMove(self) {
      return tick(self) % 2 === 1 ? { name: 'Rolling up the hill… (next: ROLL 10)', kind: 'countdown', block: 5 } : A('ROLL!', 10);
    },
  },
  bossy_squash: { // StS1 Fungi Beast-ish
    name: 'Bossy Squash', emoji: '🥒', hp: [51, 55], world: 1,
    nextMove(self) {
      return tick(self) % 3 === 0 ? A('SQUASH! (+ you are Weak 1)', 6, 0, { fn: (st) => applyStatus(st, st.hero, 'weak', 1) }) : A('Bossy Bump', 5);
    },
  },
  popcorn_puff: { // summon only (Mega Corn's POP!)
    name: 'Popcorn Puff', emoji: '🍿', hp: [8, 8], world: 1, summon: true,
    nextMove() { return A('Puff!', 2); },
  },
  cornstalk: { // MINI BOSS (Wyatt) — Swat · Corn Drop · Deep Roots
    name: 'The Cornstalk', emoji: '🌾', hp: [82, 85], elite: true, world: 1,
    beforeAct(self) { self.block += 3; },
    nextMove(self, state) {
      const n = tick(self);
      if (n % 4 === 1 && countLiving(state, 'mini_corn') < 2) {
        return { name: 'Corn Drop! (a Mini Corn falls off and joins)', kind: 'summon', fn: (st) => summonNow(st, 'mini_corn') };
      }
      return A('Swat', 7);
    },
    roots: 5,
  },
  mega_corn: { // BOSS 1 — the Heat Meter, persistent Husk, POP!, Kettle Corn at half
    name: 'The Mega Corn', emoji: '🌽', hp: [138, 138], boss: true, world: 1,
    init(self) { self.state.heat = 0; self.state.kettle = false; self.meter = { k: 'heat', n: 0, max: 4, label: '🔥 Heat' }; },
    onDamaged(self, state) {
      if (!self.state.kettle && self.hp > 0 && self.hp <= self.maxHp / 2) {
        self.state.kettle = true; self.name = 'KETTLE CORN!'; self.artKey = 'mega_corn_kettle';
        state.log.push({ t: 'bossPhase', key: 'mega_corn', text: '🔥 KETTLE CORN! It heats up twice as fast now!' });
      }
    },
    nextMove(self, state) {
      const n = tick(self);
      self.state.heat = Math.min(4, self.state.heat + (self.state.kettle ? 2 : 1));
      self.meter.n = self.state.heat;
      if (self.state.heat >= 4) {
        return A('💥 POP!!! (then 2 Popcorn Puffs jump out)', 18, 0, {
          big: true,
          reset: (st, e) => { e.state.heat = 0; e.meter.n = 0; },
          fn: (st) => { for (let i = 0; i < 2; i++) if (livingEnemies(st).length < 5) summonNow(st, 'popcorn_puff'); },
        });
      }
      if (n % 2 === 1) return { name: 'Husk Up! (+10 Husk that stays until you break it)', kind: 'defend', fn: (st, e) => { e.shield = Math.min(20, (e.shield || 0) + 10); } };
      return A('Kernel Spray', 3, 3);
    },
  },

  // ======================= WORLD 2 — Tomato World =======================
  mini_tomato: { // StS1 Cultist-lite (ripens)
    name: 'Mini Tomato', emoji: '🍅', hp: [47, 51], world: 2,
    nextMove(self) {
      return tick(self) % 3 === 0 ? { name: 'Ripen! (+2 Strong)', kind: 'buff', fn: (st, e) => applyStatus(st, e, 'strong', 2) } : A('Tomato Toss', 7);
    },
  },
  cherry_tomato: { // StS1 Slime spawn — splashes when popped
    name: 'Cherry Tomato', emoji: '🔴', hp: [15, 16], world: 2,
    nextMove() { return A('Roll Into You', 2); },
    onDeath(self, state) { dealDamage(state, state.hero, 2, { isAttack: false, src: 'splash' }); state.log.push({ t: 'splash', amount: 2 }); },
    splash: 2,
  },
  hot_pepper: { // StS1 poison, on you (Burning)
    name: 'Hot Pepper', emoji: '🌶️', hp: [50, 53], world: 2,
    nextMove(self) {
      return tick(self) % 2 === 1
        ? A('Spicy Poke (+ Burning 3)', 4, 0, { fn: (st) => applyStatus(st, st.hero, 'burning', 3) })
        : A('Fire Breath', 8);
    },
  },
  zucchini_bat: { // StS1 charge-then-hit
    name: 'Zucchini Slugger', emoji: '🥒', hp: [61, 65], world: 2,
    nextMove(self) {
      return tick(self) % 2 === 1 ? { name: 'Winding up… (next: BIG SWING 12)', kind: 'countdown', block: 8 } : A('BIG SWING!', 12);
    },
  },
  rotten_tomato: { // MINI BOSS (Wyatt) — Rotten Splat · Stinky Cloud · bursts on death
    name: 'The Rotten Tomato', emoji: '🤢', hp: [126, 129], elite: true, world: 2,
    nextMove(self) {
      if (tick(self) % 3 === 0) {
        return { name: 'Stinky Cloud! (your first card next turn costs 1 more + a Stinky card)', kind: 'debuff',
          fn: (st) => { st.cardTaxNext = 1; addJunk(st, 'rotten_tomato'); } };
      }
      return A('Rotten Splat (+ you are Weak 1)', 8, 0, { fn: (st) => applyStatus(st, st.hero, 'weak', 1) });
    },
    onDeath(self, state) { dealDamage(state, state.hero, 6, { isAttack: false, src: 'burst' }); state.log.push({ t: 'splash', amount: 6 }); },
    splash: 6,
  },
  ripe_tomato: { // BOSS 2 — the Ripeness Meter, warned SPLAT!, Vine Grab, Cherry Toss
    name: 'The Ripe Tomato', emoji: '🍅', hp: [195, 195], boss: true, world: 2,
    init(self) { self.state.ripe = 0; self.state.half = false; self.meter = { k: 'ripe', n: 0, max: 10, label: '🍅 Ripeness' }; },
    // every hit ripens it; every 2 Ripeness adds +1 to its attacks
    onHit(self) {
      if (self.state.warned) return; // ready to SPLAT: stays at 10
      if (self.state.ripe < 10) {
        self.state.ripe += 1; self.meter.n = self.state.ripe;
        if (self.state.ripe % 2 === 0) self.strong = (self.strong || 0) + 1;
      }
    },
    onDamaged(self, state) {
      if (!self.state.half && self.hp > 0 && self.hp <= self.maxHp / 2) {
        self.state.half = true;
        state.log.push({ t: 'bossPhase', key: 'ripe_tomato', text: '🌿 A second vine grows! Vine Grab wraps 2 cards now.' });
      }
    },
    nextMove(self, state) {
      if (self.state.warned) {
        self.state.warned = false;
        return A('💥 SPLAT!!!', Math.max(0, 30 - (self.strong || 0)), 0, {
          big: true,
          reset: (st, e) => { e.strong = Math.max(0, (e.strong || 0) - Math.floor(e.state.ripe / 2)); e.state.ripe = 0; e.meter.n = 0; e.artKey = 'ripe_tomato'; },
        });
      }
      if (self.state.ripe >= 10) {
        self.state.warned = true; self.artKey = 'ripe_tomato_ripe';
        return { name: '⚠️ TOO RIPE! Next turn: SPLAT 30!', kind: 'countdown', block: 10 };
      }
      const n = tick(self);
      if (n % 3 === 1) {
        const k = self.state.half ? 2 : 1;
        return A(`Vine Grab (wraps ${k} card${k > 1 ? 's' : ''} next turn)`, 7, 0, { fn: (st) => queueGrab(st, k) });
      }
      if (n % 3 === 2 && countLiving(state, 'cherry_tomato') < 3) {
        return { name: 'Cherry Toss! (2 Cherry Tomatoes)', kind: 'summon', fn: (st) => { summonNow(st, 'cherry_tomato'); summonNow(st, 'cherry_tomato'); } };
      }
      return A('Tomato Slam', 13);
    },
  },

  // ======================= WORLD 3 — Onion World (underground) =======================
  mini_onion: { // makes you Teary
    name: 'Mini Onion', emoji: '🧅', hp: [46, 50], world: 3,
    nextMove(self) {
      return tick(self) % 2 === 1
        ? A('Onion Sting (+ Teary 1)', 5, 0, { fn: (st) => queueTeary(st, 1) })
        : A('Layer Slap', 8);
    },
  },
  carrot_drill: { // StS1 Transient-ish timing: underground every other turn
    name: 'Carrot Drill', emoji: '🥕', hp: [53, 57], world: 3,
    nextMove(self) {
      if (tick(self) % 2 === 1) return { name: 'Dig Down! (underground: can\'t be hit, then DRILL 11)', kind: 'special', fn: (st, e) => { e.dissolved = true; } };
      return A('DRILL!', 11, 0, { pre: (st, e) => { e.dissolved = false; } });
    },
  },
  radish: { // StS1 pair: the other gets angry
    name: 'Radish', emoji: '🌰', hp: [31, 34], world: 3,
    nextMove() { return A('Radish Kick', 5); },
    onDeath(self, state) {
      for (const e of livingEnemies(state)) if (e !== self && e.key === 'radish') { applyStatus(state, e, 'strong', 3); state.log.push({ t: 'angry', target: state.enemies.indexOf(e) }); }
    },
  },
  couch_potato: { // big blocker
    name: 'Couch Potato', emoji: '🥔', hp: [76, 80], world: 3,
    nextMove(self) {
      return tick(self) % 2 === 1 ? { name: 'Lounge (+13 Block)', kind: 'defend', block: 13 } : A('FLOP!', 10);
    },
  },
  baby_onion: { // summon only (the Heart of the Onion)
    name: 'Baby Onion', emoji: '🧅', hp: [12, 12], world: 3, summon: true,
    nextMove() { return A('Tiny Tears (+ Teary 1)', 3, 0, { fn: (st) => queueTeary(st, 1) }); },
  },
  bruised_onion: { // MINI BOSS (Wyatt) — angrier every hit · Grumpy Tears · Bruised Spot
    name: 'The Bruised Onion', emoji: '🟣', hp: [140, 143], elite: true, world: 3,
    firstHitBonus: 5,
    onHit(self) { if ((self.state.anger || 0) < 8) { self.state.anger = (self.state.anger || 0) + 1; self.strong = (self.strong || 0) + 1; } },
    nextMove(self) {
      return tick(self) % 2 === 1
        ? A('Grumpy Tears (+ Teary 1)', 6, 0, { fn: (st) => queueTeary(st, 1) })
        : A('Big Grump', 10);
    },
  },
  huge_onion: { // FINAL BOSS — three layers; damage never carries through a layer break
    name: 'The Huge Onion — Papery Skin', emoji: '🧅', hp: [140, 140], boss: true, world: 3,
    init(self) { self.state.layer = 1; self.meter = { k: 'layer', n: 1, max: 3, label: '🧅 Layer' }; },
    onDeath(self, state) {
      const L = self.state.layer;
      if (L >= 3) return;
      const next = L + 1;
      self.state.layer = next; self.state.n = 0; self.meter.n = next;
      self.maxHp = Math.round((next === 2 ? 120 : 105) * (self.hpMult || 1)); self.hp = self.maxHp;
      self.deathHandled = false; self.block = 0; self.strong = 0; self.weak = 0; self.bruised = 0; self.nuhUh = false;
      self.name = next === 2 ? 'The Huge Onion — Stinky Layer' : 'The Huge Onion — the HEART';
      self.artKey = next === 2 ? 'huge_onion_2' : 'huge_onion_3';
      self.intent = self.def.nextMove(self, state, state.rng);
      state.log.push({ t: 'bossPhase', key: 'huge_onion', layer: next,
        text: next === 2 ? '🧅 PEEL! A layer comes off… and the Stinky Layer is underneath!' : '🧅 PEEL! You reached the HEART of the Onion. It is MAD.' });
    },
    nextMove(self, state) {
      const n = tick(self);
      const L = self.state.layer;
      if (L === 1) return A('Papery Slap (+ Teary 1)', 11, 0, { fn: (st) => queueTeary(st, 1) });
      if (L === 2) {
        return n % 2 === 1
          ? A('Onion Breath (+ a Stinky card)', 7, 2, { fn: (st) => addJunk(st, 'huge_onion') })
          : A('Layer Lash', 7, 2);
      }
      if (n % 3 === 1 && countLiving(state, 'baby_onion') < 2) {
        return { name: 'Baby Onions! (2 join the fight)', kind: 'summon', fn: (st) => { summonNow(st, 'baby_onion'); summonNow(st, 'baby_onion'); } };
      }
      return A(n % 2 === 0 ? 'Heart Stomp' : 'ONION RAGE', n % 2 === 0 ? 15 : 19, 0, { big: true });
    },
  },

  // ======================= the Jackpot's all-crops fight (Hugo) =======================
  medley_1: medley(1, 92), medley_2: medley(2, 112), medley_3: medley(3, 130),
};

// The Veggie Medley: a Corn, a Tomato, and an Onion squished into one wobbly salad.
// Mini-boss strength for its world; only from the Jackpot's three-crops result.
function medley(world, hp) {
  const s = world - 1;
  return {
    name: 'The Veggie Medley', emoji: '🥗', hp: [hp, hp], elite: true, world, jackpot: true, artKey: 'veggie_medley',
    nextMove(self) {
      const n = tick(self) % 3;
      if (n === 1) return A('Toss Salad', 3 + s, 3);
      if (n === 2) return { name: 'Extra Dressing (+10 Block, +2 Strong)', kind: 'buff', block: 10, fn: (st, e) => applyStatus(st, e, 'strong', 2) };
      return A('BIG CRUNCH', 12 + 2 * s);
    },
  };
}

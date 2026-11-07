// Rolfe Legends 5 — card data. Pure data + pure helpers; js/combat.js interprets.
// Every card names its inspiration (DESIGN.md §3). ALL content is new for RL5 —
// test/test.mjs enforces that no name collides with RL1–RL4 (the no-port rule).
//
// Effect ops (fx array, run in order):
//   dmg, times, allEnemies            attack damage (Strong / Weak / Bruised apply; Aaron adds his Gear bonus)
//   shot: N                           (on a dmg op) Wyatt's SHOT: +N damage per Touch, then ALL Touches are spent
//   downshift: N                      (on a dmg op) Aaron's Downshift: +N damage per gear dropped, then back to Gear 1
//   bookStorm                         (on a dmg op) BOOK STORM!: + Library Day bonus
//   block, blockPerGear: N            block (Aaron adds his Gear bonus) · N block per current Gear
//   draw, energy
//   status: { k, n, target }          k: 'strong' | 'weak' | 'bruised'; target: 'target' | 'self' | 'all'
//   touch: N                          Wyatt: +N Touches (max 5)
//   shift: N                          Aaron: +N Gears (max 3)
//   page: N                           Liam: +N pages in the Book Meter (4 → BOOK STORM!)
//   fillBook                          Liam: fill the Book Meter right now
//   sequel                            Liam: the next BOOK STORM! this fight happens twice
//   cancel                            the target's next attack is cancelled ("Nuh-uh!")
//   ifGear: { n, fx }                 run nested ops when Gear ≥ n
//   power: 'id', pn                   a lasting power for this fight
// Flags: exhausts ("Used up"), unplayable, retain (stays in hand at turn end),
//        pageDiscount (costs 1 less per page in the Book Meter), special (never in rewards).

export const HEROES = {
  wyatt: {
    id: 'wyatt', name: 'Wyatt the Speedy', short: 'Wyatt', emoji: '⚽', hp: 80,
    relic: 'shin_guards', mechanic: 'touches',
    tagline: 'Fastest feet on the farm. Dribble up Touches… then SHOOT.',
    starter: ['pass', 'pass', 'pass', 'pass', 'juke_left', 'juke_left', 'juke_left', 'juke_left', 'toe_tap', 'power_shot'],
  },
  aaron: {
    id: 'aaron', name: 'Aaron the Strong', short: 'Aaron', emoji: '🚜', hp: 82,
    relic: 'tractor_keys', mechanic: 'gears',
    tagline: 'Drives the farm tractor into battle. Shift up… and PLOW.',
    starter: ['plow', 'plow', 'plow', 'plow', 'hay_bale', 'hay_bale', 'hay_bale', 'hay_bale', 'shift_up', 'hay_bale_launch'],
  },
  liam: {
    id: 'liam', name: 'Liam the Reader', short: 'Liam', emoji: '📚', hp: 72,
    relic: 'library_card', mechanic: 'book',
    tagline: 'Reads a LOT of books now. Fill the Book Meter… then BOOK STORM!',
    starter: ['bonk_book', 'bonk_book', 'bonk_book', 'bonk_book', 'hide_book', 'hide_book', 'hide_book', 'read_book', 'read_book', 'bookmark'],
  },
};

export const TOUCH_MAX = 5;
export const GEAR_MAX = 3;
export const GEAR_BONUS = 2;          // per gear above 1, to Aaron's attacks and block
export const BOOK_PAGES = 4;          // Book Meter size
export const BOOK_STORM_DMG = 15;     // Wyatt's number: 15 to every enemy
export const BOOK_STORM_ID = 'book_storm';
export const COUSIN_ID = 'cousins';
export const STINKY_ID = 'stinky';

export const CARDS = {
  // ================= ⚽ WYATT THE SPEEDY — Touches =================
  pass: { hero: 'wyatt', name: 'Pass', emoji: '⚽', type: 'attack', cost: 1, rarity: 'starter', src: 'StS1 Strike + a Touch',
    text: 'Deal {d} damage. +1 Touch.', fx: [{ dmg: 7 }, { touch: 1 }], up: { fx: [{ dmg: 10 }, { touch: 1 }] } },
  juke_left: { hero: 'wyatt', name: 'Juke Left', emoji: '↩️', type: 'skill', cost: 1, rarity: 'starter', src: 'StS1 Defend',
    text: 'Gain {b} Block.', fx: [{ block: 6 }], up: { fx: [{ block: 9 }] } },
  toe_tap: { hero: 'wyatt', name: 'Toe Tap', emoji: '🦶', type: 'skill', cost: 0, rarity: 'starter', src: 'StS1 Prepared (Touch version)',
    text: '+{t} Touches. Used up.', fx: [{ touch: 2 }], exhausts: true, up: { fx: [{ touch: 3 }] } },
  power_shot: { hero: 'wyatt', name: 'Power Shot', emoji: '🥅', type: 'attack', cost: 1, rarity: 'starter', src: 'StS1 Finisher (spends Touches)',
    text: 'SHOT! Deal {d} damage (+{s} for every Touch, then they\'re all spent){now}.', fx: [{ dmg: 5, shot: 5 }], up: { fx: [{ dmg: 7, shot: 6 }] } },

  give_and_go: { hero: 'wyatt', name: 'Give and Go', emoji: '🔁', type: 'attack', cost: 1, rarity: 'common', src: 'StS1 Pommel Strike',
    text: 'Deal {d} damage. +1 Touch. Draw 1.', fx: [{ dmg: 4 }, { touch: 1 }, { draw: 1 }], up: { fx: [{ dmg: 7 }, { touch: 1 }, { draw: 1 }] } },
  dribble_past: { hero: 'wyatt', name: 'Dribble Past', emoji: '💨', type: 'skill', cost: 1, rarity: 'common', src: 'StS1 Defend+ + a Touch',
    text: 'Gain {b} Block. +1 Touch.', fx: [{ block: 7 }, { touch: 1 }], up: { fx: [{ block: 10 }, { touch: 1 }] } },
  header: { hero: 'wyatt', name: 'Header', emoji: '🙆', type: 'attack', cost: 1, rarity: 'common', src: 'StS1 Twin Strike',
    text: 'Deal {d} damage twice.', fx: [{ dmg: 5, times: 2 }], up: { fx: [{ dmg: 7, times: 2 }] } },
  chip_shot: { hero: 'wyatt', name: 'Chip Shot', emoji: '🌈', type: 'attack', cost: 0, rarity: 'common', src: 'StS1 Shiv (SHOT version)',
    text: 'SHOT! Deal {d} damage (+{s} for every Touch, then they\'re spent){now}.', fx: [{ dmg: 3, shot: 4 }], up: { fx: [{ dmg: 5, shot: 5 }] } },
  step_over: { hero: 'wyatt', name: 'Step Over', emoji: '🩰', type: 'skill', cost: 0, rarity: 'common', src: 'StS1 Prepared',
    text: '+1 Touch. Draw {n}. Used up.', fx: [{ touch: 1 }, { draw: 1 }], exhausts: true, up: { fx: [{ touch: 1 }, { draw: 2 }] } },
  wall_pass: { hero: 'wyatt', name: 'Wall Pass', emoji: '🧱', type: 'attack', cost: 1, rarity: 'common', src: "StS1 Dagger Spray (Wyatt's AoE)",
    text: 'Deal {d} damage to ALL enemies. +1 Touch.', fx: [{ dmg: 4, allEnemies: true }, { touch: 1 }], up: { fx: [{ dmg: 6, allEnemies: true }, { touch: 1 }] } },

  bicycle_kick: { hero: 'wyatt', name: 'Overhead Kick', emoji: '🚲', type: 'attack', cost: 2, rarity: 'uncommon', src: 'StS1 Die Die Die (SHOT to all)',
    text: 'SHOT! Deal {d} damage to ALL enemies (+{s} for every Touch, then they\'re spent){now}.', fx: [{ dmg: 5, shot: 4, allEnemies: true }],
    up: { fx: [{ dmg: 7, shot: 5, allEnemies: true }] } },
  corner_kick: { hero: 'wyatt', name: 'Corner Kick', emoji: '🚩', type: 'attack', cost: 1, rarity: 'uncommon', src: 'StS1 Bash (SHOT version)',
    text: 'SHOT! Deal {d} damage (+{s} for every Touch, then they\'re spent){now}. It\'s Bruised {n}.', fx: [{ dmg: 4, shot: 5 }, { status: { k: 'bruised', n: 1, target: 'target' } }],
    up: { fx: [{ dmg: 6, shot: 5 }, { status: { k: 'bruised', n: 2, target: 'target' } }] } },
  rainbow_flick: { hero: 'wyatt', name: 'Rainbow Flick', emoji: '🎆', type: 'skill', cost: 1, rarity: 'uncommon', src: 'StS1 Blur-ish',
    text: '+{t} Touches. Gain {b} Block.', fx: [{ touch: 2 }, { block: 5 }], up: { fx: [{ touch: 2 }, { block: 8 }] } },
  sliding_save: { hero: 'wyatt', name: 'Sliding Save', emoji: '🧤', type: 'attack', cost: 1, rarity: 'uncommon', src: 'StS1 Neutralize+',
    text: 'Deal {d} damage. It\'s Weak {n}.', fx: [{ dmg: 6 }, { status: { k: 'weak', n: 2, target: 'target' } }],
    up: { fx: [{ dmg: 8 }, { status: { k: 'weak', n: 3, target: 'target' } }] } },
  keepy_uppy: { hero: 'wyatt', name: 'Keepy-Uppy', emoji: '🔂', type: 'power', cost: 1, rarity: 'uncommon', src: 'StS1 Noxious Fumes (Touch version)',
    text: 'At the start of every turn, +{n} Touch.', power: 'keepy_uppy', pn: 1, up: { cost: 0 } },
  through_ball: { hero: 'wyatt', name: 'Through Ball', emoji: '🎯', type: 'skill', cost: 1, rarity: 'uncommon', src: 'StS1 Acrobatics',
    text: 'Draw {n} cards. +1 Touch.', fx: [{ draw: 2 }, { touch: 1 }], up: { fx: [{ draw: 3 }, { touch: 1 }] } },

  golden_boot: { hero: 'wyatt', name: 'Golden Boot', emoji: '🥇', type: 'power', cost: 2, rarity: 'rare', src: 'Original',
    text: 'Every SHOT! leaves {n} Touch behind instead of spending them all.', power: 'golden_boot', pn: 1, up: { pn: 2 } },
  fast_break: { hero: 'wyatt', name: 'Fast Break', emoji: '🏃', type: 'power', cost: 1, rarity: 'rare', src: 'Original',
    text: 'You can hold up to 10 Touches this fight. +{t} Touches now.', power: 'fast_break', pn: 10, fx: [{ touch: 2 }], up: { fx: [{ touch: 4 }] } },
  penalty_kick: { hero: 'wyatt', name: 'Penalty Kick', emoji: '🏆', type: 'attack', cost: 2, rarity: 'rare', src: 'StS1 Skewer-ish (big SHOT)',
    text: 'SHOT! Deal {d} damage (+{s} for every Touch, then they\'re spent){now}.', fx: [{ dmg: 10, shot: 6 }], up: { fx: [{ dmg: 14, shot: 7 }] } },

  // ================= 🚜 AARON THE STRONG — Tractor Gears =================
  plow: { hero: 'aaron', name: 'Plow', emoji: '🚜', type: 'attack', cost: 1, rarity: 'starter', src: 'StS1 Strike',
    text: 'Deal {d} damage.', fx: [{ dmg: 6 }], up: { fx: [{ dmg: 9 }] } },
  hay_bale: { hero: 'aaron', name: 'Hay Bale', emoji: '🌾', type: 'skill', cost: 1, rarity: 'starter', src: 'StS1 Defend',
    text: 'Gain {b} Block.', fx: [{ block: 5 }], up: { fx: [{ block: 8 }] } },
  shift_up: { hero: 'aaron', name: 'Shift Up', emoji: '🕹️', type: 'skill', cost: 1, rarity: 'starter', src: 'StS1 Inflame (resets each fight)',
    text: '+1 Gear. Gain {b} Block.', fx: [{ shift: 1 }, { block: 4 }], up: { fx: [{ shift: 1 }, { block: 7 }] } },
  hay_bale_launch: { hero: 'aaron', name: 'Hay Bale Launch', emoji: '🎯', type: 'attack', cost: 2, rarity: 'starter', src: 'StS1 Heavy Blade (Downshift)',
    text: 'DOWNSHIFT! Deal {d} damage (+{s} for every gear you drop, back to Gear 1){now}.', fx: [{ dmg: 6, downshift: 8 }], up: { fx: [{ dmg: 9, downshift: 10 }] } },

  rev_it: { hero: 'aaron', name: 'Rev It', emoji: '🔥', type: 'skill', cost: 0, rarity: 'common', src: 'StS1 Flex-ish',
    text: '+1 Gear. Used up.', fx: [{ shift: 1 }], exhausts: true, up: { fx: [{ shift: 1 }, { draw: 1 }], text: '+1 Gear. Draw 1. Used up.' } },
  mud_spray: { hero: 'aaron', name: 'Mud Spray', emoji: '🟤', type: 'attack', cost: 1, rarity: 'common', src: 'StS1 Cleave',
    text: 'Deal {d} damage to ALL enemies.', fx: [{ dmg: 4, allEnemies: true }], up: { fx: [{ dmg: 7, allEnemies: true }] } },
  bumper: { hero: 'aaron', name: 'Bumper Bash', emoji: '💥', type: 'attack', cost: 1, rarity: 'common', src: 'StS1 Strike+',
    text: 'Deal {d} damage.', fx: [{ dmg: 9 }], up: { fx: [{ dmg: 12 }] } },
  big_wheels: { hero: 'aaron', name: 'Big Wheels', emoji: '🛞', type: 'skill', cost: 1, rarity: 'common', src: 'StS1 Entrench-ish',
    text: 'Gain {n} Block for every Gear you\'re in{now}.', fx: [{ blockPerGear: 4 }], up: { fx: [{ blockPerGear: 6 }] } },
  gear_grind: { hero: 'aaron', name: 'Gear Grind', emoji: '⚙️', type: 'attack', cost: 1, rarity: 'common', src: 'StS1 Clash (conditional)',
    text: 'Deal {d} damage. In Gear 3: hit again.', fx: [{ dmg: 6 }, { ifGear: { n: 3, fx: [{ dmg: 6 }] } }],
    up: { fx: [{ dmg: 8 }, { ifGear: { n: 3, fx: [{ dmg: 8 }] } }] } },
  tow_hitch: { hero: 'aaron', name: 'Tow Hitch', emoji: '🪝', type: 'skill', cost: 1, rarity: 'common', src: 'StS1 Shrug It Off',
    text: 'Gain {b} Block. Draw 1.', fx: [{ block: 7 }, { draw: 1 }], up: { fx: [{ block: 10 }, { draw: 1 }] } },

  tractor_horn: { hero: 'aaron', name: 'Tractor Horn', emoji: '📯', type: 'skill', cost: 1, rarity: 'uncommon', src: 'StS1 Intimidate',
    text: 'ALL enemies are Weak {n}. Used up.', fx: [{ status: { k: 'weak', n: 2, target: 'all' } }], exhausts: true, up: { fx: [{ status: { k: 'weak', n: 3, target: 'all' } }] } },
  hay_wagon: { hero: 'aaron', name: 'Hay Wagon', emoji: '🛻', type: 'attack', cost: 2, rarity: 'uncommon', src: 'StS1 Uppercut',
    text: 'Deal {d} damage. It\'s Bruised {n}.', fx: [{ dmg: 14 }, { status: { k: 'bruised', n: 1, target: 'target' } }],
    up: { fx: [{ dmg: 18 }, { status: { k: 'bruised', n: 2, target: 'target' } }] } },
  second_gear: { hero: 'aaron', name: 'Second Gear', emoji: '🔧', type: 'skill', cost: 1, rarity: 'uncommon', src: 'StS1 Battle Trance-lite',
    text: '+1 Gear. Draw {n}.', fx: [{ shift: 1 }, { draw: 2 }], up: { fx: [{ shift: 1 }, { draw: 3 }] } },
  plow_through: { hero: 'aaron', name: 'Plow Through', emoji: '🌪️', type: 'attack', cost: 1, rarity: 'uncommon', src: 'StS1 Whirlwind-lite (Downshift)',
    text: 'DOWNSHIFT! Deal {d} damage to ALL enemies (+{s} for every gear you drop){now}.', fx: [{ dmg: 3, downshift: 5, allEnemies: true }],
    up: { fx: [{ dmg: 5, downshift: 6, allEnemies: true }] } },
  roll_bar: { hero: 'aaron', name: 'Roll Bar', emoji: '🛡️', type: 'power', cost: 1, rarity: 'uncommon', src: 'StS1 Feel No Pain (on Shift)',
    text: 'Every time you shift up a Gear, gain {n} Block.', power: 'roll_bar', pn: 4, up: { pn: 6 } },
  engine_roar: { hero: 'aaron', name: 'Engine Roar', emoji: '🦁', type: 'skill', cost: 1, rarity: 'uncommon', src: 'StS1 Inflame',
    text: 'Gain {n} Strong. Used up.', fx: [{ status: { k: 'strong', n: 2, target: 'self' } }], exhausts: true, up: { fx: [{ status: { k: 'strong', n: 3, target: 'self' } }] } },

  full_throttle: { hero: 'aaron', name: 'Full Throttle', emoji: '🏁', type: 'power', cost: 2, rarity: 'rare', src: 'StS1 Demon Form (Gear version)',
    text: 'At the start of every turn, +1 Gear.', power: 'full_throttle', pn: 1, up: { cost: 1 } },
  last_furrow: { hero: 'aaron', name: 'Last Furrow', emoji: '🌄', type: 'attack', cost: 2, rarity: 'rare', src: 'StS1 Immolate (Downshift)',
    text: 'DOWNSHIFT! Deal {d} damage to ALL enemies (+{s} for every gear you drop){now}.', fx: [{ dmg: 8, downshift: 10, allEnemies: true }],
    up: { fx: [{ dmg: 12, downshift: 12, allEnemies: true }] } },
  big_red_charge: { hero: 'aaron', name: 'Big Red Charge', emoji: '🟥', type: 'attack', cost: 3, rarity: 'rare', src: 'StS1 Bludgeon',
    text: 'Deal {d} damage.', fx: [{ dmg: 30 }], up: { fx: [{ dmg: 38 }] } },

  // ================= 📚 LIAM THE READER — the Book Meter (Wyatt's design) =================
  bonk_book: { hero: 'liam', name: 'Bonk with a Book', emoji: '📕', type: 'attack', cost: 1, rarity: 'starter', src: 'StS1 Strike',
    text: 'Deal {d} damage.', fx: [{ dmg: 7 }], up: { fx: [{ dmg: 10 }] } },
  hide_book: { hero: 'liam', name: 'Hide Behind a Book', emoji: '📖', type: 'skill', cost: 1, rarity: 'starter', src: 'StS1 Defend',
    text: 'Gain {b} Block.', fx: [{ block: 5 }], up: { fx: [{ block: 8 }] } },
  read_book: { hero: 'liam', name: 'Read a Book', emoji: '📗', type: 'skill', cost: 1, rarity: 'starter', src: 'Wyatt: the Book card (fills the Book Meter)',
    text: 'Read it! +1 page. Draw 1.', fx: [{ page: 1 }, { draw: 1 }], up: { fx: [{ page: 1 }, { draw: 1 }, { block: 3 }], text: 'Read it! +1 page. Draw 1. Gain {b} Block.' } },
  bookmark: { hero: 'liam', name: 'Bookmark', emoji: '🔖', type: 'skill', cost: 0, rarity: 'starter', src: 'StS1 Well-Laid Plans-ish',
    text: '+1 page. Stays in your hand at the end of your turn. Used up.', fx: [{ page: 1 }], exhausts: true, retain: true,
    up: { fx: [{ page: 1 }, { draw: 1 }], text: '+1 page. Draw 1. Stays in your hand at the end of your turn. Used up.' } },
  story_time: { hero: 'liam', name: 'Story Time', emoji: '🧸', type: 'skill', cost: 1, rarity: 'common', src: 'Original (Book Meter)',
    text: '+{pg} pages.', fx: [{ page: 2 }], up: { fx: [{ page: 2 }, { block: 4 }], text: '+{pg} pages. Gain {b} Block.' } },
  pop_up_book: { hero: 'liam', name: 'Pop-Up Book', emoji: '🏰', type: 'skill', cost: 1, rarity: 'common', src: 'StS1 Defend+ + a page',
    text: 'Gain {b} Block. +1 page.', fx: [{ block: 8 }, { page: 1 }], up: { fx: [{ block: 11 }, { page: 1 }] } },
  dinosaur_book: { hero: 'liam', name: 'Dinosaur Book', emoji: '🦖', type: 'attack', cost: 1, rarity: 'common', src: 'StS1 Strike+',
    text: 'ROAR! Deal {d} damage.', fx: [{ dmg: 9 }], up: { fx: [{ dmg: 12 }] } },
  space_book: { hero: 'liam', name: 'Space Book', emoji: '🚀', type: 'attack', cost: 1, rarity: 'common', src: 'StS1 Thunderclap-ish',
    text: 'Shooting stars! Deal {d} damage to ALL enemies twice.', fx: [{ dmg: 2, allEnemies: true, times: 2 }], up: { fx: [{ dmg: 3, allEnemies: true, times: 2 }] } },
  picture_book: { hero: 'liam', name: 'Picture Book', emoji: '🖼️', type: 'skill', cost: 0, rarity: 'common', src: 'Original',
    text: '+{pg} page. Used up.', fx: [{ page: 1 }], exhausts: true, up: { fx: [{ page: 2 }], text: '+{pg} pages. Used up.' } },
  bedtime_story: { hero: 'liam', name: 'Bedtime Story', emoji: '🌙', type: 'skill', cost: 1, rarity: 'common', src: 'StS1 Leg Sweep-lite',
    text: 'Gain {b} Block. Make an enemy Weak {n}.', fx: [{ block: 6 }, { status: { k: 'weak', n: 1, target: 'target' } }],
    up: { fx: [{ block: 8 }, { status: { k: 'weak', n: 2, target: 'target' } }] } },

  library_day: { hero: 'liam', name: 'Library Day', emoji: '🏛️', type: 'power', cost: 1, rarity: 'uncommon', src: 'Original (Book Meter)',
    text: 'BOOK STORM! deals +{n} damage.', power: 'library_day', pn: 5, up: { pn: 8 } },
  sequel: { hero: 'liam', name: 'The Sequel', emoji: '📚', type: 'skill', cost: 1, rarity: 'uncommon', src: 'StS1 Burst',
    text: 'Your next BOOK STORM! this fight happens twice. Used up.', fx: [{ sequel: true }], exhausts: true, up: { cost: 0 } },
  page_turner: { hero: 'liam', name: 'Page Turner', emoji: '📄', type: 'skill', cost: 1, rarity: 'uncommon', src: 'StS1 Acrobatics',
    text: 'Draw {n} cards. +1 page.', fx: [{ draw: 2 }, { page: 1 }], up: { fx: [{ draw: 3 }, { page: 1 }] } },
  big_book_bonk: { hero: 'liam', name: 'Big Book Bonk', emoji: '📘', type: 'attack', cost: 2, rarity: 'uncommon', src: 'StS1 Carnage-lite',
    text: 'Deal {d} damage. +1 page.', fx: [{ dmg: 14 }, { page: 1 }], up: { fx: [{ dmg: 18 }, { page: 1 }] } },
  read_aloud: { hero: 'liam', name: 'Read Aloud', emoji: '📣', type: 'attack', cost: 1, rarity: 'uncommon', src: 'StS1 Cleave + a page',
    text: 'Deal {d} damage to ALL enemies. +1 page.', fx: [{ dmg: 4, allEnemies: true }, { page: 1 }], up: { fx: [{ dmg: 6, allEnemies: true }, { page: 1 }] } },
  book_fort: { hero: 'liam', name: 'Book Fort', emoji: '🏯', type: 'skill', cost: 2, rarity: 'uncommon', src: 'StS1 Impervious-lite',
    text: 'Gain {b} Block.', fx: [{ block: 15 }], up: { fx: [{ block: 20 }] } },

  the_end: { hero: 'liam', name: 'The End', emoji: '🔚', type: 'skill', cost: 1, rarity: 'rare', src: 'Original (fills the meter)',
    text: 'Fill the Book Meter right now! Used up.', fx: [{ fillBook: true }], exhausts: true, up: { cost: 0 } },
  bookworm: { hero: 'liam', name: 'Bookworm', emoji: '🐛', type: 'power', cost: 1, rarity: 'rare', src: 'StS1 Noxious Fumes (page version)',
    text: 'At the start of every turn, +{n} page.', power: 'bookworm', pn: 1, up: { cost: 0 } },
  overdue_book: { hero: 'liam', name: 'Overdue Book', emoji: '⏰', type: 'attack', cost: 3, rarity: 'rare', src: 'StS1 Masterful Stab (inverted: pages make it cheaper)',
    text: 'Deal {d} damage. Costs 1 less for every page in your Book Meter.', fx: [{ dmg: 22 }], pageDiscount: true, up: { fx: [{ dmg: 28 }] } },

  // ================= specials (never in rewards) =================
  book_storm: { hero: 'liam', name: 'BOOK STORM!', emoji: '🌪️', type: 'attack', cost: 0, rarity: 'special', special: true, src: 'Wyatt: throws books at every enemy for 15',
    text: 'Throw books at EVERY enemy for {d} damage! Used up.', fx: [{ dmg: BOOK_STORM_DMG, allEnemies: true, bookStorm: true }], exhausts: true },
  cousins: { hero: null, name: 'The Cousins!', emoji: '👯', type: 'skill', cost: 0, rarity: 'special', special: true, cousin: true,
    src: "Wyatt: the Jackpot's Cousin Card — Stella's Barbie, Lucy's squish, Delilah's Nuh-uh",
    text: '👑 Stella\'s Barbie: +{n} Strong. 🫧 Lucy\'s squish: Weak 2. 💅 Delilah: "Nuh-uh!" No next attack.',
    fx: [{ status: { k: 'strong', n: 2, target: 'self' } }, { status: { k: 'weak', n: 2, target: 'target' } }, { cancel: true }], exhausts: true },
  stinky: { hero: null, name: 'Stinky', emoji: '🤢', type: 'status', cost: null, rarity: 'status', special: true, src: 'StS1 Dazed (fight-only)',
    text: 'Pee-yew! Can\'t be played. Gone after the fight.', unplayable: true },
};

export const RARITY_WEIGHTS = { common: 60, uncommon: 32, rare: 8 };

export function draftPool(heroId) {
  return Object.keys(CARDS).filter((id) => CARDS[id].hero === heroId && ['common', 'uncommon', 'rare'].includes(CARDS[id].rarity));
}

// A card instance in a deck: { id, up, uid }
let uidCounter = 1;
export function makeCard(id, up = false) {
  return { id, up: !!up, uid: uidCounter++ };
}
export function bumpUid(n) { if (n >= uidCounter) uidCounter = n + 1; } // after loading a save

// Resolved view of a card instance: upgrade overrides. Pure.
export function cardInfo(inst) {
  const base = CARDS[inst.id];
  if (!base) return null;
  const info = { ...base, id: inst.id, uid: inst.uid, upgraded: !!inst.up };
  if (inst.up && base.up) Object.assign(info, base.up);
  if (inst.up) info.name = `${info.name}+`;
  return info;
}

export function firstDmgIdx(info) {
  return (info.fx || []).findIndex((o) => o.dmg != null);
}

export function upgradableCards(deck) {
  return deck.filter((c) => !c.up && CARDS[c.id] && CARDS[c.id].up);
}

// Never carried into the next fight by the saved-cards rule (DESIGN.md §4).
export function neverSaved(id) {
  return id === COUSIN_ID || id === STINKY_ID || id === BOOK_STORM_ID;
}

// The value a card's {n} placeholder stands for (a test asserts every {n} resolves).
export function nValue(info) {
  if (info.power && info.pn != null && info.id !== 'fast_break') return info.pn;
  for (const o of info.fx || []) {
    if (o.status) return Math.abs(o.status.n);
    if (o.draw != null) return o.draw;
    if (o.blockPerGear != null) return o.blockPerGear;
  }
  return info.pn ?? null;
}
export function touchValue(info) { const o = (info.fx || []).find((x) => x.touch != null); return o ? o.touch : null; }
export function pageValue(info) { const o = (info.fx || []).find((x) => x.page != null); return o ? o.page : null; }
export function scaleValue(info) { const o = (info.fx || []).find((x) => x.shot != null || x.downshift != null); return o ? (o.shot ?? o.downshift) : null; }

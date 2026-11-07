// Rolfe Legends 5 — the three crop worlds (Wyatt: three separate worlds, one boss each).
// Pure data: names, map stops, story lines, encounters. DESIGN.md §6.

const STOPS = {
  shop: { ico: '🌱', name: "Grampa Flaj's Seed Shed", desc: 'Buy cards or treasures, or get rid of a card.' },
  rest: { ico: '🍎', name: "Mom's Snack Break", desc: 'Snack (heal) or Practice (upgrade a card).' },
  treasure: { ico: '🦙', name: "Goldie's Gate", desc: 'Goldie found something. A treasure!' },
  jackpot: { ico: '🎰', name: 'The Jackpot', desc: 'One free spin! Three cousins = the Cousin Card. Three crops = a fight. Mixed = a Cactus.' },
};

export const WORLDS = {
  1: {
    id: 'w1', name: 'Corn World', short: 'Corn', emoji: '🌽', boss: 'The Mega Corn', bossKey: 'mega_corn',
    challenge: 'Watch the Heat Meter. Block BEFORE it pops!',
    rooms: {
      fight: { ico: '⚔️', name: 'Crop Fight', desc: 'Angry corn and friends.' },
      elite: { ico: '💀', name: 'MINI BOSS: the Cornstalk', desc: 'A tough fight, with a treasure at the end.' },
      ...STOPS,
      boss: { ico: '🌽', name: 'THE MEGA CORN', desc: 'The biggest ear of corn you have EVER seen.' },
    },
    story: { sub: 'Into the corn rows!', line: 'The whole cornfield woke up grumpy. Somewhere in the middle, the Mega Corn is heating up.' },
    encounters: {
      easy: [['mini_corn'], ['soybean_pod', 'soybean_pod', 'soybean_pod'], ['bossy_squash']],
      hard: [['pumpkin_roller'], ['mini_corn', 'soybean_pod', 'soybean_pod'], ['bossy_squash', 'mini_corn'], ['pumpkin_roller', 'soybean_pod']],
      elite: [['cornstalk']],
      boss: [['mega_corn']],
      medley: ['medley_1'],
    },
  },
  2: {
    id: 'w2', name: 'Tomato World', short: 'Tomato', emoji: '🍅', boss: 'The Ripe Tomato', bossKey: 'ripe_tomato',
    challenge: 'Every hit makes the Ripe Tomato riper. Big hits beat lots of little ones!',
    rooms: {
      fight: { ico: '⚔️', name: 'Crop Fight', desc: 'Tomatoes, peppers, and a very big zucchini.' },
      elite: { ico: '💀', name: 'MINI BOSS: the Rotten Tomato', desc: 'A tough (and stinky) fight, with a treasure at the end.' },
      ...STOPS,
      boss: { ico: '🍅', name: 'THE RIPE TOMATO', desc: 'So ripe it might SPLAT at any moment.' },
    },
    story: { sub: 'Into the giant tomato garden!', line: 'The vines are taller than the barn. The tomatoes are ripe, red, and ready to SPLAT.' },
    encounters: {
      easy: [['mini_tomato'], ['cherry_tomato', 'cherry_tomato', 'cherry_tomato', 'cherry_tomato'], ['hot_pepper']],
      hard: [['zucchini_bat'], ['hot_pepper', 'mini_tomato'], ['zucchini_bat', 'cherry_tomato', 'cherry_tomato'], ['mini_tomato', 'mini_tomato']],
      elite: [['rotten_tomato']],
      boss: [['ripe_tomato']],
      medley: ['medley_2'],
    },
  },
  3: {
    id: 'w3', name: 'Onion World', short: 'Onion', emoji: '🧅', boss: 'The Huge Onion', bossKey: 'huge_onion',
    challenge: 'Onions make you teary: some cards go blurry. You can still play them!',
    rooms: {
      fight: { ico: '⚔️', name: 'Crop Fight', desc: 'Onions, carrots, radishes, and one very comfy potato.' },
      elite: { ico: '💀', name: 'MINI BOSS: the Bruised Onion', desc: 'A tough (and grumpy) fight, with a treasure at the end.' },
      ...STOPS,
      boss: { ico: '🧅', name: 'THE HUGE ONION', desc: 'Three layers. Peel them ALL.' },
    },
    story: { sub: 'Down the burrow into Onion World!', line: 'Underground, where the root crops grow. It smells like onions. A LOT like onions.' },
    encounters: {
      easy: [['mini_onion'], ['radish', 'radish'], ['carrot_drill']],
      hard: [['couch_potato'], ['mini_onion', 'carrot_drill'], ['couch_potato', 'radish'], ['mini_onion', 'mini_onion']],
      elite: [['bruised_onion']],
      boss: [['huge_onion']],
      medley: ['medley_3'],
    },
  },
};
export const WORLD_COUNT = 3;

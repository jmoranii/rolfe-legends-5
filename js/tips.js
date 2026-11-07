// Rolfe Legends 5 — Coach James's tip library (victory beats) + loss lines.
// Per-hero tips only show for that hero. Copy is listed in REVIEW.md for James's pass.

export const TIPS_GENERAL = [
  'Look at the bubble over each crop — it tells you EXACTLY what it will do next.',
  'Block only lasts one turn. Block when a big hit is coming, attack when it isn\'t.',
  'Cards left in your hand when a fight ends come WITH you to the next fight!',
  'The Jackpot is free! Three cousins = the Cousin Card. Three crops = a fight. Mixed = a Cactus.',
  'The Cousin Card comes back every fight in that world. Save Delilah\'s "Nuh-uh!" for the BIG hit.',
  'A mini boss (💀) is tough… but it always drops a treasure.',
  'Removing weak cards at the Seed Shed makes your good cards show up more often.',
  'Tap anything you don\'t understand — every chip and bubble explains itself.',
  'Watch the Mega Corn\'s Heat Meter. Block BEFORE it pops!',
  'Every hit makes the Ripe Tomato riper. One big hit beats lots of little ones.',
  'Teary? Blurry cards still work. Play them anyway!',
  'Your whole deck travels with you to the next world — every card you pick matters.',
];
export const TIPS_HERO = {
  wyatt: [
    'Pass the ball to build up Touches… then SHOOT for a huge hit!',
    'A SHOT spends ALL your Touches. Wait until you have a bunch!',
    'Keepy-Uppy gives you a free Touch every single turn.',
  ],
  aaron: [
    'Shift up to Gear 3 and EVERY card gets stronger.',
    'Downshift cards drop you back to Gear 1… for a giant hit. Rev up first!',
    'Full Throttle shifts you up a gear every turn by itself.',
  ],
  liam: [
    'Read a Book fills your Book Meter. Four pages… BOOK STORM!',
    'BOOK STORM! hits EVERY enemy for 15. Save it for a crowd!',
    'Bookworm gives you a free page every turn.',
  ],
};
let tipIdx = 0;
export function nextTip(hero) {
  const pool = [...TIPS_GENERAL, ...(TIPS_HERO[hero] || []), ...(TIPS_HERO[hero] || [])];
  return pool[tipIdx++ % pool.length];
}
export const LOSS_LINES = [
  'Those crops are TOUGH. Try a different path next time.',
  'Every legend loses a few. Shake it off and try again!',
  'Next time, block before the big hit is coming.',
  'Try a different hero! Each one plays totally different.',
  'Spin the Jackpot! The cousins are a big help.',
];
let lossIdx = 0;
export function nextLossLine() { return LOSS_LINES[lossIdx++ % LOSS_LINES.length]; }

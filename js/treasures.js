// Rolfe Legends 5 — treasures (relics). Pure data; combat.js / run.js implement hooks.
// All new for RL5 (no-port rule). The Cactus is the Jackpot's mixed-up prize (Wyatt).

export const TREASURES = {
  // hero starters
  shin_guards:  { name: 'Shin Guards', emoji: '🦵', starter: 'wyatt', text: 'Start every fight with 1 Touch.' },
  tractor_keys: { name: 'Tractor Keys', emoji: '🔑', starter: 'aaron', text: 'The first time you shift up a Gear each fight, draw 1.' },
  library_card: { name: 'Library Card', emoji: '🪪', starter: 'liam', text: 'Start every fight with 2 pages in your Book Meter.' },

  // the pool (Goldie's Gate, mini bosses, the shop)
  straw_hat:     { name: 'Straw Hat', emoji: '👒', text: 'Start every fight with 7 Block.' },
  seed_packet:   { name: 'Seed Packet', emoji: '🌱', text: '+1 ⚡ on your first turn of every fight.' },
  garden_gloves: { name: 'Garden Gloves', emoji: '🧤', text: 'The first card you play each fight costs 0.' },
  watering_can:  { name: 'Watering Can', emoji: '🚿', text: 'Heal 3 HP after every fight.' },
  morning_glory: { name: 'Morning Glory', emoji: '🌺', text: 'Every 3rd turn of a fight, gain 1 ⚡.' },
  piggy_jar:     { name: 'Coin Jar', emoji: '🫙', text: '+60 coins right now.' },
  bug_spray:     { name: 'Bug Spray', emoji: '🧴', text: 'At the start of every fight, all enemies are Weak 1.' },
  compost_bin:   { name: 'Compost Bin', emoji: '♻️', text: 'The first time you drop below half HP in a fight, gain 10 Block.' },
  farm_bell:     { name: 'Farm Bell', emoji: '🔔', text: 'Card rewards show 4 choices instead of 3.' },
  pitchfork:     { name: 'Pitchfork', emoji: '🔱', text: 'Start every fight with 1 Strong.' },
  rain_barrel:   { name: 'Rain Barrel', emoji: '🛢️', text: 'You can\'t be Burning.' },

  // boss treasures (pick 1 of 3 after the Mega Corn and after the Ripe Tomato)
  golden_corn:    { name: 'Golden Corn', emoji: '🏅', boss: true, text: '+1 ⚡ every turn. No catch!' },
  tomato_cage:    { name: 'Tomato Cage', emoji: '🗼', boss: true, text: 'Gain 5 Block at the start of every turn.' },
  grain_bin:      { name: 'Grain Bin', emoji: '🛖', boss: true, text: 'Draw 1 extra card every turn.' },
  blue_ribbon:    { name: 'Blue Ribbon', emoji: '🎗️', boss: true, text: 'Start every fight with 2 Strong.' },
  county_trophy:  { name: 'County Fair Trophy', emoji: '🏆', boss: true, text: '+12 max HP right now.' },

  // the Jackpot (Wyatt) — leaves when you beat this world's boss
  cactus: { name: 'Cactus', emoji: '🌵', jackpot: true, text: 'Every time an enemy hits you, the Cactus pokes it back for 1. Leaves when you beat this world\'s boss.' },
};

export function treasurePool(owned) {
  return Object.keys(TREASURES).filter((id) => !TREASURES[id].starter && !TREASURES[id].boss && !TREASURES[id].jackpot && !owned.includes(id));
}
export function bossTreasurePool(owned) {
  return Object.keys(TREASURES).filter((id) => TREASURES[id].boss && !owned.includes(id));
}

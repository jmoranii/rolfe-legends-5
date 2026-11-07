// Rolfe Legends 5 — art paths (pure). Every painting is drop-in: the loader tries
// these paths in order, then falls back to the emoji. Per-world LIGHT, not per-world
// card skins (DESIGN.md §9): a card is painted once; worlds change backgrounds,
// boards, frames, and the map.

export const heroArt = (hero) => [`assets/heroes/${hero}.jpg`];
export const heroWinArt = (hero) => [`assets/heroes/${hero}_win.jpg`, `assets/heroes/${hero}.jpg`];
export const cardArt = (id) => [`assets/cards/${id}.jpg`];
export const enemyArt = (artKey) => [`assets/enemies/${artKey}.jpg`];
export const worldBg = (world, kind) => [`assets/bg/w${world}_${kind}.jpg`]; // battle | map | shop | rest | treasure | jackpot | story
export const sceneArt = (name) => [`assets/scenes/${name}.jpg`];
export const endingArt = (name) => [`assets/ending/${name}.jpg`];
export const jackpotFace = (key) => [`assets/jackpot/${key}.jpg`]; // stella lucy delilah corn tomato onion
export const treasureArt = (id) => [`assets/treasures/${id}.jpg`];
export const uiArt = (name) => [`assets/ui/${name}.jpg`];

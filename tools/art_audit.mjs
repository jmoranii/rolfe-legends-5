// Rolfe Legends 5 — art/music audit: every hook the game loads has a file.
//   node tools/art_audit.mjs   (exit 1 if anything is missing)
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { CARDS, HEROES } from '../js/cards.js';
import { ENEMIES } from '../js/enemies.js';
import { TREASURES } from '../js/treasures.js';
import * as A from '../js/art.js';
import { openingShots, endingShots } from '../js/scenes.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const want = new Set();
for (const h of Object.keys(HEROES)) { want.add(A.heroArt(h)[0]); want.add(A.heroWinArt(h)[0]); want.add(A.uiArt(`ko_${h}`)[0]); }
for (const id of Object.keys(CARDS)) want.add(A.cardArt(id)[0]);
for (const [k, e] of Object.entries(ENEMIES)) want.add(A.enemyArt(e.artKey || k)[0]);
for (const k of ['mega_corn_kettle', 'ripe_tomato_ripe', 'huge_onion_2', 'huge_onion_3']) want.add(A.enemyArt(k)[0]);
for (const id of Object.keys(TREASURES)) want.add(A.treasureArt(id)[0]);
for (const w of [1, 2, 3]) for (const kind of ['battle', 'map', 'shop', 'rest', 'treasure', 'jackpot', 'story']) want.add(A.worldBg(w, kind)[0]);
for (const s of openingShots('x')) want.add(A.sceneArt(s.img)[0]);
for (const h of Object.keys(HEROES)) for (const s of endingShots(h)) want.add(A.endingArt(s.img)[0]);
for (const k of ['stella', 'lucy', 'delilah', 'corn', 'tomato', 'onion']) want.add(A.jackpotFace(k)[0]);
for (const k of ['title', 'portrait_coach', 'jackpot_machine']) want.add(A.uiArt(k)[0]);
for (const t of ['title', 'world1', 'world2', 'world3', 'battle1', 'battle2', 'battle3', 'jackpot', 'ending', 'boss_mega_corn', 'boss_ripe_tomato', 'boss_huge_onion']) want.add(`assets/audio/${t}.mp3`);
want.add('assets/audio/ending.lrc');
const missing = [...want].filter((p) => !existsSync(join(ROOT, p)));
console.log(`art/music hooks: ${want.size - missing.length}/${want.size} present`);
if (missing.length) { console.log(missing.map((m) => `  missing ${m}`).join('\n')); process.exit(1); }

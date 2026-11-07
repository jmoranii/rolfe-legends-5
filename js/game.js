// Rolfe Legends 5: The Crops Attack — UI layer. Renders the pure engine
// (combat.js / run.js): title → hero → Wyatt's opening (Savanah's car rumbles the
// soil) → Corn World → map → fights, the Jackpot, shops, snacks → the Mega Corn →
// Tomato World → … → the Huge Onion → the ending → the song. Art + music are drop-in
// (emoji / silence fallbacks). Design: DESIGN.md · build rules: CLAUDE.md, GOAL.md.

import { makeRng, randomSeed } from './rng.js';
import { HEROES, CARDS, cardInfo, makeCard, upgradableCards, BOOK_PAGES, GEAR_MAX, COUSIN_ID, STINKY_ID, BOOK_STORM_ID } from './cards.js';
import { cardText } from './text.js';
import { TREASURES } from './treasures.js';
import { WORLDS, WORLD_COUNT } from './worlds.js';
import { SLOTS } from './jackpot.js';
import * as C from './combat.js';
import * as R from './run.js';
import { MAP_FLOORS, BOSS_ID } from './map.js';
import * as A from './art.js';
import * as SC from './scenes.js';
import { sfx, setEnabled as setSfx, isEnabled as sfxOn } from './sfx.js';
import * as music from './music.js';
import { creditsRoll } from './credits.js';
import { prefetch } from './prefetch.js';
import { nextTip, nextLossLine } from './tips.js';

const $app = document.getElementById('app');
const SAVE_KEY = 'rl5_run';
const PROFILE_KEY = 'rl5_profile';
const TIPS_KEY = 'rl5_tips';
const SEENFX_KEY = 'rl5_seenfx';
const ANIM_KEY = 'rl5_anim';

const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let animMode = safeGet(ANIM_KEY) || 'slow';
function fxScale() { return REDUCED ? 0.01 : (animMode === 'fast' ? 0.55 : 1.9); }
function stepMs() { return REDUCED ? 30 : (animMode === 'fast' ? 420 : 1350); }
function applyFxScale() { document.documentElement.style.setProperty('--fx', String(REDUCED ? 0.01 : fxScale())); }
applyFxScale();

function safeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function safeSet(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode: play on, no save */ } }
function safeDel(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } }

let run = null;
let combat = null;
let combatKind = 'fight';
let selectedCard = null;
let prevSnap = null;
let savedThisFight = new Set();

// ---------- profile & save ----------
function loadProfile() {
  try { const p = JSON.parse(safeGet(PROFILE_KEY)); if (p && p.wins) return { harvestMax: 0, movies: {}, ...p }; } catch { /* fresh */ }
  return { wins: {}, harvestMax: 0, movies: {} };
}
function saveProfile(p) { safeSet(PROFILE_KEY, JSON.stringify(p)); }
function saveRun() { if (run) safeSet(SAVE_KEY, R.serializeRun(run)); }
function clearSave() { safeDel(SAVE_KEY); }
function markMovie(k) { const p = loadProfile(); p.movies[k] = 1; saveProfile(p); }

// ---------- tiny dom helpers ----------
function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}
function curLook() { return run && run.world ? `w${run.world}` : 'base'; }
function screen(extra = '') {
  $app.innerHTML = '';
  document.querySelectorAll('.coach-bubble').forEach((b) => b.remove());
  resetTips();
  const s = el('div', `screen look-${curLook()} ${extra} screen-enter`);
  $app.appendChild(s);
  return s;
}
let $toasts = null;
function toast(msg, ms = 2600) {
  if (!$toasts || !$toasts.isConnected) { $toasts = el('div', 'toast-stack'); document.body.appendChild($toasts); }
  const words = String(msg).replace(/<[^>]*>/g, ' ').trim().split(/\s+/).length;
  const dur = Math.min(9000, Math.max(ms, 2600, words * 320)); // the boys read slowly; a tap dismisses
  const t = el('div', 'toast', msg);
  const dismiss = () => { if (!t.isConnected) return; t.classList.add('gone'); setTimeout(() => t.remove(), 260); };
  t.onclick = dismiss;
  $toasts.appendChild(t);
  setTimeout(dismiss, dur);
}
function modal(title, buildFn, { dismissable = true } = {}) {
  const veil = el('div', `modal-veil look-${curLook()}`);
  const m = el('div', 'modal');
  if (title) m.appendChild(el('h2', '', title));
  veil.appendChild(m);
  if (dismissable) veil.addEventListener('click', (ev) => { if (ev.target === veil) veil.remove(); });
  document.body.appendChild(veil);
  buildFn(m, () => veil.remove());
  return veil;
}

// ---------- drop-in art: try each path in order, then the emoji ----------
const missingArt = new Map();
const MISSING_RETRY_MS = 12000;
function artImg(paths, emoji, cls = '') {
  const list = (Array.isArray(paths) ? paths : [paths]).filter(Boolean);
  const wrap = el('span', `art-slot ${cls}`);
  const usable = list.filter((p) => { const f = missingArt.get(p); return !f || Date.now() - f >= MISSING_RETRY_MS; });
  if (!usable.length) { wrap.textContent = emoji; wrap.classList.add('art-emoji'); return wrap; }
  const img = document.createElement('img');
  img.alt = ''; img.draggable = false;
  let i = 0;
  img.onload = () => missingArt.delete(usable[i]);
  img.onerror = () => {
    missingArt.set(usable[i], Date.now());
    i += 1;
    if (i < usable.length) img.src = usable[i];
    else { img.remove(); wrap.textContent = emoji; wrap.classList.add('art-emoji'); }
  };
  img.src = usable[0];
  wrap.appendChild(img);
  return wrap;
}
function bgLayer(paths, cls = 'scene-bg') {
  const d = el('div', cls);
  d.dataset.bg = '';
  const list = (Array.isArray(paths) ? paths : [paths]).filter(Boolean);
  const tryAt = (i) => {
    if (i >= list.length) return;
    const p = list[i];
    const f = missingArt.get(p);
    if (f && Date.now() - f < MISSING_RETRY_MS) return tryAt(i + 1);
    const probe = new Image();
    probe.onload = () => { missingArt.delete(p); d.style.backgroundImage = `url("${p}")`; d.classList.add('has-art'); };
    probe.onerror = () => { missingArt.set(p, Date.now()); tryAt(i + 1); };
    probe.src = p;
  };
  tryAt(0);
  return d;
}

// ---------- the card face (every card surface uses this) ----------
function cardFace(inst, { look = curLook(), mini = false, live = false, price = null, extraCls = '' } = {}) {
  const info = cardInfo(inst);
  const st = live ? combat : null;
  const cost = st ? C.effectiveCost(st, inst) : info.cost;
  const teary = st && C.isTeary(st, inst);
  const grabbed = st && C.isGrabbed(st, inst);
  const d = el('div', `${mini ? 'mini-card' : 'card'} cardface look-${look} type-${info.type} rarity-${info.rarity}${info.upgraded ? ' upgraded' : ''}${info.cousin ? ' cousin-card' : ''}${info.id === BOOK_STORM_ID ? ' storm-card' : ''}${teary ? ' teary' : ''}${grabbed ? ' grabbed' : ''} ${extraCls}`);
  if (cost !== null && cost !== undefined) {
    const costEl = el('div', 'cost', String(cost));
    if (st && cost < info.cost) costEl.classList.add('cost-down');
    if (st && cost > info.cost) costEl.classList.add('cost-up');
    d.appendChild(costEl);
  }
  d.appendChild(artImg(A.cardArt(inst.id), info.emoji, 'card-art'));
  d.appendChild(el('div', 'cnm', teary ? '😢 ???' : info.name));
  d.appendChild(el('div', 'ctx', teary ? 'Too teary to read! You can still play it.' : cardText(info, st)));
  if (grabbed) d.appendChild(el('div', 'card-tag tag-vine', '🌿 grabbed!'));
  if (st && savedThisFight.has(inst.uid)) d.appendChild(el('div', 'card-tag tag-saved', '💾 saved'));
  if (price != null) d.appendChild(el('div', 'price-tag', `💰${price}`));
  return d;
}
function sceneDeps() { return { el, artImg, bgLayer, sfx, REDUCED, fxScale, cardFace: (c, o) => cardFace(c, o) }; }

// A stop screen: the place as a painted banner, choices beneath, with decision
// support (HP · coins · deck) on every stop.
function sceneScreen(artPaths, emoji, titleText) {
  const s = screen('scene-screen');
  const banner = el('div', 'scene-banner');
  banner.appendChild(artImg(artPaths, emoji, 'scene-banner-art'));
  banner.appendChild(el('div', 'scene-banner-shade'));
  banner.appendChild(el('h2', 'scene-banner-title', titleText));
  s.appendChild(banner);
  const body = el('div', 'scene-body');
  if (run) body.appendChild(statusStrip());
  s.appendChild(body);
  return body;
}
function statusStrip() {
  const strip = el('div', 'scene-status');
  strip.appendChild(el('span', 'scene-stat stat-hp', `❤️ ${run.hp}/${run.maxHp}`));
  strip.appendChild(el('span', 'scene-stat stat-gold', `💰 ${run.coins}`));
  if (run.cousinCard) strip.appendChild(el('span', 'scene-stat', '👯 Cousins!'));
  const deckB = el('button', 'pilebtn', `🎴 My Deck (${run.deck.length})`);
  deckB.onclick = () => showDeckModal(run.deck);
  strip.appendChild(deckB);
  return strip;
}

// ---------- Coach James: one tip per moment, never twice ----------
function tipsSeen() { try { return JSON.parse(safeGet(TIPS_KEY)) || {}; } catch { return {}; } }
const tipQueue = [];
let tipActive = false;
function coachTip(key, text) {
  const seen = tipsSeen();
  if (seen[key]) return;
  seen[key] = 1;
  safeSet(TIPS_KEY, JSON.stringify(seen));
  tipQueue.push(text);
  pumpTips();
}
function pumpTips() {
  if (tipActive || !tipQueue.length) return;
  tipActive = true;
  const text = tipQueue.shift();
  const b = el('div', 'coach-bubble tappable');
  b.appendChild(artImg(A.uiArt('portrait_coach'), '🧢', 'coach-face'));
  b.appendChild(el('span', 'coach-text', `<b>Coach James:</b> ${text}<br><span class="tip-tap">(tap to close)</span>`));
  document.body.appendChild(b);
  b.onclick = () => {
    b.classList.add('gone');
    setTimeout(() => { b.remove(); tipActive = false; pumpTips(); }, 350);
  };
}
function resetTips() { tipQueue.length = 0; tipActive = false; }

// ---------- wake lock + fullscreen ----------
let wakeLock = null, wakeWanted = false;
function holdScreen() {
  wakeWanted = true;
  if (!('wakeLock' in navigator) || wakeLock) return;
  navigator.wakeLock.request('screen').then((wl) => { wakeLock = wl; wl.addEventListener('release', () => { wakeLock = null; }); }).catch(() => {});
}
function releaseScreen() { wakeWanted = false; if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; } }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && wakeWanted) holdScreen(); });
const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement || null;
function fsAvailable() { const d = document.documentElement; return !!(d.requestFullscreen || d.webkitRequestFullscreen); }
async function toggleFullscreen() {
  const d = document.documentElement;
  try {
    if (fsEl()) await (document.exitFullscreen ? document.exitFullscreen() : document.webkitExitFullscreen());
    else await (d.requestFullscreen ? d.requestFullscreen() : d.webkitRequestFullscreen());
  } catch { /* some webviews refuse; the button just no-ops */ }
}
const fsLabel = () => `⛶ Full screen: ${fsEl() ? 'ON' : 'OFF'}`;
for (const evName of ['fullscreenchange', 'webkitfullscreenchange']) {
  document.addEventListener(evName, () => document.querySelectorAll('.fs-toggle').forEach((b) => { b.textContent = fsLabel(); }));
}

// ---------- prefetch bundles ----------
function worldArtUrls(w) {
  const keys = new Set();
  const enc = WORLDS[w].encounters;
  for (const pool of [enc.easy, enc.hard, enc.elite, enc.boss]) for (const g of pool) for (const k of g) keys.add(k);
  keys.add('veggie_medley');
  if (w === 1) { keys.add('popcorn_puff'); keys.add('mega_corn_kettle'); }
  if (w === 2) keys.add('ripe_tomato_ripe');
  if (w === 3) { keys.add('baby_onion'); keys.add('huge_onion_2'); keys.add('huge_onion_3'); }
  const urls = [...keys].map((k) => `assets/enemies/${k}.jpg`);
  for (const kind of ['battle', 'map', 'shop', 'rest', 'treasure', 'jackpot', 'story']) urls.push(`assets/bg/w${w}_${kind}.jpg`);
  return urls;
}
function deckArtUrls() {
  if (!run) return [];
  return [...new Set(run.deck.map((c) => c.id))].map((id) => A.cardArt(id)[0]).concat(A.heroArt(run.hero)[0]);
}
function prefetchWorld(w) {
  prefetch([...worldArtUrls(w), `assets/audio/world${w}.mp3`, `assets/audio/battle${w}.mp3`, `assets/audio/boss_${WORLDS[w].bossKey}.mp3`, ...deckArtUrls()]);
  if (w < WORLD_COUNT) prefetch(worldArtUrls(w + 1).slice(0, 6));
}

// ================================================================= TITLE
function showTitle() {
  releaseScreen();
  run = null;
  music.play('title');
  const s = screen('title-screen');
  s.appendChild(bgLayer(A.uiArt('title'), 'title-art'));
  const inner = el('div', 'title-inner');
  inner.appendChild(el('h1', 'title-logo', '🌽 ROLFE LEGENDS 5 🧅'));
  inner.appendChild(el('p', 'subtitle title-sub', '<b>THE CROPS ATTACK</b><br>designed by Wyatt · made with Uncle James'));
  const btns = el('div', 'title-buttons');
  const saved = R.deserializeRun(safeGet(SAVE_KEY));
  if (saved) {
    const b = el('button', 'btn gold', `▶️ Continue — ${HEROES[saved.hero].short}, ${WORLDS[saved.world].name}`);
    b.onclick = () => { sfx.tap(); run = saved; resumeRun(); };
    btns.appendChild(b);
  }
  const nb = el('button', 'btn', saved ? '🆕 New game' : '▶️ Play!');
  nb.onclick = () => {
    sfx.tap();
    if (saved) {
      modal('Start a new game?', (m, close) => {
        m.appendChild(el('p', '', 'Your game in progress will be gone.'));
        const yes = el('button', 'btn', 'Yes, new game');
        yes.onclick = () => { close(); clearSave(); showHeroSelect(); };
        const no = el('button', 'btn secondary', 'No, keep it');
        no.onclick = close;
        m.append(yes, no);
      });
    } else showHeroSelect();
  };
  btns.appendChild(nb);
  const p = loadProfile();
  const star = (n) => (n <= 5 ? '⭐'.repeat(n) : `⭐×${n}`);
  const winBits = ['wyatt', 'aaron', 'liam'].filter((h) => p.wins[h] > 0).map((h) => `${HEROES[h].emoji} ${HEROES[h].short} ${star(p.wins[h])}`);
  if (winBits.length) btns.appendChild(el('p', 'subtitle wins-shelf', winBits.join('<br>') + (p.harvestMax ? `<br>🌾 Harvest Level ${p.harvestMax} unlocked` : '')));
  if (Object.keys(p.movies || {}).length) {
    const mv = el('button', 'btn secondary', '🎬 Movies');
    mv.onclick = showMovies;
    btns.appendChild(mv);
  }
  const settings = el('button', 'btn secondary', '⚙️ Settings');
  settings.onclick = showSettings;
  btns.appendChild(settings);
  inner.appendChild(btns);
  s.appendChild(inner);
  if (fsAvailable()) {
    const fs = el('button', 'fs-btn', '⛶');
    fs.setAttribute('aria-label', 'Full screen');
    fs.onclick = () => { sfx.tap(); toggleFullscreen(); };
    s.appendChild(fs);
  }
  prefetch(['assets/heroes/wyatt.jpg', 'assets/heroes/aaron.jpg', 'assets/heroes/liam.jpg', 'assets/scenes/open_1_car.jpg', 'assets/scenes/open_2_rumble.jpg', 'assets/ui/portrait_coach.jpg']);
  prefetch(worldArtUrls(1));
}

function resumeRun() {
  if (run.after) return continueAfter();
  // an interrupted fight restarts from its beginning (StS behavior) — never skipped
  if (run.pending) {
    const { kind, encounter } = run.pending;
    if (kind === 'boss') return bossIntro(encounter);
    return startFight(encounter, kind);
  }
  showMap();
}

// ================================================================= SETTINGS
function showSettings() {
  modal('⚙️ Settings', (m, close) => {
    const mus = el('button', 'btn', `🎵 Music: ${music.isEnabled() ? 'ON' : 'OFF'}`);
    mus.onclick = () => { music.setEnabled(!music.isEnabled()); mus.textContent = `🎵 Music: ${music.isEnabled() ? 'ON' : 'OFF'}`; };
    const sx = el('button', 'btn', `🔔 Sounds: ${sfxOn() ? 'ON' : 'OFF'}`);
    sx.onclick = () => { setSfx(!sfxOn()); sx.textContent = `🔔 Sounds: ${sfxOn() ? 'ON' : 'OFF'}`; };
    const animLabel = () => `🎬 Animations: ${animMode === 'slow' ? 'SLOW & CLEAR' : 'FAST'}`;
    const anim = el('button', 'btn', animLabel());
    anim.onclick = () => {
      animMode = animMode === 'slow' ? 'fast' : 'slow';
      safeSet(ANIM_KEY, animMode);
      applyFxScale();
      anim.textContent = animLabel();
    };
    m.append(mus, sx, anim);
    if (fsAvailable()) { const fs = el('button', 'btn fs-toggle', fsLabel()); fs.onclick = () => toggleFullscreen(); m.append(fs); }
    const a2hs = el('button', 'btn secondary', '📲 Put it on your home screen');
    a2hs.onclick = () => { close(); showA2HS(); };
    const code = el('button', 'btn secondary', '📦 Save Code (move your game to another tablet)');
    code.onclick = () => { close(); showSaveCode(); };
    m.append(a2hs, code);
    if (run) {
      const quit = el('button', 'btn danger', '🏳️ Give up this run');
      quit.onclick = () => {
        close();
        modal('Give up this run?', (m2, c2) => {
          const yes = el('button', 'btn danger', 'Yes, end it');
          yes.onclick = () => { c2(); clearSave(); showTitle(); };
          const no = el('button', 'btn secondary', 'No, keep playing!');
          no.onclick = c2;
          m2.append(yes, no);
        });
      };
      m.append(quit);
    }
    const nuke = el('button', 'btn danger', '💥 Start over COMPLETELY');
    nuke.onclick = () => {
      close();
      modal('💥 Start over completely?', (m2, c2) => {
        m2.appendChild(el('p', '', 'This erases EVERYTHING on this device: wins, Harvest Levels, movies, tips, and any run in progress. There is no undo.'));
        const yes = el('button', 'btn danger', 'Yes — wipe it all');
        yes.onclick = () => { for (const k of [SAVE_KEY, PROFILE_KEY, TIPS_KEY, SEENFX_KEY]) safeDel(k); run = null; c2(); toast('💥 Fresh start!'); showTitle(); };
        const no = el('button', 'btn secondary', 'No — keep my stuff!');
        no.onclick = c2;
        m2.append(yes, no);
      });
    };
    m.append(nuke);
    m.appendChild(el('p', 'subtitle', `Rolfe Legends 5 · designed by Wyatt, made with Uncle James<br><span style="opacity:.55;font-size:.72rem">version: ${new Date(document.lastModified).toLocaleString()}</span>`));
  });
}
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; });
function showA2HS() {
  modal('📲 Home screen', (m) => {
    if (deferredInstall) { const b = el('button', 'btn gold', '⬇️ Install the game'); b.onclick = () => { deferredInstall.prompt(); deferredInstall = null; }; m.appendChild(b); }
    m.appendChild(el('p', '', '<b>iPad / iPhone (Safari):</b> tap Share ⬆️, then <b>"Add to Home Screen"</b>.'));
    m.appendChild(el('p', '', '<b>Android (Chrome):</b> tap ⋮, then <b>"Add to home screen"</b>.'));
    m.appendChild(el('p', '', '<b>Amazon Fire kids tablet:</b> a grown-up adds this website at <b>parents.amazon.com</b> (Add Web Content). Then tap ⛶ on the title screen.'));
    m.appendChild(el('p', 'subtitle', 'Then it gets its own icon — and works with no internet.'));
  });
}
// Save Code: the whole game (run + wins) as a copy-paste code
function encodeSave() {
  const blob = JSON.stringify({ g: 'rl5', run: safeGet(SAVE_KEY), profile: safeGet(PROFILE_KEY) });
  return btoa(unescape(encodeURIComponent(blob)));
}
function decodeSave(code) {
  try {
    const o = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
    if (!o || o.g !== 'rl5') return null;
    if (o.run && !R.deserializeRun(o.run)) return null;
    return o;
  } catch { return null; }
}
function showSaveCode() {
  modal('📦 Save Code', (m, close) => {
    m.appendChild(el('p', '', 'Copy this code on THIS tablet, then paste it on the other one.'));
    const ta = el('textarea', 'save-code');
    ta.value = encodeSave(); ta.readOnly = true;
    ta.onclick = () => ta.select();
    m.appendChild(ta);
    m.appendChild(el('p', 'subtitle', 'Got a code from another tablet? Paste it here:'));
    const inp = el('textarea', 'save-code');
    inp.placeholder = 'paste a Save Code…';
    m.appendChild(inp);
    const load = el('button', 'btn gold', '📥 Load that code');
    load.onclick = () => {
      const o = decodeSave(inp.value);
      if (!o) return toast('Hmm, that code doesn\'t look right.');
      if (o.run) safeSet(SAVE_KEY, o.run); else safeDel(SAVE_KEY);
      if (o.profile) safeSet(PROFILE_KEY, o.profile);
      close(); toast('📥 Loaded!'); showTitle();
    };
    m.appendChild(load);
  });
}

// ================================================================= MOVIES
const MOVIES = [
  { key: 'opening', label: '🚗 The Crops Wake Up', play: (done) => SC.openingCutscene(sceneDeps(), HEROES.wyatt.name, done) },
  { key: 'ending', label: '🦙 The Ending', play: (done) => playEnding('wyatt', done) },
  { key: 'song', label: '🎵 The Song: "The Crops Attack"', play: (done) => { music.play(null); SC.playEndingVideo(sceneDeps(), done, () => creditsRoll('wyatt', { el, artImg, sfx, REDUCED }, done)); } },
];
function showMovies() {
  const p = loadProfile();
  modal('🎬 Movies', (m, close) => {
    for (const mv of MOVIES) {
      if (!p.movies[mv.key]) continue;
      const b = el('button', 'btn', mv.label);
      b.onclick = () => { close(); mv.play(() => { music.play('title'); showTitle(); }); };
      m.appendChild(b);
    }
  });
}

// ================================================================= HERO SELECT
const MECH = {
  wyatt: '⚽ <b>Touches:</b> passes build up Touches… then a SHOT spends them all for a huge hit.',
  aaron: '🚜 <b>Tractor Gears:</b> shift up to Gear 3 and every card gets stronger. Downshift for a BIG hit.',
  liam: '📚 <b>The Book Meter:</b> read books to fill it. Four pages… BOOK STORM! 15 to EVERY enemy.',
};
function showHeroSelect() {
  const s = screen('look-base hero-screen');
  s.appendChild(bgLayer(A.sceneArt('open_5_hero'), 'battle-bg'));
  s.appendChild(el('h2', '', 'Who saves the farm?'));
  const row = el('div', 'hero-pick');
  for (const id of ['wyatt', 'aaron', 'liam']) {
    const h = HEROES[id];
    const c = el('div', 'hero-card');
    c.setAttribute('role', 'button');
    c.tabIndex = 0;
    c.setAttribute('aria-label', `Play as ${h.name}`);
    c.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') c.click(); });
    c.appendChild(artImg(A.heroArt(id), h.emoji, 'hero-face'));
    c.appendChild(el('h3', '', h.name));
    c.appendChild(el('p', '', h.tagline));
    c.appendChild(el('p', 'hero-mech', MECH[id]));
    c.appendChild(el('p', '', `❤️ ${h.hp} HP · ${TREASURES[h.relic].emoji} ${TREASURES[h.relic].name}`));
    c.onclick = () => { sfx.play(); pickHarvest(id); };
    row.appendChild(c);
  }
  s.appendChild(row);
  const back = el('button', 'btn secondary', '← Back');
  back.onclick = showTitle;
  s.appendChild(back);
}
function pickHarvest(heroId) {
  const p = loadProfile();
  if (!p.harvestMax) return startRun(heroId, 0);
  modal('🌾 How big a HARVEST?', (m, close) => {
    m.appendChild(el('p', 'subtitle', 'Harvest Levels make the whole game harder. Each level adds one more thing.'));
    for (let L = 0; L <= p.harvestMax; L++) {
      const b = el('button', `btn ${L ? 'secondary two-line' : ''}`, L === 0 ? '🙂 Normal' : `🌾 Harvest Level ${L}<small>${C.HARVEST_LEVELS[L]}</small>`);
      b.onclick = () => { close(); startRun(heroId, L); };
      m.appendChild(b);
    }
  });
}
function startRun(heroId, harvestLevel) {
  run = R.newRun(heroId, randomSeed(), { harvestLevel });
  saveRun();
  music.play('world1');
  $app.innerHTML = '';
  // Wyatt's opening: Aunt Savanah's car rumbles the soil, and the crops SPROUT
  SC.openingCutscene(sceneDeps(), HEROES[heroId].name, () => { markMovie('opening'); showWorldStory(); });
}

function showWorldStory() {
  const W = WORLDS[run.world];
  music.play(`world${run.world}`);
  prefetchWorld(run.world);
  $app.innerHTML = '';
  SC.storyCard(sceneDeps(), {
    world: run.world, kicker: `WORLD ${run.world}`, name: W.name.toUpperCase(), emoji: W.emoji,
    sub: W.story.sub, line: `${W.story.line}<br><br><b>Watch out:</b> ${W.challenge}`, button: run.world === 1 ? '🌽 Let\'s go!' : '💪 Onward!',
  }, () => showMap());
}

// ================================================================= MAP
const WEATHER = {
  w1: { n: 14, make: (i) => (i % 4 === 0 ? el('span', 'wp kernel', '🌽') : el('span', 'wp pollen')) },
  w2: { n: 12, make: (i) => (i % 5 === 0 ? el('span', 'wp leaf', '🍃') : el('span', 'wp seedfluff')) },
  w3: { n: 12, make: (i) => (i % 4 === 0 ? el('span', 'wp drip', '💧') : el('span', 'wp dirt')) },
};
function weatherLayer(look) {
  const w = el('div', `weather weather-${look}`);
  if (REDUCED) return w;
  const spec = WEATHER[look];
  if (!spec) return w;
  for (let i = 0; i < spec.n; i++) {
    const p = spec.make(i);
    p.style.setProperty('--wl', `${(i * 83 + 29) % 100}%`);
    p.style.setProperty('--wt', `${6 + ((i * 47) % 9)}s`);
    p.style.setProperty('--wdel', `${-((i * 13) % 11)}s`);
    p.style.setProperty('--ws', `${0.6 + ((i * 31) % 10) / 12}`);
    w.appendChild(p);
  }
  return w;
}
function nodeMeta(type) {
  const rooms = WORLDS[run.world].rooms;
  return rooms[type] || { ico: '❔', name: type, desc: '' };
}
const ROW_H = 92, MAP_PAD = 40;
function nodeXY(node, W) { return { x: W * (0.14 + node.c * 0.24), y: MAP_PAD + (MAP_FLOORS - node.f) * ROW_H + 20 }; }

function showMap() {
  releaseScreen();
  music.play(`world${run.world}`);
  saveRun();
  const s = screen('map-screen');
  s.appendChild(weatherLayer(curLook()));
  const W = WORLDS[run.world];
  const bar = el('div', 'map-topbar');
  bar.appendChild(el('h2', 'map-title', `${W.emoji} World ${run.world}: ${W.name}`));
  bar.appendChild(el('div', 'floor-meter', `Floor ${run.floor}/${MAP_FLOORS} · ❤️ ${run.hp}/${run.maxHp} · 💰 ${run.coins}${run.harvestLevel ? ` · 🌾 HL${run.harvestLevel}` : ''}`));
  const shelf = el('div', 'relic-shelf');
  for (const rid of run.relics) {
    const t = TREASURES[rid];
    const pin = el('span', 'relic-pin', t.emoji);
    pin.onclick = () => toast(`${t.emoji} <b>${t.name}</b>: ${t.text}`);
    shelf.appendChild(pin);
  }
  if (run.cousinCard) {
    const cb = el('span', 'relic-pin cousin-pin', '👯');
    cb.onclick = () => toast('👯 <b>The Cousin Card</b> is in your hand at the start of EVERY fight in this world. It leaves when you beat the boss.');
    shelf.appendChild(cb);
  }
  const deckBtn = el('button', 'pilebtn', `🎴 ${run.deck.length}`);
  deckBtn.onclick = () => showDeckModal(run.deck);
  const helpBtn = el('button', 'pilebtn', '📖');
  helpBtn.onclick = showHelpModal;
  const menuBtn = el('button', 'pilebtn', '⚙️');
  menuBtn.onclick = showSettings;
  shelf.append(deckBtn, helpBtn, menuBtn);
  bar.appendChild(shelf);
  s.appendChild(bar);

  const wrap = el('div', 'map-wrap');
  const canvas = el('div', 'map-canvas');
  const H = MAP_PAD * 2 + MAP_FLOORS * ROW_H + 40;
  canvas.style.height = `${H}px`;
  canvas.appendChild(bgLayer(A.worldBg(run.world, 'map'), 'map-bg'));
  const wide = bgLayer(A.worldBg(run.world, 'map'), 'map-bg-wide');
  wide.style.height = `${H}px`;
  wrap.appendChild(wide);
  s.appendChild(wrap);
  wrap.appendChild(canvas);
  const Wd = Math.min(wrap.clientWidth || 390, 560);
  canvas.style.width = `${Wd}px`;
  const map = run.map;
  const reach = new Set(R.nextNodes(run).map((n) => n.id));
  const onTrail = new Set(run.trail);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', Wd); svg.setAttribute('height', H);
  svg.classList.add('map-edges');
  const trailPairs = new Set();
  for (let i = 0; i < run.trail.length - 1; i++) trailPairs.add(`${run.trail[i]}>${run.trail[i + 1]}`);
  for (const [from, tos] of Object.entries(map.edges)) {
    for (const to of tos) {
      const a = nodeXY(map.nodes[from], Wd), b = nodeXY(map.nodes[to], Wd);
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const midY = (a.y + b.y) / 2;
      path.setAttribute('d', `M ${a.x} ${a.y} C ${a.x} ${midY}, ${b.x} ${midY}, ${b.x} ${b.y}`);
      path.classList.add('edge');
      if (trailPairs.has(`${from}>${to}`)) path.classList.add('edge-taken');
      else if (run.pos === from) path.classList.add('edge-open');
      svg.appendChild(path);
    }
  }
  canvas.appendChild(svg);
  let currentEl = null, eliteReach = false, jackpotReach = false;
  for (const [id, node] of Object.entries(map.nodes)) {
    const meta = nodeMeta(node.type);
    const { x, y } = nodeXY(node, Wd);
    const isReach = reach.has(id);
    const cls = ['map-spot', `spot-${node.type}`];
    if (id === BOSS_ID) cls.push('spot-boss-big');
    if (isReach) cls.push('map-node', 'reachable');
    if (onTrail.has(id)) cls.push('visited');
    if (run.pos === id) cls.push('current');
    const d = el('div', cls.join(' '));
    d.style.left = `${x}px`; d.style.top = `${y}px`;
    d.innerHTML = `<span class="spot-ico">${meta.ico}</span>`;
    if (id === BOSS_ID) d.appendChild(artImg(A.enemyArt(W.bossKey), meta.ico, 'spot-boss-face'));
    if (isReach) {
      if (node.type === 'elite') eliteReach = true;
      if (node.type === 'jackpot') jackpotReach = true;
      d.onclick = () => { sfx.tap(); const res = R.enterMapNode(run, id); if (res) enterNode(res); };
    } else d.onclick = () => toast(`${meta.ico} <b>${meta.name}</b> — ${meta.desc}`);
    canvas.appendChild(d);
    if (run.pos === id) currentEl = d;
  }
  if (!run.pos) {
    const start = el('div', 'map-start-hint', '⬆️ Pick your first stop');
    start.style.top = `${MAP_PAD + MAP_FLOORS * ROW_H + 8}px`;
    canvas.appendChild(start);
  }
  requestAnimationFrame(() => {
    const target = currentEl ? currentEl.offsetTop - wrap.clientHeight * 0.62 : canvas.scrollHeight;
    wrap.scrollTo({ top: Math.max(0, target), behavior: REDUCED ? 'auto' : 'smooth' });
  });
  coachTip('map', 'Pick your path! You can see the whole world — the big boss waits at the top.');
  if (jackpotReach) coachTip('jackpot', '🎰 THE JACKPOT! One free spin. Three cousins = the Cousin Card. Three crops = a fight. Mixed = a Cactus. Your call!');
  if (eliteReach) coachTip('elite', '💀 is a MINI BOSS. Tough… but it always drops a treasure.');
  prefetchWorld(run.world);
}

function enterNode(res) {
  saveRun();
  switch (res.type) {
    case 'fight': case 'elite': return startFight(res.encounter, res.type);
    case 'boss':
      run.pending = { kind: 'boss', encounter: res.encounter };
      saveRun();
      return bossIntro(res.encounter);
    case 'jackpot': return showJackpot();
    case 'shop': return showShop(res.shop);
    case 'rest': return showRest();
    case 'treasure': return showTreasure(res.treasure);
    default: return showMap();
  }
}

// ================================================================= BOSS INTRO
const BOSS_LINES = {
  mega_corn: '"You woke me up. Now things are going to get… HOT." 🌽🔥',
  ripe_tomato: '"I am SO ripe. Hit me. I DARE you." 🍅',
  huge_onion: '"Peel me if you can. But I warn you… you WILL cry." 🧅',
};
function bossIntro(encounter) {
  const key = encounter.enemies[0];
  const W = WORLDS[run.world];
  music.play(`boss_${key}`);
  const s = screen('boss-intro');
  s.appendChild(bgLayer(A.worldBg(run.world, 'battle'), 'battle-bg'));
  const inner = el('div', 'boss-intro-inner');
  inner.appendChild(el('div', 'story-kicker', 'BIG BOSS'));
  inner.appendChild(artImg(A.enemyArt(key), W.emoji, 'boss-intro-face'));
  inner.appendChild(el('h1', 'boss-intro-name', W.boss.toUpperCase()));
  inner.appendChild(el('div', 'speaker-line', BOSS_LINES[key] || ''));
  const b = el('button', 'btn gold', '⚔️ Let\'s battle!');
  b.onclick = () => startFight(encounter, 'boss');
  inner.appendChild(b);
  s.appendChild(inner);
  sfx.boom();
}

// ================================================================= THE JACKPOT (Wyatt's design)
function showJackpot() {
  if (run.jackpotDone) { toast('🎰 You already used this world\'s Jackpot.'); return showMap(); }
  music.play('jackpot');
  const s = sceneScreen(A.worldBg(run.world, 'jackpot'), '🎰', '🎰 THE JACKPOT');
  s.appendChild(el('div', 'speaker-line', 'One free spin! <b>Three cousins</b> = the Cousin Card. <b>Three crops</b> = a crop fight. <b>Mixed up</b> = a Cactus.'));
  const machine = el('div', 'jackpot-machine');
  machine.appendChild(artImg(A.uiArt('jackpot_machine'), '🎰', 'jackpot-art'));
  const reels = el('div', 'reels');
  const reelEls = SLOTS.map((slot, i) => {
    const r = el('div', 'reel');
    r.appendChild(reelFace(slot.cousin));
    r.dataset.i = String(i);
    reels.appendChild(r);
    return r;
  });
  machine.appendChild(reels);
  s.appendChild(machine);
  s.appendChild(el('p', 'subtitle', '<small>Slot 1: Stella or Corn · Slot 2: Lucy or Tomato · Slot 3: Delilah or Onion</small>'));
  const spinB = el('button', 'btn gold big-spin', '🎰 SPIN! (free)');
  const walk = el('button', 'btn secondary', 'No thanks — walk past →');
  walk.onclick = () => { R.walkPastJackpot(run); saveRun(); showMap(); };
  spinB.onclick = () => {
    spinB.disabled = true; walk.disabled = true;
    const res = R.spinJackpot(run);
    if (!res) return showMap();
    // a crops result is a fight the reload can't skip
    if (res.outcome === 'crops') run.pending = { kind: 'medley', encounter: res.encounter };
    saveRun();
    animateReels(reelEls, res, () => jackpotResult(res));
  };
  s.append(spinB, walk);
}
function reelFace(face) {
  const f = el('div', 'reel-face');
  f.appendChild(artImg(A.jackpotFace(face.key), face.emoji, 'reel-art'));
  f.appendChild(el('div', 'reel-name', face.name));
  return f;
}
function animateReels(reelEls, res, onDone) {
  const spinMs = REDUCED ? 0 : Math.round(900 * Math.max(1, fxScale() * 0.8));
  let tick = 0;
  const timers = [];
  reelEls.forEach((r, i) => {
    const slot = SLOTS[i];
    let flip = false;
    if (REDUCED) { r.innerHTML = ''; r.appendChild(reelFace(res.shown[i])); return; }
    r.classList.add('spinning');
    const iv = setInterval(() => {
      flip = !flip; r.innerHTML = ''; r.appendChild(reelFace(flip ? slot.crop : slot.cousin)); sfx.reelTick(tick++);
    }, 110);
    timers.push(setTimeout(() => {
      clearInterval(iv);
      r.classList.remove('spinning'); r.classList.add('stopped');
      r.innerHTML = ''; r.appendChild(reelFace(res.shown[i]));
      sfx.reelStop();
    }, spinMs * (i + 1) + 300));
  });
  setTimeout(onDone, REDUCED ? 200 : spinMs * 3 + 900);
}
function jackpotResult(res) {
  if (res.outcome === 'cousins') {
    sfx.jackpot();
    bigBanner('🎉 JACKPOT! 👯', 'banner-jackpot');
    modal(null, (m, close) => {
      m.classList.add('treasure-pop');
      m.appendChild(el('h2', '', 'THE COUSINS ARE ON YOUR SIDE!'));
      m.appendChild(cardFace(makeCard(COUSIN_ID), { mini: true }));
      m.appendChild(el('p', 'subtitle', 'Stella, Lucy, and Delilah join you! <b>The Cousin Card is in your hand at the start of EVERY fight in this world.</b> Use it once per fight. It leaves when you beat the boss.'));
      const b = el('button', 'btn gold', '👯 Let\'s GO! →');
      b.onclick = () => { close(); showMap(); };
      m.appendChild(b);
    }, { dismissable: false });
    return;
  }
  if (res.outcome === 'crops') {
    sfx.wahwah();
    bigBanner('😱 CROPS!!!', 'banner-boss');
    modal(null, (m, close) => {
      m.classList.add('treasure-pop');
      m.appendChild(el('h2', '', 'Uh-oh… three CROPS!'));
      m.appendChild(artImg(A.enemyArt('veggie_medley'), '🥗', 'pet-pop-face'));
      m.appendChild(el('p', 'subtitle', 'A Corn, a Tomato, and an Onion squish together into… <b>THE VEGGIE MEDLEY!</b> Beat it for a <b>rare card</b> and bonus coins.'));
      const b = el('button', 'btn gold', '⚔️ Bring it on!');
      b.onclick = () => { close(); startFight(res.encounter, 'medley'); };
      m.appendChild(b);
    }, { dismissable: false });
    return;
  }
  sfx.relic();
  modal(null, (m, close) => {
    m.classList.add('treasure-pop');
    m.appendChild(el('h2', '', 'Mixed up! You get… a CACTUS!'));
    m.appendChild(artImg(A.treasureArt('cactus'), '🌵', 'pet-pop-face'));
    m.appendChild(el('p', 'subtitle', TREASURES.cactus.text));
    const b = el('button', 'btn gold', '🌵 Ouch… I mean, thanks! →');
    b.onclick = () => { close(); showMap(); };
    m.appendChild(b);
  }, { dismissable: false });
}

// ================================================================= COMBAT
function startFight(encounter, kind) {
  combatKind = kind;
  if (run) { run.pending = { kind, encounter }; saveRun(); }
  savedThisFight = new Set(run.saved || []);
  combat = C.startCombat(run, encounter, makeRng(randomSeed()), { kind });
  lastPulseTurn = -1;
  holdScreen();
  music.play(kind === 'boss' ? `boss_${encounter.enemies[0]}` : `battle${run.world}`);
  selectedCard = null;
  prevSnap = null;
  renderCombat();
  const n = (run.stats.fights || 0) + (run.stats.elites || 0);
  // one new idea per fight
  if (n === 0) coachTip('basics', 'Tap a card to play it. Each card costs ⚡ — you get 3 every turn. The bubble over a crop shows EXACTLY what it will do next!');
  if (n >= 1) {
    const MECH_TIP = {
      wyatt: '⚽ Watch your TOUCHES: passes add soccer balls. A SHOT card spends them ALL for a giant hit!',
      aaron: '🚜 Watch your GEAR: shift up and every card gets stronger. DOWNSHIFT cards drop you back down for a huge hit!',
      liam: '📚 Watch your BOOK METER: read books to fill it. Four pages… BOOK STORM! It hits EVERY enemy for 15.',
    };
    coachTip(`mech_${run.hero}`, MECH_TIP[run.hero]);
  }
  if (savedThisFight.size && combat.savedIn) coachTip('saved', '💾 SAVED CARDS! The cards left in your hand at the end of a fight come with you into the next one.');
  if (combat.hand.some((c) => c.id === COUSIN_ID)) coachTip('cousin', '👯 The Cousin Card! Tap it, then tap a crop: Stella gives you a Barbie (Strong!), Lucy squishes it (Weak!), and Delilah says "Nuh-uh!" — its next attack is CANCELLED.');
  if (combat.enemies.some((e) => e.key === 'mega_corn')) coachTip('heat', '🔥 Watch the Mega Corn\'s HEAT METER. When it fills up… POP! Block BEFORE it happens.');
  if (combat.enemies.some((e) => e.key === 'ripe_tomato')) coachTip('ripe', '🍅 Every hit makes the Ripe Tomato RIPER (and it hits harder). Use big hits, not lots of little ones!');
  if (combat.enemies.some((e) => e.key === 'huge_onion')) coachTip('layers', '🧅 The Huge Onion has THREE layers. Peel them all!');
}

const STATUS_INFO = {
  block: '🛡️ Block: soaks up that much damage, then goes away next turn.',
  strong: '💪 Strong: every attack hits that much harder.',
  weak: '😵 Weak: attacks do 25% LESS damage. Goes down by 1 each turn.',
  bruised: '🟣 Bruised: takes 50% MORE damage from attacks. Goes down by 1 each turn.',
  burning: '🔥 Burning: you lose that much HP at the end of your turn (block can\'t stop it). Goes down by 1 each time.',
  husk: '🌽 Husk: soaks up damage until it breaks. It does NOT go away on its own. Break it and the corn is Bruised!',
  dissolved: '🕳️ Underground! Can\'t be hit this turn. It pops back up next turn.',
  nuhUh: '🙅 "Nuh-uh!" — Delilah cancelled its next attack.',
  teary: '😢 Teary: some cards are blurry. You can\'t read them, but you can still play them!',
  grabbed: '🌿 Grabbed: a vine has that card. You can\'t play it this turn.',
  meter: '📊 A boss meter. Watch it! Something big happens when it fills up.',
};
function seenFx() { try { return JSON.parse(safeGet(SEENFX_KEY)) || {}; } catch { return {}; } }
function markFxSeen(k) { const s = seenFx(); s[k] = 1; safeSet(SEENFX_KEY, JSON.stringify(s)); }
function statusChips(cr, isEnemy = false) {
  const seen = seenFx();
  const chips = [];
  const add = (k, label) => chips.push(`<span class="chip${seen[k] ? '' : ' chip-new'}" data-status="${k}">${label}</span>`);
  if (cr.block) add('block', `🛡️${cr.block}`);
  if (cr.strong) add('strong', `💪${cr.strong}`);
  if (cr.weak) add('weak', `😵${cr.weak}`);
  if (cr.bruised) add('bruised', `🟣${cr.bruised}`);
  if (!isEnemy && cr.burning) add('burning', `🔥${cr.burning}`);
  if (isEnemy) {
    if (cr.shield > 0) add('husk', `🌽${cr.shield}`);
    if (cr.dissolved) add('dissolved', '🕳️');
    if (cr.nuhUh) add('nuhUh', '🙅');
  }
  return chips.join('');
}
const POWER_INFO = {
  keepy_uppy: { emoji: '🔂', text: (n) => `Keepy-Uppy: +${n} Touch every turn.` },
  golden_boot: { emoji: '🥇', text: (n) => `Golden Boot: every SHOT! leaves ${n} Touch behind.` },
  fast_break: { emoji: '🏃', text: (n) => `Fast Break: you can hold up to ${n} Touches.` },
  roll_bar: { emoji: '🛡️', text: (n) => `Roll Bar: +${n} Block every time you shift up.` },
  full_throttle: { emoji: '🏁', text: () => 'Full Throttle: +1 Gear every turn.' },
  library_day: { emoji: '🏛️', text: (n) => `Library Day: BOOK STORM! does +${n}.` },
  bookworm: { emoji: '🐛', text: (n) => `Bookworm: +${n} page every turn.` },
};
function powerChips(h) {
  return Object.entries(h.powers || {}).filter(([k, v]) => v != null && v !== false && POWER_INFO[k])
    .map(([k, v]) => `<span class="chip chip-power" data-power="${k}">${POWER_INFO[k].emoji}${Number.isFinite(v) && v !== true ? v : ''}</span>`).join('');
}
const INTENT_KIND_INFO = {
  attack: (n, d) => `⚔️ ${n}: it will attack you for ${d} after your turn!`,
  defend: (n) => `🛡️ ${n}: it will protect itself.`,
  buff: (n) => `⬆️ ${n}: it will power itself up.`,
  debuff: (n) => `🌀 ${n}: it will do something sneaky to you.`,
  summon: (n) => `➕ ${n}: it will call in friends.`,
  countdown: (n) => `⏳ ${n}: something BIG is coming.`,
  special: (n) => `✨ ${n}.`,
  cancelled: (n) => `🙅 "Nuh-uh!" ${n} — Delilah cancelled it. It does NOTHING.`,
};
function intentLabel(st, e) {
  const it = e.intent;
  if (!it) return '';
  if (it.dmg != null) {
    const p = C.intentPreview(st, e);
    if (p.cancelled) return `<span class="intent cancelled" data-intent="cancelled" data-name="${escapeAttr(it.name)}">🙅 Nuh-uh!</span>`;
    const t = p.times > 1 ? `×${p.times}` : '';
    const extra = it.block ? ` 🛡️${it.block}` : '';
    return `<span class="intent attack${it.big ? ' big-hit' : ''}" data-intent="attack" data-name="${escapeAttr(it.name)}" data-dmg="${p.per}${t} (${p.per * p.times} total)">⚔️ ${p.per}${t}${extra}</span>`;
  }
  const icons = { defend: '🛡️', buff: '⬆️', debuff: '🌀', summon: '➕', countdown: '⏳', special: '✨' };
  const num = it.block ? ` ${it.block}` : '';
  return `<span class="intent ${it.kind}" data-intent="${it.kind}" data-name="${escapeAttr(it.name)}">${icons[it.kind] || '❔'}${num} <small>${it.name}</small></span>`;
}
function escapeAttr(s) { return String(s).replace(/"/g, '&quot;'); }
function enemyMeter(e) {
  if (!e.meter) return '';
  const { n, max, label } = e.meter;
  const pct = Math.min(100, (n / max) * 100);
  return `<div class="boss-meter meter-${e.meter.k}${n >= max ? ' full' : ''}" data-status="meter"><span>${label} ${n}/${max}</span><i style="width:${pct}%"></i></div>`;
}

function snapCombat(st) {
  const snap = { heroHp: st.hero.hp, heroBlock: st.hero.block, enemies: {}, count: st.enemies.length };
  st.enemies.forEach((e, i) => { snap.enemies[i] = { hp: e.hp, block: e.block, dead: e.hp <= 0, artKey: e.artKey, name: e.name, strong: e.strong || 0 }; });
  return snap;
}
function floaty(target, text, cls, leftPct) {
  if (!target || REDUCED) return;
  const f = el('span', `floaty ${cls}`, text);
  f.style.left = `${leftPct ?? 22 + Math.random() * 46}%`;
  const ms = Math.round(950 * fxScale());
  f.style.animationDuration = `${ms}ms`;
  target.appendChild(f);
  setTimeout(() => f.remove(), ms + 60);
}
function bigBanner(text, cls = '') {
  if (REDUCED) return toast(text);
  const b = el('div', `big-banner ${cls}`, text);
  document.body.appendChild(b);
  setTimeout(() => b.remove(), Math.round(1600 * fxScale()));
}
function quake() { const a = document.getElementById('app'); a.classList.add('quake'); setTimeout(() => a.classList.remove('quake'), 900); }
function formShiftFx(enemyEl, oldArtKey, emoji) {
  if (!enemyEl) return;
  const face = enemyEl.querySelector('.face');
  enemyEl.classList.add('form-shifting');
  const ms = Math.round(900 * fxScale());
  if (face && !REDUCED && oldArtKey) {
    const ghost = artImg(A.enemyArt(oldArtKey), emoji, 'face form-ghost');
    ghost.style.animationDuration = `${ms}ms`;
    face.appendChild(ghost);
    setTimeout(() => ghost.remove(), ms + 60);
  }
  floaty(enemyEl, '✨ CHANGING!', 'formshift');
  sfx.boom();
  setTimeout(() => enemyEl.classList.remove('form-shifting'), ms + 60);
}
function splitInFx(enemyEl) {
  if (!enemyEl || REDUCED) return;
  enemyEl.classList.add('splitting-in');
  setTimeout(() => enemyEl.classList.remove('splitting-in'), Math.round(760 * fxScale()) + 60);
}

let lastLogIdx = 0;
function animateDiffs(s, enemyEls, heroEl) {
  const st = combat;
  if (!prevSnap || !st) { prevSnap = st ? snapCombat(st) : null; lastLogIdx = st ? st.log.length : 0; return; }
  const prev = prevSnap;
  const events = st.log.slice(lastLogIdx);
  lastLogIdx = st.log.length;
  let delay = 0;
  const stagger = Math.max(90, Math.round(190 * fxScale()));
  const meterEl = s.querySelector('.hero-meter');
  for (const ev of events) {
    const tgt = ev.target === 'hero' ? heroEl : enemyEls[ev.target];
    switch (ev.t) {
      case 'relic': { const pin = document.querySelector(`.belt-pin[data-relic="${ev.id}"]`); if (pin) { pin.classList.remove('proc'); void pin.offsetWidth; pin.classList.add('proc'); } continue; }
      case 'touch': floaty(meterEl || heroEl, `⚽+${ev.n}`, 'blk'); sfx.tap(); continue;
      case 'shot': bigBanner(`⚽ SHOT! ${ev.dmg}`, 'banner-shot'); sfx.boom(); continue;
      case 'gear': floaty(meterEl || heroEl, `🕹️ GEAR ${ev.now}!`, 'formshift'); sfx.clang(); continue;
      case 'downshift': bigBanner(`🚜 DOWNSHIFT! ${ev.dmg}`, 'banner-shot'); sfx.boom(); continue;
      case 'page': floaty(meterEl || heroEl, `📖+${ev.n}`, 'blk'); sfx.sparkle(); continue;
      case 'bookFull': bigBanner('📚 BOOK METER FULL! BOOK STORM! is in your hand!', 'banner-storm'); sfx.powerUp(); continue;
      case 'bookStorm': bigBanner(`🌪️📚 BOOK STORM!${ev.reps > 1 ? ' ×2' : ''}`, 'banner-storm'); sfx.flush(); quake(); continue;
      case 'husk': if (tgt) floaty(tgt, `🌽 husk -${ev.amount}`, 'blk'); continue;
      case 'huskBreak': if (tgt) { floaty(tgt, '💥 HUSK BROKEN! Bruised!', 'formshift'); tgt.classList.add('fury-flash'); } sfx.boom(); continue;
      case 'cactus': { const t2 = enemyEls[ev.target]; if (t2) floaty(t2, '🌵 -1', 'dmg'); continue; }
      case 'nuhUhSet': { const t2 = enemyEls[ev.target]; if (t2) floaty(t2, '🙅 "Nuh-uh!"', 'formshift'); sfx.sass(); continue; }
      case 'nuhUh': { const t2 = enemyEls[ev.target]; bigBanner('🙅 "NUH-UH!" Cancelled!', 'banner-jackpot'); if (t2) floaty(t2, '🙅 cancelled!', 'blk'); sfx.sass(); continue; }
      case 'teary': toast(`😢 Teary! ${ev.n} card${ev.n > 1 ? 's are' : ' is'} too blurry to read. You can still play ${ev.n > 1 ? 'them' : 'it'}!`); coachTip('teary', '😢 Teary cards are blurry, but they still work. Play them anyway!'); continue;
      case 'grabbed': toast(`🌿 A vine grabbed ${ev.n} of your cards! You can't play ${ev.n > 1 ? 'them' : 'it'} this turn.`); sfx.debuff(); continue;
      case 'stinky': toast('🤢 Pee-yew! A <b>Stinky</b> card went into your draw pile. It can\'t be played, and it\'s gone after the fight.'); sfx.debuff(); continue;
      case 'junkCapped': continue;
      case 'burn': floaty(heroEl, `🔥 -${ev.amount}`, 'dmg'); continue;
      case 'splash': floaty(heroEl, `💦 splash -${ev.amount}`, 'dmg'); continue;
      case 'spot': if (tgt) floaty(tgt, `🎯 Bruised Spot +${ev.amount}`, 'formshift'); continue;
      case 'angry': { const t2 = enemyEls[ev.target]; if (t2) floaty(t2, '😡 ANGRY!', 'formshift'); continue; }
      case 'bossPhase': bigBanner(ev.text, 'banner-boss'); sfx.boom(); quake(); continue;
      case 'immune': if (tgt) floaty(tgt, '🕳️ underground!', 'blk'); continue;
      case 'play': continue;
      default: break;
    }
    if (!tgt) continue;
    const hitIdx = delay / stagger;
    const show = () => {
      if (ev.t === 'dmg') {
        floaty(tgt, `-${ev.amount}`, 'dmg' + (ev.amount >= 12 ? ' big' : ''));
        tgt.classList.remove('shake'); void tgt.offsetWidth; tgt.classList.add('shake');
        if (ev.target === 'hero') sfx.hurt();
        else if (ev.amount >= 15) sfx.boom();
        else if (ev.amount >= 8) sfx.slash();
        else sfx.slashTick(hitIdx);
      } else if (ev.t === 'blocked') { floaty(tgt, '🛡️ Blocked!', 'blk'); sfx.shieldClink(); }
    };
    if (REDUCED || delay === 0) show(); else setTimeout(show, delay);
    delay += stagger;
  }
  st.enemies.forEach((e, i) => {
    const elx = enemyEls[i];
    if (!elx) return;
    const p = prev.enemies[i];
    if (!p) { if (i >= prev.count) splitInFx(elx); return; }
    if (e.hp <= 0 && !p.dead) {
      elx.classList.add('dying');
      if (e.isBoss) { elx.classList.add('dying-boss'); floaty(elx, '💥 HARVESTED!', 'formshift'); sfx.bossDefeat(); quake(); }
      else sfx.defeat();
    }
    if (e.block > p.block) floaty(elx, `🛡️+${e.block - p.block}`, 'blk');
    if ((e.strong || 0) > p.strong) floaty(elx, `💪+${(e.strong || 0) - p.strong}`, 'formshift');
    if (e.artKey !== p.artKey) formShiftFx(elx, p.artKey, e.emoji);
  });
  if (st.hero.hp > prev.heroHp) floaty(heroEl, `+${st.hero.hp - prev.heroHp}`, 'heal');
  if (st.hero.block > prev.heroBlock) floaty(heroEl, `🛡️+${st.hero.block - prev.heroBlock}`, 'blk');
  prevSnap = snapCombat(st);
}

function heroMeter(st) {
  const hero = run.hero;
  const m = el('div', `hero-meter meter-${hero}`);
  if (hero === 'wyatt') {
    const cap = C.touchCap(st);
    const n = st.touches;
    m.innerHTML = `<span class="meter-label">⚽ TOUCHES</span><span class="balls">${Array.from({ length: Math.max(5, Math.min(cap, 10)) }, (_, i) => `<i class="ball${n > i ? ' on' : ''}">⚽</i>`).join('')}</span><b class="meter-num">${n}</b>`;
    m.dataset.meter = 'touches';
  } else if (hero === 'aaron') {
    const g = st.gear;
    m.innerHTML = `<span class="meter-label">🚜 GEAR</span><span class="gearbox">${[1, 2, 3].map((i) => `<i class="gear${g >= i ? ' on' : ''}${g === i ? ' cur' : ''}">${i}</i>`).join('')}</span><b class="meter-num">+${C.gearBonus(st)}</b>`;
    m.dataset.meter = 'gears';
    if (g >= GEAR_MAX) m.classList.add('almost');
  } else {
    const p = st.pages;
    m.innerHTML = `<span class="meter-label">📚 BOOK METER</span><span class="pages">${Array.from({ length: BOOK_PAGES }, (_, i) => `<i class="page${p > i ? ' on' : ''}">📄</i>`).join('')}</span><b class="meter-num">${p}/${BOOK_PAGES}</b>${st.sequel ? '<span class="meter-tag">×2</span>' : ''}`;
    m.dataset.meter = 'book';
    if (p >= BOOK_PAGES - 1) m.classList.add('almost');
  }
  return m;
}

let lastPulseTurn = -1;
function renderCombat(actedEnemy = null) {
  const s = screen('combat');
  s.classList.remove('screen-enter');
  const st = combat;
  if (st.hero.hp > 0 && st.hero.hp <= st.hero.maxHp * 0.25) {
    s.classList.add('danger');
    if (st.turn !== lastPulseTurn) { lastPulseTurn = st.turn; sfx.heartbeat(); }
  }
  s.appendChild(bgLayer(A.worldBg(run.world, 'battle'), 'battle-bg'));
  const inner = el('div', 'combat-inner');
  s.appendChild(inner);
  if (st.cardTax && st.cardsThisTurn === 0) inner.appendChild(el('div', 'rule-banner', '🤢 Stinky Cloud: your FIRST card this turn costs 1 more.'));
  // enemies
  const row = el('div', 'enemy-row');
  const enemyEls = [];
  st.enemies.forEach((e, i) => {
    if (e.gone) { enemyEls[i] = null; return; }
    const dead = e.hp <= 0;
    const d = el('div', `enemy${dead ? ' dead' : ''}${e.isBoss ? ' boss-foe' : ''}${e.isElite && !e.isBoss ? ' elite-foe' : ''}${e.dissolved ? ' dissolved' : ''}`);
    if (!st._spawnFxDone && !REDUCED) { d.classList.add(`spawn-${curLook()}`); d.style.setProperty('--si', String(i)); }
    if (!dead) {
      const spent = st.phase === 'enemy' && !st.queue.includes(e);
      d.insertAdjacentHTML('beforeend', spent
        ? '<div class="intent-slot"><span class="next-label">NEXT MOVE</span><span class="intent thinking">…</span></div>'
        : `<div class="intent-slot"><span class="next-label">NEXT MOVE</span>${intentLabel(st, e)}</div>`);
    }
    d.appendChild(artImg(A.enemyArt(e.artKey), e.emoji, 'face'));
    d.insertAdjacentHTML('beforeend', `<div class="nm">${e.name}</div>
      <div class="hpbar"><div style="width:${Math.max(0, e.hp / e.maxHp * 100)}%"></div></div>
      <div class="hpnum">❤️ ${Math.max(0, e.hp)}/${e.maxHp}</div>
      ${dead ? '' : enemyMeter(e)}
      <div class="chips">${statusChips(e, true)}</div>`);
    const canTarget = !dead && C.targetable(st, e);
    if (canTarget && selectedCard && cardWantsTarget(selectedCard)) { d.classList.add('targetable'); d.onclick = () => playSelected(e, d); }
    else if (!dead) { d.classList.add('scoutable'); d.onclick = () => showScout(e); }
    if (e === actedEnemy) d.classList.add('lunge');
    row.appendChild(d);
    enemyEls[i] = d;
  });
  st._spawnFxDone = true;
  inner.appendChild(row);
  // hero strip + meter
  const h = st.hero;
  const hero = HEROES[run.hero];
  const strip = el('div', 'hero-strip');
  strip.appendChild(artImg(A.heroArt(run.hero), hero.emoji, 'face hero-face-combat'));
  const stats = el('div', 'stats');
  stats.innerHTML = `<b>${hero.name}</b>
      <div class="hpbar"><div style="width:${h.hp / h.maxHp * 100}%"></div></div>
      <div class="hpnum">❤️ ${h.hp}/${h.maxHp} ${h.block ? `· 🛡️ ${h.block}` : ''}</div>
      <div class="chips">${statusChips(h)}${powerChips(h)}</div>`;
  strip.appendChild(stats);
  strip.appendChild(el('div', 'energy-orb', `${h.energy}<small>⚡</small>`));
  inner.appendChild(strip);
  inner.appendChild(heroMeter(st));
  // belt: treasures
  if (run.relics.length) {
    const belt = el('div', 'belt-row');
    const g = el('div', 'belt-group');
    g.appendChild(el('div', 'belt-label', 'TREASURES'));
    const pins = el('div', 'belt-pins');
    for (const rid of run.relics) {
      const t = TREASURES[rid];
      const pin = el('button', 'relic-pin belt-pin', t.emoji);
      pin.dataset.relic = rid;
      pin.onclick = () => toast(`${t.emoji} <b>${t.name}</b>: ${t.text}`);
      pins.appendChild(pin);
    }
    g.appendChild(pins);
    belt.appendChild(g);
    inner.appendChild(belt);
  }
  // hand
  const hand = el('div', 'hand');
  const n = st.hand.length;
  st.hand.forEach((c, i) => {
    const afford = C.canPlay(st, c) && st.phase !== 'enemy';
    const d = cardFace(c, { live: true, extraCls: `${c === selectedCard ? 'selected' : ''}${afford ? '' : ' unaffordable'}` });
    if (c.id === STINKY_ID) d.appendChild(el('div', 'card-tag tag-stinky', 'can\'t play · gone after the fight'));
    if (!REDUCED && n > 1) {
      const off = i - (n - 1) / 2;
      d.style.setProperty('--fan-rot', `${off * Math.min(4, 26 / n)}deg`);
      d.style.setProperty('--fan-y', `${Math.abs(off) * Math.min(3.4, 22 / n)}px`);
    }
    d.onclick = () => onCardTap(c, d);
    hand.appendChild(d);
  });
  inner.appendChild(hand);
  if (selectedCard && cardWantsTarget(selectedCard)) inner.appendChild(el('div', 'target-hint', selectedCard.id === COUSIN_ID ? '🎯 Tap the crop Delilah should "Nuh-uh!"' : '🎯 Tap an enemy!'));
  // bottom bar
  const bottom = el('div', 'combat-bottom');
  const drawB = el('button', 'pilebtn', `🎴 ${st.draw.length}`);
  drawB.onclick = () => showDeckModal(st.draw, 'Draw pile (shuffled)');
  const discB = el('button', 'pilebtn', `🗑️ ${st.discard.length}`);
  discB.onclick = () => showDeckModal(st.discard, 'Discard pile');
  bottom.append(drawB, discB);
  if (st.exhaust.length) { const exB = el('button', 'pilebtn', `♻️ ${st.exhaust.length}`); exB.onclick = () => showDeckModal(st.exhaust, 'Used up this fight'); bottom.append(exB); }
  const endB = el('button', 'endturn', st.phase === 'enemy' ? '👀 CROPS\' TURN…' : 'END TURN ▶');
  endB.disabled = st.phase === 'enemy';
  endB.onclick = () => { sfx.turn(); selectedCard = null; runEnemyPhase(); };
  const infoB = el('button', 'pilebtn', '📖');
  infoB.onclick = showHelpModal;
  bottom.append(endB, infoB);
  inner.appendChild(bottom);
  animateDiffs(s, enemyEls, strip);
}

function runEnemyPhase() {
  if (!combat) return;
  if (!C.beginEnemyPhase(combat)) return;
  if (combat.over) return afterAction(); // Burning can end it before the crops move
  renderCombat();
  const step = () => {
    if (!combat) return;
    if (combat.over) return afterAction();
    const actor = C.stepEnemyAction(combat);
    if (combat.over) { renderCombat(actor); return setTimeout(afterAction, REDUCED ? 0 : stepMs() + 250); }
    if (actor) { renderCombat(actor); setTimeout(step, stepMs()); } else renderCombat();
  };
  setTimeout(step, REDUCED ? 0 : Math.round(stepMs() * 0.5));
}

function cardWantsTarget(c) {
  const info = cardInfo(c);
  if (!C.cardNeedsTarget(info)) return false;
  return C.targetableEnemies(combat).length > 1;
}
function flyCard(cardEl, targetEl) {
  if (REDUCED || !cardEl) return;
  const r = cardEl.getBoundingClientRect();
  const ghost = cardEl.cloneNode(true);
  ghost.classList.add('card-ghost');
  ghost.style.left = `${r.left}px`; ghost.style.top = `${r.top}px`; ghost.style.width = `${r.width}px`;
  let dx = 0, dy = -window.innerHeight * 0.45;
  if (targetEl) { const t = targetEl.getBoundingClientRect(); dx = t.left + t.width / 2 - (r.left + r.width / 2); dy = t.top + t.height / 2 - (r.top + r.height / 2); }
  ghost.style.setProperty('--fly-x', `${dx}px`);
  ghost.style.setProperty('--fly-y', `${dy}px`);
  const ms = Math.round(520 * fxScale());
  ghost.style.transitionDuration = `${ms}ms`;
  document.body.appendChild(ghost);
  requestAnimationFrame(() => ghost.classList.add('fly'));
  setTimeout(() => ghost.remove(), ms + 40);
}
function playCardSound(info) {
  const fx = info.fx || [];
  if (info.cousin) return sfx.jackpot();
  if (info.type === 'power') return sfx.powerUp();
  if (fx.some((o) => o.page)) return sfx.sparkle();
  if (fx.some((o) => o.shift)) return sfx.clang();
  if (fx.some((o) => o.touch) && info.type !== 'attack') return sfx.pop();
  if (fx.some((o) => o.status && ['weak', 'bruised'].includes(o.status.k)) && info.type !== 'attack') return sfx.debuff();
  if (fx.some((o) => o.block != null || o.blockPerGear != null)) return sfx.shield();
  if (fx.some((o) => o.draw)) return sfx.sparkle();
  if (info.type === 'attack') return;
  return sfx.play();
}
function revealIfTeary(c) {
  if (combat && C.isTeary(combat, c)) toast(`😢 The blurry card was… <b>${cardInfo(c).name}</b>!`);
}
function onCardTap(c, cardEl) {
  if (combat.phase === 'enemy') return;
  if (!C.canPlay(combat, c)) {
    sfx.tap();
    const info = cardInfo(c);
    if (C.isGrabbed(combat, c)) toast(`🌿 A vine is holding that card! You can play it next turn.`);
    else if (c.id === STINKY_ID) toast('🤢 Stinky can\'t be played. It\'s gone after the fight.');
    else if (info.cost !== null) {
      const orb = document.querySelector('.energy-orb');
      if (orb) { orb.classList.remove('pulse'); void orb.offsetWidth; orb.classList.add('pulse'); }
    }
    return;
  }
  if (cardWantsTarget(c)) { selectedCard = selectedCard === c ? null : c; renderCombat(); return; }
  selectedCard = null;
  const info = cardInfo(c);
  playCardSound(info);
  const targetEl = info.type === 'attack' ? document.querySelector('.enemy:not(.dead):not(.dissolved)') : document.querySelector('.hero-strip');
  flyCard(cardEl, targetEl);
  revealIfTeary(c);
  C.playCard(combat, c, C.targetableEnemies(combat)[0]);
  afterAction();
}
function playSelected(enemy, enemyEl) {
  const c = selectedCard;
  selectedCard = null;
  playCardSound(cardInfo(c));
  flyCard(document.querySelector('.card.selected'), enemyEl);
  revealIfTeary(c);
  C.playCard(combat, c, enemy);
  afterAction();
}
function showScout(e) {
  sfx.tap();
  modal(null, (m, close) => {
    const head = el('div', 'scout-head');
    head.appendChild(artImg(A.enemyArt(e.artKey), e.emoji, 'face scout-face'));
    const who = el('div', 'scout-who');
    who.appendChild(el('div', 'scout-name', e.name));
    who.appendChild(el('div', 'scout-hp', `❤️ ${Math.max(0, e.hp)} / ${e.maxHp}`));
    head.appendChild(who);
    m.appendChild(head);
    const facts = [];
    if (e.intent) {
      const p = C.intentPreview(combat, e);
      facts.push(`<b>Next move:</b> ${e.intent.name}${p ? (p.cancelled ? ' — 🙅 CANCELLED by Delilah!' : ` (⚔️ ${p.per}${(e.intent.times || 1) > 1 ? `×${e.intent.times}` : ''})`) : ''}`);
    }
    if (e.meter) facts.push(`${e.meter.label}: ${e.meter.n} / ${e.meter.max}`);
    if (e.block > 0) facts.push(`🛡️ ${e.block} Block right now`);
    if (e.shield > 0) facts.push(`🌽 Husk: ${e.shield} left — break it and it's Bruised!`);
    if (e.def.firstHitBonus) facts.push(`🎯 Bruised Spot: your FIRST hit each turn does +${e.def.firstHitBonus}`);
    if (e.def.roots) facts.push(`🌱 Deep Roots: regrows ${e.def.roots} Block every turn`);
    if (e.key === 'ripe_tomato') facts.push(`🍅 Ripeness ${e.state.ripe}/10: every hit makes it riper. At 10… SPLAT!`);
    if (e.strong) facts.push(`💪 ${e.strong} Strong`);
    if (e.weak) facts.push(`😵 Weak for ${e.weak}`);
    if (e.bruised) facts.push(`🟣 Bruised for ${e.bruised}`);
    if (e.dissolved) facts.push('🕳️ Underground — can\'t be hit this turn');
    m.appendChild(el('div', 'scout-facts', facts.join('<br>')));
    const ok = el('button', 'btn', '👍 Got it');
    ok.onclick = close;
    m.appendChild(ok);
  });
}

let winPending = false;
function afterAction() {
  if (!combat) return;
  if (combat.over) {
    if (winPending) return;
    winPending = true;
    renderCombat();
    if (combat.won) {
      // saved cards glow before the screen changes (Polish floor 4)
      const keep = new Set(C.savedHandUids(combat));
      document.querySelectorAll('.hand .cardface').forEach((d, i) => { const c = combat.hand[i]; if (c && keep.has(c.uid)) { d.classList.add('saved-glow'); d.appendChild(el('div', 'card-tag tag-saved', '💾 Saved for next fight!')); } });
      // reduced motion drops the animation, never the information: the glow still shows briefly
      const ms = REDUCED ? (keep.size ? 900 : 0) : Math.round((combatKind === 'boss' ? 1900 : 1100) * fxScale());
      // the boys' ask: beat the Huge Onion's last form and Goldie comes and eats it
      const finalOnion = combatKind === 'boss' && combat.enemies.some((e) => e.key === 'huge_onion');
      setTimeout(() => { winPending = false; if (finalOnion) goldieSnack(combatWon); else combatWon(); }, ms);
      return;
    }
    sfx.lose();
    const app = document.getElementById('app');
    if (!REDUCED) app.classList.add('ko');
    setTimeout(() => { winPending = false; app.classList.remove('ko'); fadeOutThen(showDefeat); }, REDUCED ? 0 : Math.round(1600 * fxScale()));
    return;
  }
  renderCombat();
}
function fadeOutThen(fn) {
  const cur = document.querySelector('.screen');
  if (REDUCED || !cur) return fn();
  cur.classList.add('screen-fade-out');
  setTimeout(fn, Math.round(480 * fxScale()));
}

// ================================================================= GOLDIE'S SNACK (the boys' ask)
// The Heart of the Onion is beaten → it shrinks to one little onion → Goldie the llama
// walks in → CRUNCH. Tap to move along; skippable; reduced motion keeps every step, no motion.
function goldieSnack(onDone) {
  music.play(null);
  const root = el('div', 'cutscene goldie-snack look-w3');
  root.appendChild(bgLayer(A.worldBg(3, 'battle'), 'cutscene-bg'));
  const stage = el('div', 'snack-stage');
  const onion = el('div', 'snack-onion');
  onion.appendChild(artImg(A.enemyArt('huge_onion_3'), '🧅', 'snack-onion-art'));
  const goldie = el('div', 'snack-goldie');
  goldie.appendChild(artImg(A.endingArt('end_4_goldie'), '🦙', 'snack-goldie-art'));
  stage.append(onion, goldie);
  const cap = el('div', 'cutscene-cap ending-cap show', 'The Heart of the Onion is beaten! It shrinks… and shrinks… 🧅');
  root.append(stage, cap);
  document.body.appendChild(root);
  $app.innerHTML = '';
  let step = 0, done = false, timer = 0;
  const steps = [
    () => { onion.classList.add('shrunk'); cap.innerHTML = '…until it\'s just ONE little onion. 🧅'; sfx.pop(); },
    () => { goldie.classList.add('in'); cap.innerHTML = 'Wait… who\'s that? Here comes <b>GOLDIE</b>! 🦙'; sfx.tap(); },
    () => { onion.classList.add('eaten'); goldie.classList.add('chomp'); cap.innerHTML = '<b>CRUNCH!</b> Goldie ate the onion! 🦙🧅'; sfx.crunch(); bigBanner('🦙 CRUNCH!', 'banner-jackpot'); },
    () => { cap.innerHTML = '"Goldie says nothing. Goldie knows." 🦙'; sfx.relic(); },
  ];
  const finish = () => { if (done) return; done = true; clearTimeout(timer); root.remove(); onDone(); };
  const next = () => {
    if (step >= steps.length) return finish();
    steps[step++]();
    clearTimeout(timer);
    timer = setTimeout(next, REDUCED ? 2600 : 2400);
  };
  const skip = el('button', 'cutscene-skip', 'skip ⏭');
  skip.onclick = (ev) => { ev.stopPropagation(); finish(); };
  root.appendChild(skip);
  root.addEventListener('click', (ev) => { if (!ev.target.closest('.cutscene-skip')) next(); });
  timer = setTimeout(next, REDUCED ? 1600 : 1800);
}

// ================================================================= AFTER A WIN
function combatWon() {
  sfx.win();
  const st = combat;
  combat = null;
  prevSnap = null;
  releaseScreen();
  const kind = combatKind;
  run.pending = null;
  const result = R.applyCombatResult(run, st, kind);
  const rng = makeRng(run.seed ^ (run.world * 31 + run.floor * 7) ^ 0x5EED);
  const rewards = R.fightRewards(run, kind, rng);
  run.after = { kind, rewards, result };
  saveRun();
  if (kind === 'boss') return fadeOutThen(() => showBossSplash(st, rewards));
  fadeOutThen(() => showVictoryBeat(st, kind, rewards, result, continueAfter));
}

// The after-fight steps in order: treasure (mini boss) → card reward. Resumable.
function continueAfter() {
  const a = run.after;
  if (!a) return showMap();
  if (a.kind === 'boss') return showBossSplash(null, a.rewards);
  if (a.rewards.treasure && !a.treasureShown) return showTreasurePop(a.rewards.treasure, () => { a.treasureShown = true; saveRun(); continueAfter(); });
  return showReward(a.rewards, a.kind);
}
function finishAfter() { run.after = null; saveRun(); showMap(); }

const BEAT_LINES = [(n) => `Nice work! ${n}? Harvested.`, (n) => `THAT'S how it's done. ${n} is back in the dirt.`, (n) => `Look at you go! ${n} didn't stand a chance.`];
let beatIdx = 0;
function showVictoryBeat(st, kind, rewards, result, onDone) {
  const named = st.enemies.filter((e) => !e.gone && !e.def.summon).map((e) => e.name);
  const label = named.length > 1 ? `${named[0]} & friends` : (named[0] || 'That crop');
  const s = screen('victory-beat');
  s.appendChild(artImg(A.uiArt('portrait_coach'), '🧢', 'scene-art'));
  s.appendChild(el('h2', '', kind === 'medley' ? '🥗 VEGGIE MEDLEY — TOSSED!' : kind === 'elite' ? '💀 Mini boss — BEATEN!' : 'Nice work!'));
  s.appendChild(el('div', 'speaker-line', `"${BEAT_LINES[beatIdx++ % BEAT_LINES.length](label)}"`));
  const tally = el('div', 'coin-tally');
  const lines = [];
  if (rewards.coins) lines.push(`<span>⚔️ Fight win</span><b>+💰${rewards.coins}</b>`);
  if (result && result.healed) lines.push(`<span>🚿 Watering Can</span><b>+❤️${result.healed}</b>`);
  if (result && result.saved) lines.push(`<span>💾 Cards saved for next fight</span><b>${result.saved}</b>`);
  if (!lines.length) lines.push('<span>No coins this time</span><b></b>');
  tally.innerHTML = lines.map((l) => `<div class="tally-line">${l}</div>`).join('') + `<div class="tally-total">💰 You have ${run.coins} coins</div>`;
  s.appendChild(tally);
  s.appendChild(el('div', 'tip-card', `💡 <b>Coach's tip:</b> ${nextTip(run.hero)}`));
  const b = el('button', 'btn gold', '🎉 Keep going →');
  b.onclick = onDone;
  s.appendChild(b);
}

function showReward(rewards, kind) {
  const s = screen('center-stack');
  s.appendChild(el('h2', '', kind === 'medley' ? '🌟 Pick a RARE card' : '🎴 Pick a new card'));
  s.appendChild(el('p', 'subtitle', 'It joins your deck for the WHOLE run — every world!'));
  const row = el('div', 'reward-row');
  for (const id of rewards.cards) {
    const d = cardFace(makeCard(id), { mini: true });
    d.onclick = () => { if (!run.after) return; sfx.play(); R.takeCard(run, id); finishAfter(); };
    row.appendChild(d);
  }
  s.appendChild(row);
  const skip = el('button', 'btn secondary', 'Skip →');
  skip.onclick = () => finishAfter();
  s.appendChild(skip);
  coachTip('reward', 'Pick a card to add to your deck — or skip if none of them help. A small deck draws its best cards more often!');
}

// ================================================================= BOSS WIN → NEXT WORLD
function showBossSplash(st, rewards) {
  const s = screen('boss-splash');
  if (!REDUCED) {
    const confetti = el('div', 'confetti-layer');
    const bits = { w1: ['🌽', '🍿', '✨', '⭐'], w2: ['🍅', '🍃', '✨', '⭐'], w3: ['🧅', '🥕', '✨', '⭐'] }[curLook()] || ['🎉'];
    for (let i = 0; i < 60; i++) {
      const c = el('span', 'confetto', bits[i % bits.length]);
      c.style.left = `${(i * 137) % 100}%`; c.style.animationDelay = `${(i % 20) * 0.14}s`; c.style.fontSize = `${0.8 + (i % 4) * 0.28}rem`;
      confetti.appendChild(c);
    }
    s.appendChild(confetti);
  }
  const W = WORLDS[run.world];
  s.prepend(bgLayer(A.worldBg(run.world, 'battle'), 'battle-bg'));
  const goldieAte = W.bossKey === 'huge_onion';
  s.appendChild(artImg(goldieAte ? A.endingArt('end_5_goldie') : A.enemyArt(W.bossKey), goldieAte ? '🦙' : W.emoji, 'boss-intro-face'));
  s.appendChild(el('h1', 'splash-big', goldieAte ? 'THE HUGE ONION: EATEN BY GOLDIE!' : `${W.boss.toUpperCase()}: HARVESTED!`));
  const LINES = {
    mega_corn: '"…I need to cool off." — the Mega Corn 🌽',
    ripe_tomato: '"Okay. Maybe I was a LITTLE too ripe." — the Ripe Tomato 🍅',
    huge_onion: '"…" — Goldie, chewing 🦙',
  };
  s.appendChild(el('div', 'speaker-line', LINES[W.bossKey]));
  s.appendChild(el('p', 'subtitle', `+💰${rewards.coins}`));
  const leaving = [run.cousinCard && 'the cousins', run.relics.includes('cactus') && 'the Cactus'].filter(Boolean);
  if (run.world < WORLD_COUNT && leaving.length) {
    const who = leaving.join(' and ');
    s.appendChild(el('p', 'subtitle', `👋 ${who[0].toUpperCase()}${who.slice(1)} stay${leaving.length === 1 && !run.cousinCard ? 's' : ''} behind in ${W.name}. The next world has its own Jackpot!`));
  }
  const b = el('button', 'btn gold', run.world < WORLD_COUNT ? '🏆 Collect your prize →' : '🏆 THE FARM IS SAFE?! →');
  b.onclick = () => {
    if (run.world >= WORLD_COUNT) return showVictory();
    const leaveWorld = () => {
      R.afterBoss(run);
      toast(run.harvestLevel >= 5 ? '💖 You healed up a lot!' : '💖 All healed up for the next world!');
      R.advanceWorld(run);
      run.after = null;
      saveRun();
      showWorldStory();
    };
    const a = run.after;
    if (a && a.treasurePicked) return leaveWorld();
    pickTreasure('🏆 Pick a BOSS TREASURE', rewards.bossTreasures || [], leaveWorld, (id) => { if (run.after) run.after.treasurePicked = id; });
  };
  s.appendChild(b);
  music.play('title');
}

// ================================================================= SHOP / REST / TREASURE
function showShop(shop) {
  const W = WORLDS[run.world];
  const s = sceneScreen(A.worldBg(run.world, 'shop'), W.rooms.shop.ico, W.rooms.shop.name);
  s.appendChild(el('div', 'speaker-line', '"Seeds, tools, a little of everything. Take a look, kiddo." — Grampa Flaj'));
  s.appendChild(el('p', 'subtitle gold-line', `Your coins: 💰 <b>${run.coins}</b>`));
  if (shop.cards.length) {
    s.appendChild(el('p', 'subtitle', '<b>Cards</b>'));
    const row = el('div', 'reward-row');
    shop.cards.forEach((item, i) => {
      const d = cardFace(makeCard(item.id), { mini: true, price: item.price });
      if (run.coins < item.price) d.classList.add('cant-afford');
      else d.onclick = () => { if (R.shopBuyCard(run, shop, i)) { sfx.gold(); saveRun(); showShop(shop); } };
      row.appendChild(d);
    });
    s.appendChild(row);
  }
  if (shop.treasures.length) {
    s.appendChild(el('p', 'subtitle', '<b>Treasures</b>'));
    shop.treasures.forEach((item, i) => {
      const t = TREASURES[item.id];
      const b = el('button', 'btn gold two-line', `${t.emoji} ${t.name} — 💰${item.price}<small>${t.text}</small>`);
      b.disabled = run.coins < item.price;
      b.onclick = () => { if (R.shopBuyTreasure(run, shop, i)) { sfx.relic(); toast(`${t.emoji} ${t.name}!`); saveRun(); showShop(shop); } };
      s.appendChild(b);
    });
  }
  if (!shop.removed) {
    const b = el('button', 'btn secondary', `✂️ Remove a card from your deck — 💰${shop.removePrice}`);
    b.disabled = run.coins < shop.removePrice;
    b.onclick = () => pickCardModal('Remove which card?', run.deck, (c) => {
      if (R.shopRemoveCard(run, shop, c.uid)) { sfx.play(); toast('✂️ Card removed!'); saveRun(); showShop(shop); }
    });
    s.appendChild(b);
  }
  const done = el('button', 'btn', 'All done →');
  done.onclick = () => { saveRun(); showMap(); };
  s.appendChild(done);
}
function showRest() {
  const W = WORLDS[run.world];
  const s = sceneScreen(A.worldBg(run.world, 'rest'), W.rooms.rest.ico, W.rooms.rest.name);
  s.appendChild(el('div', 'speaker-line', '"Snack time! Eat up… or practice one of your moves?" — Mom'));
  const heal = el('button', 'btn', `🍎 Snack (heal ${R.restHealAmount(run)} HP)`);
  heal.onclick = () => { sfx.heal(); const h = R.restHeal(run); toast(`❤️ +${h} HP`); saveRun(); showMap(); };
  s.appendChild(heal);
  const canUp = upgradableCards(run.deck).length > 0;
  const practice = el('button', 'btn gold', '⭐ Practice (upgrade a card)');
  practice.disabled = !canUp;
  practice.onclick = () => upgradePickModal(upgradableCards(run.deck), (c) => { if (R.restPractice(run, c.uid)) { sfx.relic(); toast(`⭐ ${CARDS[c.id].name}+!`); saveRun(); showMap(); } });
  s.appendChild(practice);
}
function showTreasure(tid) {
  const W = WORLDS[run.world];
  const s = sceneScreen(A.worldBg(run.world, 'treasure'), W.rooms.treasure.ico, W.rooms.treasure.name);
  if (!tid) { s.appendChild(el('div', 'speaker-line', 'Goldie looks at you. She has nothing. Goldie knows.')); const b = el('button', 'btn', 'Onward →'); b.onclick = showMap; s.appendChild(b); return; }
  s.appendChild(el('div', 'speaker-line', 'Goldie the llama found something by her fence…'));
  const b = el('button', 'btn gold', '🎁 See what it is!');
  b.onclick = () => showTreasurePop(tid, () => { saveRun(); showMap(); });
  s.appendChild(b);
}
function showTreasurePop(tid, onDone) {
  const t = TREASURES[tid];
  sfx.relic();
  modal(null, (m, close) => {
    m.classList.add('treasure-pop');
    m.appendChild(el('h2', '', 'TREASURE!'));
    m.appendChild(artImg(A.treasureArt(tid), t.emoji, 'treasure-emoji'));
    m.appendChild(el('h2', 'treasure-name', t.name));
    m.appendChild(el('p', 'subtitle', t.text));
    const b = el('button', 'btn gold', 'WHOA! →');
    b.onclick = () => { close(); onDone(); };
    m.appendChild(b);
  }, { dismissable: false });
}
function pickTreasure(title, ids, onDone, onPicked = null) {
  if (!ids.length) return onDone();
  modal(title, (m, close) => {
    for (const id of ids) {
      const t = TREASURES[id];
      const b = el('button', 'btn gold two-line', `${t.emoji} ${t.name}<small>${t.text}</small>`);
      b.onclick = () => { R.gainTreasure(run, id); if (onPicked) onPicked(id); sfx.relic(); saveRun(); close(); onDone(); };
      m.appendChild(b);
    }
  }, { dismissable: false });
}

// ================================================================= PICKERS & MODALS
function showDeckModal(cards, title = 'My Deck') {
  modal(`${title} (${cards.length})`, (m) => {
    if (!cards.length) m.appendChild(el('p', 'subtitle', '(empty)'));
    const grid = el('div', 'deck-grid');
    for (const c of cards) grid.appendChild(cardFace(c, { mini: true }));
    m.appendChild(grid);
  });
}
function pickCardModal(title, cards, onPick, { onCancel = null } = {}) {
  modal(title, (m, close) => {
    const grid = el('div', 'deck-grid');
    for (const c of cards) {
      const f = cardFace(c, { mini: true });
      f.onclick = () => { close(); onPick(c); };
      grid.appendChild(f);
    }
    m.appendChild(grid);
    if (onCancel) {
      const back = el('button', 'btn secondary', '← Back');
      back.onclick = () => { close(); onCancel(); };
      m.appendChild(back);
    }
  }, { dismissable: !onCancel });
}
function upgradePickModal(cards, onConfirm, heading = '⭐ Practice which move?') {
  modal(null, (m, close) => {
    const showList = () => {
      m.innerHTML = '';
      m.appendChild(el('h2', '', heading));
      const grid = el('div', 'deck-grid');
      for (const c of cards) { const f = cardFace(c, { mini: true }); f.onclick = () => showCompare(c); grid.appendChild(f); }
      m.appendChild(grid);
    };
    const showCompare = (c) => {
      m.innerHTML = '';
      m.appendChild(el('h2', '', '⭐ Practice makes perfect'));
      const row = el('div', 'upgrade-compare');
      row.appendChild(cardFace(c, { mini: true, extraCls: 'up-before' }));
      row.appendChild(el('div', 'up-arrow', '➜'));
      row.appendChild(cardFace({ ...c, up: true }, { mini: true, extraCls: 'up-after' }));
      m.appendChild(row);
      const yes = el('button', 'btn gold', '⭐ This one!');
      yes.onclick = () => { close(); onConfirm(c); };
      const back = el('button', 'btn secondary', '← Pick a different card');
      back.onclick = showList;
      m.append(yes, back);
    };
    showList();
  }, { dismissable: false });
}
const KEYWORD_INFO = [
  ['⚡ Energy', 'Cards cost ⚡. You get 3 fresh ⚡ every turn.'],
  ['🎯 Next move bubble', 'Shows what each crop will do next. ⚔️ + a number = how hard it will hit you.'],
  ['♻️ Used up', 'After you play it, that card is gone until the NEXT fight.'],
  ['💾 Saved cards', 'Cards still in your hand when a fight ends start in your hand next fight.'],
  ['🎰 The Jackpot', 'One free spin per world. Three cousins = the Cousin Card. Three crops = a fight. Mixed = a Cactus.'],
  ['👯 The Cousin Card', 'In your hand every fight in that world. Strong for you, Weak for a crop, and "Nuh-uh!" cancels its next attack.'],
  ['🌵 The Cactus', 'Pokes back for 1 every time you get hit. Leaves with the world boss.'],
  ['🤢 Stinky', 'A junk card. Can\'t be played. Gone after the fight.'],
];
function showHelpModal() {
  modal('📖 How to read the game', (m) => {
    m.appendChild(el('p', 'subtitle', '<b>Words</b>'));
    for (const [k, v] of KEYWORD_INFO) m.appendChild(el('p', 'deck-line', `<b>${k}</b> <span class="dim">${v}</span>`));
    m.appendChild(el('p', 'subtitle', '<b>Effects (tap any chip in a fight!)</b>'));
    for (const v of Object.values(STATUS_INFO)) m.appendChild(el('p', 'deck-line', `<span class="dim">${v}</span>`));
    if (run) {
      m.appendChild(el('p', 'subtitle', `<b>${HEROES[run.hero].name}</b>`));
      m.appendChild(el('p', 'deck-line', MECH[run.hero]));
    }
  });
}

// ================================================================= ENDINGS
const KILLER_SRC = { burning: { name: 'Hot pepper burns', emoji: '🔥' }, splash: { name: 'A tomato splash', emoji: '💦' }, burst: { name: 'A rotten burst', emoji: '🤢' }, oops: { name: 'Bad luck', emoji: '😵' } };
function showDefeat() {
  releaseScreen();
  music.play('title');
  const st = combat; combat = null; prevSnap = null;
  const s = screen('look-base');
  s.appendChild(artImg(A.uiArt(`ko_${run.hero}`), '🌧️', 'scene-art ko-art'));
  s.appendChild(el('h2', '', 'The crops win… this time.'));
  const k = st && st.killedBy;
  if (k) {
    const info = k.name ? k : (KILLER_SRC[k.src] || KILLER_SRC.oops);
    const chip = el('div', 'killer-chip');
    chip.appendChild(artImg(k.artKey ? A.enemyArt(k.artKey) : 'assets/none.jpg', info.emoji, 'killer-face'));
    chip.appendChild(el('div', 'killer-name', `taken down by<br><b>${String(info.name).toUpperCase()}</b>`));
    s.appendChild(chip);
  }
  s.appendChild(el('p', 'subtitle recap-line', `${WORLDS[run.world].name} · Floor ${run.floor} · ⚔️ ${run.stats.fights + run.stats.elites + run.stats.medleys} fights won`));
  s.appendChild(el('div', 'speaker-line', `"${nextLossLine()}" — Coach James`));
  clearSave();
  const b = el('button', 'btn', '🔁 Try again');
  b.onclick = showTitle;
  s.appendChild(b);
}
// The ending (in-engine) → the song: the music video if it's here, else the
// synced-lyric karaoke credits (offline-safe fallback).
function playEnding(hero, onDone) {
  music.play(null);
  SC.endingCutscene(sceneDeps(), hero, () => {
    SC.playEndingVideo(sceneDeps(), onDone, () => creditsRoll(hero, { el, artImg, sfx, REDUCED }, onDone));
  });
}
function showVictory() {
  const heroId = run.hero;
  const p = loadProfile();
  p.wins[heroId] = (p.wins[heroId] || 0) + 1;
  const newHL = Math.min(10, Math.max(p.harvestMax || 0, (run.harvestLevel || 0) + 1));
  const unlocked = newHL > (p.harvestMax || 0);
  p.harvestMax = newHL;
  p.movies.ending = 1; p.movies.song = 1;
  saveProfile(p);
  const hl = run.harvestLevel;
  clearSave();
  prefetch(['assets/audio/ending.mp3', 'assets/audio/ending.lrc']);
  playEnding(heroId, () => showCrown(heroId, hl, unlocked, newHL));
}
function showCrown(heroId, hl, unlocked, newHL) {
  music.play('title');
  const s = screen('look-base crown-screen');
  s.appendChild(el('div', 'crown', '👑'));
  s.appendChild(el('h1', '', 'THE FARM IS SAFE!'));
  const LINES = {
    wyatt: '"The corn popped. The tomato splatted. The onion cried. But nobody is faster than WYATT THE SPEEDY!" ⚽',
    aaron: '"Three worlds. Three giant crops. One tractor. AARON THE STRONG!" 🚜',
    liam: '"The Huge Onion said I would cry. I said… BOOK STORM! LIAM THE READER!" 📚',
  };
  s.appendChild(artImg(A.heroWinArt(heroId), HEROES[heroId].emoji, 'scene-art'));
  s.appendChild(el('div', 'speaker-line', LINES[heroId]));
  if (hl) s.appendChild(el('p', 'subtitle', `🌾 …on Harvest Level ${hl}!`));
  if (unlocked) s.appendChild(el('div', 'speaker-line', `🌾 <b>Harvest Level ${newHL} unlocked!</b> Pick it when you start a new game. ${C.HARVEST_LEVELS[newHL]}`));
  const again = el('button', 'btn secondary', '🎬 Watch the ending again');
  again.onclick = () => playEnding(heroId, () => showCrown(heroId, hl, false, newHL));
  const home = el('button', 'btn gold', '🏠 Back to the title');
  home.onclick = showTitle;
  s.append(again, home);
}

// ================================================================= BOOT
music.arm();
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
{
  const rh = document.createElement('div');
  rh.className = 'rotate-hint';
  rh.innerHTML = '<span class="rh-icon">📱</span>Turn your screen tall-ways to play!';
  document.body.appendChild(rh);
}
// tap-to-explain everywhere (kids can't hover)
document.addEventListener('click', (ev) => {
  if (!ev.target.closest) return;
  if (ev.target.closest('.enemy.targetable')) return;
  const chip = ev.target.closest('[data-status]');
  if (chip && STATUS_INFO[chip.dataset.status]) {
    toast(STATUS_INFO[chip.dataset.status], 2800);
    markFxSeen(chip.dataset.status);
    document.querySelectorAll(`.chip[data-status="${chip.dataset.status}"]`).forEach((c) => c.classList.remove('chip-new'));
    ev.stopPropagation();
    return;
  }
  const pchip = ev.target.closest('.chip[data-power]');
  if (pchip && combat && POWER_INFO[pchip.dataset.power]) { toast(POWER_INFO[pchip.dataset.power].text(combat.hero.powers[pchip.dataset.power]), 3000); ev.stopPropagation(); return; }
  const it = ev.target.closest('.intent[data-intent]');
  if (it) { const fn = INTENT_KIND_INFO[it.dataset.intent]; if (fn) toast(fn(it.dataset.name || 'its move', it.dataset.dmg || ''), 3200); ev.stopPropagation(); return; }
  if (ev.target.closest('.energy-orb')) { toast('⚡ Energy: cards cost ⚡. You get 3 fresh ⚡ every turn.'); return; }
  const meter = ev.target.closest('.hero-meter');
  if (meter && combat) {
    const T = {
      touches: `⚽ ${combat.touches} Touches. Passes add Touches. A SHOT card spends them ALL for extra damage!`,
      gears: `🚜 Gear ${combat.gear}: your attacks and Block get +${C.gearBonus(combat)}. DOWNSHIFT drops back to Gear 1 for a big hit.`,
      book: `📚 Book Meter ${combat.pages}/${BOOK_PAGES}. Fill it up… BOOK STORM! 15 damage to EVERY enemy.`,
    };
    toast(T[meter.dataset.meter] || '', 3200);
  }
}, true);

const preview = /^#(credits|ending|opening)$/.exec(location.hash);
if (preview) {
  run = null;
  if (preview[1] === 'opening') SC.openingCutscene(sceneDeps(), HEROES.wyatt.name, showTitle);
  else playEnding('wyatt', showTitle);
} else showTitle();

// e2e/debug handle (+ dev jumps for tests/screenshots — harmless in play)
window.__RL5 = {
  get run() { return run; }, get combat() { return combat; }, get wakeHeld() { return !!wakeLock; }, R, C, showTitle,
  dev: {
    start(heroId = 'wyatt', seed = 4242, world = 1) {
      run = R.newRun(heroId, seed);
      while (run.world < world) R.advanceWorld(run);
      saveRun();
      showMap();
    },
    fight(keys, kind = 'fight') { if (!run) this.start(); startFight({ enemies: keys }, kind); },
    jackpot() { if (!run) this.start(); run.jackpotDone = false; showJackpot(); },
    cousins() { if (!run) this.start(); run.cousinCard = true; saveRun(); },
    shop() { if (!run) this.start(); showShop(R.makeShop(run, makeRng(99))); },
    rest() { if (!run) this.start(); showRest(); },
    victory() { if (!run) this.start('wyatt', 1, 3); showVictory(); },
    defeat() { if (!run) this.start(); combat = null; showDefeat(); },
    opening() { SC.openingCutscene(sceneDeps(), HEROES.wyatt.name, showTitle); },
    goldie() { goldieSnack(showTitle); },
    ending(hero = 'wyatt') { SC.endingCutscene(sceneDeps(), hero, showTitle); },
    win() { if (combat) { for (const e of C.livingEnemies(combat)) { e.hp = 0; e.deathHandled = true; } C.checkCombatEnd(combat); afterAction(); } },
    refresh() { afterAction(); },
    screen(name) {
      if (!run) this.start();
      const rng = makeRng(7);
      const after = (kind) => { run.after = { kind, rewards: R.fightRewards(run, kind, rng), result: { healed: 0, saved: 2 } }; };
      const S = {
        title: showTitle, settings: showSettings, movies: showMovies, saveCode: showSaveCode, heroes: showHeroSelect,
        story: showWorldStory, map: showMap, defeat: () => this.defeat(), rest: () => this.rest(), jackpot: () => this.jackpot(),
        deck: () => { showMap(); showDeckModal(run.deck); },
        treasure: () => showTreasure(Object.keys(TREASURES)[3]),
        boss: () => bossIntro({ enemies: WORLDS[run.world].encounters.boss[0] }),
        reward: () => { after('fight'); continueAfter(); },
        bossSplash: () => { after('boss'); showBossSplash(null, run.after.rewards); },
      };
      S[name]();
    },
  },
};

// Rolfe Legends 5 e2e: drives the real UI headless in BOTH engines (the boys' tablets
// are Safari/Silk). Covers: title → hero → Wyatt's opening → story → map → a real fight
// by taps → victory beat → reward → saved cards → save/reload; the Jackpot (all three
// outcomes); the Cousin Card's "Nuh-uh!"; Teary + Grabbed cards; the hero and boss meters;
// BOOK STORM!; a FULL scripted run through all three worlds and the ending; offline boot;
// the shared-origin service worker.
//   node test/e2e.mjs            (self-hosts the repo on :8204 if nothing answers)
// WEBKIT PIN: playwright stays at 1.60.0 on this Mac (macOS 14's frozen WebKit build
// hangs on ≥1.61). Missing-asset 404s are by design (drop-in art/music layers).
import { createRequire } from 'module';
import http from 'http';
import { readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const { webkit, chromium } = require('playwright');

const PORT = 8205;
const BASE = `http://localhost:${PORT}`;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = join(ROOT, 'docs', 'smoke', 'e2e');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.lrc': 'text/plain', '.mp4': 'video/mp4' };
let ownServer = null;
try { await fetch(BASE, { signal: AbortSignal.timeout(1500) }); } catch {
  ownServer = http.createServer(async (req, res) => {
    try {
      let path = decodeURIComponent(new URL(req.url, BASE).pathname);
      if (path.endsWith('/')) path += 'index.html';
      const data = await readFile(join(ROOT, path));
      const type = MIME[extname(path)] || 'application/octet-stream';
      // byte ranges, like GitHub Pages (Safari won't play video from a server without them)
      const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
      if (m) {
        const start = m[1] ? +m[1] : Math.max(0, data.length - +m[2]);
        const end = m[1] && m[2] ? Math.min(+m[2], data.length - 1) : data.length - 1;
        res.writeHead(206, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${data.length}`, 'Content-Length': end - start + 1 });
        return res.end(data.subarray(start, end + 1));
      }
      res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes' });
      res.end(data);
    } catch { res.writeHead(404).end(); }
  }).listen(PORT);
  console.log(`(self-hosting the repo on :${PORT})`);
}
await mkdir(SHOTS, { recursive: true });

const results = [];
function ok(cond, msg) { results.push([!!cond, msg]); if (!cond) console.log('  ✗', msg); }
// outcome asserts save a screenshot when they fail (Polish floor 9)
async function okShot(page, cond, msg) {
  ok(cond, msg);
  if (!cond) {
    await mkdir(join(ROOT, 'test-results'), { recursive: true });
    await page.screenshot({ path: join(ROOT, 'test-results', `${msg.replace(/[^a-z0-9]+/gi, '_').slice(0, 60)}.png`) }).catch(() => {});
  }
}
async function zapTips(page) {
  for (let i = 0; i < 5; i++) {
    if (await page.locator('.coach-bubble').count() === 0) break;
    await page.locator('.coach-bubble').first().click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(400);
  }
}
async function newPage(browser, { mobile = false } = {}) {
  const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 768, height: 1024 }, reducedMotion: 'reduce' });
  page._errors = [];
  // WebKit reports an idle prefetch that a test reload cuts off as a page error too (benign)
  page.on('pageerror', (e) => { if (!String(e).includes('due to access control checks')) page._errors.push(String(e)); });
  // 404s are by design (drop-in layers); WebKit also logs an idle prefetch that a test reload cuts off
  page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' && !t.includes('Failed to load resource') && !t.includes('due to access control checks')) page._errors.push(t); });
  return page;
}
async function shot(page, name) { await page.waitForTimeout(250); await page.screenshot({ path: join(SHOTS, `${name}.jpg`), type: 'jpeg', quality: 60 }); }
const rl5 = (page, fn, arg) => page.evaluate(fn, arg);

// ---------------------------------------------------------------- the real UI, by taps
async function uiSuite(browserType, name) {
  const browser = await browserType.launch({ timeout: 30000 });
  const page = await newPage(browser, { mobile: name === 'webkit' });
  await page.goto(BASE, { waitUntil: 'load', timeout: 20000 });
  ok(await page.locator('.title-logo').count() === 1, `${name}: title renders`);
  ok((await page.textContent('.title-sub')).includes('THE CROPS ATTACK'), `${name}: the title says The Crops Attack`);
  if (name === 'chromium') await shot(page, 'title');
  await page.locator('.btn', { hasText: 'Play' }).click();
  ok(await page.locator('.hero-card').count() === 3, `${name}: three heroes to pick`);
  ok(await page.locator('.hero-card', { hasText: 'Liam the Reader' }).count() === 1, `${name}: Liam the Reader is a hero`);
  await page.locator('.hero-card', { hasText: 'Aaron' }).click();
  ok(await page.locator('.cutscene.opening').count() === 1, `${name}: Wyatt's opening plays`);
  ok((await page.textContent('.ending-cap')).includes('Savanah'), `${name}: the opening starts with Aunt Savanah's car`);
  await page.locator('.cutscene.opening').click();
  ok((await page.textContent('.ending-cap')).includes('RUMBLE'), `${name}: the ground rumbles`);
  await page.locator('.cutscene-skip').click();
  await page.waitForSelector('.cutscene.story .story-name', { timeout: 5000 }).catch(() => {});
  ok((await page.locator('.story-name').textContent()).includes('CORN WORLD'), `${name}: World 1 is Corn World`);
  await page.locator('.cutscene .btn').click();
  ok(await page.locator('.map-screen.look-w1').count() === 1, `${name}: the map, in the Corn World look`);
  ok(await page.locator('.map-spot.spot-jackpot').count() >= 1, `${name}: the Jackpot is on the map`);
  if (name === 'chromium') await shot(page, 'map-w1');
  await zapTips(page);
  await page.locator('.map-node.reachable').first().click();
  ok(await page.locator('.combat').count() === 1, `${name}: a fight starts`);
  ok(await page.locator('.hero-meter.meter-aaron .gearbox').count() === 1, `${name}: Aaron's gear stick shows`);
  if (name === 'chromium') await shot(page, 'combat-w1');
  for (let turn = 0; turn < 30; turn++) {
    await zapTips(page);
    if (await page.locator('.combat').count() === 0) break;
    for (let k = 0; k < 8; k++) {
      const playable = page.locator('.hand .card:not(.unaffordable)');
      if (await playable.count() === 0) break;
      await playable.first().click();
      if (await page.locator('.enemy.targetable').count()) await page.locator('.enemy.targetable').first().click();
      await page.waitForTimeout(80);
      if (await page.locator('.combat').count() === 0) break;
    }
    if (await page.locator('.combat').count() === 0) break;
    if (await rl5(page, () => window.__RL5.combat && window.__RL5.combat.over)) { await page.waitForTimeout(400); continue; }
    await page.locator('.endturn').click();
    await page.waitForFunction(() => !window.__RL5.combat || window.__RL5.combat.phase === 'hero' || window.__RL5.combat.over, null, { timeout: 8000 }).catch(() => {});
  }
  await page.waitForSelector('.victory-beat, .screen h2', { timeout: 8000 }).catch(() => {});
  const won = await page.locator('.victory-beat').count() === 1;
  await okShot(page, won, `${name}: won the first fight by taps`);
  if (won) {
    ok(await page.locator('.coin-tally').textContent().then((t) => t.includes('Fight win')), `${name}: the coin tally shows the fight coins`);
    await page.locator('.btn', { hasText: 'Keep going' }).click();
    ok(await page.locator('.reward-row .mini-card').count() >= 3, `${name}: card reward offers 3+`);
    await page.locator('.reward-row .mini-card').first().click();
    ok(await page.locator('.map-screen').count() === 1, `${name}: back to the map`);
    await page.reload({ waitUntil: 'load' });
    ok(await page.locator('.btn', { hasText: 'Continue' }).count() === 1, `${name}: Continue appears after reload`);
    await page.locator('.btn', { hasText: 'Continue' }).click();
    ok(await page.locator('.map-screen').count() === 1, `${name}: the saved run resumes on the map`);
  }
  ok(page._errors.length === 0, `${name}: no page errors (${page._errors.slice(0, 2).join(' | ')})`);
  await browser.close();
}

// find a seed whose first Jackpot spin lands on `want`, start there, open the Jackpot
async function jackpotWith(page, want, hero = 'wyatt') {
  return rl5(page, ({ want, hero }) => {
    const R = window.__RL5.R;
    for (let s = 1; s < 500; s++) {
      const probe = R.newRun(hero, s);
      const r = R.spinJackpot(probe);
      if (r.outcome === want) { window.__RL5.dev.start(hero, s, 1); window.__RL5.dev.jackpot(); return s; }
    }
    return null;
  }, { want, hero });
}

// ---------------------------------------------------------------- RL5 mechanics, via dev jumps
async function mechanicsSuite(browserType, name) {
  const browser = await browserType.launch({ timeout: 30000 });
  const page = await newPage(browser);
  await page.goto(BASE, { waitUntil: 'load' });
  await rl5(page, () => localStorage.setItem('rl5_tips', JSON.stringify(Object.fromEntries(['basics', 'mech_wyatt', 'mech_aaron', 'mech_liam', 'map', 'jackpot', 'cousin', 'saved', 'heat', 'ripe', 'layers', 'teary', 'reward', 'elite'].map((k) => [k, 1])))));
  // --- the Jackpot: three cousins → the Cousin Card
  ok(await jackpotWith(page, 'cousins') != null, `${name}: found a cousins seed`);
  ok(await page.locator('.reel').count() === 3, `${name}: the Jackpot has three reels`);
  if (name.startsWith('chromium')) await shot(page, 'jackpot');
  await page.locator('.big-spin').click();
  await page.waitForSelector('.treasure-pop', { timeout: 8000 });
  ok((await page.textContent('.treasure-pop')).includes('COUSINS'), `${name}: three cousins → the cousins join you`);
  ok(await page.locator('.treasure-pop .cousin-card').count() === 1, `${name}: the Cousin Card is shown`);
  ok(await page.locator('.reel .reel-name', { hasText: 'Stella' }).count() === 1, `${name}: the reels landed on Stella…`);
  if (name.startsWith('chromium')) await shot(page, 'jackpot-cousins');
  await page.locator('.treasure-pop .btn').click();
  ok(await rl5(page, () => window.__RL5.run.cousinCard && window.__RL5.run.jackpotDone), `${name}: the run has the Cousin Card; the spin is used`);
  // --- the Cousin Card in a fight: Delilah's "Nuh-uh!"
  await rl5(page, () => window.__RL5.dev.fight(['mini_corn', 'bossy_squash']));
  ok(await page.locator('.hand .cousin-card').count() === 1, `${name}: the Cousin Card starts in hand`);
  await page.locator('.hand .cousin-card').click();
  ok(await page.locator('.target-hint').textContent().then((t) => t.includes('Nuh-uh')), `${name}: it asks which crop to Nuh-uh`);
  await page.locator('.enemy.targetable').nth(1).click();
  await page.waitForTimeout(200);
  ok(await page.locator('.intent.cancelled').count() === 1, `${name}: the crop's next move shows "Nuh-uh!"`);
  ok(await rl5(page, () => window.__RL5.combat.hero.strong === 2), `${name}: Stella's Barbie: +2 Strong`);
  if (name.startsWith('chromium')) await shot(page, 'cousin-nuhuh');
  // --- crops → the Veggie Medley fight
  ok(await jackpotWith(page, 'crops') != null, `${name}: found a crops seed`);
  await page.locator('.big-spin').click();
  await page.waitForSelector('.treasure-pop', { timeout: 8000 });
  ok((await page.textContent('.treasure-pop')).includes('VEGGIE MEDLEY'), `${name}: three crops → the Veggie Medley`);
  await page.locator('.treasure-pop .btn').click();
  ok(await page.locator('.enemy .nm', { hasText: 'Veggie Medley' }).count() === 1, `${name}: the Veggie Medley fight starts`);
  await page.reload({ waitUntil: 'load' });
  await page.locator('.btn', { hasText: 'Continue' }).click();
  ok(await page.locator('.enemy .nm', { hasText: 'Veggie Medley' }).count() === 1, `${name}: a reload can't skip the crop fight`);
  // --- mixed → the Cactus
  ok(await jackpotWith(page, 'mixed') != null, `${name}: found a mixed seed`);
  await page.locator('.big-spin').click();
  await page.waitForSelector('.treasure-pop', { timeout: 8000 });
  ok((await page.textContent('.treasure-pop')).includes('CACTUS'), `${name}: mixed → the Cactus`);
  await page.locator('.treasure-pop .btn').click();
  ok(await rl5(page, () => window.__RL5.run.relics.includes('cactus')), `${name}: the Cactus is a treasure now`);
  // --- walk past
  await rl5(page, () => window.__RL5.dev.jackpot());
  await page.locator('.btn', { hasText: 'walk past' }).click();
  ok(await rl5(page, () => window.__RL5.run.jackpotDone) && await page.locator('.map-screen').count() === 1, `${name}: you can walk past the Jackpot`);
  // --- Teary + Grabbed + meters
  await rl5(page, () => { window.__RL5.dev.start('liam', 77, 3); window.__RL5.dev.fight(['huge_onion']); const st = window.__RL5.combat; window.__RL5.C.queueTeary(st, 1); window.__RL5.C.queueGrab(st, 1); st.enemies[0].intent = { name: 'nap', kind: 'defend' }; });
  await page.locator('.endturn').click();
  await page.waitForFunction(() => window.__RL5.combat && window.__RL5.combat.phase === 'hero' && window.__RL5.combat.turn === 2, null, { timeout: 8000 }).catch(() => {});
  ok(await page.locator('.hand .card.teary').count() === 1, `${name}: a Teary card is blurry`);
  ok(await page.locator('.hand .card.grabbed .tag-vine').count() === 1, `${name}: a Grabbed card shows the vine`);
  ok(await page.locator('.boss-meter.meter-layer').count() === 1, `${name}: the Huge Onion shows its layer meter`);
  ok(await page.locator('.hero-meter.meter-liam .pages').count() === 1, `${name}: Liam's Book Meter shows`);
  if (name.startsWith('chromium')) await shot(page, 'teary-onion');
  // --- BOOK STORM!
  await rl5(page, () => { const C = window.__RL5.C; C.addPage(window.__RL5.combat, 4); window.__RL5.dev.refresh(); });
  ok(await page.locator('.hand .card.storm-card').count() >= 1, `${name}: a full Book Meter puts BOOK STORM! in hand`);
  // --- the Mega Corn's Heat Meter
  await rl5(page, () => { window.__RL5.dev.start('wyatt', 5, 1); window.__RL5.dev.fight(['mega_corn'], 'boss'); });
  ok(await page.locator('.boss-meter.meter-heat').count() === 1, `${name}: the Mega Corn shows its Heat Meter`);
  ok(await page.locator('.hero-meter.meter-wyatt .balls').count() === 1, `${name}: Wyatt's Touches show`);
  // --- saved cards glow at the end of a fight
  await rl5(page, () => { window.__RL5.dev.start('wyatt', 9, 1); window.__RL5.dev.fight(['popcorn_puff']); window.__RL5.dev.win(); });
  await page.waitForTimeout(200);
  ok(await page.locator('.hand .saved-glow').count() >= 1, `${name}: saved cards glow when the fight ends`);
  await page.waitForSelector('.victory-beat', { timeout: 6000 }).catch(() => {});
  ok(await page.locator('.coin-tally', { hasText: 'saved for next fight' }).count() === 1, `${name}: the tally counts saved cards`);
  // --- the boys' ask: beat the Huge Onion's last form and Goldie eats it
  await rl5(page, () => { window.__RL5.dev.start('aaron', 12, 3); window.__RL5.dev.fight(['huge_onion'], 'boss'); const C = window.__RL5.C; const st = window.__RL5.combat; const o = st.enemies[0]; for (let i = 0; i < 3; i++) C.dealDamage(st, o, 999, { isAttack: false, fromHero: true }); window.__RL5.dev.refresh(); });
  await page.waitForSelector('.goldie-snack', { timeout: 6000 }).catch(() => {});
  await okShot(page, await page.locator('.goldie-snack').count() === 1, `${name}: beating the Heart of the Onion brings Goldie`);
  for (let i = 0; i < 3; i++) { await page.locator('.goldie-snack').click().catch(() => {}); await page.waitForTimeout(150); }
  ok(await page.locator('.goldie-snack .ending-cap').textContent().then((t) => t.includes('CRUNCH')).catch(() => false), `${name}: CRUNCH — Goldie eats the onion`);
  if (name.startsWith('chromium')) await shot(page, 'goldie-snack');
  await page.locator('.goldie-snack').click().catch(() => {});
  await page.locator('.goldie-snack').click().catch(() => {});
  await page.waitForSelector('.boss-splash', { timeout: 8000 }).catch(() => {});
  ok(await page.locator('.splash-big', { hasText: 'EATEN BY GOLDIE' }).count() === 1, `${name}: the victory screen says Goldie ate it`);
  ok(page._errors.length === 0, `${name}: mechanics — no page errors (${page._errors.slice(0, 2).join(' | ')})`);
  await browser.close();
}

async function fullRun(browserType, name) {
  const browser = await browserType.launch({ timeout: 30000 });
  const page = await newPage(browser);
  await page.goto(BASE, { waitUntil: 'load' });
  await rl5(page, () => window.__RL5.dev.start('liam', 2026, 1));
  const looks = [];
  for (let step = 0; step < 500; step++) {
    const state = await rl5(page, () => {
      const scr = document.querySelector('.screen');
      return { screen: scr ? scr.className : '', cut: !!document.querySelector('.cutscene'), modal: !!document.querySelector('.modal-veil'), combat: !!window.__RL5.combat, crown: !!document.querySelector('.crown-screen'), credits: !!document.querySelector('.credits'), world: window.__RL5.run && window.__RL5.run.world };
    });
    if (state.crown) break;
    if (state.world && !looks.includes(state.world)) looks.push(state.world);
    if (state.credits) { await page.locator('.credits-skip').click().catch(() => {}); await page.locator('.credits-continue').click().catch(() => {}); continue; }
    if (state.cut) {
      const skip = page.locator('.cutscene-skip');
      if (await skip.count()) { await skip.first().click().catch(() => {}); } else { await page.locator('.cutscene .btn').first().click().catch(() => {}); }
      await page.waitForTimeout(120);
      continue;
    }
    if (state.modal) {
      const btn = page.locator('.modal .btn:not([disabled])').first();
      if (await btn.count()) { await btn.click().catch(() => {}); } else { await page.locator('.modal .mini-card').first().click().catch(() => {}); }
      await page.waitForTimeout(80);
      continue;
    }
    if (state.combat) { await rl5(page, () => window.__RL5.dev.win()); await page.waitForTimeout(150); continue; }
    if (state.screen.includes('map-screen')) { await rl5(page, () => document.querySelector('.map-node.reachable').click()); continue; }
    if (state.screen.includes('victory-beat') || state.screen.includes('boss-splash') || state.screen.includes('boss-intro')) {
      await page.locator('.screen .btn.gold').first().click().catch(() => {});
      continue;
    }
    const exits = ['SPIN', 'All done', 'Snack', 'See what it is', 'Onward', 'Skip'];
    let clicked = false;
    for (const t of exits) {
      const b = page.locator('.screen .btn:not([disabled])', { hasText: t }).first();
      if (await b.count()) { await b.click().catch(() => {}); clicked = true; await page.waitForTimeout(t === 'SPIN' ? 600 : 0); break; }
    }
    if (!clicked) {
      const any = page.locator('.screen .btn:not([disabled])').first();
      if (await any.count()) await any.click().catch(() => {}); else await page.waitForTimeout(100);
    }
  }
  await okShot(page, await page.locator('.crown-screen').count() === 1, `${name}: a full run reaches the crown screen (worlds seen: ${looks.join(',')})`);
  ok(looks.join(',') === '1,2,3', `${name}: the run visited all three worlds`);
  ok(await rl5(page, () => JSON.parse(localStorage.getItem('rl5_profile')).wins.liam === 1), `${name}: the win is recorded`);
  ok(await rl5(page, () => JSON.parse(localStorage.getItem('rl5_profile')).harvestMax === 1), `${name}: Harvest Level 1 unlocks`);
  if (name.startsWith('chromium')) await shot(page, 'crown');
  ok(page._errors.length === 0, `${name}: full run — no page errors (${page._errors.slice(0, 2).join(' | ')})`);
  await browser.close();
}

// ---------------------------------------------------------------- the ending, offline boot, sw
async function endingAndOffline(browserType, name) {
  const browser = await browserType.launch({ timeout: 30000 });
  const context = await browser.newContext({ viewport: { width: 768, height: 1024 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => { if (!String(e).includes('due to access control checks')) errors.push(String(e)); });
  await page.goto(BASE, { waitUntil: 'load' });
  await rl5(page, () => window.__RL5.dev.ending('aaron'));
  await okShot(page, await page.locator('.cutscene.ending-cut').count() === 1, `${name}: the ending cutscene`);
  ok(await page.locator('.ending-cap').textContent().then((t) => t.includes('Huge Onion gone')), `${name}: shot 1 — the farm settles`);
  await page.locator('.cutscene.ending-cut').click();
  ok(await page.locator('.ending-cap').textContent().then((t) => t.includes('AARON')), `${name}: shot 2 — Aaron and his tractor`);
  await page.locator('.cutscene.ending-cut').click();
  ok(await page.locator('.ending-cap').textContent().then((t) => t.includes('Goldie knows')), `${name}: shot 3 — Goldie knows`);
  if (name.startsWith('chromium')) await shot(page, 'ending');
  await page.locator('.cutscene-skip').click();
  const claimed = await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 }).then(() => true, () => false);
  if (!claimed) { await page.reload({ waitUntil: 'load' }); }
  const claimed2 = claimed || await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 }).then(() => true, () => false);
  ok(claimed2, `${name}: the service worker controls the page`);
  await context.setOffline(true);
  await page.reload({ waitUntil: 'load' }).catch(() => {});
  ok(await page.locator('.title-logo').count() === 1, `${name}: boots offline`);
  await context.setOffline(false);
  const keys = await page.evaluate(() => caches.keys());
  ok(keys.some((k) => /^rolfe-legends-5-v\d+$/.test(k)), `${name}: RL5's cache exists`);
  ok(errors.length === 0, `${name}: ending/offline — no page errors (${errors.slice(0, 2).join(' | ')})`);
  await browser.close();
}
async function swSiblingCaches(browserType, name) {
  const browser = await browserType.launch({ timeout: 30000 });
  const page = await browser.newPage();
  const SIBLINGS = ['rolfe-legends-v3', 'rolfe-legends-2-v35', 'rolfe-legends-3-v3', 'rolfe-legends-4-v2'];
  const OWN_OLD = 'rolfe-legends-5-v0';
  await page.goto(BASE + '/manifest.json', { waitUntil: 'load' });
  await page.evaluate(async (names) => { for (const n of names) await (await caches.open(n)).put('/probe-' + n, new Response(n)); }, [...SIBLINGS, OWN_OLD]);
  await page.goto(BASE, { waitUntil: 'load' });
  const claimed = await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 }).then(() => true, () => false);
  ok(claimed, `${name}: sw activates and claims`);
  const keys = await page.evaluate(() => caches.keys());
  for (const s of SIBLINGS) ok(keys.includes(s), `${name}: sibling cache ${s} survives RL5's activate`);
  ok(!keys.includes(OWN_OLD), `${name}: RL5's own stale cache is cleaned`);
  await browser.close();
}

try {
  for (const [bt, nm] of [[chromium, 'chromium'], [webkit, 'webkit']]) {
    await uiSuite(bt, nm);
    await mechanicsSuite(bt, `${nm}-mech`);
    await fullRun(bt, `${nm}-full`);
    await endingAndOffline(bt, `${nm}-end`);
    await swSiblingCaches(bt, `${nm}-sw`);
  }
} catch (e) {
  ok(false, 'suite crashed: ' + (e && e.message));
}
if (ownServer) ownServer.close();
const pass = results.filter(([c]) => c).length;
console.log(`\ne2e: ${pass}/${results.length} passed`);
process.exit(pass === results.length ? 0 : 1);

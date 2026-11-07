// Rolfe Legends 5 — in-engine cutscenes. Light (stills + CSS animation + sound),
// offline-safe, ≤20 s, ALWAYS skippable, replayable from the Movies menu.
//   openingCutscene — Wyatt's opening: Savanah's car rumbles the soil, the crops SPROUT
//   storyCard — each world's gate card
//   endingCutscene — the farm settles after Goldie's snack (the snack itself plays in the final fight)
// deps (from game.js): { el, artImg, bgLayer, sfx, REDUCED, fxScale, cardFace }

import { sceneArt, endingArt, worldBg } from './art.js';

function overlay(deps, cls) {
  const root = deps.el('div', `cutscene ${cls}`);
  document.body.appendChild(root);
  return root;
}
function skipBtn(deps, root, onSkip) {
  const b = deps.el('button', 'cutscene-skip', 'skip ⏭');
  b.onclick = (ev) => { ev.stopPropagation(); onSkip(); };
  root.appendChild(b);
  return b;
}

// A tap-to-advance slideshow with an auto-advance timer. Each shot: { img, text, sound?, fx? }.
function slideshow(deps, cls, shots, onDone, { artFn = sceneArt, ms = 4200 } = {}) {
  const { el, sfx } = deps;
  const root = overlay(deps, `ending ${cls}`);
  const stage = el('div', 'ending-stage');
  const cap = el('div', 'cutscene-cap ending-cap');
  root.append(stage, cap);
  let i = -1, done = false, timer = 0;
  const finish = () => { if (done) return; done = true; clearTimeout(timer); root.remove(); onDone(); };
  skipBtn(deps, root, finish);
  const next = () => {
    i += 1;
    if (i >= shots.length) return finish();
    const s = shots[i];
    const shot = deps.bgLayer(artFn(s.img), `ending-shot kenburns${s.fx ? ` ${s.fx}` : ''}`);
    stage.appendChild(shot);
    const old = stage.children.length > 1 ? stage.firstChild : null;
    if (old) setTimeout(() => old.remove(), 900);
    cap.innerHTML = s.text;
    cap.classList.remove('show'); void cap.offsetWidth; cap.classList.add('show');
    if (s.fx === 'rumble') { root.classList.remove('quake'); void root.offsetWidth; root.classList.add('quake'); }
    (sfx[s.sound] || sfx.tap)();
    clearTimeout(timer);
    timer = setTimeout(next, ms);
  };
  root.addEventListener('click', (ev) => { if (!ev.target.closest('.cutscene-skip')) next(); });
  next();
  return { finish };
}

// Wyatt's opening (DESIGN.md §7): picks up exactly where RL4's ending stopped.
export function openingShots(heroName) {
  return [
    { img: 'open_1_car', text: 'Aunt Savanah\'s shiny gray car drives the cousins away down the lane… 🚗✨👋', sound: 'play' },
    { img: 'open_2_rumble', text: 'RUMBLE… RUMBLE… the whole lane shakes as the car goes by! 🫨', sound: 'boom', fx: 'rumble' },
    { img: 'open_3_wiggle', text: 'Uh-oh. The soil is WIGGLING. And the crops are NOT happy about it. 😠🌱', sound: 'squish', fx: 'rumble' },
    { img: 'open_4_sprout', text: 'They SPROUT up out of the ground… and ATTACK! 🌽🍅🧅', sound: 'boom', fx: 'rumble' },
    { img: 'open_5_hero', text: `Only one legend can save the farm: <b>${heroName}</b>! 💪`, sound: 'relic' },
  ];
}
export function openingCutscene(deps, heroName, onDone) {
  return slideshow(deps, 'opening look-base', openingShots(heroName), onDone);
}

export function storyCard(deps, { world, kicker, name, emoji, sub, line, button }, onDone) {
  const { el } = deps;
  const root = overlay(deps, `story look-w${world}`);
  root.appendChild(deps.bgLayer(worldBg(world, 'story'), 'cutscene-bg'));
  const inner = el('div', 'story-inner');
  inner.appendChild(el('div', 'story-kicker', kicker));
  inner.appendChild(el('div', 'story-emoji', emoji));
  inner.appendChild(el('h1', 'story-name', name));
  inner.appendChild(el('p', 'story-sub', sub));
  inner.appendChild(el('div', 'speaker-line story-line', line));
  const b = el('button', 'btn gold', button || 'Onward! →');
  b.onclick = () => { root.remove(); onDone(); };
  inner.appendChild(b);
  root.appendChild(inner);
}

// The ending (Hugo's draft for veto, DESIGN.md §7), shot by shot. Tap to advance.
export function endingShots(hero) {
  const heroShot = {
    wyatt: { img: 'end_3_wyatt', text: 'WYATT THE SPEEDY stands on the farm, ball under his foot. ⚽' },
    aaron: { img: 'end_3_aaron', text: 'AARON THE STRONG parks the tractor right in the middle of the farm. 🚜' },
    liam: { img: 'end_3_liam', text: 'LIAM THE READER sits on his giant book and turns the page. 📚' },
  }[hero];
  return [
    { img: 'end_2_settle', text: 'With the Huge Onion gone (thanks, Goldie!), the crops all over the farm calm down and settle back into the soil. 🌽🍅🌱', sound: 'heal' },
    heroShot,
    { img: 'end_5_goldie', text: 'Goldie licks her lips. "Goldie says nothing. Goldie knows." 🦙', sound: 'relic' },
    { img: 'end_6_farm', text: 'The farm is safe. The crops are quiet. The LEGENDS win! 🏆', sound: 'win' },
  ];
}
export function endingCutscene(deps, hero, onDone) {
  return slideshow(deps, 'ending-cut look-base', endingShots(hero), onDone, { artFn: endingArt });
}

// If the music-video ending exists, it plays first (lazy, skippable); any failure
// (offline + uncached, missing file) falls back to the in-engine credits.
export function playEndingVideo(deps, onDone, onFail) {
  const { el } = deps;
  const root = overlay(deps, 'video-ending');
  const v = document.createElement('video');
  v.src = 'assets/video/ending.mp4';
  v.playsInline = true;
  v.setAttribute('playsinline', '');
  v.preload = 'auto';
  v.controls = false;
  root.appendChild(v);
  let settled = false, started = false, lastT = -1, still = 0;
  const watch = setInterval(() => {
    if (!started || v.paused || v.ended) { still = 0; return; }
    if (v.currentTime !== lastT) { lastT = v.currentTime; still = 0; return; }
    still += 1;
    if (still >= (navigator.onLine ? 15 : 4)) done(false);
  }, 1000);
  const done = (ok) => { if (settled) return; settled = true; clearInterval(watch); v.pause(); root.remove(); (ok ? onDone : onFail)(); };
  skipBtn(deps, root, () => done(true));
  v.addEventListener('ended', () => done(true));
  v.addEventListener('error', () => done(false));
  const failTimer = setTimeout(() => { if (v.readyState < 2) done(false); }, 6000);
  v.addEventListener('playing', () => { clearTimeout(failTimer); started = true; });
  const p = v.play();
  if (p && p.catch) {
    p.catch(() => {
      const tap = el('button', 'btn gold cutscene-go', '▶️ Play the ending!');
      tap.onclick = () => { tap.remove(); v.play().catch(() => done(false)); };
      root.appendChild(tap);
      clearTimeout(failTimer);
    });
  }
}

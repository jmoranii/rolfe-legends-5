// Rolfe Legends 5 — background music. Looping tracks with crossfade, separate from SFX.
// Tracks live at assets/audio/<name>.mp3. Missing files no-op gracefully (drop-in like art).
// Browser autoplay policy: nothing plays until unlock() is called from a user gesture.

const TRACKS = ['title', 'world1', 'world2', 'world3', 'battle1', 'battle2', 'battle3', 'jackpot', 'ending', 'boss_mega_corn', 'boss_ripe_tomato', 'boss_huge_onion'];
// each boss's own theme; its world's battle track plays if the theme is missing
const FALLBACK = { boss_mega_corn: 'battle1', boss_ripe_tomato: 'battle2', boss_huge_onion: 'battle3', battle1: 'world1', battle2: 'world2', battle3: 'world3', jackpot: 'title' };
const VOL = 0.45;            // music sits under SFX
const FADE_MS = 600;

let enabled = true;
let unlocked = false;
let started = false;         // has a track actually begun audible playback?
let current = null;          // track name currently desired
const els = new Map();       // name -> {audio}
const missing = new Set();   // names whose file 404'd — never retry

const GESTURES = ['pointerdown', 'touchstart', 'mousedown', 'keydown', 'click'];
function onGesture() { unlock(); }

// Arm autoplay-unlock: any user gesture tries to start music, and the listeners
// STAY until playback actually succeeds (handles Safari/Chrome rejecting the
// first attempt). Idempotent.
export function arm() {
  for (const g of GESTURES) window.addEventListener(g, onGesture, { capture: true, passive: true });
}
function disarm() {
  for (const g of GESTURES) window.removeEventListener(g, onGesture, { capture: true });
}

export function setEnabled(on) {
  enabled = on;
  if (!on) stopAll();
  else { arm(); if (unlocked && current) play(current); }
}
export function isEnabled() { return enabled; }

// Mark unlocked and attempt the current track. Safe to call repeatedly.
export function unlock() {
  unlocked = true;
  if (enabled && current) play(current);
}

function getEl(name) {
  if (missing.has(name)) return null;
  let e = els.get(name);
  if (!e) {
    const audio = new Audio(`assets/audio/${name}.mp3`);
    audio.loop = name !== 'ending'; // the ending song plays once
    audio.preload = 'auto';
    audio.volume = 0;
    audio.dataset.track = name;
    audio.addEventListener('error', () => {
      missing.add(name); els.delete(name); audio.remove();
      if (current === name && FALLBACK[name]) play(FALLBACK[name]);
    }, { once: true });
    if (document.body) document.body.appendChild(audio); // inspectable + helps some browsers
    e = { audio };
    els.set(name, e);
  }
  return e;
}

function fade(audio, to, ms, onDone) {
  const from = audio.volume;
  const start = performance.now ? performance.now() : 0;
  // performance.now is fine in browsers; tests don't import this module
  const step = (now) => {
    const t = Math.min(1, (now - start) / ms);
    audio.volume = Math.max(0, Math.min(1, from + (to - from) * t));
    if (t < 1) requestAnimationFrame(step);
    else if (onDone) onDone();
  };
  requestAnimationFrame(step);
}

// Public: request a track. Crossfades from whatever's playing. Unknown/missing → silence.
export function play(name) {
  if (!TRACKS.includes(name)) name = null;
  while (name && missing.has(name) && FALLBACK[name]) name = FALLBACK[name]; // resolve stand-ins before fading anything
  current = name;
  if (!enabled || !unlocked) return;     // remembered; starts on unlock
  // fade out everything that isn't the target
  for (const [n, e] of els) {
    if (n !== name && !e.audio.paused) fade(e.audio, 0, FADE_MS, () => { if (current !== n) e.audio.pause(); }); // not if it became the target again
  }
  if (!name) return;
  const e = getEl(name);
  if (!e) { if (FALLBACK[name]) play(FALLBACK[name]); return; } // missing → stand-in, or silence
  const p = e.audio.play();
  if (p && p.then) {
    p.then(() => { started = true; disarm(); fade(e.audio, VOL, FADE_MS); })
     .catch(() => { /* autoplay still blocked → armed listeners retry on next gesture */ });
  } else {                               // older browsers: no promise returned
    started = true; disarm(); fade(e.audio, VOL, FADE_MS);
  }
}

export function stopAll() {
  for (const [, e] of els) { if (!e.audio.paused) { e.audio.pause(); e.audio.volume = 0; } }
}

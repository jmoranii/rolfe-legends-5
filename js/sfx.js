// Rolfe Legends 5 — procedural WebAudio SFX (no audio files). RL1 pattern.
let ctx = null;
let enabled = true;

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function setEnabled(on) { enabled = on; }
export function isEnabled() { return enabled; }

// filtered-noise gust: tones can't make wind, so this one gets a noise buffer
// swept through a bandpass — quiet rise, airy peak, gone.
function gust(dur, vol = 0.18, when = 0) {
  const c = ac();
  if (!c || !enabled) return;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(); src.buffer = buf;
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.9;
  bp.frequency.setValueAtTime(220, c.currentTime + when);
  bp.frequency.exponentialRampToValueAtTime(1400, c.currentTime + when + dur * 0.7);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, c.currentTime + when);
  g.gain.exponentialRampToValueAtTime(vol, c.currentTime + when + dur * 0.35);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + when + dur);
  src.connect(bp); bp.connect(g); g.connect(c.destination);
  src.start(c.currentTime + when); src.stop(c.currentTime + when + dur + 0.02);
}

function tone(freq, dur, type = 'sine', vol = 0.15, when = 0) {
  const c = ac();
  if (!c || !enabled) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, c.currentTime + when);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + when + dur);
  o.connect(g); g.connect(c.destination);
  o.start(c.currentTime + when); o.stop(c.currentTime + when + dur + 0.02);
}

export const sfx = {
  tap: () => tone(600, 0.06, 'square', 0.06),
  play: () => { tone(440, 0.08, 'triangle', 0.12); tone(660, 0.1, 'triangle', 0.1, 0.05); },
  attack: () => { tone(200, 0.12, 'sawtooth', 0.14); tone(120, 0.15, 'square', 0.1, 0.03); },
  block: () => { tone(300, 0.1, 'square', 0.1); tone(240, 0.12, 'square', 0.08, 0.05); },
  hurt: () => { tone(150, 0.2, 'sawtooth', 0.16); tone(90, 0.25, 'sawtooth', 0.1, 0.05); },
  heal: () => { tone(523, 0.12, 'sine', 0.12); tone(659, 0.12, 'sine', 0.12, 0.1); tone(784, 0.18, 'sine', 0.12, 0.2); },
  gold: () => { tone(988, 0.08, 'square', 0.08); tone(1319, 0.1, 'square', 0.08, 0.06); },
  win: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'triangle', 0.14, i * 0.12)); },
  lose: () => { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.25, 'triangle', 0.12, i * 0.18)); },
  relic: () => { [660, 880, 1100].forEach((f, i) => tone(f, 0.14, 'sine', 0.12, i * 0.09)); },
  quack: () => { tone(280, 0.09, 'sawtooth', 0.18); tone(220, 0.12, 'sawtooth', 0.14, 0.09); },
  turn: () => tone(392, 0.1, 'triangle', 0.1),

  // ---- per-card-family voices (cause-and-effect pass, Sun 2026-08-02) ----
  slash: () => { tone(750, 0.05, 'sawtooth', 0.12); tone(320, 0.13, 'sawtooth', 0.15, 0.03); },       // single hit
  slashTick: (i = 0) => tone(480 + (i % 5) * 90, 0.05, 'square', 0.11),                               // one hit of a flurry
  shield: () => { tone(170, 0.16, 'triangle', 0.2); tone(85, 0.22, 'sine', 0.13, 0.02); },            // block THUNK
  shieldClink: () => { tone(1100, 0.05, 'triangle', 0.12); tone(700, 0.09, 'triangle', 0.1, 0.03); }, // fully blocked
  poison: () => { tone(340, 0.11, 'sine', 0.12); tone(270, 0.11, 'sine', 0.12, 0.09); tone(210, 0.16, 'sine', 0.13, 0.18); }, // bubbly downward
  debuff: () => { tone(420, 0.12, 'sawtooth', 0.1); tone(300, 0.14, 'sawtooth', 0.1, 0.09); tone(210, 0.18, 'sawtooth', 0.1, 0.19); },
  powerUp: () => { [262, 330, 392, 523].forEach((f, i) => tone(f, 0.11, 'triangle', 0.13, i * 0.06)); }, // power comes online
  sparkle: () => { [1047, 1319, 1568].forEach((f, i) => tone(f, 0.07, 'sine', 0.09, i * 0.04)); },    // draw / energy
  pop: () => { tone(520, 0.05, 'square', 0.16); tone(260, 0.09, 'sine', 0.12, 0.03); },               // diaper floats/pops
  boom: () => { tone(90, 0.35, 'sawtooth', 0.2); tone(55, 0.5, 'sine', 0.18, 0.05); tone(180, 0.15, 'square', 0.1, 0.02); }, // BLOWOUT / huge hit

  // ---- going down (Sun 2026-08-02) ----
  // A defeat needs its own voice: a hit that kills should not sound like a hit that
  // only hurts. Downward wobble, air going out of it.
  defeat: () => { [440, 330, 247, 165].forEach((f, i) => tone(f, 0.16, 'triangle', 0.13, i * 0.075)); tone(70, 0.34, 'sine', 0.14, 0.2); },
  // The boss going down: a long collapse with a real thud under it.
  bossDefeat: () => {
    [523, 392, 294, 220, 165, 110].forEach((f, i) => tone(f, 0.22, 'sawtooth', 0.13, i * 0.11));
    tone(80, 0.7, 'sine', 0.22, 0.5);
    tone(55, 0.9, 'sine', 0.18, 0.62);
    tone(200, 0.3, 'square', 0.09, 0.55);
  },

  // ---- RL4 voices ----
  flush: () => { gust(0.9, 0.2); [880, 660, 520, 390, 300].forEach((f, i) => tone(f, 0.12, 'sine', 0.12, i * 0.06)); tone(120, 0.4, 'sine', 0.14, 0.2); },
  squish: () => { tone(220, 0.09, 'sine', 0.16); tone(330, 0.12, 'sine', 0.12, 0.06); },
  coin: () => { tone(1319, 0.06, 'square', 0.07); tone(1760, 0.09, 'square', 0.07, 0.05); },
  clang: () => { tone(880, 0.07, 'square', 0.12); tone(1240, 0.12, 'triangle', 0.1, 0.02); tone(140, 0.2, 'sawtooth', 0.1, 0.02); },
  sass: () => { tone(520, 0.1, 'triangle', 0.12); tone(390, 0.18, 'triangle', 0.12, 0.1); },
  zoom: () => { [400, 600, 900].forEach((f, i) => tone(f, 0.05, 'sawtooth', 0.07, i * 0.03)); },
  reelTick: (i = 0) => tone(700 + (i % 3) * 120, 0.03, 'square', 0.06),                                // a Jackpot reel ticking by
  reelStop: () => { tone(330, 0.08, 'square', 0.12); tone(165, 0.12, 'triangle', 0.1, 0.03); },       // a reel thunks into place
  jackpot: () => { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.12, 'square', 0.1, i * 0.07)); [1047, 1319, 1568].forEach((f, i) => tone(f, 0.25, 'triangle', 0.1, 0.5 + i * 0.12)); },
  wahwah: () => { [392, 370, 349, 294].forEach((f, i) => tone(f, i === 3 ? 0.5 : 0.22, 'sawtooth', 0.08, i * 0.24)); },
  crunch: () => { gust(0.18, 0.22); tone(140, 0.08, 'square', 0.12); gust(0.14, 0.18, 0.12); },
  shieldUp: () => { tone(660, 0.1, 'triangle', 0.12); tone(990, 0.16, 'triangle', 0.1, 0.06); },

  // low-HP danger pulse: two soft thumps, once per turn (Sun 2026-08-02)
  heartbeat: () => { tone(55, 0.12, 'sine', 0.2); tone(48, 0.18, 'sine', 0.16, 0.18); },

  // ---- blown away (Sun 2026-08-02) ----
  // Leaving is not losing: wind, not a thud. The big version is the Passing
  // Squall's whole-sky exhale as it finally lets go.
  whoosh: (big = false) => {
    gust(big ? 1.1 : 0.5, big ? 0.26 : 0.16);
    if (big) { gust(0.8, 0.13, 0.25); tone(180, 0.5, 'sine', 0.06, 0.1); }
  },
};

// Rolfe Legends 5 — world map generator (pure, seeded). 10 floors + the boss.
// RL4's non-crossing path-walk graph with a FIXED floor schedule, so every path
// meets the quotas (DESIGN.md §4) and still offers real choices:
//   F1–F3 fight · F4 shop · F5 fight-or-treasure · F6 THE JACKPOT · F7 treasure-or-fight ·
//   F8 mini boss · F9 fight · F10 rest · F11 boss.
// Every path: ≥4 normal fights, exactly 1 mini boss, 1 shop, 1 treasure, exactly 1
// Jackpot (Wyatt: "you get the jackpot once per world"), rest on F10.

import { makeRng } from './rng.js';

export const MAP_FLOORS = 11;   // boss floor
export const MAP_COLS = 4;
export const REST_FLOOR = 10;
export const JACKPOT_FLOOR = 6;
export const BOSS_ID = 'boss';
const WALKS = 6;

const SCHEDULE = {
  1: ['fight'], 2: ['fight'], 3: ['fight'], 4: ['shop'], 5: ['pair'],
  6: ['jackpot'], 7: ['pair'], 8: ['elite'], 9: ['fight'], 10: ['rest'],
};

export function generateWorldMap(seed, world) {
  for (let salt = 0; salt < 80; salt++) {
    const m = buildMap(seed, world, salt);
    if (validateMap(m).length === 0) return m;
  }
  return buildMap(seed, world, 0);
}

function buildMap(seed, world, salt) {
  const rng = makeRng((seed ^ Math.imul(world + 17, 0x9E3779B9) ^ Math.imul(salt, 0x85EBCA6B)) >>> 0);
  const nodeSet = new Set();
  const edgeSet = new Set();
  const starts = [];
  for (let w = 0; w < WALKS; w++) {
    let c = rng.int(MAP_COLS);
    if (w === 1) { let g = 8; while (c === starts[0] && g-- > 0) c = rng.int(MAP_COLS); }
    starts.push(c);
    nodeSet.add(`1-${c}`);
    for (let f = 1; f < REST_FLOOR; f++) {
      const nc = Math.max(0, Math.min(MAP_COLS - 1, c + rng.int(3) - 1));
      nodeSet.add(`${f + 1}-${nc}`);
      edgeSet.add(`${f}-${c}>${f + 1}-${nc}`);
      c = nc;
    }
  }
  const edges = {};
  const addEdge = (a, b) => { (edges[a] || (edges[a] = [])).includes(b) || edges[a].push(b); };
  // planarize each floor transition (re-pair sorted froms with sorted tos)
  for (let f = 1; f < REST_FLOOR; f++) {
    const pairs = [...edgeSet].map((s) => s.split('>')).filter(([a]) => Number(a.split('-')[0]) === f);
    const froms = pairs.map(([a]) => Number(a.split('-')[1])).sort((x, y) => x - y);
    const tos = pairs.map(([, b]) => Number(b.split('-')[1])).sort((x, y) => x - y);
    for (let i = 0; i < froms.length; i++) addEdge(`${f}-${froms[i]}`, `${f + 1}-${tos[i]}`);
  }
  const nodes = {};
  for (const id of nodeSet) { const [f, c] = id.split('-').map(Number); nodes[id] = { f, c, type: 'fight' }; }
  for (const id of Object.keys(nodes)) if (nodes[id].f === REST_FLOOR) addEdge(id, BOSS_ID);
  nodes[BOSS_ID] = { f: MAP_FLOORS, c: (MAP_COLS - 1) / 2, type: 'boss' };
  const byFloor = (f) => Object.keys(nodes).filter((id) => nodes[id].f === f).sort((a, b) => nodes[a].c - nodes[b].c);
  // F5 and F7 are a "pair" floor: each node is a fight or a treasure. A node's type on
  // F7 is the opposite of every F5 node that leads into it, so every path gets exactly
  // one treasure and one extra fight across the two floors.
  for (let f = 1; f <= REST_FLOOR; f++) {
    const ids = byFloor(f);
    const opt = SCHEDULE[f][0];
    if (opt !== 'pair') { for (const id of ids) nodes[id].type = opt; continue; }
    if (f === 5) {
      const shuffled = rng.shuffle(ids);
      shuffled.forEach((id, i) => { nodes[id].type = i % 2 === 0 ? 'treasure' : 'fight'; });
    }
  }
  // F7 depends on the F5 node upstream (through the single F6 Jackpot step)
  const upstream5 = (id7) => {
    const ups = new Set();
    for (const id5 of byFloor(5)) for (const id6 of edges[id5] || []) if ((edges[id6] || []).includes(id7)) ups.add(nodes[id5].type);
    return [...ups];
  };
  for (const id of byFloor(7)) {
    const ups = upstream5(id);
    nodes[id].type = ups.length === 1 && ups[0] === 'treasure' ? 'fight' : (ups.length === 1 ? 'treasure' : 'mixed');
  }
  const floors = [];
  for (let f = 1; f <= MAP_FLOORS; f++) floors[f] = f === MAP_FLOORS ? [BOSS_ID] : byFloor(f);
  return { world, nodes, edges, floors };
}

export function reachableIds(map, pos) {
  if (!pos) return map.floors[1];
  return map.edges[pos] || [];
}

// every start→boss path (tests + the harness path-quota check)
export function allPaths(map) {
  const out = [];
  const walk = (id, path) => {
    const p = [...path, id];
    if (id === BOSS_ID) { out.push(p); return; }
    for (const n of map.edges[id] || []) walk(n, p);
  };
  for (const s of map.floors[1]) walk(s, []);
  return out;
}

export function validateMap(map) {
  const problems = [];
  const paths = allPaths(map);
  if (!paths.length) problems.push('no paths');
  const covered = new Set(paths.flat());
  for (const id of Object.keys(map.nodes)) if (!covered.has(id)) problems.push(`${id} not on any path`);
  for (const id of Object.keys(map.nodes)) if (map.nodes[id].type === 'mixed') problems.push(`${id} mixed`);
  for (const p of paths) {
    const t = p.map((id) => map.nodes[id].type);
    const n = (k) => t.filter((x) => x === k).length;
    if (n('fight') < 4) problems.push(`path too few fights: ${t.join(',')}`);
    if (n('elite') !== 1) problems.push(`path elites ${n('elite')}`);
    if (n('shop') !== 1) problems.push('path shop count');
    if (n('treasure') !== 1) problems.push(`path treasure count ${n('treasure')}`);
    if (n('jackpot') !== 1) problems.push('path jackpot count');
    const ji = p.findIndex((id) => map.nodes[id].type === 'jackpot');
    if (ji >= 0 && (map.nodes[p[ji]].f < 4 || map.nodes[p[ji]].f > 7)) problems.push('jackpot floor');
    if (map.nodes[p[p.length - 2]].type !== 'rest') problems.push('no rest before boss');
  }
  // non-crossing edges
  for (let f = 1; f < MAP_FLOORS; f++) {
    const es = [];
    for (const id of map.floors[f] || []) for (const to of map.edges[id] || []) if (to !== BOSS_ID) es.push([map.nodes[id].c, map.nodes[to].c]);
    for (const [a, b] of es) for (const [x, y] of es) if (a < x && b > y) problems.push(`crossing edges on floor ${f}`);
  }
  return problems;
}

# Rolfe Legends 5: The Crops Attack

A Slay-the-Spire-style card game designed by Wyatt (10) on Sat 2026-11-07 and built the same day by James with Hugo, an AI assistant. When Aunt Savanah's car rumbles away at the end of Rolfe Legends 4, the soil wiggles, the crops get mad, and they sprout up and attack the farm. Three heroes (**Wyatt the Speedy**, **Aaron the Strong**, **Liam the Reader**) fight through **Corn World**, **Tomato World**, and **Onion World** to the Mega Corn, the Ripe Tomato, and the Huge Onion. Each world has a free **Jackpot**: three cousins win the Cousin Card, three crops start a fight, and a mixed spin gives you a Cactus.

- **Play: <https://jmoranii.github.io/rolfe-legends-5/>** (works offline after the first visit; Settings → 📲 adds it to a tablet's home screen). Local: `python3 -m http.server 8210` in this folder → <http://localhost:8210>
- Design: [DESIGN.md](DESIGN.md) · build rules: [CLAUDE.md](CLAUDE.md) · plan: [GOAL.md](GOAL.md) · status: [PROGRESS.md](PROGRESS.md) · review list: [REVIEW.md](REVIEW.md)
- Tests: `node test/test.mjs` (rules) · `node test/selfplay.mjs 150` (balance: simulated runs with a bot per hero) · `node test/e2e.mjs` (real UI in Chromium and WebKit) · `node tools/art_audit.mjs` (every art/music hook present)
- Art: `python3 tools/art.py run` (gpt-image) → `python3 tools/optimize_art.py` · music: `assets/gen-music.sh` (Suno)

Vanilla HTML/CSS/JS, no build step, no server.

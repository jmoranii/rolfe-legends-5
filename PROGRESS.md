# PROGRESS — Rolfe Legends 5

## Sat 2026-11-07 — built to the Definition of done (local only; publish is James's)

- **Phase 0–3:** RL4 engine stripped and rebuilt for the crops: three hero mechanics (Touches, Tractor Gears, Book Meter → BOOK STORM!), the Jackpot (45/45/10, Cousin Card, Veggie Medley, Cactus), saved cards, Teary / Grabbed / Stinky / Burning, Heat / Ripeness / onion-layer bosses, three worlds, Harvest Levels 1–10, Wyatt's opening, the ending.
- **Phase 4 (balance, 720 runs):** Wyatt 20.0% · Aaron 20.8% · Liam 22.9% (rails 17–27) · Jackpot spin 23.6% vs walk 18.9% · hoarding vs normal within 5 pts · every big boss harder than its mini boss · median turns fight 3 / mini boss 6 / boss 8 · est. run ~31 min · RAILS: ALL CLEAR. Harvest ladder: HL3 ~10%, HL5 ~5%, HL10 ~1%.
- **Phase 5 (art):** 157 / 157 paintings on the codex backend, 0 failures, 0 moderation blocks; Coach James's portrait reused from RL4. Optimized web set 23.2 MB. Every painting reviewed on contact sheets: no logos or text, Liam fully clothed throughout.
- **Phase 6 (music):** 12 Suno tracks (take 1), 12 downloads spent per James's call; the ending song "The Crops Attack" has word-level timing (32 lines) and the credits derive portrait beats from it. No ending music video this round (the in-engine karaoke credits are the ending).
- **Phase 7:** offline service worker (`rolfe-legends-5-v2`, sibling caches safe), PWA manifest, Farm/Save Code, wake lock, phone layout.
- **Tests:** 1093 unit · selfplay rails all clear · e2e 132/132 in Chromium AND WebKit.

## Not done / known gaps

- No secret (James's call).
- No ending music video (RL4 made one with the music-video skill); the synced karaoke credits play instead.
- Treasure icons are painted but treasure pins on the map/combat belt still show emoji (only the treasure pop-up uses the painting).

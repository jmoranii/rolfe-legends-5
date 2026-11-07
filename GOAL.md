# GOAL: Build Rolfe Legends 5: The Crops Attack — the whole game, autonomously

> **STATUS: LIVE** (Sat 2026-11-07). James: "let's go ahead and start building it now," to Wyatt's specifications. One autonomous pass, the entire game: three worlds, the Jackpot, art, music, scenes, and the ending, to shippable quality. **Publishing is James's** (Phase 8).

You are working in `~/code/rolfe-legends-5`. Read `CLAUDE.md` (constitution + content rules) and `DESIGN.md` (the design with numbers and credits) first; they override this file on conflict. Goal: phases 0–7 below, to the Definition of done. **Never push to a remote or deploy anywhere.**

## What's different from RL4's goal run

1. **The chassis is RL4, already copied in.** This repo is `~/code/rolfe-legends-4` minus its git history, art, music, and docs. Phase 0 strips RL4's content and RL4-only systems (pets, Arena, stickers, visitors, Sass, Tea Party Rules, Squishy, Nuh-Uh Shield, Momentum, Big Hammer, Potty meter, world card skins), renames everything to RL5 (`rl5_*` keys, `rolfe-legends-5-v1` cache, titles, manifest), and gets an empty-but-green game.
2. **No-port test widens to RL4:** no card, enemy, treasure, status, or event name in RL5 may match one in `~/code/rolfe-legends{,-2,-3,-4}/js/*.js`, except the callbacks listed in DESIGN.md §11 (hero names, cousin names, Goldie).
3. **New systems are the headline:** the Jackpot (DESIGN.md §5), the Cousin Card, the Cactus, saved cards (§4), and three new hero mechanics (§3). Each gets a unit test suite and a harness strategy before balance numbers count.
4. **Harder than RL4:** the boys beat RL4 and asked for harder. Rails below.

## Non-negotiable ground rules

1. **Green before every commit:** `node test/test.mjs` + `node test/selfplay.mjs 150` + e2e (Chromium and WebKit). Never commit red. Granular commits, clear messages.
2. **Content rules in CLAUDE.md hold absolutely.**
3. **Anything needing James's judgment → REVIEW.md**, then keep going: dialogue, lyrics, art you're unsure of, any design deviation (quote Wyatt's original), anything cut. Best call now, log it, never block.
4. **Keep PROGRESS.md current every commit:** phase, done, next, harness numbers, rubric grades.
5. **Harness fidelity is a rail:** a mechanic's numbers don't count until the bot genuinely plays it. The harness refuses non-numeric or zero run counts.
6. **Art on the codex backend** ($0 marginal; burns plan limits 3–5×; ~1–2 min/image): 3 lanes in parallel, each call wrapped in `perl -e 'alarm 420; exec @ARGV'`, **on exit 4 (usage window exhausted) pause art, keep building, resume when it resets; never switch backends.** RL4 hit a race in the image tool's parallel mode that saved paintings from the wrong job: give every lane its own output path and audit job → file at the end. Normalize sizes in the optimize pass. Likeness-critical art first (hero portraits, the Cousin Card, the opening scene), card art last.

## Phase 0 — Strip and rename

Strip RL4 content and systems (list above), keep the engine, map generator, rng, save + Farm Code, music/prefetch/credits, sw.js (namespaced, its unit test kept), e2e rig, harness skeleton. Rename to RL5 everywhere. Widen the no-port test. Everything green with placeholder content before real content lands. Commit.

## Phase 1 — Combat core + heroes

- Effects: Strong, Weak, Bruised, Teary (blurred cards still playable; clears end of turn), Grabbed (card locked this turn), Stinky (fight-only junk), Burning. Tap-to-explain chips + a one-time teaching pop-up each.
- Hero mechanics, always on screen: **Touches** (soccer-ball row, max 5, SHOT spends all), **Tractor Gears** (gear stick 1–3, +2 attack/+2 block per gear above 1, Downshift bursts), **Book Meter** (4 pages; full → BOOK STORM! into hand: 0⚡, 15 to every enemy, used up; meter resets; empties after each fight). Liam's design is Wyatt's and is exact.
- Starter decks, starter treasures, and 15-card pools per DESIGN.md §3 (the build finalizes card names and numbers; every card names its inspiration).
- **Saved cards** (DESIGN.md §4): the hand at the moment a fight ends starts the next fight in hand, before the normal draw of 5 (cap 10). Never saved: the Cousin Card, Stinky, BOOK STORM!.
- **Guard tests:** no infinite turn (search-based: adversarial hands/treasures, a single turn terminates within N plays) · saved cards never duplicate a card (uids unique across draw/hand/discard) · the Cousin Card can appear at most once per fight · Teary never changes what a card does · nothing changes mid-turn.

## Phase 2 — The run + the Jackpot

- 3 worlds × (intro scene → 10-floor branching map → boss); every path has the stops listed in DESIGN.md §4, including **exactly one Jackpot between floors 4 and 7** (map invariant test). Post-boss heal 50% of missing HP + Boss Treasure pick. Auto-save every node.
- **The Jackpot (`js/jackpot.js`, pure):** seeded outcome first (45% cousins / 45% crops / 10% mixed), then the reel faces; one free spin; walk-past allowed; once per world. Cousins → Cousin Card for the rest of the world; crops → the Veggie Medley fight (rare card + bonus coins on a win); mixed → the Cactus (thorns 1) for the rest of the world. Both the Cousin Card and the Cactus leave when that world's boss is beaten. Unit tests: odds within ±2% over 100k seeded spins, once-per-world, leave-on-boss, Cousin Card once per fight, Delilah's cancel really cancels exactly the targeted enemy's next attack and shows it on the intent.
- Shop (Grampa Flaj's Seed Shed: cards, removal, treasures), rest (Mom's Snack Break: heal 30% or upgrade), treasure (Goldie's Gate), treasures + boss treasures. Teaching order: one new idea per fight in World 1.

## Phase 3 — Worlds, enemies, bosses, scenes, ending

- All three bestiaries, mini bosses, the Veggie Medley, and bosses per DESIGN.md §6: Mega Corn's Heat Meter + persistent Husk + Kettle Corn; Ripe Tomato's Ripeness Meter + warned SPLAT! + Vine Grab; Huge Onion's three layers (big peel moment each; damage never carries through a break). Every meter is visible and telegraphs.
- Per-world look: CSS world themes (frames, boards, palettes, map styling) + per-world backgrounds.
- **Opening cutscene (Wyatt):** Savanah's car drives the cousins away down the lane → the ground rumbles → the soil wiggles → the crops get mad → they sprout and attack. ≤20 s, skippable, replayable from a Movies menu.
- World intros, the Jackpot slot-machine moment (reels, lever/button, sound, the cousins jumping onto the card on a win), and **the ending** per DESIGN.md §7 (Goldie eats the little onion), victory song with synced lyrics, credits.
- **Harvest Levels 1–10** (DESIGN.md §8).

## Phase 4 — Balance

- Bots that genuinely play each hero mechanic, the Jackpot (spin vs. walk past), the Cousin Card (smart target for the cancel), saved cards (a hoarding strategy and a play-everything strategy), and every boss mechanic.
- **Rails** (all must hold, reported in PROGRESS.md):
  - First-run winrate **~22% per hero (17–27)**, parity within 8 points.
  - **Every world's boss is harder than its mini boss:** lower win rate conditional on reaching it, and more average damage dealt to the hero. Fails the build if not.
  - **Bosses a little harder than RL4's cousins:** each RL5 boss's damage-dealt-to-hero and fight length ≥ the matching RL4 boss's (pull RL4 numbers from `~/code/rolfe-legends-4/test/selfplay.mjs` runs).
  - Regular crops a little stronger than RL4's normals (avg damage to hero per normal fight ≥ RL4's world-matched average).
  - Jackpot: spinning is the better choice on average, but not by more than 10 points of winrate; the Cousin Card alone never lifts a hero's winrate by more than 8 points.
  - Saved cards: no hoarding strategy beats play-everything by more than 5 points; median saved cards per fight reported.
  - Median fight turns: normals 3–6, mini bosses 6–10, bosses 8–14. Every starter deck beats every World-1 normal in >90% of sims. No single encounter >35% of all deaths. Estimated run 35–40 min. Harvest Levels monotonic, HL10 < 10%.

## Phase 5 — Art (gpt-image, codex)

1. **Style gate (self-check, not a stop):** write the base storybook-gouache block (RL1–RL4's) plus three lighting blocks (Corn golden morning, Tomato warm afternoon garden, Onion underground amber/teal). Paint Wyatt's portrait, Liam on his book, one crop enemy per world, and the Cousin Card; check likeness, legibility at phone size, no logos/text, Liam fully clothed. Screenshot into REVIEW.md, adjust, proceed.
2. **Bulk** per DESIGN.md §9 (~140 images). Batch with retries; reroll only clear failures; optimize pass; art-coverage audit (every hook has art, no emoji fallback shows in the smoke tour).

## Phase 6 — Music (suno, take 1 kept)

Tracks per DESIGN.md §10, including the **ending** song with word-level `.lrc` and the Jackpot jingle + win/lose stings. Lyrics → REVIEW.md. Ending video via the vault's music-video skill (`<vault>/.claude/skills/music-video/SKILL.md` + `field-notes.md`) if time allows; in-engine karaoke credits are the fallback and must work offline.

## Phase 7 — Ship hardening

Offline sw (namespaced), per-world predictive prefetch, 128 kbps audio, PWA manifest + A2HS, Farm Code UI, screen wake lock, phone portrait + landscape layouts, full dual-engine e2e (including a scripted full run through all three worlds, a Jackpot of each outcome, and the ending), every-screen smoke screenshots per world into PROGRESS.md.

## Polish floor — acceptance criteria

1. Everything in `~/code/rolfe-legends-4/GOAL.md` §Polish floor that still applies (legibility audit, SLOW & CLEAR default + FAST toggle, sequenced enemy turns, victory beats, nothing invisible, decision support, scene banners, story interstitials, ship plumbing, credits robustness, plain-words cards).
2. **Every meter telegraphs:** Heat, Ripeness, onion layer, Touches, Gear, Book Meter all on screen with their next payoff named.
3. **The Jackpot lands:** the reels feel like a real slot machine; the outcome is unmistakable; the Cousin Card's art matches Wyatt's spec (Stella back, Lucy + Delilah front); the "walk past" choice is clear.
4. **Saved cards are visible:** cards that will carry over glow at fight end ("Saved for next fight!") and arrive with a little flourish.
5. **Teary is fair:** blurred cards keep their cost and frame color; tapping one shows "too teary to read!"; the effect never hides an enemy intent.

## The quality rubric

RL2's eight (solvable turns, real path dilemmas, deck identity by mid-run, escalating power fantasy, paid-for risk, fights end before boring, fairness on screen, runs tell stories) plus: **9. Three heroes, three different games.** **10. The Jackpot is a real decision and a real moment.** **11. Each world feels like a new place** within its first two floors. Grade honestly in PROGRESS.md at each phase end.

## Definition of done

Phases 0–7 complete; polish floor verified; all Phase 4 rails green; unit + selfplay + dual-engine e2e green; art and music for every hook (fallbacks intact); REVIEW.md contains: Gaps & Personalization report, every dialogue/lyric draft, Wyatt-credited deviations (quoted), Hugo's veto list (DESIGN.md "(Hugo)" items), images generated vs planned, and the publish checklist (new public repo `jmoranii/rolfe-legends-5` + Pages, squashed first push as in RL4). Stop there; Phase 8 (publish) is James's.

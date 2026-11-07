# Rolfe Legends 5: The Crops Attack

The fifth Rolfe Legends game, and the third one **co-designed with the boys**. Wyatt (10) pitched it live with James on Sat 2026-11-07 (Aaron, 8, was in the room and passed this round): the crops wake up angry when Aunt Savanah's car rumbles away at the end of RL4, three crop worlds with giant crop bosses, Liam the Reader, and a Jackpot that can win the cousins as helpers. **Their ideas are requirements, not suggestions.**

Read `DESIGN.md` (the design, with numbers and credits) and `GOAL.md` (the build plan and acceptance criteria). DESIGN.md wins on any conflict with this file's summaries; this file's content rules win over everything.

## The one-sentence vision

Three heroes defend the farm through Corn World, Tomato World, and Onion World in one run with one deck, spinning each world's Jackpot for a chance at the three cousins' helper card, until the Huge Onion is peeled down to nothing.

## Pillars (check every decision against these)

1. **The boys' ideas are load-bearing.** Every Wyatt-credited idea in DESIGN.md ships as designed unless James says otherwise. When implementation forces a change, log it in REVIEW.md with his original quoted.
2. **Not a reskin.** RL4's *engine* is the chassis (this repo started as a copy of `~/code/rolfe-legends-4` minus its art, music, and docs). RL1–RL4 *content* is never reused as-is (DESIGN.md §1.2; §11 lists the allowed callbacks). A test enforces the names.
3. **Kid-fair, harder than RL4.** Exact intents on screen, every meter visible, nothing changes mid-turn, no unwinnable spirals. ~22% first-run winrate per hero (rails 17–27). Every big boss is harder than every mini boss.
4. **Every world is a new place.** Look, light, sound, enemies, and skill change per world.
5. **RL4-final is the polish FLOOR.** GOAL.md §Polish floor is acceptance criteria for the first pass.
6. **Durable + frictionless.** Vanilla HTML/CSS/JS, no build step, no server, localStorage (`rl5_*` keys) + Farm Code, offline PWA, hosted at `jmoranii.github.io/rolfe-legends-5/`.
7. **Tested, not hoped.** Unit + selfplay + dual-engine e2e green before every commit. The harness must genuinely play every new mechanic (Touches, Tractor Gears, Book Meter + BOOK STORM!, the Jackpot and Cousin Card, the Cactus, saved cards, Heat/Ripeness meters, Husk block, Grabbed, Teary, Stinky, Burning, onion layers) or its numbers are fiction.

## Hard content rules

- **First names and family nicknames only.** No surnames, birthdates, or real place names beyond "the farm." Grandparents are **Grampa Flaj** and **Grandma Rockie**. Aunt **Savanah** (one n).
- **The cousins are helpers now.** Stella, Lucy, and Delilah are fabulous, squishy, and sassy, never mean. They appear on the Cousin Card and in the opening scene.
- **Crops are funny-angry, never gross or scary for an 8-year-old.** Rotten and stinky stay cartoon (green stink lines, flies optional, no rot gore). Onion "crying" is cartoon tears.
- **Liam the Reader** sits on a giant book holding a book (Wyatt). Always fully clothed in every painting (RL4 rule: put the clothing line in every Liam prompt).
- **Never a curse or status named "Chores."** Chores are never framed as bad (household norm, series canon).
- **Name-brand toys OK** (James, RL4): Stella's Barbie. Don't copy real logos or packaging art (RL4 caught the model painting the Barbie logo into 38 images; prompts must say "no logos, no text").
- **Public posture same as RL1/RL3/RL4** (James): first names and painted likenesses may appear in the public repo and on Pages. **Reference photos are gitignored and never committed.**
- Family dialogue, crop lines, and all lyrics are drafted, shipped, and listed in REVIEW.md for James's pass.
- **Secrets:** none specified. Do not invent one. Whether RL5 has a secret is James's call, made out of the boys' hearing.

## Cast

- **Heroes:** Wyatt the Speedy (Touches) · Aaron the Strong (Tractor Gears) · **Liam the Reader** (Book Meter → BOOK STORM!).
- **Bosses:** the Mega Corn (World 1) · the Ripe Tomato (World 2) · the Huge Onion (World 3, final).
- **Mini bosses:** the Cornstalk · the Rotten Tomato · the Bruised Onion.
- **Jackpot cast:** Stella, Lucy, Delilah (the Cousin Card); the Veggie Medley (the all-crops fight); the Cactus.
- **Map stops:** Grampa Flaj's Seed Shed (shop) · Mom's Snack Break (rest) · Goldie's Gate (treasure).
- **Opening cast:** Aunt Savanah's shiny gray car, the cousins in it, the tree-lined lane, the farm.

## Reference photos (gitignored)

`assets/ref-photos/`: `wyatt.png`, `aaron.png`, `liam-recent-1.png` + `liam-recent-2.png` (use these for Liam; `liam.png` is older), `stella.jpg` + `stella-face-bday.jpg`, `lucy.jpg` + `lucy-face-xmas.jpg`, `delilah.jpg`, `savannah.jpg`, `savannah-family.jpg`, `girls-family.jpg`, `llama.jpeg` (Goldie), `tory.png` (Mom), `jacob.png` (Dad), `sean.png` (Grampa Flaj), `kim.png` (Grandma Rockie). Kept copies live in James's notes vault people library (`media/people/`); file any new photo there too.

## Conventions

- Stack: HTML5 + CSS3 + vanilla JS ES modules, zero dependencies, no build.
- Pure logic (no DOM): `js/combat.js`, `js/run.js`, `js/rng.js`, `js/map.js`, `js/jackpot.js` · data: `js/cards.js`, `js/enemies.js`, `js/treasures.js`, `js/worlds.js` · render: `js/game.js`.
- Every card and enemy names its inspiration in a code comment (StS1/StS2/original/Wyatt).
- Tests: `node test/test.mjs` + `node test/selfplay.mjs <n>` (n numeric > 0; refuses vacuous runs) + Playwright e2e in Chromium AND WebKit. **Pin playwright 1.60.0** (this Mac's frozen WebKit hangs on newer).
- Service worker: `CACHE = 'rolfe-legends-5-vN'`; activate deletes only this game's own caches (the shared-origin fix; keep its unit test).
- Art: `gpt-image` CLI, **codex backend** (James's ChatGPT subscription). Emoji fallback always; PNGs drop in with no code changes.
- Music: the vault's suno skill (`<vault>/.claude/skills/suno/SKILL.md`), take 1 kept, `.lrc` word timings for songs with lyrics, silence fallback.
- Seeded RNG everywhere in logic; reproducible runs.

## Privacy & publishing

Local git only. **Never push to any remote, never deploy** — publish is James's call (series precedent). Reference photos are never committed or pushed.

# Rolfe Legends 5: The Crops Attack — Design

**Bottom line.** A Slay-the-Spire-style card roguelike: three heroes defend the Rolfe farm through three crop worlds (Corn → Tomato → Onion) in ONE run with ONE deck. The crops woke up angry when Aunt Savanah's car rumbled down the lane at the end of RL4. New this time: a once-per-world **Jackpot** stop that can win the three cousins as a once-per-fight helper card, a **saved-cards** rule (cards left in your hand carry into the next fight), and three new hero mechanics (Wyatt's Touches, Aaron's Tractor Gears, Liam the Reader's Book Meter). Built on RL4's engine; every visible thing is new.

Status: **v1, Sat 2026-11-07**, written from the live co-design session with Wyatt (10) at James's house (Aaron, 8, was there and chose not to pitch this round). Numbers are starting points for the selfplay harness, not final.

Source of the ideas (credit matters: the boys' ideas are requirements):
- **Wyatt:** the title, card game again, the choose-your-path map, crops as the whole enemy cast, three separate worlds (Corn / Tomato / Onion) with the **Mega Corn**, **Ripe Tomato**, and **Huge Onion** as bosses, the mini bosses' names (**Cornstalk**, **Rotten Tomato** (Hugo's name, Wyatt's "sure"), **Bruised Onion**), the opening cutscene (Savanah's car rumbles the soil, the crops get mad and sprout), the heroes (Wyatt the Speedy, Aaron the Strong, **Liam the Reader**, "because he's reading a lot of books now") and Liam's portrait and Book Meter, the whole **Jackpot** (slots, odds, outcomes, once per world, free), the **Cousin Card** and each cousin's power, the **Cactus**, the **saved-cards** rule, "bosses a little harder than the cousins," "regular crops a little stronger than the teacups," and "every big boss harder than every mini boss." No cousin as a playable hero (Wyatt said no).
- **James:** the questions that shaped it; same series posture (public repo, first names, painted likenesses).
- **Hugo:** the boss and mini-boss powers (approved in chat: "I like your boss ideas"), the regular-enemy rosters, Wyatt's and Aaron's mechanics, all numbers, the ending, everything marked *(Hugo)* below. Anything *(Hugo)* is for James and the boys to veto; log vetoes in REVIEW.md.

---

## 1. Pillars

1. **The boys' ideas are load-bearing.** Everything Wyatt designed ships as designed. When implementation forces a change, log it in REVIEW.md with his original words quoted.
2. **Not a reskin.** RL4's *engine* is the chassis (turns, energy, intents, seeded RNG, map generator, save + Farm Code, music/prefetch/credits, sw, harness, e2e rig). RL1–RL4 *content* is never reused as-is: no card, enemy, treasure, status, or event name carried over (a test enforces names against `~/code/rolfe-legends{,-2,-3,-4}/js/*.js`; deliberate callbacks are the exception and are listed in §11). RL4's pets, Arena, stickers, family visitors, Sass, Tea Party Rules, Squishy, Momentum, Big Hammer, and Potty meter are all removed.
3. **Kid-fair, harder than RL4.** Exact intents on screen, every meter visible, nothing changes mid-turn, no unwinnable spirals. The boys beat RL4 (shipped ~28% first-run winrate) and asked for harder: target **~22% first-run winrate per hero (rails 17–27)**.
4. **Every world is a new place.** Look, sound, enemies, and its boss's signature skill change per world.
5. **RL4-final is the polish FLOOR** (GOAL.md §Polish floor).
6. **Durable + frictionless.** Vanilla HTML/CSS/JS, no build, no server, `rl5_*` localStorage keys + Farm Code, offline PWA, hosted at `jmoranii.github.io/rolfe-legends-5/` (the parental-controls-approved origin).
7. **Tested, not hoped.** Unit + selfplay + dual-engine e2e green before every commit; the harness genuinely plays every new mechanic.

## 2. Core combat (kept StS rules)

- **3 ⚡ per turn, draw 5**, block disappears at the start of your turn, every enemy intent shows exact numbers. Hand cap 10.
- Pick 1 of 3 cards after fights (skip allowed). Upgrades at rest spots (+ = bigger numbers only).
- Hero HP 60–76; enemy hits 3–35.

### Effects (plain words; the whole game has these)

| Effect | Plain-words text | StS original |
|---|---|---|
| **Strong** | Your attacks deal +1 damage per Strong. | Strength |
| **Weak** | Deals 25% less attack damage. Goes down by 1 each turn. | Weak |
| **Bruised** | Takes 50% more attack damage. Goes down by 1 each turn. | Vulnerable |
| **Teary** *(Onion World)* | N cards in your hand are blurry: you can't read them, but you can still play them. Clears at the end of your turn. | Original (StS2 hidden-info flavor) |
| **Grabbed** *(Tomato World)* | This card is wrapped in a vine: it can't be played this turn. | StS2 card lock |
| **Stinky** *(junk card)* | Can't be played. Gone after the fight. | StS Dazed (fight-only) |
| **Burning** *(Hot Pepper)* | Lose N HP at the end of your turn, then N goes down by 1. | StS poison, on you |

Every effect has a tap-to-explain chip and a one-time teaching pop-up the first time it appears.

## 3. Heroes

Each: starter deck of 10, starter treasure, reward pool of 15 (6 common / 6 uncommon / 3 rare). Every card names its inspiration in a code comment. Names below are first drafts; the build may rename for clarity, never the hero names.

### ⚽ Wyatt the Speedy — 66 HP — mechanic: **Touches** *(Hugo)*

Soccer dribbling. **Dribble** cards add Touches (shown as soccer balls, max 5; they last all fight). **SHOT** cards spend ALL your Touches for +4 damage each. Two ways to play: wind up one huge shot, or keep passing for steady small hits that each add a Touch.
- Starter treasure — **Shin Guards:** start each fight with 1 Touch.
- Starter (10): 4× **Pass** (1⚡ deal 6, +1 Touch) · 4× **Juke Left** (1⚡ 5 block) · 1× **Toe Tap** (0⚡ +2 Touches, exhaust) · 1× **Power Shot** (1⚡ SHOT: deal 4 + 4 per Touch).
- Pool ideas: Give-and-Go (draw 1, +1 Touch), Bicycle Kick (SHOT to ALL enemies), Corner Kick (2⚡ SHOT, Bruised 1), Dribble Past (8 block, +1 Touch), Header (deal 5 twice), Hat Trick 2 (rare power: SHOTs don't spend 1 Touch), Fast Break (Touches don't cap at 5 this fight), etc. Need one AoE in commons.

### 🚜 Aaron the Strong — 76 HP — mechanic: **Tractor Gears** *(Hugo)*

Aaron drives the farm tractor into battle. He starts every fight in **Gear 1** (a gear stick on screen, Gears 1–3). **Shift Up** cards raise the gear; every gear above 1 adds **+2 to his attacks and +2 to his block cards**. **Downshift** cards drop back to Gear 1 for a big burst sized by the gears dropped. Two ways to play: stay in Gear 3 and grind, or rev and dump.
- Starter treasure — **Tractor Keys:** the first time you Shift Up each fight, draw 1.
- Starter (10): 4× **Plow** (1⚡ deal 6) · 4× **Hay Bale** (1⚡ 5 block) · 1× **Shift Up** (1⚡ +1 Gear, 3 block) · 1× **Hay Bale Launch** (2⚡ Downshift: deal 6 + 8 per gear dropped).
- Pool ideas: Rev It (0⚡ +1 Gear, exhaust), Full Throttle (power: start fights in Gear 2), Mud Spray (5 to ALL), Big Wheels (block = 4 × Gear), Tow Hitch, Hay Wagon, Last Furrow (rare: Downshift, hit ALL).

### 📚 Liam the Reader — 60 HP — mechanic: **the Book Meter** (Wyatt)

Wyatt's design, exactly: Liam has a **Book** card; every time he reads it, his **Book Meter** fills; when the meter is full he gets a special card that **throws books at every enemy for 15 damage**.
- **Book Meter: 4 pages** *(Hugo number)*. **Read a Book** (starter, 2 copies): 1⚡, draw 1 card, +1 page. Some pool cards add pages too.
- **Full meter → "BOOK STORM!"** goes into Liam's hand: 0⚡, deal 15 to EVERY enemy, used up. Meter resets to 0 and can fill again. Meter empties at the end of each fight.
- Portrait (Wyatt): **Liam sitting on a giant book, holding a book.** Always fully clothed (RL4 rule).
- Starter treasure — **Library Card:** start each fight with 1 page.
- Starter (10): 3× **Bonk with a Book** (1⚡ deal 6) · 3× **Hide Behind a Book** (1⚡ 5 block) · 2× **Read a Book** · 1× **Bookmark** (0⚡ +1 page, keep this card in hand at turn end) · 1× **Big Words** (1⚡ deal 4, Weak 1).
- Pool ideas: Story Time (+2 pages), Pop-Up Book (block 8, +1 page), Library Day (power: BOOK STORM deals +5), The End (rare: fill the meter now), Sequel (rare: your next BOOK STORM happens twice), Dinosaur Book (deal 10), Space Book (deal 3 to ALL twice).

## 4. The run

- **3 worlds, one deck, one run**: Corn World → Tomato World → Onion World. Each world: a short intro scene, a **10-floor branching map + boss**. Run target 35–40 min.
- **Every path** has: floor-1 fight, ≥4 normal fights, 1 mini-boss fight (never before floor 4), 1 shop, 1 treasure, **1 Jackpot**, rest on floor 10. *(Hugo: the Jackpot sits on every path between floors 4 and 7, so every world gives exactly one chance; "you get the jackpot once per world.")*
- **After each boss:** heal 50% of missing HP *(Hugo; RL4 healed to full and the boys asked for harder)* and pick 1 of 3 Boss Treasures. Rest spots heal 30% of max HP.
- Coins from fights; shop sells cards, a card removal, and treasures. No pets, Arena, or stickers.
- Saves: auto-save every node; `rl5_*` keys; Farm Code.

### Map stops (who's there) *(Hugo; boys may swap)*

- **Shop — Grampa Flaj's Seed Shed.** · **Rest — Mom's Snack Break** (heal, or Practice to upgrade). · **Treasure — Goldie's Gate** (Goldie the llama "found" it). · **Jackpot — the Jackpot.** · Fights, mini boss, boss.

### Saved cards (Wyatt)

- **Cards still in your hand when a fight ends go back into your hand at the start of the next fight.** At the next fight's start they're in hand first, then you draw 5 as usual (hand cap 10). The Cousin Card is never saved (§5).
- *(Hugo)* Junk (Stinky) and BOOK STORM! are never saved. Harness rail: average saved cards per fight and their winrate effect are reported; if hoarding dominates, the fix is a saved-card cap (log in REVIEW.md), never removing the rule.

## 5. The Jackpot (Wyatt's design, exact)

- A stop on the map, **once per world, free, one spin**. You may walk past without spinning ("it's a chance if you want it or not").
- **Three slots, two faces each:** Slot 1 **Stella or Corn** · Slot 2 **Lucy or Tomato** · Slot 3 **Delilah or Onion**.
- **Odds: 45% all three cousins · 45% all three crops · 10% mixed.** (Implementation: pick the outcome first with the seeded RNG, then animate the reels to it; for "mixed," pick a random non-uniform face combination.)
- **All three cousins → the Cousin Card.**
  - Art (Wyatt): **Stella in the back, Lucy and Delilah in the front.**
  - Tap it and all three act at once: **Stella hands you a Barbie → you gain Strong** · **Lucy squishes an enemy → it's Weak** · **Delilah says "Nuh-uh!" → cancels that enemy's next attack** (its intent turns into a "Nuh-uh!" bubble and does nothing). *(Hugo numbers: 0⚡, Strong 2 for the fight, Weak 2, cancel one intent. Targeted.)*
  - It appears in your hand at the start of **every fight** for the rest of that world. **Once per fight, never twice** (it's used up when played; it can't be saved, copied, or drawn twice).
  - It **leaves when you beat that world's boss**. The next world's Jackpot is the chance to win it back.
- **All three crops → a crop character jumps out and you fight it.** *(Hugo: **the Veggie Medley**, a jackpot-only fight: a Corn, a Tomato, and an Onion fused into one wobbly salad monster, mini-boss strength for that world; beating it pays a rare card choice and bonus coins.)*
- **Mixed → the Cactus treasure.** Every time an enemy attack hits you, the Cactus pokes that enemy for 1 (StS Bronze Scales at 1). It **leaves with the world boss** too.

## 6. The worlds

Each world tests one skill. Numbers are v1 starting points; the harness tunes them. **Rails: every big boss is harder than every mini boss in its world** (lower win rate conditional on reaching it, higher damage dealt); regular crops are a little stronger than RL4's (RL4 world-3 normals: 32–36 HP, hits ~7; RL5 normals start ~35–45 HP, hits ~8–10).

### 🌽 World 1 — Corn World (golden cornfield, morning) — skill: *plan ahead and block before the big hit*

- Normals: **Mini Corn** (kernel hits 3 × 3) · **Soybean Pods** (a group of 3, ~14 HP each, hit 4) · **Pumpkin Roller** (rolls for ~16 every other turn) · **Popcorn Puff** (summon only: 8 HP, hit 3).
- Mini boss — **the Cornstalk** (~80 HP): Swat 12 · Corn Drop (Mini Corns fall off and join, max 2) · Deep Roots (regrows 5 block every turn).
- **BOSS — the Mega Corn** (190 HP): Kernel Spray (5 × 3) · Husk Up (15 block that does NOT expire until broken) · **Heat Meter** rises 1 each turn, shown; at 3: **POP!** hits for 30 and 2 Popcorn Puffs jump out, then the meter resets · at half HP becomes **Kettle Corn** (heats 2 per turn).

### 🍅 World 2 — Tomato World (a giant tomato garden in the afternoon) — skill: *big hits beat lots of little ones*

- Normals: **Mini Tomato** · **Cherry Tomato Bunch** (many small ones) · **Hot Pepper** (each hit adds Burning) · *(Hugo may add one more: e.g., Strawberry Patch, Zucchini Bat)*.
- Mini boss — **the Rotten Tomato** (~90 HP): Rotten Splat (10 + Weak 1) · Stinky Cloud every few turns (your next card costs 1 more) · bursts on death for a small splash (have block).
- **BOSS — the Ripe Tomato** (320 HP): **Ripeness Meter**: each hit you land makes it 1 riper, and each ripeness adds +1 to its attacks · Vine Grab (one of your cards is Grabbed next turn) · Cherry Toss (2 Cherry Tomatoes that splash you when popped) · fully ripe (10): warns a turn early, then **SPLAT!** for 35 and goes back to green · at half HP, Vine Grab grabs 2 cards.

### 🧅 World 3 — Onion World (underground, where root crops grow; evening light through the roots) — skill: *keep fighting when you can't see everything*

- Normals: **Mini Onion** (makes you Teary) · **Carrot Drill** (burrowed, can't be hit every other turn) · **Radish Twins** · **Couch Potato** (a big blocker).
- Mini boss — **the Bruised Onion** (~100 HP): gets 1 angrier (+1 damage) every time you hit it · Grumpy Tears (Teary 1) · Bruised Spot (the first hit each turn does +5).
- **BOSS — the Huge Onion** (final, 3 layers, 480 HP total): **Layer 1 Papery Skin** (180): hits 14 + Teary 1 · **Layer 2 Stinky Layer** (160): 9 × 2 and Onion Breath (a Stinky junk card) · **Layer 3 the Heart of the Onion** (140): hits 22 → 28 alternating, calls Baby Onions (12 HP, Teary on hit). Layers peel with a big moment each; damage never carries through a layer break.

## 7. Story and scenes

- **Opening (Wyatt):** picks up exactly where RL4's ending stopped: Aunt Savanah's shiny gray car drives the cousins away down the tree-lined lane, the ground rumbles, the soil wiggles, the crops get mad, and they **sprout up and attack**. Stills + CSS animation + sound, ≤20 s, skippable, replayable from Movies.
- **World intros:** a short scene per world (into the corn rows; the giant tomato garden; down a burrow into Onion World).
- **The Jackpot scene:** a real slot-machine moment: three reels, sound, a lever or button, a big reveal; the three cousins jump onto the Cousin Card on a win.
- **The ending** *(Hugo, for veto):* the Huge Onion's last layer peels and it shrinks to a normal little onion; the crops settle back into the soil; the hero stands on the farm (barn, Goldie in her fence, grain bins, the house, trees). Goldie leans over the fence and eats the little onion ("Goldie says nothing. Goldie knows."). Victory song with word-synced lyrics, then credits. The ending video follows the vault's music-video skill if time allows; the in-engine karaoke credits are the fallback.

## 8. Ascension — Harvest Levels 1–10 *(Hugo)*

Unlocked after the first win; one stacking modifier each (enemy HP, mini-boss damage, boss HP, less post-boss healing, normal damage, shop prices, less max HP, weaker rest, boss damage, Jackpot odds shift to 35/55/10). Monotonic; HL10 < 10% winrate.

## 9. Art plan

- **Style:** RL1–RL4's storybook gouache, with **per-world lighting**: Corn World golden morning, Tomato World warm afternoon garden, Onion World underground amber/teal. Card art is painted once (no per-world card skins this time; that was RL4's headline). Backgrounds, map, and frames change per world.
- Count (rough, ~140): 3 hero portraits (Liam on a book per Wyatt) + victory poses · ~55 cards · ~16 enemies + summons · 3 mini bosses · 3 bosses with phase art (Kettle Corn, fully ripe, each onion layer) · the Cousin Card (Stella back, Lucy + Delilah front) · Cactus + ~15 treasures · the Jackpot machine + reel faces · map/shop/rest/treasure per world · opening cutscene stills (Savanah's car, the rumbling lane, crops sprouting) · world intros · ending stills · title · app icon.
- Likenesses from `assets/ref-photos/` (gitignored). The kept copies live in James's vault people library (`media/people/`). Cousins appear only on the Cousin Card and the opening scene.

## 10. Music *(suno via the vault's suno skill, take 1 kept)*

`title`, `map_w1..w3`, `battle_w1..w3`, `boss_megacorn`, `boss_ripetomato`, `boss_hugeonion`, `jackpot` (a short spinning jingle + win/lose stings), `victory` sting, and **`ending`**, the victory song with word-level `.lrc` (lyrics about the crops attacking, the three worlds, the Jackpot cousins, and Goldie's snack). Lyrics → REVIEW.md.

## 11. Deliberate callbacks (allowed exceptions to the no-port rule)

- Aunt Savanah's gray car, the tree-lined lane, and the farm layout from RL4's ending (story continuity; new paintings).
- Stella, Lucy, Delilah (RL4's bosses, now helpers; their RL4 powers inspire the Cousin Card).
- Goldie the llama and her line "Goldie says nothing. Goldie knows."
- Hero names Wyatt the Speedy and Aaron the Strong.

## 12. Open (James's calls; never block the build on them)

- **A secret?** Every game has had one. James's call, out of the boys' hearing; **do not invent one** unless James approves (GOAL.md).
- Hugo's mechanics for Wyatt and Aaron, the ending, the map-stop hosts, and the Veggie Medley are first drafts for veto.
- Saved-cards cap (only if the harness shows hoarding dominates).

## 13. Harness tuning (Sat 2026-11-07) — where the shipped numbers moved, and why

The selfplay harness (720 runs) tuned the v1 numbers above. This section wins on any conflict.

- **Boss health** (chat numbers were starting points): Mega Corn 190 → **138** (Heat Meter fills at **4**, POP! 30 → **18**, Husk 15 → **10**, Kernel Spray 3×3) · Ripe Tomato 320 → **195** (every **2** Ripeness = +1 attack; SPLAT! 35 → **30**) · Huge Onion 480 → **365** (layers 140 / 120 / 105; hits 11, 7×2, 15 → 19). For comparison, RL4's shipped cousins: Stella 130, Lucy 200, Delilah 260 + 180. The first two crop bosses are at or above their cousin; the Huge Onion is lower in raw health but has three phases, Teary, and Stinky. Overall run winrate (~21%) is below RL4's shipped ~28%, so the game IS harder, as asked.
- **Regular crops:** health +35% and hits −25% versus v1, so fights last 3+ turns (the saved-cards rule made fights very short).
- **Mini bosses:** Cornstalk 84 HP, Swat 7, Deep Roots 3 · Rotten Tomato 128 · Bruised Onion 142. Every big boss is harder than its mini boss (rail: lower win rate when reached, more damage dealt).
- **After a big boss you heal back up** (RL4's rule). The v1 "50% of missing" was too punishing with the harder bosses; Harvest Level 5 now heals most of the way.
- **Heroes:** HP Wyatt 80 / Aaron 82 / Liam 72. Pass deals 7, Juke Left 6 Block, Power Shot 5 + 5 per Touch. Aaron's Gear bonus is **+2** per gear (+3 made him much stronger than the others). Liam's starter is 4 Bonk / 3 Hide / 2 Read a Book / Bookmark (Big Words removed), and the Library Card starts each fight with **2 pages**.
- **Harness result:** Wyatt 20.0% · Aaron 20.8% · Liam 22.9% (rails 17–27); Jackpot spin 23.6% vs walk past 18.9%; hoarding vs normal play within 5 points; every rail clear.

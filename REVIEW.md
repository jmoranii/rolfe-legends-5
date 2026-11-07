# REVIEW — James's queue for Rolfe Legends 5

Everything needing James's judgment lands here; the build never blocks on it. Section 1 is
the short list to read first.

## 1. Read first

- **A secret?** Every game in the series has had one. None is built. Decide out of the boys' hearing.
- **Hugo's design calls to veto** (everything Wyatt designed shipped as he said it):
  - Wyatt's mechanic: **Touches** (passes add soccer balls; a SHOT spends them all).
  - Aaron's mechanic: **Tractor Gears** (shift up to Gear 3 for +2 per gear; Downshift for a big hit).
  - Liam's numbers: a **4-page** Book Meter, and the Library Card starts each fight with 2 pages.
  - Cousin Card numbers: 0⚡, +2 Strong, Weak 2, cancels one attack.
  - The all-crops Jackpot fight is **the Veggie Medley** (a corn, a tomato, and an onion squished together).
  - Map stops: **Grampa Flaj's Seed Shed** (shop), **Mom's Snack Break** (rest), **Goldie's Gate** (treasure).
  - **The ending:** the Huge Onion shrinks to a little onion and **Goldie eats it**.
  - **Harvest Levels 1–10** for after the first win.
- **Saved cards:** shipped exactly as Wyatt said (leftover hand → next fight's hand, then draw 5). The harness shows it's strong but fair (hoarding beats normal play by under 5 points). No cap added.

## 2. Where the numbers moved from the chat (DESIGN.md §13)

The boss health numbers I gave in chat (190 / 320 / 480) were starting points. The balance harness brought them to **138 / 195 / 365**, because at the chat numbers almost no run won. The first two bosses are still at or above their RL4 cousin (Stella 130, Lucy 200); the Huge Onion is lower in raw health than Delilah but has three phases and makes you Teary. The whole run is harder than RL4 (about 21% wins vs RL4's 28%), which is what Wyatt asked for. Also: after a big boss you heal back up (RL4's rule), not halfway.

## 3. Harvest Levels

The ladder is steep for the test bot: about 21% at level 0, about 10% at level 3, about 5% at level 5, about 1% at level 10. Real players learn; the bot doesn't. Revisit if the boys stall early on the ladder.

## 4. Dialogue and lyrics to read

- **Boss lines:** Mega Corn "You woke me up. Now things are going to get… HOT." · Ripe Tomato "I am SO ripe. Hit me. I DARE you." · Huge Onion "Peel me if you can. But I warn you… you WILL cry."
- **Boss beaten:** "…I need to cool off." · "Okay. Maybe I was a LITTLE too ripe." · "…sniff."
- **Crown screen:** one line per hero (js/game.js `showCrown`).
- **Map stops:** Grampa Flaj: "Seeds, tools, a little of everything. Take a look, kiddo." · Mom: "Snack time! Eat up… or practice one of your moves?"
- **The ending song**, "The Crops Attack": `assets/lyrics/ending.txt`. It sings "Whyatt" / "Leeum" / "Savannah" for pronunciation; the captions show the real spellings.
- **Coach James tips + loss lines:** `js/tips.js`.

## 5. Art notes

- **Coach James's portrait is reused from RL4** (same person), not repainted.
- Aaron's portrait has a blue streak in his hair, as in earlier games (from his reference photo).
- Images generated vs planned and any left on emoji: see PROGRESS.md.

## 6. Publish checklist (James's call)

1. Look at it: `cd ~/code/rolfe-legends-5 && python3 -m http.server 8210` → http://localhost:8210
2. Create the public repo `jmoranii/rolfe-legends-5` (same posture as RL1, RL3, RL4: first names and painted likenesses are public; reference photos are never committed).
3. Squash to one commit for the first push (RL4 precedent), push, turn on Pages from `main`.
4. Check the live URL on a tablet; it lives under the same `jmoranii.github.io` origin the boys' parental controls already allow.

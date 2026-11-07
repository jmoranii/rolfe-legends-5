"""Art job registry for tools/art.py — Rolfe Legends 5: The Crops Attack.
Tiers: 1 likenesses + story (faces first), 2 bosses/enemies/jackpot, 3 world backgrounds,
4 cards, 5 treasures + extras. Style: RL1–RL4's storybook gouache, with per-world LIGHT
(DESIGN.md §9) — Corn World golden morning, Tomato World warm afternoon garden, Onion
World underground amber + teal. Every card is painted once (no per-world card skins).
Content rules (CLAUDE.md): crops are funny-angry, never gross or scary; Liam is ALWAYS
fully clothed; no logos, no text."""

REF = 'assets/ref-photos/'
O = 'assets/originals/'

BASE = ("Warm hand-painted storybook gouache illustration, friendly caricature with gently exaggerated "
        "proportions, bold clean silhouette, soft golden-hour farm lighting with warm rim light, rich saturated "
        "colors on a simple painterly farm-vignette background, matched art series for a children's trading-card "
        "game, centered subject, no text, no letters, no logos, no borders, no frames, no watermark.")
SCENE = ("Warm hand-painted storybook gouache illustration, rich saturated colors, soft golden-hour light, matched "
         "art series for a children's trading-card game, no text, no letters, no logos, no borders, no frames, no watermark.")
LIGHT = {
    1: "CORN WORLD: towering golden cornfields in bright golden morning light, warm yellows and greens, blue sky",
    2: "TOMATO WORLD: a giant tomato garden with vines taller than a barn, warm late-afternoon light, ripe reds, leafy greens, terracotta",
    3: "ONION WORLD: underground among giant roots and root crops, warm amber lantern-glow and cool teal shadows, earthy browns, tangled roots overhead",
}
CROP = ("A funny-angry cartoon crop character with little arms and legs and a very expressive grumpy face, "
        "kid-friendly and comic, never gross, never scary.")
LIKE = ("Use the reference photo for the child's likeness: keep his real face shape, hair color and style, eye color "
        "and smile, as a friendly caricature clearly recognizable as the same kid. Wholesome and cheerful.")
CLOTHED = " Liam is ALWAYS fully clothed (shirt and pants) — never in underwear or a diaper."
KID_GIRLS = ("Use the reference photos for the three girls' likenesses: keep each girl's real face, hair color and style "
             "and smile, as friendly, affectionate caricatures clearly recognizable as the same girls. Wholesome and funny.")

JOBS = {}


def job(jid, out, prompt, refs=(), size='1024x1024', tier=9):
    JOBS[jid] = {'out': out, 'prompt': prompt, 'refs': list(refs), 'size': size, 'tier': tier}


def sq(style, subject):
    return f"Square image, 1024x1024.\n{style}\n\nSubject: {subject}"


def wide(style, subject):
    return f"Wide image, 1536x1024.\n{style}\n\nSubject: {subject}"


def world_style(w):
    return (f"Hand-painted storybook gouache children's trading-card game illustration set in {LIGHT[w]}. Bold clean "
            "silhouette, centered subject, no text, no letters, no logos, no borders, no frames, no watermark.")


# ---------------------------------------------------------------- heroes (tier 1)
HEROES = {
    'wyatt': ('wyatt.png', "Wyatt the Speedy, a 10-year-old boy in a soccer jersey, shorts and cleats, mid-dribble with a soccer "
              "ball at his feet, speed lines streaming behind him, confident competitive grin, a cornfield behind him"),
    'aaron': ('aaron.png', "Aaron the Strong, an 8-year-old boy with a goofy determined grin, standing tall on the step of a "
              "classic red farm tractor with one hand on the big steering wheel and the other flexing, hay bales nearby"),
    'liam': ('liam-recent-1.png', "Liam the Reader, a 3-year-old toddler sitting on top of a GIANT closed storybook like a "
             "throne, holding an open picture book in his hands and reading it with wide delighted eyes, little stacks of "
             "books around him, fully clothed in a cozy t-shirt and pants"),
}
for h, (photo, desc) in HEROES.items():
    extra = CLOTHED if h == 'liam' else ''
    refs = [REF + photo] + ([REF + 'liam-recent-2.png'] if h == 'liam' else [])
    job(f'hero_{h}', f'{O}heroes/{h}.png', sq(BASE, f"{desc}.{extra} {LIKE}"), refs, tier=1)
WIN = {
    'wyatt': "Wyatt cheering with both fists up, one foot on a soccer ball, on the farm at sunset, a little defeated onion behind him",
    'aaron': "Aaron standing on his red tractor's seat with both arms raised in victory, the farm at sunset behind him",
    'liam': "Liam standing on his giant storybook holding a book over his head in victory, the farm at sunset behind him",
}
for h, desc in WIN.items():
    extra = CLOTHED if h == 'liam' else ''
    job(f'hero_{h}_win', f'{O}heroes/{h}_win.png', sq(BASE, f"{desc}.{extra} {LIKE}"), [f'@hero_{h}'], tier=1)

# ---------------------------------------------------------------- the Cousin Card + Jackpot faces (tier 1)
job('card_cousins', f'{O}cards/cousins.png', sq(BASE, "the three cousin girls as one team portrait for a trading card "
    "(Wyatt's design): the OLDEST girl (about 7, long blonde hair) stands in the BACK holding up a fashion doll "
    "triumphantly; in FRONT, the middle girl (about 5, wavy blonde hair) squeezes a squishy stress ball and the "
    "littlest girl (about 2, very light blonde hair) holds one hand up like a stop sign with a sassy 'nuh-uh' face. "
    f"Sparkles and confetti, a farm field behind them. The doll has no logo or packaging. {KID_GIRLS}"),
    [REF + 'stella.jpg', REF + 'lucy.jpg', REF + 'delilah.jpg'], tier=1)
FACES = {
    'stella': ('stella.jpg', "a cheerful portrait of a 7-year-old girl with long blonde hair holding a fashion doll (no logo), as a slot-machine reel picture"),
    'lucy': ('lucy.jpg', "a cheerful portrait of a 5-year-old girl with wavy blonde hair squeezing a pastel squishy toy, as a slot-machine reel picture"),
    'delilah': ('delilah.jpg', "a cheerful portrait of a 2-year-old girl with very light blonde hair making a sassy 'nuh-uh' face, as a slot-machine reel picture"),
}
for k, (photo, desc) in FACES.items():
    job(f'jackpot_{k}', f'{O}jackpot/{k}.png', sq(SCENE, f"{desc}, bright simple background. Use the reference photo for "
        "her likeness: clearly the same girl, friendly caricature. Wholesome."), [REF + photo], tier=1)

# ---------------------------------------------------------------- the opening (tier 1) — Wyatt's design
LANE = "a gravel farm lane lined with tall green trees, a red barn and silver grain bins behind"
job('open_1_car', f'{O}scenes/open_1_car.png', wide(SCENE, f"a shiny gray car driving away down {LANE}, three little "
    "blonde girls waving happily out of the back windows, a woman with brown hair at the wheel, dust kicking up behind "
    "the tires, happy ending feeling."), [REF + 'savannah.jpg', REF + 'girls-family.jpg'], size='1536x1024', tier=1)
job('open_2_rumble', f'{O}scenes/open_2_rumble.png', wide(SCENE, f"the same {LANE}, the gray car small in the distance, "
    "the ground behind it RUMBLING: little cracks, dust, pebbles bouncing, comic shake lines, a startled bird flying up."),
    size='1536x1024', tier=1)
job('open_3_wiggle', f'{O}scenes/open_3_wiggle.png', wide(SCENE, "a farm crop field at the edge of the lane, the dark soil "
    "WIGGLING and bulging in bumps, little leaves poking up looking grumpy, comic wiggle lines, a feeling that something "
    "is about to happen. Funny, not scary."), size='1536x1024', tier=1)
job('open_4_sprout', f'{O}scenes/open_4_sprout.png', wide(SCENE, "crops BURSTING up out of the farm field all at once — angry "
    "cartoon corn, tomatoes, onions, carrots, radishes and pumpkins with little arms and grumpy faces, dirt flying, "
    "marching toward the red barn. Funny-angry, kid-friendly, not scary."), size='1536x1024', tier=1)
job('open_5_hero', f'{O}scenes/open_5_hero.png', wide(SCENE, "three heroes standing shoulder to shoulder in front of a red "
    "barn facing a field of grumpy cartoon crops: a 10-year-old boy with a soccer ball, an 8-year-old boy beside a red "
    "tractor, and a 3-year-old toddler (fully clothed) holding a picture book. Heroic, cheerful. Use the reference images "
    "for their likenesses."), ['@hero_wyatt', '@hero_aaron', '@hero_liam'], size='1536x1024', tier=1)

# ---------------------------------------------------------------- the ending (tier 1)
FARM = ("a Midwestern family farmyard: a big gravel patch, a red barn, a wooden fence with a cream-colored guard llama "
        "inside it, tall silver grain bins, a white farmhouse, all surrounded by tall green trees")
job('end_1_peel', f'{O}ending/end_1_peel.png', wide(world_style(3), "a giant cartoon onion's last papery layer peeling away "
    "and the onion shrinking down into one small, plain, slightly embarrassed little onion sitting on the ground."),
    size='1536x1024', tier=1)
job('end_2_settle', f'{O}ending/end_2_settle.png', wide(SCENE, f"{FARM}, at sunset; all the cartoon crops (corn, tomatoes, "
    "onions, carrots, pumpkins) calmly settling back down into neat garden rows with sleepy, content faces."),
    size='1536x1024', tier=1)
for h, desc in {
    'wyatt': "a 10-year-old boy standing proudly with one foot on a soccer ball",
    'aaron': "an 8-year-old boy parking a red tractor in the middle of the yard, grinning",
    'liam': "a 3-year-old toddler (fully clothed) sitting on a giant storybook, turning a page",
}.items():
    job(f'end_3_{h}', f'{O}ending/end_3_{h}.png', wide(SCENE, f"{FARM}, golden sunset; {desc}. {LIKE}"), [f'@hero_{h}'],
        size='1536x1024', tier=1)
job('end_4_goldie', f'{O}ending/end_4_goldie.png', wide(SCENE, "a cream-colored guard llama leaning over her wooden fence "
    "and munching a small onion with a perfectly calm, unbothered face, a little crunch burst, farm at sunset. Use the "
    "reference photo for the llama."), [REF + 'llama.jpeg'], size='1536x1024', tier=1)
job('end_5_goldie', f'{O}ending/end_5_goldie.png', wide(SCENE, "a close-up of the same cream-colored guard llama staring "
    "straight ahead with a calm, all-knowing expression, chewing slowly, golden sunset glow, deadpan comedy."),
    ['@end_4_goldie'], size='1536x1024', tier=1)
job('end_6_farm', f'{O}ending/end_6_farm.png', wide(SCENE, f"{FARM}, a peaceful golden sunset, neat quiet garden rows, "
    "fireflies starting to glow — the farm is safe."), size='1536x1024', tier=1)

# ---------------------------------------------------------------- bosses, mini bosses, crops (tier 2)
ENEMIES = {
    # world 1 — Corn World
    'mini_corn': (1, "a small grumpy ear of corn with a husk cape, flinging popping kernels"),
    'soybean_pod': (1, "a fuzzy green soybean pod with three angry little bean faces peeking out"),
    'pumpkin_roller': (1, "a round orange pumpkin rolling downhill like a bowling ball, determined face, vine tail"),
    'bossy_squash': (1, "a long yellow squash with a bossy frown and its little arms crossed"),
    'popcorn_puff': (1, "a tiny fluffy piece of popcorn with a puffed-up angry face"),
    'cornstalk': (1, "MINI BOSS: a towering cornstalk with long leafy arms swatting down, ears of corn hanging off it, deep roots gripping the ground"),
    'mega_corn': (1, "BOSS: the MEGA CORN — an enormous ear of corn as big as a silo, husk wrapped around it like armor, kernels glowing hot, a mighty scowl, steam rising"),
    'mega_corn_kettle': (1, "BOSS: KETTLE CORN — the same enormous ear of corn now red-hot and sizzling, kernels popping off it into popcorn, flames and steam, furious"),
    # world 2 — Tomato World
    'mini_tomato': (2, "a small round red tomato with a leafy green hat, puffing up angrily"),
    'cherry_tomato': (2, "a tiny cherry tomato on a little vine, cheeky angry face"),
    'hot_pepper': (2, "a red-hot chili pepper with flames on its head and a fiery scowl"),
    'zucchini_bat': (2, "a long green zucchini holding itself like a baseball bat, winding up a swing, determined face"),
    'rotten_tomato': (2, "MINI BOSS: a squishy, lumpy, old tomato with comic green stink lines and a couple of cartoon flies, grumpy face (cartoon-gross at most, never disgusting)"),
    'ripe_tomato': (2, "BOSS: the RIPE TOMATO — a gigantic shiny red tomato with thick green vines for arms, puffed up with pride, a huge leafy crown"),
    'ripe_tomato_ripe': (2, "BOSS: the same gigantic tomato now OVER-RIPE: swollen, wobbling, glowing red, sweat drops flying, about to SPLAT, alarmed face"),
    # world 3 — Onion World
    'mini_onion': (3, "a small yellow onion with teary eyes and a grumpy pout"),
    'carrot_drill': (3, "an orange carrot spinning like a drill bit, bursting up out of the dirt, goggles on"),
    'radish': (3, "a round pink-and-white radish with a leafy mohawk, karate stance"),
    'couch_potato': (3, "a big lumpy potato lounging lazily in a tiny armchair, unimpressed face"),
    'baby_onion': (3, "a tiny baby onion with big teary eyes and a little sprout curl"),
    'bruised_onion': (3, "MINI BOSS: a big purple-red onion with a cartoon bruise mark on its side and a very grumpy scowl, an ice pack strapped on"),
    'huge_onion': (3, "BOSS: the HUGE ONION — a towering golden onion covered in papery skin, roots for a beard, tears of rage streaming, standing in an underground cavern"),
    'huge_onion_2': (3, "BOSS: the same huge onion with its papery skin peeled off, now a shiny STINKY layer with comic green stink clouds swirling around it"),
    'huge_onion_3': (3, "BOSS: the glowing HEART of the onion — a smaller, furious, bright purple-gold onion core, sparks flying, small but MAD"),
    # the Jackpot's all-crops fight
    'veggie_medley': (2, "the VEGGIE MEDLEY: an ear of corn, a tomato and an onion squished together into one wobbly salad monster, mismatched arms, three faces arguing"),
}
for k, (w, desc) in ENEMIES.items():
    tier = 2
    job(f'enemy_{k}', f'{O}enemies/{k}.png', sq(world_style(w), f"{desc}. {CROP}"), tier=tier)
for k in ('corn', 'tomato', 'onion'):
    job(f'jackpot_{k}', f'{O}jackpot/{k}.png', sq(SCENE, f"a cheerful grumpy cartoon {k} character face, big and centered, as a slot-machine reel picture, bright simple background. {CROP}"), tier=2)
job('ui_jackpot_machine', f'{O}ui/jackpot_machine.png', sq(SCENE, "a big shiny red-and-gold farm-fair slot machine with three "
    "reels and a lever, decorated with painted corn, tomatoes and onions, lights around the edge. No letters or numbers."), tier=2)

# ---------------------------------------------------------------- world backgrounds (tier 3) — muted, calm lower-center
STAGE = ("an empty environment backdrop with no characters, calm and slightly muted in the lower-center where game "
         "pieces will sit, detail up top, soft vignette edges")
for w in (1, 2, 3):
    places = {
        'battle': f"{LIGHT[w]}; {STAGE}",
        'story': f"{LIGHT[w]}, a sweeping establishing view, inviting and a little mysterious; no characters",
        'shop': f"a cozy old garden-seed shed in {LIGHT[w]}: seed packets, clay pots and tools on wooden shelves, a warm welcome; {STAGE}",
        'rest': f"a picnic blanket with apples, sandwiches and lemonade in {LIGHT[w]}, cozy and safe; {STAGE}",
        'treasure': f"a wooden fence gate with a cream-colored llama peeking over it in {LIGHT[w]}, something glowing on the ground; {STAGE}",
        'jackpot': f"a farm-fair midway corner with string lights in {LIGHT[w]}, festive; {STAGE}",
    }
    for kind, desc in places.items():
        job(f'bg_w{w}_{kind}', f'{O}bg/w{w}_{kind}.png', wide(SCENE, desc), size='1536x1024', tier=3)
    job(f'bg_w{w}_map', f'{O}bg/w{w}_map.png', f"Tall image, 1024x1536.\n{SCENE}\n\nSubject: a winding top-down storybook "
        f"path map through {LIGHT[w]}, faint branching trails, no characters, no text, muted so map icons read on top.",
        size='1024x1536', tier=3)
job('ui_title', f'{O}ui/title.png', f"Tall image, 1024x1536.\n{SCENE}\n\nSubject: a red barn at golden hour with a farm "
    "field in front of it, and grumpy cartoon corn, tomatoes and onions popping up out of the soil; a cream-colored llama "
    "watching calmly from her fence; big open sky at the top for a title.", size='1024x1536', tier=3)

# ---------------------------------------------------------------- cards (tier 4) — painted once, hero as reference
CARD_DESC = {
    'pass': ('wyatt', 'Wyatt passing a soccer ball with the inside of his foot'),
    'juke_left': ('wyatt', 'Wyatt juking left around a grumpy ear of corn'),
    'toe_tap': ('wyatt', 'Wyatt tapping the top of a soccer ball with his toe, two little balls bouncing'),
    'power_shot': ('wyatt', 'Wyatt blasting a powerful soccer shot, the ball streaking with fire trails'),
    'give_and_go': ('wyatt', 'Wyatt passing a soccer ball off a hay bale and running to get it back'),
    'dribble_past': ('wyatt', 'Wyatt dribbling past a startled tomato'),
    'header': ('wyatt', 'Wyatt heading a soccer ball, motion lines'),
    'chip_shot': ('wyatt', 'Wyatt chipping a soccer ball in a rainbow arc over a pumpkin'),
    'step_over': ('wyatt', 'Wyatt doing a fancy step-over move around a soccer ball'),
    'wall_pass': ('wyatt', 'a soccer ball bouncing off a barn wall and knocking over a row of corn'),
    'bicycle_kick': ('wyatt', 'Wyatt doing an upside-down overhead kick in mid-air'),
    'corner_kick': ('wyatt', 'Wyatt taking a corner kick next to a little flag in a cornfield'),
    'rainbow_flick': ('wyatt', 'Wyatt flicking a soccer ball up over his own head from behind'),
    'sliding_save': ('wyatt', 'Wyatt sliding across the grass in goalkeeper gloves to block a tomato'),
    'keepy_uppy': ('wyatt', 'Wyatt juggling a soccer ball on his knee, counting'),
    'through_ball': ('wyatt', 'a soccer ball zooming through a gap between two grumpy crops'),
    'golden_boot': ('wyatt', 'a shining golden soccer cleat on a little pedestal, Wyatt admiring it'),
    'fast_break': ('wyatt', 'Wyatt sprinting down the field with a pile of soccer balls bouncing after him'),
    'penalty_kick': ('wyatt', 'Wyatt lining up a penalty kick against a nervous goalkeeper pumpkin'),
    'plow': ('aaron', 'Aaron driving a red tractor with a plow, flipping up dirt'),
    'hay_bale': ('aaron', 'Aaron hiding behind a stack of hay bales'),
    'shift_up': ('aaron', 'Aaron pushing the tractor gear stick forward with a big grin'),
    'hay_bale_launch': ('aaron', 'Aaron launching a giant hay bale off the front of the tractor'),
    'rev_it': ('aaron', 'Aaron revving the tractor, smoke puffing from the exhaust stack'),
    'mud_spray': ('aaron', 'the tractor wheels spraying mud all over a row of crops'),
    'bumper': ('aaron', 'the front bumper of the red tractor bashing a pumpkin'),
    'big_wheels': ('aaron', 'the giant back tractor wheels close-up, Aaron peeking from behind one'),
    'gear_grind': ('aaron', 'Aaron grinding the tractor gears, sparks flying'),
    'tow_hitch': ('aaron', 'Aaron hooking a tow chain to a hay wagon'),
    'tractor_horn': ('aaron', 'Aaron honking the tractor horn, comic sound waves knocking crops back'),
    'hay_wagon': ('aaron', 'a hay wagon piled high rolling into a group of crops'),
    'second_gear': ('aaron', 'the tractor gear stick glowing as it shifts into second gear'),
    'plow_through': ('aaron', 'the red tractor plowing straight through a row of startled crops'),
    'roll_bar': ('aaron', 'Aaron safe in the tractor seat under a sturdy roll bar'),
    'engine_roar': ('aaron', 'Aaron roaring like a lion along with the tractor engine'),
    'full_throttle': ('aaron', 'Aaron pushing the throttle all the way, the tractor racing with speed lines'),
    'last_furrow': ('aaron', 'Aaron plowing one last long furrow across a field at sunset'),
    'big_red_charge': ('aaron', 'the big red tractor charging head-on with Aaron yelling triumphantly'),
    'bonk_book': ('liam', 'Liam bonking a grumpy onion with a red hardcover book'),
    'hide_book': ('liam', 'Liam hiding behind a big open book held up like a shield'),
    'read_book': ('liam', 'Liam reading a green picture book with sparkles coming off the pages'),
    'bookmark': ('liam', 'Liam tucking a ribbon bookmark into a book'),
    'story_time': ('liam', 'Liam listening to story time, cozy, books all around'),
    'pop_up_book': ('liam', 'a pop-up book opening into a little cardboard castle wall, Liam behind it'),
    'dinosaur_book': ('liam', 'a roaring cartoon dinosaur leaping out of a book Liam is reading'),
    'space_book': ('liam', 'shooting stars and rockets flying out of a space book Liam is holding'),
    'picture_book': ('liam', 'Liam pointing at a bright picture in a picture book'),
    'bedtime_story': ('liam', 'Liam in pajamas reading a bedtime story by moonlight, a crop yawning nearby'),
    'library_day': ('liam', 'Liam walking into a big friendly library with a stack of books'),
    'sequel': ('liam', 'Liam holding two matching books, book one and book two'),
    'page_turner': ('liam', 'Liam flipping pages super fast, pages fluttering'),
    'big_book_bonk': ('liam', 'Liam lifting a HUGE heavy book over his head'),
    'read_aloud': ('liam', 'Liam reading out loud, big comic sound waves knocking crops back'),
    'book_fort': ('liam', 'Liam inside a fort built out of stacked books'),
    'the_end': ('liam', 'Liam closing a book with a happy THUD, sparkles'),
    'bookworm': ('liam', 'a friendly cartoon worm with glasses reading next to Liam'),
    'overdue_book': ('liam', 'Liam holding a dusty old book with a big alarm clock beside it'),
    'book_storm': ('liam', 'a whirlwind tornado of flying books swirling around Liam, books flying out at crops'),
}
for cid, (hero, desc) in CARD_DESC.items():
    clothed = CLOTHED if hero == 'liam' else ''
    job(f'card_{cid}', f'{O}cards/{cid}.png', sq(BASE, f"{desc}.{clothed} {LIKE} Card art for a children's card game."),
        [f'@hero_{hero}'], tier=4)
job('card_stinky', f'{O}cards/stinky.png', sq(BASE, "a comic cloud of green stink lines with a funny pinched-nose cartoon "
    "face in it, pee-yew. Cartoon only, never gross."), tier=4)

# ---------------------------------------------------------------- treasures + extras (tier 5)
TREASURE_DESC = {
    'shin_guards': 'a pair of soccer shin guards', 'tractor_keys': 'a ring of red tractor keys', 'library_card': 'a cheerful library card with a book on it (no words)',
    'straw_hat': 'a farmer\'s straw hat', 'seed_packet': 'a glowing seed packet (no words)', 'garden_gloves': 'a pair of garden gloves',
    'watering_can': 'a green watering can sprinkling water', 'morning_glory': 'a blue morning glory flower', 'piggy_jar': 'a glass jar full of gold coins',
    'bug_spray': 'a can of bug spray with a cartoon bug running away', 'compost_bin': 'a wooden compost bin', 'farm_bell': 'an old iron farm dinner bell',
    'pitchfork': 'a pitchfork', 'rain_barrel': 'a wooden rain barrel', 'golden_corn': 'a shining golden ear of corn', 'tomato_cage': 'a wire tomato cage',
    'grain_bin': 'a little silver grain bin', 'blue_ribbon': 'a county fair blue ribbon (no words)', 'county_trophy': 'a big golden county fair trophy',
    'cactus': 'a cute little potted cactus with a grumpy face and spiky arms crossed',
}
for tid, desc in TREASURE_DESC.items():
    job(f'treasure_{tid}', f'{O}treasures/{tid}.png', sq(SCENE, f"{desc}, a single object centered on a soft glowing background, treasure icon."), tier=5)
for h in ('wyatt', 'aaron', 'liam'):
    extra = CLOTHED if h == 'liam' else ''
    job(f'ui_ko_{h}', f'{O}ui/ko_{h}.png', sq(BASE, f"the same kid sitting in the farm dirt looking a little tired and "
        f"muddy but smiling, a grumpy crop walking away in the background, encouraging 'try again' mood.{extra} {LIKE}"),
        [f'@hero_{h}'], tier=5)
job('ui_icon', f'{O}ui/icon.png', sq(SCENE, "a bold app icon: an ear of corn, a tomato and an onion stacked playfully on a "
    "golden shield, simple and readable at small size, no text."), tier=5)

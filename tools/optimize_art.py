#!/usr/bin/env python3
"""optimize_art.py — full-res originals (assets/originals/**, gitignored) → web-weight
deployed art at the paths js/art.js loads. Normalizes codex's off-size outputs by
center-cropping to the intended aspect, then resizing. Make-like: skips up-to-date files.
  python3 tools/optimize_art.py [--force]
"""
import os, subprocess, sys, shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
O = 'assets/originals'
FORCE = '--force' in sys.argv

# (source dir, dest dir, aspect (w/h), max long edge px, format)
RULES = [
    ('heroes', 'assets/heroes', 1.0, 512, 'jpeg'),
    ('enemies', 'assets/enemies', 1.0, 384, 'jpeg'),
    ('cards', 'assets/cards', 1.0, 320, 'jpeg'),
    ('jackpot', 'assets/jackpot', 1.0, 256, 'jpeg'),
    ('treasures', 'assets/treasures', 1.0, 192, 'jpeg'),
    ('ending', 'assets/ending', 1.5, 1280, 'jpeg'),
    ('scenes', 'assets/scenes', 1.5, 1280, 'jpeg'),
]


def size(p):
    out = subprocess.run(['sips', '-g', 'pixelWidth', '-g', 'pixelHeight', p], capture_output=True, text=True).stdout
    w = int(out.split('pixelWidth:')[1].split()[0]); h = int(out.split('pixelHeight:')[1].split()[0])
    return w, h


def emit(src, dst, aspect, px, fmt='jpeg', quality=78):
    if not FORCE and os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
        return False
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    w, h = size(src)
    # center-crop to the intended aspect
    if abs(w / h - aspect) > 0.02:
        if w / h > aspect:
            nw, nh = int(round(h * aspect)), h
        else:
            nw, nh = w, int(round(w / aspect))
        tmp = dst + '.crop.png'
        subprocess.run(['sips', '-c', str(nh), str(nw), src, '--out', tmp], capture_output=True)
        src2 = tmp
    else:
        src2, tmp = src, None
    args = ['sips', '-Z', str(px), src2, '--out', dst]
    if fmt == 'jpeg':
        args[1:1] = ['-s', 'format', 'jpeg', '-s', 'formatOptions', str(quality)]
    else:
        args[1:1] = ['-s', 'format', 'png']
    subprocess.run(args, capture_output=True)
    if tmp and os.path.exists(tmp):
        os.remove(tmp)
    return True


def main():
    n = 0
    # world backgrounds: wide stages, except the tall maps
    bgd = os.path.join(O, 'bg')
    if os.path.isdir(bgd):
        for f in sorted(os.listdir(bgd)):
            if f.endswith('.png'):
                tall = f.endswith('_map.png')
                n += emit(os.path.join(bgd, f), os.path.join('assets/bg', f[:-4] + '.jpg'), 2 / 3 if tall else 1.5, 1280)
    for sub, dest, aspect, px, fmt in RULES:
        d = os.path.join(O, sub)
        if not os.path.isdir(d):
            continue
        for f in sorted(os.listdir(d)):
            if not f.endswith('.png'):
                continue
            if emit(os.path.join(d, f), os.path.join(dest, f[:-4] + '.jpg'), aspect, px, fmt):
                n += 1
    ui = os.path.join(O, 'ui')
    if os.path.isdir(ui):
        for f in sorted(os.listdir(ui)):
            src = os.path.join(ui, f)
            if f == 'title.png':
                n += emit(src, 'assets/ui/title.jpg', 2 / 3, 1280)
            elif f == 'jackpot_machine.png':
                n += emit(src, 'assets/ui/jackpot_machine.jpg', 1.0, 512)
            elif f.startswith('ko_'):
                n += emit(src, f'assets/ui/{f[:-4]}.jpg', 1.0, 512)
            elif f == 'icon.png':
                for name, px in (('icon-512.png', 512), ('icon-192.png', 192), ('apple-touch-icon.png', 180), ('icon.png', 256)):
                    n += emit(src, f'assets/ui/{name}', 1.0, px, 'png')
    # Coach James's portrait is the same person as RL3's coach (reused, not new content)
    if not os.path.exists('assets/ui/portrait_coach.jpg'):
        rl3 = os.path.expanduser('~/code/rolfe-legends-3/assets/ui/portrait_coach.jpg')
        if os.path.exists(rl3):
            shutil.copy(rl3, 'assets/ui/portrait_coach.jpg'); n += 1
    total = 0
    for root, _, files in os.walk('assets'):
        if 'originals' in root or 'ref-photos' in root:
            continue
        total += sum(os.path.getsize(os.path.join(root, f)) for f in files if f.endswith(('.jpg', '.png')))
    print(f'optimized {n} files · deployed art total {total / 1e6:.1f} MB')


if __name__ == '__main__':
    main()

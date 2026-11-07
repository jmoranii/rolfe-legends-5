#!/usr/bin/env python3
"""art.py — Rolfe Legends 5 art runner (gpt-image CLI, codex backend = James's ChatGPT plan).

Jobs live in tools/art_jobs.py. Each job: out path (PNG under assets/originals/), prompt,
refs (file paths, or '@<job id>' to use another job's output — e.g. world edits of a base
painting), size, tier (lower runs first: likenesses before card skins).

  python3 tools/art.py list [tier|id-prefix]     # plan
  python3 tools/art.py run [--lanes 3] [--max N] [ids or prefixes or 'tier<=K' ...]
  python3 tools/art.py missing                   # what's left

Resumable: existing outputs are skipped. Exit code 4 from gpt-image (plan usage window
exhausted) stops all lanes and writes assets/art-state.json {"paused": true, ...}; rerun later.
"""
import json, os, subprocess, sys, threading, time
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
sys.path.insert(0, os.path.join(ROOT, 'tools'))
from art_jobs import JOBS  # noqa: E402

LOG = 'assets/art-log.txt'
STATE = 'assets/art-state.json'
lock = threading.Lock()
stop = threading.Event()


def log(msg):
    line = f"{time.strftime('%H:%M:%S')} {msg}"
    with lock:
        print(line, flush=True)
        with open(LOG, 'a') as f:
            f.write(line + '\n')


def deps(job):
    return [r[1:] for r in job.get('refs', []) if r.startswith('@')]


def done(jid):
    return os.path.exists(JOBS[jid]['out'])


def select(args):
    if not args:
        return list(JOBS)
    out = []
    for jid, j in JOBS.items():
        for a in args:
            if a.startswith('tier<='):
                if j.get('tier', 9) <= int(a[6:]):
                    out.append(jid); break
            elif jid == a or jid.startswith(a):
                out.append(jid); break
    return out


def run_one(jid):
    j = JOBS[jid]
    if stop.is_set() or done(jid):
        return 'skip'
    refs = []
    for r in j.get('refs', []):
        p = JOBS[r[1:]]['out'] if r.startswith('@') else r
        if not os.path.exists(p):
            log(f'SKIP {jid}: missing ref {p}')
            return 'missing-ref'
        refs += ['--ref', p]
    os.makedirs(os.path.dirname(j['out']), exist_ok=True)
    cmd = ['perl', '-e', 'alarm 480; exec @ARGV', 'gpt-image', '--backend', 'codex',
           '--size', j.get('size', '1024x1024'), '--quality', 'high', '-o', os.path.abspath(j['out'])] + refs + ['--', j['prompt']]
    for attempt in (1, 2):
        if stop.is_set():
            return 'stopped'
        t0 = time.time()
        log(f'GEN {jid} (try {attempt})')
        p = subprocess.run(cmd, capture_output=True, text=True)
        with lock, open(LOG, 'a') as f:
            f.write((p.stdout or '')[-1500:] + (p.stderr or '')[-1500:] + '\n')
        if p.returncode == 0 and os.path.exists(j['out']):
            log(f'OK  {jid} {time.time() - t0:.0f}s')
            return 'ok'
        if p.returncode == 4:
            log(f'LIMIT {jid}: usage window exhausted — pausing all lanes')
            stop.set()
            json.dump({'paused': True, 'at': time.strftime('%Y-%m-%d %H:%M'), 'job': jid}, open(STATE, 'w'))
            return 'limit'
        if p.returncode == 5:
            log(f'MODERATION {jid} — not retrying')
            return 'moderation'
        log(f'FAIL {jid} rc={p.returncode} {time.time() - t0:.0f}s')
    return 'fail'


def run(ids, lanes, maxn):
    todo = [i for i in ids if not done(i)]
    # pull in unfinished deps
    need = set(todo)
    for i in list(todo):
        for d in deps(JOBS[i]):
            if not done(d):
                need.add(d)
    todo = sorted(need, key=lambda i: (JOBS[i].get('tier', 9), list(JOBS).index(i)))
    if maxn:
        todo = todo[:maxn]
    log(f'RUN {len(todo)} jobs, {lanes} lanes')
    results = {}
    pending = list(todo)
    inflight = {}
    with ThreadPoolExecutor(lanes) as ex:
        while (pending or inflight) and not stop.is_set():
            # launch ready jobs
            for jid in list(pending):
                if len(inflight) >= lanes:
                    break
                blocked = [d for d in deps(JOBS[jid]) if not done(d)]
                if any(d in inflight or d in pending for d in blocked):
                    continue
                pending.remove(jid)
                inflight[jid] = ex.submit(run_one, jid)
            for jid, fut in list(inflight.items()):
                if fut.done():
                    results[jid] = fut.result()
                    del inflight[jid]
            time.sleep(1)
    ok = sum(1 for v in results.values() if v == 'ok')
    bad = {k: v for k, v in results.items() if v not in ('ok', 'skip')}
    log(f'END ok={ok} other={bad} left={len([i for i in ids if not done(i)])}')
    if not stop.is_set() and os.path.exists(STATE):
        os.remove(STATE)
    return 4 if stop.is_set() else 0


def main():
    a = sys.argv[1:]
    mode = a.pop(0) if a else 'list'
    lanes, maxn = 3, 0
    if '--lanes' in a:
        k = a.index('--lanes'); lanes = int(a[k + 1]); del a[k:k + 2]
    if '--max' in a:
        k = a.index('--max'); maxn = int(a[k + 1]); del a[k:k + 2]
    ids = select(a)
    if mode == 'list':
        for i in ids:
            print(f"{'✓' if done(i) else ' '} t{JOBS[i].get('tier', 9)} {i} → {JOBS[i]['out']}")
        print(f'{len(ids)} jobs, {sum(done(i) for i in ids)} done')
    elif mode == 'missing':
        miss = [i for i in ids if not done(i)]
        print('\n'.join(miss)); print(f'{len(miss)} missing')
    elif mode == 'run':
        sys.exit(run(ids, lanes, maxn))


if __name__ == '__main__':
    main()

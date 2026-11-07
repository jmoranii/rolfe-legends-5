#!/bin/bash
# RL5 soundtrack batch via suno-auto (Sat 2026-11-07). 12 tracks, James's call ("12 downloads
# (full)"). Take 1 only.
#
# Download policy: Suno Pro caps song downloads at 20/month (since Thu 2026-09-03), and
# `suno download` has been broken since that date (clip audio_url is /api/forbidden). So,
# per the vault's reference/tools/suno-cli.md (Open section):
#   1. generate with suno-auto --wait (NO --download: it would fetch both takes),
#   2. unlock ONLY take 1 with the vault's suno-unlock (spends 1 of the 20; it drives the
#      suno.com Download modal on the CLI's piloted Chrome, CDP port 9233),
#   3. pull it with suno-fetch (free; the endpoint says `processing` for ~1 min after unlock).
# If the piloted Chrome is signed out (sidebar shows "Log in"; suno-unlock would time out
# waiting for "Download"), it is healed first, per suno-cli.md Open (Wed 2026-09-23).
# Re-runnable: recorded clip ids, finished downloads and unlocks are never repeated, and an
# unlock ledger refuses more than MAX_UNLOCKS distinct unlocks.
set -uo pipefail
cd "$(dirname "$0")/.."
export PATH="/opt/homebrew/bin:$PATH"
VAULT="${RL_VAULT:-$(ls -d "$HOME"/Library/CloudStorage/GoogleDrive-*/"My Drive"/second-brain 2>/dev/null | head -1)}"  # the second-brain vault (Drive-synced)
SKILL="$VAULT/.claude/skills/suno"
REPO="$(pwd)"
LOGS="assets/audio/gen-logs"      # gitignored
ORIG="assets/originals/audio"     # gitignored
LEDGER="$LOGS/unlock-ledger.txt"  # one line per suno-unlock call: time track clip rc
MAX_UNLOCKS=12
TRACKS="title world1 world2 world3 battle1 battle2 battle3 jackpot boss_mega_corn boss_ripe_tomato boss_huge_onion ending"
mkdir -p "$LOGS" "$ORIG" assets/audio

# ---------- generation ----------

take1() { # gen log -> "id status duration take2id" of take 1 (empty if no clips)
/usr/bin/python3 - "$1" <<'PY'
import json, sys
t = open(sys.argv[1], errors="replace").read()
i = 0 if t.startswith("{") else t.find("\n{") + 1
if i <= 0 and not t.startswith("{"):
    sys.exit(0)
try:
    d, _ = json.JSONDecoder().raw_decode(t[i:])
    clips = d.get("data") or []
    if isinstance(clips, dict):
        clips = [clips]
    c = clips[0]
    other = clips[1]["id"] if len(clips) > 1 else "-"
    print(c["id"], c.get("status") or "?", (c.get("metadata") or {}).get("duration") or "?", other)
except Exception:
    pass
PY
}

wait_complete() { # id -> 0 complete | 1 error or timeout (~5 min)
  local id="$1" i s
  for i in $(seq 1 20); do
    s=$(suno status "$id" --json 2>/dev/null)
    case "$s" in
      *'"status": "complete"'*) return 0 ;;
      *'"status": "error"'*) return 1 ;;
    esac
    sleep 15
  done
  return 1
}

gen_track() { # track title [suno args...]
  local track="$1" title="$2"; shift 2
  if [ -s "$LOGS/$track.id" ]; then
    echo "=== $track: already generated (take 1 $(cat "$LOGS/$track.id"))"; return 0
  fi
  local attempt log rc info id status dur id2
  for attempt in $(seq 1 "${GEN_ATTEMPTS:-3}"); do   # captcha transients are free to retry
    log="$LOGS/$track.attempt$attempt.log"
    echo "=== $(date +%H:%M:%S) generating $track ($title) [attempt $attempt]"
    ( cd "$VAULT" && .claude/skills/suno/suno-auto generate --title "$title" "$@" --model v5.5 --wait ) > "$log" 2>&1
    rc=$?
    if [ $rc -eq 3 ]; then
      echo "!!! AUTH BROKEN (exit 3). Stopping; James must run 'suno auth --login'."; tail -5 "$log"; exit 3
    fi
    if [ $rc -eq 4 ]; then
      echo "!!! RATE LIMITED (exit 4). Stopping the batch."; tail -5 "$log"; exit 4
    fi
    info=$(take1 "$log")
    if [ -n "$info" ]; then
      read -r id status dur id2 <<< "$info"
      cp "$log" "$LOGS/$track.json"
      echo "    take 1 $id status=$status dur=${dur}s | take 2 $id2 (stays on Suno, never downloaded)"
      if [ "$status" != "complete" ]; then
        if [ "$status" = "error" ] || ! wait_complete "$id"; then
          echo "!!! $track: render failed (status $status; a silent filter failure charges 0 credits)"; return 1
        fi
      fi
      echo "$id" > "$LOGS/$track.id"
      echo "$track $id $id2 $dur" >> "$LOGS/clips.txt"
      return 0
    fi
    echo "    no clip returned (rc=$rc; captcha/config transients cost 0 credits); cooling down 45s"
    tail -3 "$log" | sed 's/^/      /'
    sleep 45
  done
  echo "!!! $track: generation FAILED after ${GEN_ATTEMPTS:-3} attempts"; return 1
}

# ---------- take-1 unlock + fetch ----------

heal_signin() { # clip -> 0 signed in; only touches cookies when the page shows signed out
/usr/bin/python3 - "$1" <<'PY'
import json, os, sys, time
from playwright.sync_api import sync_playwright
AUTH = os.path.expanduser("~/Library/Application Support/com.suno-cli.suno-cli/auth.json")
url = f"https://suno.com/song/{sys.argv[1]}"

def signed_out(page):
    txt = page.evaluate("() => (document.body && document.body.innerText || '').slice(0, 1500)")
    return ("Log in" in txt) or ("Join Suno for free" in txt)

with sync_playwright() as p:
    ctx = p.chromium.connect_over_cdp("http://localhost:9233").contexts[0]
    page = ctx.new_page()
    try:
        page.goto(url, wait_until="domcontentloaded"); time.sleep(6)
        if not signed_out(page):
            print("heal: signed in already"); sys.exit(0)
        clerk = (json.load(open(AUTH)).get("clerk_client_cookie") or "").strip()
        if not clerk:
            print("heal: no clerk_client_cookie in auth.json (needs `suno auth --login`)"); sys.exit(1)
        sfx = None
        for c in ctx.cookies(["https://auth.suno.com", "https://suno.com"]):
            for base in ("__client_uat_", "__session_"):
                if c["name"].startswith(base):
                    sfx = c["name"][len(base):]
                    break
            if sfx:
                break
        sfx = sfx or "Jnxw-muT"
        uat = str(int(time.time()))
        ck = lambda n, v, d, h=False: {"name": n, "value": v, "domain": d, "path": "/",
                                        "secure": True, "httpOnly": h, "sameSite": "Lax"}
        # exactly what suno_watch.py heals: __client (+ nonzero uat markers), never __session
        ctx.add_cookies([ck("__client", clerk, "auth.suno.com", True),
                         ck("__client_uat", uat, ".suno.com"),
                         ck(f"__client_uat_{sfx}", uat, ".suno.com")])
        for _ in range(3):
            page.goto(url, wait_until="domcontentloaded"); time.sleep(8)
            if not signed_out(page):
                print("heal: was signed out; healed, signed in"); sys.exit(0)
        print("heal: STILL signed out after cookie heal"); sys.exit(1)
    finally:
        try:
            page.close()
        except Exception:
            pass
PY
}

try_fetch() { # track id -> 0 fetched | 10 processing | 11 not unlocked | 12 other
  local track="$1" id="$2" tmp="assets/audio/tmp_$1" out rc dur
  mkdir -p "$tmp"; rm -f "$tmp/$track.mp3"
  out=$("$SKILL/suno-fetch" "$id" --output "$REPO/$tmp" --name "$track" 2>&1); rc=$?
  echo "[$(date +%H:%M:%S)] rc=$rc $out" >> "$LOGS/$track-fetch.log"
  if [ $rc -eq 0 ] && [ -s "$tmp/$track.mp3" ]; then
    dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$tmp/$track.mp3" 2>/dev/null)
    if [ -n "$dur" ]; then
      mv "$tmp/$track.mp3" "$ORIG/$track.mp3"; rmdir "$tmp" 2>/dev/null
      echo "    fetched $ORIG/$track.mp3 (${dur%.*}s)"; return 0
    fi
  fi
  rm -f "$tmp/$track.mp3"
  case "$out" in
    *processing*) return 10 ;;
    *not_authorized*) return 11 ;;
    *) return 12 ;;
  esac
}

do_unlock() { # track id -> suno-unlock's exit code (2 = refused by the budget guard)
  local track="$1" id="$2" n tries rc
  tries=$(/usr/bin/grep -c " $id " "$LEDGER" 2>/dev/null); tries=${tries:-0}
  if [ "$tries" -eq 0 ]; then
    n=$(awk '{print $3}' "$LEDGER" 2>/dev/null | sort -u | /usr/bin/grep -c .)
    if [ "${n:-0}" -ge "$MAX_UNLOCKS" ]; then
      echo "!!! unlock budget ($MAX_UNLOCKS) already used; refusing to unlock $track"; return 2
    fi
  elif [ "$tries" -ge 2 ]; then
    echo "!!! $track: suno-unlock already tried twice for $id; refusing"; return 2
  fi
  heal_signin "$id" 2>&1 | tee -a "$LOGS/$track-unlock.log" | sed 's/^/    /'
  echo "[$(date +%H:%M:%S)] suno-unlock $id" >> "$LOGS/$track-unlock.log"
  "$SKILL/suno-unlock" "$id" >> "$LOGS/$track-unlock.log" 2>&1; rc=$?
  echo "$(date +%Y-%m-%dT%H:%M:%S) $track $id rc=$rc" >> "$LEDGER"
  return $rc
}

download_track() { # track
  local track="$1" id rc urc i
  if [ -s "$ORIG/$track.mp3" ]; then echo "=== $track: original already on disk"; return 0; fi
  id=$(cat "$LOGS/$track.id" 2>/dev/null)
  if [ -z "$id" ]; then echo "!!! $track: no take-1 clip id (generation failed)"; return 1; fi
  echo "=== $(date +%H:%M:%S) $track: take 1 $id"
  try_fetch "$track" "$id"; rc=$?
  if [ $rc -eq 0 ]; then echo "    (already unlocked earlier; no download spent)"; return 0; fi
  if [ $rc -ne 10 ]; then          # not unlocked yet -> unlock take 1, once
    do_unlock "$track" "$id"; urc=$?
    [ $urc -eq 2 ] && return 1
    if [ $urc -ne 0 ]; then
      echo "    suno-unlock exited $urc; probing whether the unlock landed"
      sleep 10; try_fetch "$track" "$id"; rc=$?
      [ $rc -eq 0 ] && return 0
      if [ $rc -eq 11 ]; then      # it did not: heal + retry once (heal runs inside do_unlock)
        echo "    not unlocked; retrying suno-unlock once after the sign-in heal"
        do_unlock "$track" "$id"; urc=$?
        if [ $urc -ne 0 ]; then echo "!!! $track: unlock FAILED twice (see $LOGS/$track-unlock.log)"; return 1; fi
      fi
    fi
    echo "    unlocked (1 download spent); waiting while the download processes"
  fi
  for i in $(seq 1 14); do          # ~3.5 min of processing retries
    try_fetch "$track" "$id"; rc=$?
    [ $rc -eq 0 ] && return 0
    sleep 15
  done
  echo "!!! $track: fetch FAILED after ~3.5 min (last rc=$rc; see $LOGS/$track-fetch.log)"; return 1
}

# ---------- web copies + ending word timings ----------

web_copy() { # track
  local t="$1"
  [ -s "$ORIG/$t.mp3" ] || return 1
  ffmpeg -nostdin -y -v error -i "$ORIG/$t.mp3" -vn -codec:a libmp3lame -b:a 128k "assets/audio/$t.mp3" || return 1
  echo "    web copy assets/audio/$t.mp3 ($(du -h "assets/audio/$t.mp3" | cut -f1 | tr -d ' '))"
}

make_lrc() { # word-level LRC for the ending song (needs the FULL clip UUID)
  local id i raw="$LOGS/ending-lrc.raw"
  id=$(cat "$LOGS/ending.id" 2>/dev/null); [ -n "$id" ] || return 1
  for i in 1 2 3; do
    suno config check >/dev/null 2>&1   # rotate the JWT first so no refresh chatter lands in stdout
    suno timed-lyrics "$id" --lrc > "$raw" 2> "$LOGS/ending-lrc.err"
    if /usr/bin/grep -q '^\[[0-9][0-9]:[0-9][0-9]\.[0-9][0-9]\]' "$raw"; then
      cp "$raw" assets/audio/ending.lrc
      echo "    assets/audio/ending.lrc: $(/usr/bin/grep -c '^\[[0-9]' assets/audio/ending.lrc) timestamped lines"
      return 0
    fi
    sleep 20
  done
  echo "!!! ending.lrc FAILED (see $raw and $LOGS/ending-lrc.err)"; return 1
}

# ---------- run ----------

FAILS=0
TAGS_END="upbeat pop punk country rock kids victory anthem, bright electric guitars, gang vocals, handclaps, triumphant singalong, young energetic vocals"

echo "##### phase 1: generate (12 tracks, v5.5, take 1 kept)"
TAGS_END="upbeat pop punk country rock kids victory anthem, banjo and bright electric guitars, gang vocals, handclaps, triumphant farm singalong, young energetic vocals"
gen_track title "RL5 The Crops Attack (Title)" --tags "rollicking country rock adventure instrumental, banjo, fiddle, stomping drums, electric guitar, cartoon farm mischief, video game title theme, looping" --exclude "vocals, singing, sad, dark" --instrumental || FAILS=$((FAILS+1))
gen_track world1 "RL5 Corn World Map" --tags "sunny bluegrass instrumental, banjo and fiddle, golden morning in a giant cornfield, curious and upbeat, video game map music, looping" --exclude "vocals, singing, sad" --instrumental || FAILS=$((FAILS+1))
gen_track world2 "RL5 Tomato World Map" --tags "warm swampy country funk instrumental, slide guitar, washboard, lazy afternoon in a giant tomato garden, playful, video game map music, looping" --exclude "vocals, singing, sad" --instrumental || FAILS=$((FAILS+1))
gen_track world3 "RL5 Onion World Map" --tags "mysterious underground folk instrumental, plucked mandolin, low cello, dripping marimba, cozy-spooky cave under the farm, kid-friendly, video game map music, looping" --exclude "vocals, singing, horror, scary" --instrumental || FAILS=$((FAILS+1))
gen_track battle1 "RL5 Corn World Battle" --tags "fast bluegrass breakdown instrumental, driving banjo, fiddle runs, stomping kick drum, popcorn percussion, video game battle music, looping" --exclude "vocals, singing, sad" --instrumental || FAILS=$((FAILS+1))
gen_track battle2 "RL5 Tomato World Battle" --tags "punchy country rock instrumental, twangy electric guitar, big drums, splashy cymbals, juicy funky bass, video game battle music, looping" --exclude "vocals, singing, sad" --instrumental || FAILS=$((FAILS+1))
gen_track battle3 "RL5 Onion World Battle" --tags "intense folk rock instrumental, galloping mandolin and fiddle, deep toms, tearful minor-key but heroic, underground chase, video game battle music, looping" --exclude "vocals, singing, horror, screaming" --instrumental || FAILS=$((FAILS+1))
gen_track jackpot "RL5 The Jackpot" --tags "county fair carnival instrumental, honky-tonk piano, calliope organ, slot machine bells, suspenseful drumroll, fun and lucky, short jingle, looping" --exclude "vocals, singing, sad" --instrumental || FAILS=$((FAILS+1))
gen_track boss_mega_corn "RL5 The Mega Corn" --tags "heavy southern rock boss instrumental, sizzling distorted guitar, popping percussion, rising heat, dramatic cartoon showdown, video game boss theme, looping" --exclude "vocals, singing, horror, screaming" --instrumental || FAILS=$((FAILS+1))
gen_track boss_ripe_tomato "RL5 The Ripe Tomato" --tags "big brassy swamp rock boss instrumental, tuba and horns, slide guitar, wobbling bass building to a huge splash, comic menace, video game boss theme, looping" --exclude "vocals, singing, horror, screaming" --instrumental || FAILS=$((FAILS+1))
gen_track boss_huge_onion "RL5 The Huge Onion" --tags "epic orchestral folk boss instrumental, choir oohs, strings and fiddle, layered build in three parts, tearful and grand final battle, video game final boss theme, looping" --exclude "vocals, lyrics, horror, screaming" --instrumental || FAILS=$((FAILS+1))
gen_track ending "The Crops Attack" --tags "$TAGS_END" --exclude "sad, slow, screaming, metal" --lyrics-file "$REPO/assets/lyrics/ending.txt" || FAILS=$((FAILS+1))
echo "##### phase 2: unlock + fetch take 1 only (max $MAX_UNLOCKS unlocks)"
for t in $TRACKS; do download_track "$t" || FAILS=$((FAILS+1)); done

echo "##### phase 3: 128 kbps web copies + ending word timings"
for t in $TRACKS; do [ -s "assets/audio/$t.mp3" ] || web_copy "$t" || { echo "!!! $t: no web copy"; FAILS=$((FAILS+1)); }; done
[ -s assets/audio/ending.lrc ] || make_lrc || FAILS=$((FAILS+1))

echo "##### summary (fails=$FAILS)"
for t in $TRACKS; do
  printf '%-12s take1=%-36s orig=%-3s web=%s\n' "$t" "$(cat "$LOGS/$t.id" 2>/dev/null || echo -)" \
    "$([ -s "$ORIG/$t.mp3" ] && echo yes || echo no)" "$([ -s "assets/audio/$t.mp3" ] && echo yes || echo no)"
done
echo "unlock ledger:"; cat "$LEDGER" 2>/dev/null
exit $(( FAILS > 0 ? 1 : 0 ))   # 3 and 4 stay reserved for the suno auth / rate-limit stops

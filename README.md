<div align="center">

# 🎧 Muji

### Your AI coding companion with ambient vibes

[![GitHub Stars](https://img.shields.io/github/stars/JSLEEKR/Muji?style=for-the-badge&logo=github&color=yellow)](https://github.com/JSLEEKR/Muji/stargazers)
[![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-18+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Claude](https://img.shields.io/badge/powered%20by-Claude%20Code-D4A574?style=for-the-badge)](https://claude.ai)

<br/>

**Turns your silent terminal into an immersive coding environment**

Ambient music + Voice notifications + Audio ducking + Pomodoro timer + AI research — all wired into Claude Code

[🚀 Quick Start](#-quick-start) · [🎵 Music Control](#music---music-control) · [⏱️ Pomodoro](#-pomodoro-timer) · [📖 Configuration](#-configuration)

</div>

---

## Why This Exists

Developers spend hours in the terminal with Claude Code, but the experience is **silent and disconnected**. No ambient atmosphere, no audio feedback, no sense of time passing. You finish a 3-hour session feeling drained without knowing why.

**Muji** transforms Claude Code sessions into an immersive, productivity-enhancing environment. It's like having a co-working space — with Lo-Fi beats, gentle voice notifications that tell you when things succeed or fail, and a Pomodoro timer that reminds you to take breaks.

- 🎵 **Background music** — Stream Lo-Fi, Jazz, Nature, or Classical from YouTube. Or play your own files.
- 🔔 **Context-aware notifications** — Hear when your git push succeeds, your build fails, or your tests break.
- 🎚️ **Smart audio ducking** — BGM automatically fades when a notification plays, then fades back up.
- ⏱️ **Built-in Pomodoro** — 25/5/15 minute cycles with audio cues. Music switches to nature sounds during breaks.
- 🔬 **Research subagent** — Dispatch background research tasks and get notified when results are ready.
- 🌍 **Multilingual** — TTS voices for English, Korean, Japanese, Chinese, Spanish, French, German, Portuguese, Russian.

Stop coding in silence. Let the vibes sync to you.

---

## 🎬 How It Works

```
You start a Claude Code session
        ↓
🎵 Lo-Fi music begins playing automatically
🔊 "Alright, starting up." (TTS greeting)
        ↓
You code normally — Claude Code does its thing
        ↓
┌─────────────────────────────────────────────────────────┐
│  Claude runs `git push`                                 │
│  → BGM fades from 30 → 10 (ducking)                    │
│  → 🔔 success-big.wav plays                            │
│  → 🔊 "Pushed." (TTS)                                   │
│  → BGM fades from 10 → 30 (restore)                    │
└─────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────┐
│  Claude runs `npm test` — 3 tests fail                  │
│  → BGM fades down                                       │
│  → ⚠️ warn-soft.wav plays                              │
│  → 🔊 "3 tests failed." (TTS)                          │
│  → BGM fades back up                                    │
└─────────────────────────────────────────────────────────┘
        ↓
⏱️ After 25 minutes: "25분 지났어, 쉬어가자." (Pomodoro)
🎵 Music switches to Nature Sounds for your break
```

Every interaction is **automatic**. You don't need to configure anything — just install and code.

---

## 📋 Feature Overview

| Feature | What It Does | How It Works |
|---------|-------------|--------------|
| 🎵 **Background Music** | Streams ambient music during coding | `mpv` plays YouTube streams or local files, controlled via IPC |
| 🎚️ **Audio Ducking** | Lowers music when notifications play | Smooth volume fade-out → play notification → fade-in |
| 🔊 **TTS Notifications** | Speaks event announcements aloud | Multi-engine: edge-tts, ElevenLabs, Coqui, espeak, system |
| 🔔 **Sound Effects** | Plays distinct WAV cues per event | 9 generated tones: chimes, bells, warnings, errors |
| ⏱️ **Pomodoro Timer** | 25/5/15 min work-break cycles | Background daemon with PID management |
| 🎯 **Focus Modes** | One-command preset switching | Configures music + volume + TTS + Pomodoro together |
| 🔬 **Research Mate** | Background AI research subagent | Dispatches tasks, notifies on completion |
| 🪝 **Lifecycle Hooks** | Auto-reacts to Claude Code events | SessionStart, PostToolUse, Stop, TaskCompleted |
| 🌍 **Multilingual** | TTS in 9 languages | Per-language voice selection in config |

---

## 🚀 Quick Start

### Prerequisites

| Tool | Required | Purpose |
|------|----------|---------|
| Node.js 18+ | ✅ Yes | Plugin runtime |
| mpv | ✅ Yes | Audio playback (BGM + SFX) |
| yt-dlp | 📌 Recommended | YouTube stream extraction |
| TTS engine | 📌 Recommended | Voice notifications (see [TTS Engines](#-tts-engines)) |

### Install

```bash
# 1. Install system dependencies
# macOS
brew install mpv yt-dlp
pip install edge-tts

# Linux (Debian/Ubuntu)
sudo apt install mpv socat
pip install yt-dlp edge-tts

# 2. Clone and install
git clone https://github.com/JSLEEKR/Muji.git ~/.claude/plugins/muji
cd ~/.claude/plugins/muji
npm install

# 3. Check everything is ready
npm run setup
```

### What `npm run setup` does

The setup script scans your system and reports:

```
=== Muji Setup ===

Checking required dependencies...
  [OK] mpv
  [OK] yt-dlp
  [OK] socat

Checking TTS engines...
  [OK] edge-tts
  [--] espeak-ng
  [OK] system (macOS say)

Config directory: /Users/you/.claude/.muji
  Copied default config to user config
  TTS cache: /Users/you/.claude/.muji/tts-cache

=== Setup Complete ===
All dependencies found. Ready to use!
```

### Register with Claude Code

Follow the Claude Code plugin installation flow for your version. The plugin declares:
- **Entry point:** `package.json`
- **Hooks:** `hooks/hooks.json`
- **Commands:** `/focus`, `/music`, `/timer`, `/mate`
- **Agents:** `research-mate`

### Start coding

Just open a Claude Code session. BGM starts automatically, you hear a chime and a greeting, and you're good to go.

---

## ⚡ Slash Commands

### `/focus` — Focus Mode Presets

Switch music, volume, TTS, and Pomodoro behavior in one command.

| Mode | Music | Volume | TTS | Pomodoro |
|------|-------|--------|-----|----------|
| `/focus deep` | Lo-Fi Hip Hop | 25 | ❌ SFX only | Auto-starts |
| `/focus write` | Jazz & Rain | 20 | ✅ Gentle | Manual |
| `/focus chill` | Nature Sounds | 35 | ✅ Full | Manual |
| `/focus off` | Stopped | — | ❌ Disabled | Stopped |

**Deep** is for flow-state coding where you don't want voice interruptions. **Write** is for documentation and long-form work. **Chill** is for relaxed exploration with full audio feedback.

```
/focus deep     ← minimal distraction, maximum focus
```

### `/music` — Music Control

Direct control over background music playback.

```bash
/music lofi              # Switch to Lo-Fi Hip Hop stream
/music jazz              # Switch to Jazz & Rain stream
/music nature            # Switch to Nature Sounds stream
/music classical         # Switch to Classical Focus stream
/music off               # Stop music
/music volume 40         # Set volume (0-100)
/music status            # Show current mode, volume, playback state
/music <url>             # Play any YouTube URL or local file
```

**Examples:**

```bash
/music https://www.youtube.com/watch?v=jfKfPfyJRdk    # Play a specific stream
/music /home/user/music/ambient.mp3                     # Play a local file
/music volume 15                                        # Lower the volume
```

### `/timer` — Pomodoro Timer

Manage work/break cycles.

```bash
/timer start             # Begin a 25-minute work session
/timer stop              # Stop the timer entirely
/timer pause             # Pause the current countdown
/timer resume            # Resume a paused timer
/timer skip              # Skip to next phase (work → break or break → work)
/timer status            # Show phase, time remaining, session count
/timer config <key> <v>  # Change setting (e.g., work_minutes 50)
```

**Example `/timer status` output:**

```
Phase:     work (session 2 of 4)
Remaining: 18:42
Today:     1 session completed
```

### `/mate` — AI Research Companion

Dispatch background research tasks to the `research-mate` subagent.

```bash
/mate research "Rust async runtimes comparison 2025"
```

**How it works:**
1. The subagent launches in a separate context
2. It searches the web and summarizes findings
3. Results are saved to `/tmp/muji-research-output.md`
4. When done, you hear a knock sound + "Research done. Check it out."
5. Ask Claude about the results or read the file directly

---

## 🔔 Event Notifications

Every Claude Code lifecycle event can trigger a sound effect and/or TTS message. The notification system:
1. Detects the event (via hooks)
2. Fades BGM volume down (ducking)
3. Plays the SFX
4. Plays the TTS message
5. Fades BGM volume back up

All notifications are **queued sequentially** — no overlapping audio.

### Event Map

| Event | Trigger | SFX | TTS (en) | TTS (ko) |
|-------|---------|-----|----------|----------|
| Session start | Claude Code opens | `chime-soft.wav` | "Alright, starting up." | "자, 시작하자." |
| Git commit | `git commit` succeeds | `success.wav` | — | — |
| Git push | `git push` succeeds | `success-big.wav` | "Pushed." | "푸시 완료." |
| Test failure | Test runner fails | `warn-soft.wav` | "{count} tests failed." | "테스트 {count}개 실패했어." |
| Build success | Build completes | `success.wav` | "Build passed." | "빌드 성공." |
| Build failure | Build errors | `error.wav` | "Build failed. Check the logs." | "빌드 실패. 로그 확인해봐." |
| Lint error | Linter issues | `warn-soft.wav` | — | — |
| Subagent done | Research completes | `knock.wav` | "Research done. Check it out." | "조사 끝났어. 확인해봐." |
| Pomodoro end | 25 min up | `bell.wav` | "25 minutes up. Take a break." | "25분 지났어, 쉬어가자." |
| 5-min warning | 5 min remaining | `tick.wav` | "5 minutes left." | "5분 남았어." |
| Break end | Break over | `bell-soft.wav` | "Ready to get back to it?" | "쉬었으면 다시 해볼까?" |
| Task done | Task completed | `success.wav` | "One down. Moving on." | "하나 끝. 다음 가자." |
| Session end | Claude Code closes | `chime-soft.wav` | "Work wrapped up." | "작업 마무리됐어." |
| Error | Generic error | `error.wav` | "Got an error. Take a look." | "에러 났어. 한번 봐봐." |

### Command Pattern Detection

The `on-bash-complete` hook intelligently matches commands:

| Pattern | Matches | Does NOT match |
|---------|---------|---------------|
| `git commit` | `git commit -m "fix"` | — |
| `git push` | `git push origin main` | — |
| `npm test` | `npm test -- --watch` | — |
| `make` | `make build` | `cmake ..`, `automake` |
| `eslint` | `eslint src/` | — |

Word-boundary matching prevents false positives (e.g., `cmake` won't trigger the `make` notification).

---

## ⏱️ Pomodoro Timer

### How It Works

The timer runs as a **detached Node.js daemon** managed via PID file. This means it keeps running even between Claude Code interactions.

```
┌─────────────────────────────────────────────────────────────────┐
│                     Pomodoro Cycle                              │
│                                                                 │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   │
│  │ Work 25m │ → │ Break 5m │ → │ Work 25m │ → │ Break 5m │   │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘   │
│       ↑              │              │              │           │
│    🔔 bell        🎵 nature     🔔 bell        🎵 nature     │
│    🔊 "Take       sounds        🔊 "Take       sounds        │
│      a break"                      a break"                    │
│                                                                │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌───────────┐  │
│  │ Work 25m │ → │ Break 5m │ → │ Work 25m │ → │ LONG 15m  │  │
│  └──────────┘   └──────────┘   └──────────┘   └───────────┘  │
│                                      ↑             ↑          │
│                                   Session 4    🎵 nature      │
│                                               🔊 "Long break" │
│                                                                │
│  After long break → cycle repeats from session 1              │
└─────────────────────────────────────────────────────────────────┘
```

### Key Behaviors

| Setting | Default | Description |
|---------|---------|-------------|
| Work duration | 25 min | Length of each focus session |
| Short break | 5 min | Break between sessions 1-3 |
| Long break | 15 min | Break after every 4th session |
| Auto-start break | ✅ Yes | Break begins automatically after work ends |
| Auto-start work | ❌ No | Next work session requires manual `/timer start` |
| 5-min warning | ✅ Yes | Notification 5 minutes before work session ends |
| Break music | Nature | BGM switches to nature sounds during all breaks |

### Process Management

```
/tmp/muji-pomodoro.pid          ← PID of the daemon process
/tmp/muji-pomodoro-status.json  ← current state (polled by /timer status)
```

On Windows, these files are stored in `%TEMP%` instead of `/tmp/`.

---

## 🎵 Audio Architecture

### How Audio Playback Works

```
┌──────────────────────────────────────────────────────────┐
│                    Audio Stack                            │
│                                                          │
│  ┌─────────────────┐    ┌──────────────────────────┐    │
│  │ BGM Manager     │    │ Notifier                  │    │
│  │                 │    │                            │    │
│  │ Long-running    │    │ 1. Duck BGM (fade down)    │    │
│  │ mpv process     │◄───│ 2. Play SFX (short mpv)   │    │
│  │ with IPC socket │    │ 3. Play TTS (short mpv)   │    │
│  │                 │    │ 4. Restore BGM (fade up)   │    │
│  └────────┬────────┘    └──────────────────────────┘    │
│           │                                              │
│           ▼                                              │
│  ┌─────────────────┐                                    │
│  │ mpv             │    IPC commands:                    │
│  │ --input-ipc-    │    • set_property volume 30        │
│  │   server=socket │    • set_property pause true       │
│  │ --no-video      │    • loadfile <url> replace        │
│  │ --loop=inf      │                                    │
│  └─────────────────┘                                    │
└──────────────────────────────────────────────────────────┘
```

- **BGM:** One long-running `mpv` process with `--input-ipc-server` for runtime volume/pause/track control
- **SFX:** Short-lived `mpv` instances per sound (fire-and-forget)
- **TTS:** Generate audio file → play via short-lived `mpv` instance
- **IPC:** Node.js `net.connect()` to Unix socket (or named pipe on Windows)

### TTS Pipeline

```
Text → Engine → Audio File → Cache → mpv Playback
         │
         ├── edge-tts (free, natural, requires internet)
         ├── ElevenLabs (premium, requires API key)
         ├── Coqui (free, offline)
         ├── espeak-ng (free, offline, robotic)
         └── system (macOS say / Linux spd-say)
```

Cache key: `SHA256(engine + voice + text)` → stored at `~/.claude/.muji/tts-cache/`

If the primary engine fails, the fallback engine is tried automatically.

---

## 📝 Configuration

### Config Location

```
~/.claude/.muji/config.yaml
```

If the file doesn't exist, `config/default.yaml` is used. Create the user file to override only the keys you care about — the loader **deep-merges** both files (your overrides take priority, everything else falls back to defaults).

### All Settings

#### Language & TTS

| Key | Default | Description |
|-----|---------|-------------|
| `language` | `en` | Language for TTS messages. Affects voice selection. |
| `tts.engine` | `edge-tts` | Primary TTS engine (`edge-tts`, `elevenlabs`, `coqui`, `espeak`, `system`) |
| `tts.fallback_engine` | `system` | Fallback when primary fails |
| `tts.cache_enabled` | `true` | Cache generated TTS audio to avoid re-synthesis |
| `tts.cache_max_mb` | `200` | Max cache size in MB. LRU eviction when exceeded. |

Supported languages: `en`, `ko`, `ja`, `zh`, `es`, `fr`, `de`, `pt`, `ru`

#### Background Music

| Key | Default | Description |
|-----|---------|-------------|
| `bgm.enabled` | `true` | Enable/disable background music entirely |
| `bgm.auto_start` | `true` | Start playing when Claude Code session opens |
| `bgm.default_mode` | `lofi` | Default mode: `lofi`, `jazz`, `nature`, `classical`, `silence` |
| `bgm.volume` | `30` | Playback volume (0–100) |

#### Sound Effects

| Key | Default | Description |
|-----|---------|-------------|
| `sfx.enabled` | `true` | Enable/disable sound effects |
| `sfx.volume` | `80` | SFX playback volume (0–100) |

Override individual event sounds:

```yaml
sfx:
  events:
    commit_success: /path/to/my-custom-sound.wav
    pomodoro_end: null    # null = disable this sound
```

#### Notifications & Ducking

| Key | Default | Description |
|-----|---------|-------------|
| `notifications.enabled` | `true` | Master switch for all notifications |
| `notifications.ducking.enabled` | `true` | Fade BGM during notifications |
| `notifications.ducking.duck_volume` | `10` | BGM volume while notification plays |
| `notifications.ducking.fade_duration_ms` | `300` | Fade transition time |

#### Pomodoro

| Key | Default | Description |
|-----|---------|-------------|
| `pomodoro.work_minutes` | `25` | Work session length |
| `pomodoro.short_break_minutes` | `5` | Short break length |
| `pomodoro.long_break_minutes` | `15` | Long break after every 4th session |
| `pomodoro.sessions_before_long_break` | `4` | Sessions before a long break |
| `pomodoro.auto_start_break` | `true` | Auto-start break when work ends |
| `pomodoro.auto_start_work` | `false` | Auto-start next work when break ends |
| `pomodoro.music_override.short_break` | `nature` | BGM mode during short breaks |
| `pomodoro.music_override.long_break` | `nature` | BGM mode during long breaks |

### Example: Minimal Override

```yaml
# ~/.claude/.muji/config.yaml
# Only override what you want — everything else uses defaults

language: ko

bgm:
  volume: 20
  default_mode: jazz

tts:
  engine: system

pomodoro:
  work_minutes: 50
  short_break_minutes: 10
```

---

## 🔧 TTS Engines

| Engine | Quality | Offline | Cost | Voices | Install |
|--------|:-------:|:-------:|:----:|--------|---------|
| `edge-tts` | ⭐⭐⭐⭐ | ❌ | Free | 9 languages, natural | `pip install edge-tts` |
| `elevenlabs` | ⭐⭐⭐⭐⭐ | ❌ | Paid | Custom voice cloning | Set `ELEVENLABS_API_KEY` |
| `coqui` | ⭐⭐⭐ | ✅ | Free | English primarily | `pip install TTS` |
| `espeak-ng` | ⭐⭐ | ✅ | Free | Many languages, robotic | `apt install espeak-ng` |
| `system` | ⭐⭐⭐ | ✅ | Free | OS-dependent | Built-in |

**Recommendation:** Start with `edge-tts`. It's free, sounds natural, and supports all 9 languages. If you need offline support, `espeak-ng` works everywhere.

### Voice Selection

Each engine has per-language voice configuration:

```yaml
tts:
  engines:
    edge-tts:
      voices:
        en: en-US-AriaNeural
        ko: ko-KR-SunHiNeural
        ja: ja-JP-NanamiNeural
```

---

## 🖥️ Platform Support

| Platform | Status | Audio | TTS | Notes |
|----------|:------:|:-----:|:---:|-------|
| **macOS** | ✅ Primary | mpv via brew | `say` built-in | Full support. No `socat` needed. |
| **Linux** | ✅ Primary | mpv via apt | `spd-say` / `pico2wave` | Requires `socat` for mpv IPC. |
| **Windows (WSL2)** | ⚠️ Best-effort | mpv in WSL | `espeak-ng` | Needs PulseAudio bridge for audio output. |
| **Windows (Native)** | ⚠️ Experimental | mpv via named pipes | `espeak-ng` | Named pipe IPC instead of Unix sockets. |

### Windows Notes

On native Windows:
- mpv IPC uses named pipes (`\\.\pipe\muji-bgm-socket`) instead of Unix domain sockets
- PID/status files go to `%TEMP%` instead of `/tmp/`
- `socat` is not required (and not checked by setup script)
- Install mpv from [mpv.io](https://mpv.io/installation/)

---

## 📁 Project Structure

```
muji/
├── .claude-plugin/
│   └── plugin.json              # Plugin metadata (name, version, commands, agents)
├── commands/
│   ├── focus.md                 # /focus [deep|write|chill|off]
│   ├── music.md                 # /music [lofi|jazz|nature|off|<url>]
│   ├── timer.md                 # /timer [start|stop|status|config]
│   └── mate.md                  # /mate research <topic>
├── agents/
│   └── research-mate.md         # Background research subagent definition
├── skills/
│   └── focus-tips.md            # Contextual productivity tips
├── hooks/
│   └── hooks.json               # All hook event registrations
├── scripts/
│   ├── core/
│   │   ├── config.js            # YAML config loader with deep-merge & validation
│   │   ├── bgm.js               # mpv process lifecycle, IPC, volume, mode switching
│   │   ├── tts.js               # Multi-engine TTS with SHA-256 caching & LRU eviction
│   │   ├── notify.js            # Ducking + SFX + TTS orchestration, sequential queue
│   │   └── pomodoro.js          # Timer daemon with work/break cycles & PID management
│   ├── handlers/
│   │   ├── _bootstrap.js        # Shared init: config → bgm → tts → notifier
│   │   ├── on-session-start.js  # Auto-start BGM, play greeting
│   │   ├── on-bash-complete.js  # Pattern-match commands, fire notifications
│   │   ├── on-file-write.js     # No-op (future: activity tracking)
│   │   ├── on-task-done.js      # Notify task completion
│   │   ├── on-stop.js           # Goodbye, cleanup all processes
│   │   └── on-teammate-idle.js  # Notify subagent completion
│   └── cli/
│       ├── setup.js             # Dependency checker & config initializer
│       └── reset.js             # Kill all managed processes & temp files
├── sounds/                      # 9 generated WAV sound effects
│   ├── chime-soft.wav           # Session start/end (440Hz, 0.3s)
│   ├── success.wav              # Commit/build success (C5→E5)
│   ├── success-big.wav          # Push success (C5→E5→G5)
│   ├── warn-soft.wav            # Test/lint failure (E4, 0.4s)
│   ├── error.wav                # Build/runtime error (E4→C4)
│   ├── knock.wav                # Subagent completion (200Hz, 0.08s)
│   ├── bell.wav                 # Pomodoro work end (A5, 0.5s)
│   ├── bell-soft.wav            # Break end (A4, 0.4s)
│   └── tick.wav                 # 5-min warning (1kHz, 0.05s)
├── config/
│   └── default.yaml             # Full default configuration
├── tests/                       # 65 unit tests (node:test)
│   ├── config.test.js           # Config loading, dot-notation, message templates
│   ├── bgm.test.js              # Mode resolution, volume clamping
│   ├── tts.test.js              # Cache keys, voice resolution, command building
│   ├── notify.test.js           # Message resolution, notification queuing
│   ├── pomodoro.test.js         # Timer lifecycle, pause/resume, break types
│   └── handlers.test.js         # Command pattern matching, word boundaries
├── package.json
└── DESIGN.md                    # Full design specification
```

---

## 🧪 Testing

```bash
# Run all 65 tests
npm test

# Run a specific test file
node --test tests/config.test.js

# Run with verbose output
node --test --test-reporter spec tests/*.test.js
```

All tests use Node.js built-in `node:test` — no external test framework required.

---

## 🧹 Troubleshooting

### No audio playing

```bash
# Check if mpv is installed
mpv --version

# Test audio output
mpv sounds/chime-soft.wav
```

### BGM won't start

```bash
# Check if yt-dlp can resolve YouTube URLs
yt-dlp --get-url "https://www.youtube.com/watch?v=jfKfPfyJRdk"

# Try playing directly
mpv --no-video "https://www.youtube.com/watch?v=jfKfPfyJRdk"
```

### Kill stuck processes

```bash
npm run reset
```

This kills any running mpv and pomodoro daemon processes and cleans up temp files.

### TTS not working

```bash
# Check available engines
npm run setup

# Test edge-tts directly
edge-tts --voice "en-US-AriaNeural" --text "Hello" --write-media /tmp/test.mp3
mpv /tmp/test.mp3
```

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch
3. Run tests: `npm test`
4. Submit a pull request

---

## 📄 License

MIT — see [LICENSE](LICENSE).

---

<div align="center">

### Built with ❤️ and Claude Code

</div>

# /focus Command

Switch between focus mode presets or turn off all features.

## Usage
- `/focus deep`  — Deep work: lo-fi music, SFX only (no TTS), pomodoro auto-starts
- `/focus write` — Writing: jazz + rain, gentle TTS enabled
- `/focus chill` — Relaxed: nature sounds, all notifications
- `/focus off`   — Stop BGM, disable notifications

## Implementation

1. Parse the mode argument.

2. Load the focus mode preset from config (`focus_modes.{mode}`).

3. Apply all settings from the preset:
   a. Switch BGM mode: `bgm.switchMode(preset.bgm_mode)`
   b. Set BGM volume: `bgm.setVolume(preset.bgm_volume)`
   c. Toggle TTS: update runtime notification settings
   d. If `pomodoro_auto_start` is true, start pomodoro timer

4. For `off`:
   a. Stop BGM
   b. Stop pomodoro timer
   c. Disable notifications for this session

5. Confirm mode switch with a notification (respecting the new mode's settings).

6. Respond with a summary of what changed.

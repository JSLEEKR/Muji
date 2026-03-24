# /timer Command

Manage pomodoro work/break timer.

## Usage
- `/timer start`          — Start a 25-min work session
- `/timer stop`           — Stop the timer
- `/timer skip`           — Skip to next phase (work→break or break→work)
- `/timer pause`          — Pause the timer
- `/timer resume`         — Resume the timer
- `/timer status`         — Show current timer state
- `/timer config <k> <v>` — Adjust settings (e.g., work_minutes 50)

## Implementation

1. Parse the subcommand from user input.

2. For `start`: Spawn the pomodoro daemon if not running:
   ```bash
   node "$PLUGIN_DIR/scripts/core/pomodoro.js" start &
   ```
   Respond: "Pomodoro started. 25 minutes of focused work."

3. For `stop`: Read PID from temp file and kill the process.
   Respond: "Timer stopped."

4. For `skip`: Signal the daemon to skip the current phase.
   Respond: "Skipped to next phase."

5. For `pause`/`resume`: Signal the daemon.
   Respond: "Timer paused." / "Timer resumed."

6. For `status`: Read `/tmp/cfm-pomodoro-status.json` and display:
   - Current phase (work/break/stopped)
   - Time remaining
   - Session number
   - Total sessions today

7. For `config`: Update the runtime config value.
   Respond: "Updated {key} to {value}."

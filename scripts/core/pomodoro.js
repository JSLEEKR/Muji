const fs = require('node:fs');

class PomodoroTimer {
  constructor(config, notifier, bgmManager) {
    this._config = config;
    this._notifier = notifier;
    this._bgm = bgmManager;
    this._phase = 'stopped';
    this._sessionNumber = 0;
    this._totalSessionsToday = 0;
    this._isPaused = false;
    this._timer = null;
    this._warningTimer = null;
    this._endTime = null;
    this._pausedRemaining = null;
    this._previousBgmMode = null;
  }

  start() {
    if (this._phase !== 'stopped') this.stop();
    this._sessionNumber++;
    this._totalSessionsToday++;
    this._phase = 'work';
    this._isPaused = false;
    const minutes = this._config.get('pomodoro.work_minutes') || 25;
    this._startPhase(minutes * 60, () => this._onWorkEnd());
    if (minutes > 5) {
      const warningMs = (minutes - 5) * 60 * 1000;
      this._warningTimer = setTimeout(() => this._onWarning(), warningMs);
    }
    this._savePID();
    this._saveStatus();
  }

  stop() {
    this._clearTimers();
    this._phase = 'stopped';
    this._isPaused = false;
    this._endTime = null;
    this._pausedRemaining = null;
    this._removePID();
    this._saveStatus();
  }

  async skip() {
    if (this._phase === 'work') { await this._onWorkEnd(); }
    else if (this._phase === 'short_break' || this._phase === 'long_break') { await this._onBreakEnd(); }
  }

  pause() {
    if (this._phase === 'stopped' || this._isPaused) return;
    this._isPaused = true;
    this._pausedRemaining = Math.max(0, this._endTime - Date.now());
    this._clearTimers();
    this._saveStatus();
  }

  resume() {
    if (!this._isPaused) return;
    this._isPaused = false;
    const remaining = this._pausedRemaining || 0;
    this._pausedRemaining = null;
    const callback = this._phase === 'work' ? () => this._onWorkEnd() : () => this._onBreakEnd();
    this._endTime = Date.now() + remaining;
    this._timer = setTimeout(callback, remaining);
    // Re-arm the warning timer if we're in the work phase and there's still time for it
    if (this._phase === 'work') {
      const warningThresholdMs = 5 * 60 * 1000;
      if (remaining > warningThresholdMs) {
        this._warningTimer = setTimeout(() => this._onWarning(), remaining - warningThresholdMs);
      }
    }
    this._saveStatus();
  }

  status() {
    let remaining_seconds = 0;
    if (this._isPaused && this._pausedRemaining) {
      remaining_seconds = Math.round(this._pausedRemaining / 1000);
    } else if (this._endTime) {
      remaining_seconds = Math.max(0, Math.round((this._endTime - Date.now()) / 1000));
    }
    return {
      phase: this._phase,
      remaining_seconds,
      session_number: this._sessionNumber,
      total_sessions_today: this._totalSessionsToday,
      is_paused: this._isPaused,
    };
  }

  _getBreakType(sessionNumber) {
    const longBreakEvery = this._config.get('pomodoro.sessions_before_long_break') || 4;
    return (sessionNumber % longBreakEvery === 0) ? 'long_break' : 'short_break';
  }

  async _onWorkEnd() {
    this._clearTimers();
    await this._notifier.notify('pomodoro_end');
    const breakType = this._getBreakType(this._sessionNumber);
    const autoStartBreak = this._config.get('pomodoro.auto_start_break');
    if (autoStartBreak) {
      this._phase = breakType;
      const breakKey = breakType === 'long_break' ? 'long_break_minutes' : 'short_break_minutes';
      const minutes = this._config.get(`pomodoro.${breakKey}`) || 5;
      const overrideMode = this._config.get(`pomodoro.music_override.${breakType}`);
      if (overrideMode) { try { await this._bgm.switchMode(overrideMode); } catch { } }
      this._startPhase(minutes * 60, () => this._onBreakEnd());
      this._saveStatus();
    } else {
      this._phase = 'stopped';
      this._saveStatus();
    }
  }

  async _onBreakEnd() {
    this._clearTimers();
    await this._notifier.notify('break_end');
    const workOverride = this._config.get('pomodoro.music_override.work');
    if (workOverride) { try { await this._bgm.switchMode(workOverride); } catch { } }
    const autoStartWork = this._config.get('pomodoro.auto_start_work');
    if (autoStartWork) { this.start(); }
    else { this._phase = 'stopped'; this._saveStatus(); }
  }

  async _onWarning() { await this._notifier.notify('pomodoro_warning'); }

  _startPhase(seconds, callback) {
    this._endTime = Date.now() + seconds * 1000;
    this._timer = setTimeout(callback, seconds * 1000);
  }

  _clearTimers() {
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    if (this._warningTimer) { clearTimeout(this._warningTimer); this._warningTimer = null; }
  }

  _saveStatus() {
    try {
      const statusPath = this._config.getStatusPath();
      fs.writeFileSync(statusPath, JSON.stringify(this.status(), null, 2));
    } catch { }
  }

  _savePID() {
    try { fs.writeFileSync(this._config.getPidPath(), String(process.pid)); } catch { }
  }

  _removePID() {
    try { fs.unlinkSync(this._config.getPidPath()); } catch { }
  }
}

module.exports = PomodoroTimer;

if (require.main === module) {
  const Config = require('./config.js');
  const BGMManager = require('./bgm.js');
  const TTSEngine = require('./tts.js');
  const Notifier = require('./notify.js');
  const config = new Config(); config.load();
  const bgm = new BGMManager(config);
  const tts = new TTSEngine(config);
  const notifier = new Notifier(config, bgm, tts);
  const timer = new PomodoroTimer(config, notifier, bgm);
  const action = process.argv[2];
  if (action === 'start') {
    timer._savePID(); timer.start();
    setInterval(() => timer._saveStatus(), 5000);
  }
}

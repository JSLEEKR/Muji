const fs = require('node:fs');
const path = require('node:path');

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
    // Wellness timers (hourly chime + idle detection)
    this._hourlyTimer = null;
    this._idleTimer = null;
    this._idleNotified = false;
    // Memory optimization: cache last status to avoid unnecessary disk writes
    this._lastStatusJson = '';
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

  // ── Wellness: hourly chime + idle detection ──

  startWellness() {
    this.stopWellness();
    const hourlyEnabled = this._config.get('wellness.hourly.enabled') !== false;
    const idleEnabled = this._config.get('wellness.idle.enabled') !== false;
    const hourlyMs = ((this._config.get('wellness.hourly.interval_minutes')) || 60) * 60 * 1000;
    // Check idle every 5 minutes instead of every minute (reduces file I/O)
    const idleCheckMs = 5 * 60 * 1000;

    if (hourlyEnabled) {
      this._hourlyTimer = setInterval(() => this._onHourlyChime(), hourlyMs);
    }
    if (idleEnabled) {
      this._idleTimer = setInterval(() => this._onIdleCheck(), idleCheckMs);
    }
  }

  stopWellness() {
    if (this._hourlyTimer) { clearInterval(this._hourlyTimer); this._hourlyTimer = null; }
    if (this._idleTimer) { clearInterval(this._idleTimer); this._idleTimer = null; }
    this._idleNotified = false;
  }

  async _onHourlyChime() {
    const messages = this._config.get('wellness.hourly.messages') || ['hourly_01', 'hourly_02', 'hourly_03'];
    const pick = messages[Math.floor(Math.random() * messages.length)];
    const voicePath = this._resolveVoicePath(pick);
    if (voicePath) {
      await this._notifier.notifyVoice(voicePath);
    } else {
      await this._notifier.notify(pick);
    }
  }

  async _onIdleCheck() {
    const thresholdMin = this._config.get('wellness.idle.threshold_minutes') || 30;
    const thresholdMs = thresholdMin * 60 * 1000;
    const activityPath = this._config.getActivityPath();

    let lastActivity = 0;
    try {
      const data = JSON.parse(fs.readFileSync(activityPath, 'utf8'));
      lastActivity = data.timestamp || 0;
    } catch {
      return; // no activity file yet
    }

    const elapsed = Date.now() - lastActivity;
    if (elapsed >= thresholdMs && !this._idleNotified) {
      this._idleNotified = true;
      const messages = this._config.get('wellness.idle.messages') || ['idle_01', 'idle_02', 'idle_03', 'idle_04', 'idle_05'];
      const pick = messages[Math.floor(Math.random() * messages.length)];
      const voicePath = this._resolveVoicePath(pick);
      if (voicePath) {
        await this._notifier.notifyVoice(voicePath);
      } else {
        await this._notifier.notify(pick);
      }
    } else if (elapsed < thresholdMs) {
      this._idleNotified = false;
    }
  }

  _resolveVoicePath(event) {
    const lang = this._config.getLanguage();
    const pluginDir = this._config.getPluginDir();
    const voicePath = path.join(pluginDir, 'sounds', 'voices', lang, `${event}.mp3`);
    if (fs.existsSync(voicePath)) return voicePath;
    if (lang !== 'en') {
      const enPath = path.join(pluginDir, 'sounds', 'voices', 'en', `${event}.mp3`);
      if (fs.existsSync(enPath)) return enPath;
    }
    return null;
  }

  // ── Pomodoro internals ──

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
      const json = JSON.stringify(this.status(), null, 2);
      // Skip disk write if status hasn't changed
      if (json === this._lastStatusJson) return;
      this._lastStatusJson = json;
      fs.writeFileSync(statusPath, json);
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

  // Graceful shutdown — clean up PID and timers
  function shutdown() {
    timer.stopWellness();
    timer.stop();
    process.exit(0);
  }
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  if (action === 'start') {
    timer._savePID(); timer.start();
    timer.startWellness();
    // Save status every 30 seconds instead of 5 (reduces disk I/O 6x)
    setInterval(() => timer._saveStatus(), 30000);
  } else if (action === 'wellness') {
    timer._savePID();
    timer.startWellness();
    // Keep alive with minimal overhead
    setInterval(() => {}, 300000);
  }
}

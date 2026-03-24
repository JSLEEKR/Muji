const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tmpDir = os.tmpdir();
const TEST_PID_PATH = path.join(tmpDir, 'cfm-test-pomodoro.pid');
const TEST_STATUS_PATH = path.join(tmpDir, 'cfm-test-pomodoro-status.json');

function createMockConfig() {
  return {
    get: (p) => {
      const data = {
        'pomodoro.enabled': true,
        'pomodoro.work_minutes': 25,
        'pomodoro.short_break_minutes': 5,
        'pomodoro.long_break_minutes': 15,
        'pomodoro.sessions_before_long_break': 4,
        'pomodoro.auto_start_break': true,
        'pomodoro.auto_start_work': false,
        'pomodoro.music_override.work': null,
        'pomodoro.music_override.short_break': 'nature',
        'pomodoro.music_override.long_break': 'nature',
      };
      return data[p];
    },
    getPidPath: () => TEST_PID_PATH,
    getStatusPath: () => TEST_STATUS_PATH,
  };
}

function createMockNotifier() {
  const calls = [];
  return { calls, notify: async (event, vars) => calls.push({ event, vars }) };
}

function createMockBGM() {
  const calls = [];
  return { calls, switchMode: async (mode) => calls.push({ method: 'switchMode', mode }) };
}

describe('PomodoroTimer', () => {
  it('initializes in stopped state', () => {
    const PomodoroTimer = require('../scripts/core/pomodoro.js');
    const timer = new PomodoroTimer(createMockConfig(), createMockNotifier(), createMockBGM());
    const status = timer.status();
    assert.strictEqual(status.phase, 'stopped');
    assert.strictEqual(status.session_number, 0);
    assert.strictEqual(status.is_paused, false);
  });

  it('starts in work phase', () => {
    const PomodoroTimer = require('../scripts/core/pomodoro.js');
    const timer = new PomodoroTimer(createMockConfig(), createMockNotifier(), createMockBGM());
    timer.start();
    const status = timer.status();
    assert.strictEqual(status.phase, 'work');
    assert.strictEqual(status.session_number, 1);
    assert.ok(status.remaining_seconds > 0);
    timer.stop();
  });

  it('stops the timer', () => {
    const PomodoroTimer = require('../scripts/core/pomodoro.js');
    const timer = new PomodoroTimer(createMockConfig(), createMockNotifier(), createMockBGM());
    timer.start();
    timer.stop();
    assert.strictEqual(timer.status().phase, 'stopped');
  });

  it('pauses and resumes', () => {
    const PomodoroTimer = require('../scripts/core/pomodoro.js');
    const timer = new PomodoroTimer(createMockConfig(), createMockNotifier(), createMockBGM());
    timer.start();
    timer.pause();
    assert.strictEqual(timer.status().is_paused, true);
    timer.resume();
    assert.strictEqual(timer.status().is_paused, false);
    timer.stop();
  });

  it('calculates break type correctly', () => {
    const PomodoroTimer = require('../scripts/core/pomodoro.js');
    const timer = new PomodoroTimer(createMockConfig(), createMockNotifier(), createMockBGM());
    assert.strictEqual(timer._getBreakType(1), 'short_break');
    assert.strictEqual(timer._getBreakType(3), 'short_break');
    assert.strictEqual(timer._getBreakType(4), 'long_break');
    assert.strictEqual(timer._getBreakType(8), 'long_break');
  });

  it('saves PID file when started', () => {
    const PomodoroTimer = require('../scripts/core/pomodoro.js');
    // Clean up before test
    try { fs.unlinkSync(TEST_PID_PATH); } catch { }
    const timer = new PomodoroTimer(createMockConfig(), createMockNotifier(), createMockBGM());
    timer.start();
    const pidExists = fs.existsSync(TEST_PID_PATH);
    timer.stop();
    assert.ok(pidExists, 'PID file should be created on start()');
    // After stop, PID file should be removed
    assert.strictEqual(fs.existsSync(TEST_PID_PATH), false, 'PID file should be removed on stop()');
  });

  it('re-arms warning timer on resume when work phase has more than 5 minutes left', () => {
    const PomodoroTimer = require('../scripts/core/pomodoro.js');
    const timer = new PomodoroTimer(createMockConfig(), createMockNotifier(), createMockBGM());
    timer.start();
    // Simulate being 10 minutes into the session (15 minutes remaining, > 5 min threshold)
    timer._endTime = Date.now() + 10 * 60 * 1000; // 10 minutes remaining
    timer.pause();
    // warningTimer should be null after pause
    assert.strictEqual(timer._warningTimer, null);
    timer.resume();
    // With 10 min remaining, warning timer should be re-armed (fires at 5 min mark)
    assert.notStrictEqual(timer._warningTimer, null, 'Warning timer should be re-armed on resume when > 5 min remaining');
    timer.stop();
  });

  it('does NOT re-arm warning timer on resume when work phase has 5 minutes or less left', () => {
    const PomodoroTimer = require('../scripts/core/pomodoro.js');
    const timer = new PomodoroTimer(createMockConfig(), createMockNotifier(), createMockBGM());
    timer.start();
    // Simulate being 22 minutes into the session (3 minutes remaining, <= 5 min threshold)
    timer._endTime = Date.now() + 3 * 60 * 1000; // 3 minutes remaining
    timer.pause();
    timer.resume();
    // With 3 min remaining (already past warning time), no warning timer should be set
    assert.strictEqual(timer._warningTimer, null, 'Warning timer should NOT be set when <= 5 min remaining');
    timer.stop();
  });
});

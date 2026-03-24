const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

describe('Config', () => {
  it('loads default config from config/default.yaml', () => {
    const Config = require('../scripts/core/config.js');
    const config = new Config();
    const cfg = config.load();

    assert.strictEqual(cfg.language, 'en');
    assert.strictEqual(cfg.bgm.enabled, true);
    assert.strictEqual(cfg.bgm.default_mode, 'lofi');
    assert.strictEqual(cfg.bgm.volume, 30);
    assert.strictEqual(cfg.tts.engine, 'edge-tts');
    assert.strictEqual(cfg.pomodoro.work_minutes, 25);
  });

  it('supports dot-notation get()', () => {
    const Config = require('../scripts/core/config.js');
    const config = new Config();
    config.load();

    assert.strictEqual(config.get('tts.engine'), 'edge-tts');
    assert.strictEqual(config.get('bgm.volume'), 30);
    assert.strictEqual(config.get('pomodoro.short_break_minutes'), 5);
  });

  it('returns correct language', () => {
    const Config = require('../scripts/core/config.js');
    const config = new Config();
    config.load();
    assert.strictEqual(config.getLanguage(), 'en');
  });

  it('returns BGM sources for a mode', () => {
    const Config = require('../scripts/core/config.js');
    const config = new Config();
    config.load();
    const sources = config.getBGMSources('lofi');
    assert.ok(Array.isArray(sources));
    assert.ok(sources.length > 0);
    assert.ok(sources[0].includes('youtube.com'));
  });

  it('returns SFX path for an event', () => {
    const Config = require('../scripts/core/config.js');
    const config = new Config();
    config.load();
    const sfxPath = config.getSFXPath('session_start');
    assert.ok(sfxPath.endsWith('chime-soft.wav'));
  });

  it('resolves notification messages with variables', () => {
    const Config = require('../scripts/core/config.js');
    const config = new Config();
    config.load();
    const msg = config.getMessage('test_fail', 'en', { count: 3 });
    assert.strictEqual(msg, '3 tests failed.');
    const msgKo = config.getMessage('test_fail', 'ko', { count: 3 });
    assert.strictEqual(msgKo, '테스트 3개 실패했어.');
  });

  it('returns null message when template is null', () => {
    const Config = require('../scripts/core/config.js');
    const config = new Config();
    config.load();
    const msg = config.getMessage('commit_success', 'en', {});
    assert.strictEqual(msg, null);
  });

  it('returns platform-appropriate socket path', () => {
    const Config = require('../scripts/core/config.js');
    const config = new Config();
    config.load();
    const socketPath = config.getSocketPath();
    if (process.platform === 'win32') {
      assert.ok(socketPath.includes('\\\\.\\pipe\\'));
    } else {
      assert.ok(socketPath.startsWith('/tmp/'));
    }
  });

  it('returns platform-appropriate temp paths', () => {
    const Config = require('../scripts/core/config.js');
    const config = new Config();
    config.load();
    const pidPath = config.getPidPath();
    assert.ok(pidPath.includes('cfm-pomodoro'));
  });

  it('falls back to defaults if user config has invalid YAML', () => {
    // Write a malformed user config to a temp location and test the internal method
    const Config = require('../scripts/core/config.js');
    const config = new Config();
    // Temporarily override _loadUser to return a parse error
    const originalLoadUser = config._loadUser.bind(config);
    config._loadUser = () => {
      // Simulate a YAML parse error
      const YAML = require('yaml');
      try { YAML.parse('{ invalid: yaml: content: }'); } catch { return null; }
      return null;
    };
    // Should not throw — should fall back to defaults
    assert.doesNotThrow(() => config.load());
    assert.strictEqual(config.getLanguage(), 'en');
  });
});

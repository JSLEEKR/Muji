const { describe, it } = require('node:test');
const assert = require('node:assert');

function createMockConfig() {
  return {
    get: (p) => {
      const data = {
        'notifications.enabled': true,
        'notifications.ducking.enabled': true,
        'notifications.ducking.duck_volume': 10,
        'notifications.ducking.fade_duration_ms': 100,
        'sfx.enabled': true,
        'sfx.volume': 80,
      };
      return data[p];
    },
    getSFXPath: (event) => {
      const map = { session_start: '/mock/chime-soft.wav', test_fail: '/mock/warn-soft.wav' };
      return map[event] || null;
    },
    getMessage: (event, lang, vars) => {
      if (event === 'session_start') return "Let's get started.";
      if (event === 'test_fail') return `${vars.count} tests failed.`;
      if (event === 'commit_success') return null;
      return null;
    },
    getLanguage: () => 'en',
    getMpvPath: () => 'mpv',
    getPluginDir: () => __dirname,
  };
}

function createMockBGM() {
  const calls = [];
  return {
    calls,
    getVolume: () => 30,
    setVolume: async (v) => calls.push({ method: 'setVolume', args: [v] }),
    fadeVolume: async (target, dur) => calls.push({ method: 'fadeVolume', args: [target, dur] }),
    isPlaying: () => true,
  };
}

function createMockTTS() {
  const calls = [];
  return {
    calls,
    synthesize: async (text, lang) => {
      calls.push({ method: 'synthesize', args: [text, lang] });
      return '/mock/tts-output.mp3';
    },
  };
}

describe('Notifier', () => {
  it('resolves message templates with variables', () => {
    const Notifier = require('../scripts/core/notify.js');
    const notifier = new Notifier(createMockConfig(), createMockBGM(), createMockTTS());
    const msg = notifier._resolveMessage('test_fail', { count: 3 });
    assert.strictEqual(msg, '3 tests failed.');
  });

  it('returns null for events with null message', () => {
    const Notifier = require('../scripts/core/notify.js');
    const notifier = new Notifier(createMockConfig(), createMockBGM(), createMockTTS());
    const msg = notifier._resolveMessage('commit_success', {});
    assert.strictEqual(msg, null);
  });

  it('queues notifications sequentially', async () => {
    const Notifier = require('../scripts/core/notify.js');
    const bgm = createMockBGM();
    const tts = createMockTTS();
    const notifier = new Notifier(createMockConfig(), bgm, tts);
    notifier._playSFX = async () => {};
    notifier._playAudio = async () => {};

    const p1 = notifier.notify('session_start');
    const p2 = notifier.notify('test_fail', { count: 2 });
    await p1;
    await p2;

    assert.strictEqual(tts.calls.length, 2);
  });
});

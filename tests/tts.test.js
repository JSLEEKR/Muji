const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const crypto = require('node:crypto');

function createMockConfig() {
  return {
    get: (p) => {
      const data = {
        'tts.engine': 'edge-tts',
        'tts.fallback_engine': 'system',
        'tts.cache_enabled': true,
        'tts.cache_dir': path.join(__dirname, '.test-tts-cache'),
        'tts.cache_max_mb': 200,
      };
      return data[p];
    },
    getTTSVoice: (engine, lang) => {
      const voices = {
        'edge-tts': { en: 'en-US-AriaNeural', ko: 'ko-KR-SunHiNeural' },
        espeak: { en: 'en', ko: 'ko' },
        system: { en: 'Samantha', ko: 'Yuna' },
      };
      return voices[engine]?.[lang] || null;
    },
    getLanguage: () => 'en',
  };
}

describe('TTSEngine', () => {
  it('generates a consistent cache key for same input', () => {
    const TTSEngine = require('../scripts/core/tts.js');
    const tts = new TTSEngine(createMockConfig());
    const key1 = tts._cacheKey('Hello', 'edge-tts', 'en-US-AriaNeural');
    const key2 = tts._cacheKey('Hello', 'edge-tts', 'en-US-AriaNeural');
    assert.strictEqual(key1, key2);
  });

  it('generates different cache keys for different text', () => {
    const TTSEngine = require('../scripts/core/tts.js');
    const tts = new TTSEngine(createMockConfig());
    const key1 = tts._cacheKey('Hello', 'edge-tts', 'en-US-AriaNeural');
    const key2 = tts._cacheKey('World', 'edge-tts', 'en-US-AriaNeural');
    assert.notStrictEqual(key1, key2);
  });

  it('resolves voice for engine and language', () => {
    const TTSEngine = require('../scripts/core/tts.js');
    const tts = new TTSEngine(createMockConfig());
    assert.strictEqual(tts._resolveVoice('edge-tts', 'en'), 'en-US-AriaNeural');
    assert.strictEqual(tts._resolveVoice('edge-tts', 'ko'), 'ko-KR-SunHiNeural');
  });

  it('builds correct edge-tts command', () => {
    const TTSEngine = require('../scripts/core/tts.js');
    const tts = new TTSEngine(createMockConfig());
    const cmd = tts._buildCommand('edge-tts', 'Hello world', 'en-US-AriaNeural', '/tmp/out.mp3');
    assert.ok(cmd.includes('edge-tts'));
    assert.ok(cmd.includes('--voice'));
    assert.ok(cmd.includes('en-US-AriaNeural'));
    assert.ok(cmd.includes('--text'));
  });

  it('builds correct espeak command', () => {
    const TTSEngine = require('../scripts/core/tts.js');
    const tts = new TTSEngine(createMockConfig());
    const cmd = tts._buildCommand('espeak', 'Hello', 'en', '/tmp/out.wav');
    assert.ok(cmd.includes('espeak'));
    assert.ok(cmd.includes('-v en'));
  });
});

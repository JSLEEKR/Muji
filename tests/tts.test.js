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
    const cmd = tts._buildCommand('edge-tts', 'Hello world', 'en-US-AriaNeural', '/tmp/out.mp3', 'en');
    // On Windows, command is "python -m edge_tts"; on Unix, "edge-tts"
    assert.ok(cmd.includes('edge_tts') || cmd.includes('edge-tts'));
    assert.ok(cmd.includes('--voice'));
    assert.ok(cmd.includes('en-US-AriaNeural'));
    assert.ok(cmd.includes('--text'));
  });

  it('builds correct espeak command', () => {
    const TTSEngine = require('../scripts/core/tts.js');
    const tts = new TTSEngine(createMockConfig());
    const cmd = tts._buildCommand('espeak', 'Hello', 'en', '/tmp/out.wav', 'en');
    assert.ok(cmd.includes('espeak'));
    assert.ok(cmd.includes('-v "en"'));
  });

  it('quotes voice in espeak command to prevent shell injection', () => {
    const TTSEngine = require('../scripts/core/tts.js');
    const tts = new TTSEngine(createMockConfig());
    const cmd = tts._buildCommand('espeak', 'Hello', 'en+f3', '/tmp/out.wav', 'en');
    assert.ok(cmd.includes('-v "en+f3"'), 'espeak voice should be quoted');
  });

  it('quotes voice in pico2wave/system-linux command to prevent shell injection', () => {
    const TTSEngine = require('../scripts/core/tts.js');
    const tts = new TTSEngine(createMockConfig());
    // Build a system command for Linux (non-darwin)
    const origPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
    try {
      const cmd = tts._buildCommand('system', 'Hello', 'en-US', '/tmp/out.mp3', 'en');
      assert.ok(cmd.includes('-l "en-US"'), 'pico2wave voice should be quoted');
      assert.ok(cmd.includes('-v "en-US"'), 'espeak-ng fallback voice should be quoted');
    } finally {
      if (origPlatform) Object.defineProperty(process, 'platform', origPlatform);
      else Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
    }
  });

  it('escapes double quotes in text for edge-tts command', () => {
    const TTSEngine = require('../scripts/core/tts.js');
    const tts = new TTSEngine(createMockConfig());
    const cmd = tts._buildCommand('edge-tts', 'Say "hello"', 'en-US-AriaNeural', '/tmp/out.mp3', 'en');
    // The double-quote should be escaped as \"
    assert.ok(cmd.includes('\\"hello\\"'), 'Double quotes in text should be escaped');
  });

  it('escapes backticks in text to prevent command substitution', () => {
    const TTSEngine = require('../scripts/core/tts.js');
    const tts = new TTSEngine(createMockConfig());
    const cmd = tts._buildCommand('edge-tts', 'Run `ls`', 'en-US-AriaNeural', '/tmp/out.mp3', 'en');
    assert.ok(cmd.includes('\\`'), 'Backticks in text should be escaped');
  });

  it('sanitizes ElevenLabs voiceId and apiKey to prevent shell injection', () => {
    const TTSEngine = require('../scripts/core/tts.js');
    const mockConfig = {
      ...createMockConfig(),
      get: (p) => {
        const data = {
          'tts.engine': 'elevenlabs',
          'tts.fallback_engine': 'system',
          'tts.cache_enabled': false,
          'tts.engines.elevenlabs.api_key': 'key"; rm -rf /',
          'tts.engines.elevenlabs.voice_id': 'id$(whoami)',
          'tts.engines.elevenlabs.model_id': 'eleven_flash_v2_5',
        };
        return data[p];
      },
      getTTSVoice: () => null,
      getLanguage: () => 'en',
    };
    const tts = new TTSEngine(mockConfig);
    // voice=null so it falls back to voice_id from config which contains $(whoami)
    const cmd = tts._buildCommand('elevenlabs', 'Hello', null, '/tmp/out.mp3', 'en');
    // The voiceId and apiKey should have dangerous characters stripped
    assert.ok(!cmd.includes('$('), 'voiceId should not contain $() after sanitization');
    assert.ok(!cmd.includes('rm -rf'), 'apiKey should not contain shell commands after sanitization');
    // Should still contain the safe alphanumeric parts
    assert.ok(cmd.includes('idwhoami'), 'safe alphanumeric part of voiceId should remain');
    assert.ok(cmd.includes('key'), 'safe alphanumeric part of apiKey should remain');
  });

  it('uses default voice_id for ElevenLabs when per-language voice is empty', () => {
    const TTSEngine = require('../scripts/core/tts.js');
    const mockConfig = {
      ...createMockConfig(),
      get: (p) => {
        const data = {
          'tts.engine': 'elevenlabs',
          'tts.fallback_engine': 'system',
          'tts.cache_enabled': false,
          'tts.engines.elevenlabs.api_key': 'testkey123',
          'tts.engines.elevenlabs.voice_id': '21m00Tcm4TlvDq8ikWAM',
          'tts.engines.elevenlabs.model_id': 'eleven_flash_v2_5',
        };
        return data[p];
      },
      // Simulates empty voices.en in default.yaml — getTTSVoice returns null
      getTTSVoice: () => null,
      getLanguage: () => 'en',
    };
    const tts = new TTSEngine(mockConfig);
    // _resolveVoice should return null (not 'en'), so _buildCommand falls through to voice_id
    const voice = tts._resolveVoice('elevenlabs', 'en');
    assert.strictEqual(voice, null, '_resolveVoice should return null, not the language code');
    const cmd = tts._buildCommand('elevenlabs', 'Hello', voice, '/tmp/out.mp3', 'en');
    assert.ok(cmd.includes('21m00Tcm4TlvDq8ikWAM'), 'Should use default voice_id, not language code');
    assert.ok(!cmd.includes('/v1/text-to-speech/en'), 'Should NOT use bare language code as voice ID');
  });

  it('falls back to lang for edge-tts when voice is null', () => {
    const TTSEngine = require('../scripts/core/tts.js');
    const mockConfig = {
      ...createMockConfig(),
      getTTSVoice: () => null,
    };
    const tts = new TTSEngine(mockConfig);
    const cmd = tts._buildCommand('edge-tts', 'Hello', null, '/tmp/out.mp3', 'en');
    assert.ok(cmd.includes('--voice "en"'), 'Should fall back to lang when voice is null');
  });

  it('throws for unknown TTS engine', () => {
    const TTSEngine = require('../scripts/core/tts.js');
    const tts = new TTSEngine(createMockConfig());
    assert.throws(
      () => tts._buildCommand('unknown-engine', 'Hello', 'en', '/tmp/out.mp3', 'en'),
      /Unknown TTS engine/,
    );
  });

  it('replaces newlines in text with spaces to prevent shell command breakage', () => {
    const TTSEngine = require('../scripts/core/tts.js');
    const tts = new TTSEngine(createMockConfig());
    // A literal newline inside a double-quoted shell argument terminates the argument
    // on most shells. It must be replaced with a space.
    const cmd = tts._buildCommand('edge-tts', 'Hello\nWorld', 'en-US-AriaNeural', '/tmp/out.mp3', 'en');
    assert.ok(!cmd.includes('\n'), 'Newlines must not appear in the shell command');
    assert.ok(cmd.includes('Hello World'), 'Newline should be replaced with a space');
  });

  it('replaces carriage-return+newline with a space', () => {
    const TTSEngine = require('../scripts/core/tts.js');
    const tts = new TTSEngine(createMockConfig());
    const cmd = tts._buildCommand('edge-tts', 'Hello\r\nWorld', 'en-US-AriaNeural', '/tmp/out.mp3', 'en');
    assert.ok(!cmd.includes('\r') && !cmd.includes('\n'), 'CR/LF must not appear in the shell command');
  });

  it('_cleanCache skips files deleted between readdir and stat (TOCTOU)', () => {
    const TTSEngine = require('../scripts/core/tts.js');
    const fs = require('node:fs');
    const path = require('node:path');
    const os = require('node:os');

    const tts = new TTSEngine(createMockConfig());

    // Create a temporary cache dir with 2 files
    const tmpCacheDir = path.join(os.tmpdir(), `muji-test-cache-${Date.now()}`);
    fs.mkdirSync(tmpCacheDir, { recursive: true });
    const file1 = path.join(tmpCacheDir, 'aaa.mp3');
    const file2 = path.join(tmpCacheDir, 'bbb.mp3');
    fs.writeFileSync(file1, Buffer.alloc(1024));
    fs.writeFileSync(file2, Buffer.alloc(1024));

    tts._cacheDir = tmpCacheDir;
    tts._cacheMaxMb = 0.000001; // Force cleanup of everything

    // Patch statSync to throw ENOENT for one file, simulating a race condition
    const realStatSync = fs.statSync.bind(fs);
    let throwOnce = true;
    const origStatSync = fs.statSync;
    fs.statSync = function(p, ...args) {
      if (throwOnce && p === file1) {
        throwOnce = false;
        const err = new Error('ENOENT: no such file or directory');
        err.code = 'ENOENT';
        throw err;
      }
      return realStatSync(p, ...args);
    };

    // Should not throw and should still process remaining files
    assert.doesNotThrow(() => tts._cleanCache());

    // Restore
    fs.statSync = origStatSync;

    // Cleanup
    try { fs.rmSync(tmpCacheDir, { recursive: true }); } catch { }
  });
});

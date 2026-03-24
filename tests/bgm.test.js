const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

function createMockConfig() {
  return {
    get: (path) => {
      const data = {
        'bgm.enabled': true,
        'bgm.default_mode': 'lofi',
        'bgm.volume': 30,
        'bgm.mpv.extra_args': ['--no-video', '--really-quiet', '--loop=inf'],
      };
      return data[path];
    },
    getBGMSources: (mode) => {
      const sources = {
        lofi: ['https://www.youtube.com/watch?v=jfKfPfyJRdk'],
        jazz: ['https://www.youtube.com/watch?v=rUxyKA_-grg'],
        silence: [],
      };
      return sources[mode] || [];
    },
    getSocketPath: () => '\\\\.\\pipe\\muji-bgm-test',
    getPluginDir: () => __dirname,
  };
}

describe('BGMManager', () => {
  it('initializes with correct defaults', () => {
    const BGMManager = require('../scripts/core/bgm.js');
    const mgr = new BGMManager(createMockConfig());
    assert.strictEqual(mgr.isPlaying(), false);
    assert.strictEqual(mgr._currentMode, null);
    assert.strictEqual(mgr._volume, 30);
  });

  it('resolves sources for a mode', () => {
    const BGMManager = require('../scripts/core/bgm.js');
    const mgr = new BGMManager(createMockConfig());
    const sources = mgr._resolveSources('lofi');
    assert.ok(sources.length > 0);
  });

  it('returns empty sources for silence mode', () => {
    const BGMManager = require('../scripts/core/bgm.js');
    const mgr = new BGMManager(createMockConfig());
    const sources = mgr._resolveSources('silence');
    assert.strictEqual(sources.length, 0);
  });

  it('tracks volume changes internally', () => {
    const BGMManager = require('../scripts/core/bgm.js');
    const mgr = new BGMManager(createMockConfig());
    mgr._volume = 50;
    assert.strictEqual(mgr.getVolume(), 50);
  });

  it('clamps volume to 0-100 range', () => {
    const BGMManager = require('../scripts/core/bgm.js');
    const mgr = new BGMManager(createMockConfig());
    assert.strictEqual(mgr._clampVolume(150), 100);
    assert.strictEqual(mgr._clampVolume(-10), 0);
    assert.strictEqual(mgr._clampVolume(50), 50);
  });

  it('preserves volume=0 without defaulting to 30', () => {
    const BGMManager = require('../scripts/core/bgm.js');
    const zeroVolumeConfig = {
      ...createMockConfig(),
      get: (p) => {
        if (p === 'bgm.volume') return 0;
        return createMockConfig().get(p);
      },
    };
    const mgr = new BGMManager(zeroVolumeConfig);
    assert.strictEqual(mgr._volume, 0);
  });

  it('fadeVolume with durationMs=0 sets volume instantly', async () => {
    const BGMManager = require('../scripts/core/bgm.js');
    const mgr = new BGMManager(createMockConfig());
    mgr._volume = 30;
    // Override setVolume to avoid IPC calls (no mpv running)
    const volumesSeen = [];
    mgr.setVolume = async (v) => { mgr._volume = mgr._clampVolume(v); volumesSeen.push(mgr._volume); };
    await mgr.fadeVolume(80, 0);
    // Should set to target in a single step, not 10 steps
    assert.strictEqual(volumesSeen.length, 1);
    assert.strictEqual(mgr._volume, 80);
  });
});

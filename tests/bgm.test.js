const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const testPidPath = path.join(os.tmpdir(), 'muji-bgm-test.pid');

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
    getMpvPath: () => 'mpv',
    getPluginDir: () => __dirname,
    getBgmPidPath: () => testPidPath,
  };
}

function cleanupTestPid() {
  try { fs.unlinkSync(testPidPath); } catch { }
}

describe('BGMManager', () => {
  beforeEach(() => {
    cleanupTestPid();
  });

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
    const volumesSeen = [];
    mgr.setVolume = async (v) => { mgr._volume = mgr._clampVolume(v); volumesSeen.push(mgr._volume); };
    await mgr.fadeVolume(80, 0);
    assert.strictEqual(volumesSeen.length, 1);
    assert.strictEqual(mgr._volume, 80);
  });

  it('isPlayingGlobal returns false when no PID file exists', () => {
    const BGMManager = require('../scripts/core/bgm.js');
    const mgr = new BGMManager(createMockConfig());
    assert.strictEqual(mgr.isPlayingGlobal(), false);
  });

  it('isPlayingGlobal returns false when PID file has stale PID', () => {
    const BGMManager = require('../scripts/core/bgm.js');
    const mgr = new BGMManager(createMockConfig());
    // Write a PID that almost certainly does not exist
    fs.writeFileSync(testPidPath, '999999999', 'utf8');
    assert.strictEqual(mgr.isPlayingGlobal(), false);
    cleanupTestPid();
  });

  it('isPlayingGlobal returns true for own process PID', () => {
    const BGMManager = require('../scripts/core/bgm.js');
    const mgr = new BGMManager(createMockConfig());
    // Write our own PID — we are definitely alive
    fs.writeFileSync(testPidPath, String(process.pid), 'utf8');
    assert.strictEqual(mgr.isPlayingGlobal(), true);
    cleanupTestPid();
  });

  it('_writePid and _readPid round-trip correctly', () => {
    const BGMManager = require('../scripts/core/bgm.js');
    const mgr = new BGMManager(createMockConfig());
    mgr._writePid(12345);
    assert.strictEqual(mgr._readPid(), 12345);
    mgr._cleanupPid();
    assert.strictEqual(mgr._readPid(), null);
  });

  it('_killExisting cleans up PID file', async () => {
    const BGMManager = require('../scripts/core/bgm.js');
    const mgr = new BGMManager(createMockConfig());
    // Write a stale PID
    fs.writeFileSync(testPidPath, '999999999', 'utf8');
    await mgr._killExisting();
    assert.strictEqual(fs.existsSync(testPidPath), false);
  });
});

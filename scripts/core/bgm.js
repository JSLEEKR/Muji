const { spawn } = require('node:child_process');
const net = require('node:net');
const fs = require('node:fs');

class BGMManager {
  constructor(config) {
    this._config = config;
    this._process = null;
    this._currentMode = null;
    this._volume = config.get('bgm.volume') || 30;
    this._socketPath = config.getSocketPath();
    this._restartAttempted = false;
  }

  async start(mode) {
    if (!this._config.get('bgm.enabled')) return;
    mode = mode || this._config.get('bgm.default_mode');
    const sources = this._resolveSources(mode);
    if (sources.length === 0) {
      this._currentMode = mode;
      return;
    }
    await this.stop();
    await this._spawnMpv(sources[0]);
    this._currentMode = mode;
  }

  async stop() {
    if (this._process) {
      try { this._process.kill(); } catch { /* already exited */ }
      this._process = null;
    }
    this._currentMode = null;
    this._cleanup();
  }

  async switchMode(mode) {
    await this.stop();
    await this.start(mode);
  }

  async playUrl(url) {
    await this.stop();
    await this._spawnMpv(url);
    this._currentMode = 'custom';
  }

  async setVolume(level) {
    this._volume = this._clampVolume(level);
    if (this._process) {
      await this._sendIPC(['set_property', 'volume', this._volume]);
    }
  }

  getVolume() {
    return this._volume;
  }

  async fadeVolume(target, durationMs) {
    target = this._clampVolume(target);
    const steps = 10;
    const stepDuration = durationMs / steps;
    const current = this._volume;
    const diff = target - current;
    for (let i = 1; i <= steps; i++) {
      const vol = Math.round(current + (diff * i) / steps);
      await this.setVolume(vol);
      await this._sleep(stepDuration);
    }
  }

  async pause() {
    if (this._process) {
      await this._sendIPC(['set_property', 'pause', true]);
    }
  }

  async resume() {
    if (this._process) {
      await this._sendIPC(['set_property', 'pause', false]);
    }
  }

  isPlaying() {
    return this._process !== null && !this._process.killed;
  }

  _resolveSources(mode) {
    return this._config.getBGMSources(mode) || [];
  }

  _clampVolume(vol) {
    return Math.max(0, Math.min(100, Math.round(vol)));
  }

  async _spawnMpv(source) {
    const extraArgs = this._config.get('bgm.mpv.extra_args') || [];
    const args = [
      ...extraArgs,
      `--volume=${this._volume}`,
      `--input-ipc-server=${this._socketPath}`,
      source,
    ];
    return new Promise((resolve, reject) => {
      try {
        this._process = spawn('mpv', args, { stdio: 'ignore', detached: false });
        this._process.on('error', (err) => {
          console.error('[CFM] mpv error:', err.message);
          this._process = null;
          if (!this._restartAttempted) {
            this._restartAttempted = true;
            this._spawnMpv(source).then(() => {
              this._restartAttempted = false;
            }).catch(() => {
              console.error('[CFM] mpv restart failed. BGM disabled.');
            });
          }
        });
        this._process.on('exit', (code) => {
          if (code !== 0 && code !== null) {
            console.warn(`[CFM] mpv exited with code ${code}`);
          }
          this._process = null;
        });
        setTimeout(resolve, 500);
      } catch (err) {
        console.error('[CFM] Failed to spawn mpv:', err.message);
        reject(err);
      }
    });
  }

  async _sendIPC(command) {
    return new Promise((resolve) => {
      let resolved = false;
      function done(value) {
        if (!resolved) { resolved = true; clearTimeout(timer); resolve(value); }
      }
      const client = net.connect(this._socketPath);
      let data = '';
      client.on('connect', () => {
        client.write(JSON.stringify({ command }) + '\n');
      });
      client.on('data', (chunk) => {
        data += chunk;
        try { const parsed = JSON.parse(data); client.end(); done(parsed); } catch { }
      });
      client.on('error', () => { done(null); });
      client.on('end', () => {
        try { done(data ? JSON.parse(data) : null); } catch { done(null); }
      });
      const timer = setTimeout(() => { client.destroy(); done(null); }, 2000);
    });
  }

  _cleanup() {
    if (process.platform !== 'win32') {
      try { fs.unlinkSync(this._socketPath); } catch { }
    }
  }

  _sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
}

module.exports = BGMManager;

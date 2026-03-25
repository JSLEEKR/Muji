const { spawn } = require('node:child_process');
const net = require('node:net');
const fs = require('node:fs');

class BGMManager {
  constructor(config) {
    this._config = config;
    this._process = null;
    this._currentMode = null;
    this._volume = config.get('bgm.volume') ?? 30;
    this._socketPath = config.getSocketPath();
    this._mpvPath = config.getMpvPath();
    this._pidPath = config.getBgmPidPath();
    this._lockPath = config.getBgmPidPath() + '.lock';
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
    await this._stopGlobal();
    await this._spawnMpv(sources[0]);
    this._currentMode = mode;
  }

  async stop() {
    if (this._process) {
      try { this._process.kill(); } catch { /* already exited */ }
      this._process = null;
    }
    this._currentMode = null;
    this._restartAttempted = false;
    this._cleanupPid();
    this._cleanup();
  }

  async switchMode(mode) {
    await this._stopGlobal();
    await this.start(mode);
  }

  async playUrl(url) {
    await this._stopGlobal();
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
    if (!durationMs || durationMs <= 0) {
      await this.setVolume(target);
      return;
    }
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

  isPlayingGlobal() {
    const pid = this._readPid();
    if (pid === null) return false;
    return this._isProcessAlive(pid);
  }

  _resolveSources(mode) {
    return this._config.getBGMSources(mode) || [];
  }

  _clampVolume(vol) {
    return Math.max(0, Math.min(100, Math.round(vol)));
  }

  /**
   * Stop any globally running mpv BGM process with exclusive locking
   * to prevent race conditions across multiple Claude Code windows.
   */
  async _stopGlobal() {
    let lockFd = null;
    try {
      lockFd = this._acquireLock();

      // Kill our own local process
      if (this._process) {
        try { this._process.kill(); } catch { /* already exited */ }
        this._process = null;
      }

      // Kill global process via PID file
      const pid = this._readPid();
      if (pid !== null && this._isProcessAlive(pid)) {
        try { process.kill(pid); } catch { /* already exited */ }
        // Wait briefly for process to actually terminate
        for (let i = 0; i < 10; i++) {
          if (!this._isProcessAlive(pid)) break;
          await this._sleep(100);
        }
      }

      this._cleanupPid();
      this._cleanup();
      this._currentMode = null;
      this._restartAttempted = false;
    } finally {
      this._releaseLock(lockFd);
    }
  }

  _acquireLock() {
    try {
      const fd = fs.openSync(this._lockPath, 'wx');
      fs.writeSync(fd, String(process.pid));
      return fd;
    } catch {
      // Lock exists — check if holder is still alive (stale lock detection)
      try {
        const holderPid = parseInt(fs.readFileSync(this._lockPath, 'utf8').trim(), 10);
        if (!isNaN(holderPid) && !this._isProcessAlive(holderPid)) {
          try { fs.unlinkSync(this._lockPath); } catch { }
          try {
            const fd = fs.openSync(this._lockPath, 'wx');
            fs.writeSync(fd, String(process.pid));
            return fd;
          } catch { return null; }
        }
      } catch { }
      return null;
    }
  }

  _releaseLock(fd) {
    if (fd !== null) {
      try { fs.closeSync(fd); } catch { }
    }
    try { fs.unlinkSync(this._lockPath); } catch { }
  }

  _readPid() {
    try {
      const content = fs.readFileSync(this._pidPath, 'utf8').trim();
      const pid = parseInt(content, 10);
      return isNaN(pid) ? null : pid;
    } catch {
      return null;
    }
  }

  _writePid(pid) {
    try {
      // Atomic write: temp file → rename
      const tmpPath = this._pidPath + '.tmp';
      fs.writeFileSync(tmpPath, String(pid), 'utf8');
      fs.renameSync(tmpPath, this._pidPath);
    } catch {
      try { fs.writeFileSync(this._pidPath, String(pid), 'utf8'); } catch { }
    }
  }

  _cleanupPid() {
    try { fs.unlinkSync(this._pidPath); } catch { }
    try { fs.unlinkSync(this._pidPath + '.tmp'); } catch { }
  }

  _isProcessAlive(pid) {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
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
        const env = { ...process.env };
        if (process.platform === 'win32') {
          const pyScripts = this._config.get('advanced.python_scripts_dir');
          if (pyScripts) {
            env.PATH = `${pyScripts};${env.PATH || ''}`;
          }
        }
        this._process = spawn(this._mpvPath, args, { stdio: 'ignore', detached: true, env });
        this._process.unref();
        if (this._process.pid) {
          this._writePid(this._process.pid);
        }
        this._process.on('error', (err) => {
          console.error('[Muji] mpv error:', err.message);
          this._process = null;
          this._cleanupPid();
          if (!this._restartAttempted) {
            this._restartAttempted = true;
            this._spawnMpv(source).then(() => {
              this._restartAttempted = false;
            }).catch(() => {
              console.error('[Muji] mpv restart failed. BGM disabled.');
              this._restartAttempted = false;
            });
          }
        });
        this._process.on('exit', (code) => {
          if (code !== 0 && code !== null) {
            console.warn(`[Muji] mpv exited with code ${code}`);
          }
          this._process = null;
          this._cleanupPid();
        });
        setTimeout(resolve, 500);
      } catch (err) {
        console.error('[Muji] Failed to spawn mpv:', err.message);
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

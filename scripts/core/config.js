const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const YAML = require('yaml');

class Config {
  constructor() {
    this._config = null;
    this._pluginDir = path.resolve(__dirname, '..', '..');
  }

  load() {
    const defaults = this._loadDefault();
    const user = this._loadUser();
    this._config = user ? this._merge(defaults, user) : defaults;
    this._validate(this._config);
    return this._config;
  }

  get(dotPath) {
    if (!this._config) this.load();
    return dotPath.split('.').reduce((obj, key) => obj?.[key], this._config);
  }

  getLanguage() {
    return this.get('language') || 'en';
  }

  getTTSVoice(engine, lang) {
    let voices = this.get(`tts.engines.${engine}.voices`);
    // The system engine stores macOS voices under 'macos_voices'
    if (!voices && engine === 'system' && process.platform === 'darwin') {
      voices = this.get('tts.engines.system.macos_voices');
    }
    if (!voices) return null;
    return voices[lang] || voices['en'] || null;
  }

  getBGMSources(mode) {
    const modeConfig = this.get(`bgm.modes.${mode}`);
    return modeConfig?.sources || [];
  }

  getSFXPath(event) {
    const filename = this.get(`sfx.events.${event}`);
    if (!filename) return null;
    return path.join(this._pluginDir, 'sounds', filename);
  }

  getMessage(event, lang, vars = {}) {
    const messages = this.get(`notifications.messages.${event}`);
    if (!messages) return null;
    const template = messages[lang] ?? messages['en'] ?? null;
    if (template === null) return null;
    return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
  }

  getSocketPath() {
    if (process.platform === 'win32') {
      return '\\\\.\\pipe\\muji-bgm-socket';
    }
    return this.get('bgm.mpv.socket_path') || '/tmp/muji-bgm-socket';
  }

  getPidPath() {
    const tmpDir = process.platform === 'win32' ? os.tmpdir() : '/tmp';
    return path.join(tmpDir, 'muji-pomodoro.pid');
  }

  getBgmPidPath() {
    const tmpDir = process.platform === 'win32' ? os.tmpdir() : '/tmp';
    return path.join(tmpDir, 'muji-bgm.pid');
  }

  getActivityPath() {
    const tmpDir = process.platform === 'win32' ? os.tmpdir() : '/tmp';
    return path.join(tmpDir, 'muji-last-activity.json');
  }

  getStatusPath() {
    const tmpDir = process.platform === 'win32' ? os.tmpdir() : '/tmp';
    return path.join(tmpDir, 'muji-pomodoro-status.json');
  }

  getPluginDir() {
    return this._pluginDir;
  }

  getMpvPath() {
    // User can override in config: bgm.mpv.path
    const configured = this.get('bgm.mpv.path');
    if (configured) return configured;
    // Auto-detect on Windows where mpv is often not in PATH
    if (process.platform === 'win32') {
      const fs = require('node:fs');
      const candidates = [
        'C:\\Program Files\\MPV Player\\mpv.exe',
        'C:\\Program Files (x86)\\MPV Player\\mpv.exe',
      ];
      for (const p of candidates) {
        if (fs.existsSync(p)) return p;
      }
    }
    return 'mpv'; // fallback to PATH
  }

  _validate(config) {
    if (!config || typeof config !== 'object') {
      throw new Error('[Muji] Config is null or not an object');
    }
    const required = ['language', 'tts', 'bgm', 'sfx', 'notifications', 'pomodoro'];
    for (const key of required) {
      if (!config[key]) {
        console.warn(`[Muji] Config missing required section: ${key}`);
      }
    }
    if (config.bgm?.volume !== undefined) {
      if (config.bgm.volume < 0 || config.bgm.volume > 100) {
        console.warn('[Muji] bgm.volume must be 0-100, clamping');
        config.bgm.volume = Math.max(0, Math.min(100, config.bgm.volume));
      }
    }
  }

  _loadDefault() {
    const defaultPath = path.join(this._pluginDir, 'config', 'default.yaml');
    const content = fs.readFileSync(defaultPath, 'utf8');
    const parsed = YAML.parse(content);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error(`[Muji] default.yaml is empty or invalid`);
    }
    return parsed;
  }

  _loadUser() {
    const home = os.homedir();
    const userPath = path.join(home, '.claude', '.muji', 'config.yaml');
    if (!fs.existsSync(userPath)) return null;
    try {
      const content = fs.readFileSync(userPath, 'utf8');
      const parsed = YAML.parse(content);
      // YAML.parse returns null for empty files; treat as "no user config"
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch (err) {
      console.warn(`[Muji] Failed to load user config (${userPath}): ${err.message}. Using defaults.`);
      return null;
    }
  }

  _merge(defaults, user) {
    return this._deepMerge(defaults, user);
  }

  _deepMerge(target, source) {
    const result = { ...target };
    for (const key of Object.keys(source)) {
      if (
        source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) &&
        target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])
      ) {
        result[key] = this._deepMerge(target[key], source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }
}

module.exports = Config;

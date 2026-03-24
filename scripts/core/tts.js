const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

class TTSEngine {
  constructor(config) {
    this._config = config;
    this._engine = config.get('tts.engine') || 'edge-tts';
    this._fallback = config.get('tts.fallback_engine') || 'system';
    this._cacheEnabled = config.get('tts.cache_enabled') !== false;
    this._cacheDir = config.get('tts.cache_dir')?.replace('~', os.homedir())
      || path.join(os.homedir(), '.claude', '.muji', 'tts-cache');
    this._cacheMaxMb = config.get('tts.cache_max_mb') ?? 200;
  }

  async synthesize(text, lang) {
    lang = lang || this._config.getLanguage();
    const voice = this._resolveVoice(this._engine, lang);
    if (this._cacheEnabled) {
      const cached = this._getCachedPath(text, this._engine, voice);
      if (cached) return cached;
    }
    const ext = this._engine === 'espeak' ? 'wav' : 'mp3';
    const outPath = path.join(os.tmpdir(), `muji-tts-${Date.now()}.${ext}`);
    try {
      const cmd = this._buildCommand(this._engine, text, voice, outPath);
      execSync(cmd, { timeout: 15000, stdio: 'pipe' });
      if (this._cacheEnabled && fs.existsSync(outPath)) {
        this._saveToCache(outPath, text, this._engine, voice);
      }
      return outPath;
    } catch (err) {
      console.warn(`[Muji] TTS engine '${this._engine}' failed:`, err.message);
      if (this._fallback && this._fallback !== this._engine) {
        const fbVoice = this._resolveVoice(this._fallback, lang);
        try {
          const cmd = this._buildCommand(this._fallback, text, fbVoice, outPath);
          execSync(cmd, { timeout: 15000, stdio: 'pipe' });
          return outPath;
        } catch (fbErr) {
          console.error(`[Muji] Fallback TTS '${this._fallback}' also failed:`, fbErr.message);
        }
      }
      // Both primary and fallback failed. Remove any partial temp file so it doesn't
      // get picked up by callers expecting a valid audio file.
      try { if (fs.existsSync(outPath)) fs.unlinkSync(outPath); } catch { }
      return null;
    }
  }

  async getAvailableEngines() {
    const engines = [];
    const checks = {
      'edge-tts': 'edge-tts --help',
      espeak: 'espeak-ng --help',
      system: process.platform === 'darwin' ? 'which say' : 'which spd-say',
    };
    for (const [name, cmd] of Object.entries(checks)) {
      try { execSync(cmd, { stdio: 'pipe', timeout: 5000 }); engines.push(name); } catch { }
    }
    return engines;
  }

  async testEngine(engine) {
    const testText = 'test';
    const outPath = path.join(os.tmpdir(), `muji-tts-test-${Date.now()}.mp3`);
    const voice = this._resolveVoice(engine, 'en');
    try {
      const cmd = this._buildCommand(engine, testText, voice, outPath);
      execSync(cmd, { timeout: 10000, stdio: 'pipe' });
      const exists = fs.existsSync(outPath);
      try { fs.unlinkSync(outPath); } catch { }
      return exists;
    } catch { return false; }
  }

  _resolveVoice(engine, lang) {
    return this._config.getTTSVoice(engine, lang) || lang;
  }

  _buildCommand(engine, text, voice, outPath) {
    // Sanitize text for safe embedding in shell double-quoted strings.
    // Escape backslash first, then double-quote, then $ and backtick (Unix shell expansion).
    // Replace newlines/carriage-returns with a space — a literal newline inside a
    // double-quoted shell string terminates the argument on most shells/platforms.
    const safeText = text
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\$/g, '\\$')
      .replace(/`/g, '\\`')
      .replace(/\r?\n|\r/g, ' ');
    switch (engine) {
      case 'edge-tts':
        return `edge-tts --voice "${voice}" --text "${safeText}" --write-media "${outPath}"`;
      case 'elevenlabs': {
        const apiKey = this._config.get('tts.engines.elevenlabs.api_key') || process.env.ELEVENLABS_API_KEY || '';
        const voiceId = voice || this._config.get('tts.engines.elevenlabs.voice_id') || '';
        const modelId = this._config.get('tts.engines.elevenlabs.model_id') || 'eleven_flash_v2_5';
        // Sanitize voiceId and apiKey: strip anything that isn't alphanumeric, dash, or underscore
        const safeVoiceId = voiceId.replace(/[^a-zA-Z0-9_-]/g, '');
        const safeApiKey = apiKey.replace(/[^a-zA-Z0-9_-]/g, '');
        // Use JSON.stringify for the body to avoid shell injection in the JSON payload
        const body = JSON.stringify({ text: text, model_id: modelId });
        const safeBody = body.replace(/'/g, "'\\''");
        return `curl -s -X POST "https://api.elevenlabs.io/v1/text-to-speech/${safeVoiceId}" -H "xi-api-key: ${safeApiKey}" -H "Content-Type: application/json" -d '${safeBody}' --output "${outPath}"`;
      }
      case 'coqui': {
        const model = this._config.get('tts.engines.coqui.model') || 'tts_models/en/ljspeech/tacotron2-DDC';
        return `tts --text "${safeText}" --model_name "${model}" --out_path "${outPath}"`;
      }
      case 'espeak':
        return `espeak-ng -v ${voice} -w "${outPath}" "${safeText}"`;
      case 'system':
        if (process.platform === 'darwin') {
          const aiffPath = outPath.replace(/\.\w+$/, '.aiff');
          return `say -v "${voice}" -o "${aiffPath}" "${safeText}" && ffmpeg -y -i "${aiffPath}" "${outPath}" 2>/dev/null && rm -f "${aiffPath}"`;
        }
        return `pico2wave -l ${voice} -w "${outPath}" "${safeText}" 2>/dev/null || espeak-ng -v ${voice} -w "${outPath}" "${safeText}"`;
      default:
        throw new Error(`Unknown TTS engine: ${engine}`);
    }
  }

  _cacheKey(text, engine, voice) {
    return crypto.createHash('sha256').update(`${engine}:${voice}:${text}`).digest('hex');
  }

  _getCachedPath(text, engine, voice) {
    const hash = this._cacheKey(text, engine, voice);
    for (const ext of ['mp3', 'wav', 'aiff']) {
      const p = path.join(this._cacheDir, `${hash}.${ext}`);
      if (fs.existsSync(p)) {
        try {
          const now = new Date();
          fs.utimesSync(p, now, now);
        } catch { /* atime update failure is non-fatal */ }
        return p;
      }
    }
    return null;
  }

  _saveToCache(audioPath, text, engine, voice) {
    const hash = this._cacheKey(text, engine, voice);
    const ext = path.extname(audioPath);
    const dest = path.join(this._cacheDir, `${hash}${ext}`);
    try {
      fs.mkdirSync(this._cacheDir, { recursive: true });
      fs.copyFileSync(audioPath, dest);
      this._cleanCache();
    } catch (err) { console.warn('[Muji] Cache save failed:', err.message); }
  }

  _cleanCache() {
    try {
      const files = fs.readdirSync(this._cacheDir)
        .map((f) => {
          const fp = path.join(this._cacheDir, f);
          // Guard against TOCTOU: file may be deleted between readdirSync and statSync.
          // If statSync throws, skip this file rather than aborting the entire cleanup.
          try {
            const stat = fs.statSync(fp);
            return { path: fp, size: stat.size, mtime: stat.mtimeMs };
          } catch { return null; }
        })
        .filter(Boolean)
        .sort((a, b) => b.mtime - a.mtime);
      let totalBytes = files.reduce((s, f) => s + f.size, 0);
      const maxBytes = this._cacheMaxMb * 1024 * 1024;
      while (totalBytes > maxBytes && files.length > 0) {
        const old = files.pop();
        try { fs.unlinkSync(old.path); } catch { }
        totalBytes -= old.size;
      }
    } catch { }
  }
}

module.exports = TTSEngine;

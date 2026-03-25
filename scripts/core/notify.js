const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const PROJECT_CHIME_COUNT = 8;

class Notifier {
  constructor(config, bgmManager, ttsEngine) {
    this._config = config;
    this._bgm = bgmManager;
    this._tts = ttsEngine;
    this._mpvPath = config.getMpvPath();
    this._queue = Promise.resolve();
  }

  async notify(event, vars = {}) {
    if (!this._config.get('notifications.enabled')) return;
    const sfxPath = this._config.getSFXPath(event);
    const voicePath = this._getVoicePath(event);
    const message = this._resolveMessage(event, vars);
    if (!sfxPath && !voicePath && !message) return;
    return this._queueNotification(async () => {
      await this._duckAndRestore(async () => {
        if (sfxPath && fs.existsSync(sfxPath)) {
          await this._playSFX(sfxPath);
        }
        if (voicePath) {
          await this._playAudio(voicePath);
        } else if (message) {
          const lang = this._config.getLanguage();
          const audioFile = await this._tts.synthesize(message, lang);
          if (audioFile) {
            await this._playAudio(audioFile);
          }
        }
      });
    });
  }

  /**
   * Project-aware notification.
   * Plays: project-unique chime (louder) → pre-recorded ElevenLabs voice
   * Each project gets a consistent chime based on its name hash.
   */
  async notifyProject(event, project) {
    if (!this._config.get('notifications.enabled')) return;
    const voicePath = this._getVoicePath(event);
    const message = this._resolveMessage(event, {});
    if (!voicePath && !message) return;
    return this._queueNotification(async () => {
      await this._duckAndRestore(async () => {
        // 1. Project-unique chime (louder than normal SFX)
        const chimePath = this._getProjectChime(project);
        if (chimePath) {
          const chimeVolume = (this._config.get('sfx.volume') ?? 80) + 15;
          await this._playAudio(chimePath, Math.min(chimeVolume, 100));
        }
        // 2. Pre-recorded ElevenLabs voice (or TTS fallback)
        if (voicePath) {
          await this._playAudio(voicePath);
        } else if (message) {
          const lang = this._config.getLanguage();
          const audioFile = await this._tts.synthesize(message, lang);
          if (audioFile) { await this._playAudio(audioFile); }
        }
      });
    });
  }

  async notifyVoice(voiceFile) {
    if (!this._config.get('notifications.enabled')) return;
    if (!fs.existsSync(voiceFile)) return;
    return this._queueNotification(async () => {
      await this._duckAndRestore(async () => {
        await this._playAudio(voiceFile);
      });
    });
  }

  async playSFX(soundFile) {
    if (!this._config.get('sfx.enabled')) return;
    await this._playSFX(soundFile);
  }

  async speak(text, lang) {
    lang = lang || this._config.getLanguage();
    const audioFile = await this._tts.synthesize(text, lang);
    if (audioFile) { await this._playAudio(audioFile); }
  }

  _resolveMessage(event, vars) {
    const lang = this._config.getLanguage();
    return this._config.getMessage(event, lang, vars);
  }

  /**
   * Get a consistent chime file for a project name.
   * Hash maps project name → one of 8 pitch-shifted chimes.
   */
  _getProjectChime(project) {
    const hash = crypto.createHash('md5').update(project).digest();
    const index = (hash[0] % PROJECT_CHIME_COUNT) + 1;
    const chimePath = path.join(this._config.getPluginDir(), 'sounds', 'project-chimes', `chime-${index}.wav`);
    if (fs.existsSync(chimePath)) return chimePath;
    return null;
  }

  _getVoicePath(event) {
    const lang = this._config.getLanguage();
    const voicePath = path.join(this._config.getPluginDir(), 'sounds', 'voices', lang, `${event}.mp3`);
    if (fs.existsSync(voicePath)) return voicePath;
    if (lang !== 'en') {
      const enPath = path.join(this._config.getPluginDir(), 'sounds', 'voices', 'en', `${event}.mp3`);
      if (fs.existsSync(enPath)) return enPath;
    }
    return null;
  }

  async _duckAndRestore(callback) {
    const duckingEnabled = this._config.get('notifications.ducking.enabled');
    const bgmPlaying = this._bgm.isPlaying();
    if (!duckingEnabled || !bgmPlaying) { await callback(); return; }
    const duckVolume = this._config.get('notifications.ducking.duck_volume') ?? 10;
    const fadeDuration = this._config.get('notifications.ducking.fade_duration_ms') ?? 300;
    const originalVolume = this._bgm.getVolume();
    await this._bgm.fadeVolume(duckVolume, fadeDuration);
    try { await callback(); } finally { await this._bgm.fadeVolume(originalVolume, fadeDuration); }
  }

  _queueNotification(fn) {
    this._queue = this._queue.then(() => fn()).catch((err) => console.error('[Muji] Notification failed:', err.message));
    return this._queue;
  }

  async _playSFX(filePath) {
    const volume = this._config.get('sfx.volume') ?? 80;
    return this._playAudio(filePath, volume);
  }

  async _playAudio(filePath, volume) {
    return new Promise((resolve) => {
      let resolved = false;
      function done() {
        if (!resolved) { resolved = true; clearTimeout(timer); resolve(); }
      }
      const args = ['--no-video', '--really-quiet'];
      if (volume !== undefined) { args.push(`--volume=${volume}`); }
      args.push(filePath);
      const proc = spawn(this._mpvPath, args, { stdio: 'ignore' });
      proc.on('exit', done);
      proc.on('error', (err) => { console.warn('[Muji] Audio playback error:', err.message); done(); });
      const timer = setTimeout(() => { try { proc.kill(); } catch { } done(); }, 30000);
    });
  }
}

module.exports = Notifier;

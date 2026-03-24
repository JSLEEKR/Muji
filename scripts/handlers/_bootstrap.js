const fs = require('node:fs');
const Config = require('../core/config.js');
const BGMManager = require('../core/bgm.js');
const TTSEngine = require('../core/tts.js');
const Notifier = require('../core/notify.js');

function touchActivity(config) {
  try {
    const activityPath = config.getActivityPath();
    fs.writeFileSync(activityPath, JSON.stringify({ timestamp: Date.now() }), 'utf8');
  } catch { /* best-effort */ }
}

function bootstrap() {
  const config = new Config();
  config.load();
  const bgm = new BGMManager(config);
  const tts = new TTSEngine(config);
  const notifier = new Notifier(config, bgm, tts);
  touchActivity(config);
  return { config, bgm, tts, notifier };
}

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    let resolved = false;
    function done(value) {
      if (!resolved) { resolved = true; clearTimeout(timer); resolve(value); }
    }
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => {
      try { done(JSON.parse(data)); } catch { done({}); }
    });
    process.stdin.on('error', () => done({}));
    const timer = setTimeout(() => done({}), 1000);
    // Allow the timer to not block process exit if stdin ends first
    if (timer.unref) timer.unref();
  });
}

module.exports = { bootstrap, readStdin };

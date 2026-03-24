const Config = require('../core/config.js');
const BGMManager = require('../core/bgm.js');
const TTSEngine = require('../core/tts.js');
const Notifier = require('../core/notify.js');

function bootstrap() {
  const config = new Config();
  config.load();
  const bgm = new BGMManager(config);
  const tts = new TTSEngine(config);
  const notifier = new Notifier(config, bgm, tts);
  return { config, bgm, tts, notifier };
}

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => {
      try { resolve(JSON.parse(data)); } catch { resolve({}); }
    });
    setTimeout(() => resolve({}), 1000);
  });
}

module.exports = { bootstrap, readStdin };

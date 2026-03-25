const path = require('node:path');
const { bootstrap } = require('./_bootstrap.js');

(async () => {
  const { config, bgm, notifier } = bootstrap();
  if (config.get('bgm.auto_start')) {
    try { await bgm.start(); } catch (err) {
      console.error('[Muji] BGM auto-start failed:', err.message);
    }
  }
  const project = path.basename(process.cwd());
  await notifier.notifyProject('session_start', project);
})();

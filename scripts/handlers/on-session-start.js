const path = require('node:path');
const { bootstrap } = require('./_bootstrap.js');

(async () => {
  const { config, bgm, notifier } = bootstrap();
  if (config.get('bgm.auto_start')) {
    try { await bgm.start(); } catch (err) {
      console.error('[Muji] BGM auto-start failed:', err.message);
    }
  }
  const useDynamic = config.get('notifications.dynamic_project_name');
  if (useDynamic) {
    const project = path.basename(process.cwd());
    await notifier.notifyDynamic('session_start', { project });
  } else {
    await notifier.notify('session_start');
  }
})();

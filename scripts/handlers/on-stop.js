const path = require('node:path');
const fs = require('node:fs');
const { bootstrap } = require('./_bootstrap.js');

(async () => {
  const { config, bgm, notifier } = bootstrap();
  const useDynamic = config.get('notifications.dynamic_project_name');
  if (useDynamic) {
    const project = path.basename(process.cwd());
    await notifier.notifyDynamic('session_end', { project });
  } else {
    await notifier.notify('session_end');
  }
  await bgm.stop();
  const pidPath = config.getPidPath();
  try {
    if (fs.existsSync(pidPath)) {
      const pid = parseInt(fs.readFileSync(pidPath, 'utf8').trim(), 10);
      try { process.kill(pid); } catch { }
      fs.unlinkSync(pidPath);
    }
  } catch { }
  const statusPath = config.getStatusPath();
  try { fs.unlinkSync(statusPath); } catch { }
})();

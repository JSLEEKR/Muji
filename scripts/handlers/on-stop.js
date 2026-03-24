const { bootstrap } = require('./_bootstrap.js');
const fs = require('node:fs');

(async () => {
  const { config, bgm, notifier } = bootstrap();
  await notifier.notify('session_end');
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

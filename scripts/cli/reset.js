const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function main() {
  console.log('=== Muji Reset ===\n');

  const tmpDir = process.platform === 'win32' ? os.tmpdir() : '/tmp';

  const pidPath = path.join(tmpDir, 'muji-pomodoro.pid');
  try {
    if (fs.existsSync(pidPath)) {
      const pid = parseInt(fs.readFileSync(pidPath, 'utf8').trim(), 10);
      console.log(`Killing pomodoro daemon (PID: ${pid})...`);
      try { process.kill(pid); } catch { }
      fs.unlinkSync(pidPath);
      console.log('  Done.');
    } else {
      console.log('No pomodoro daemon running.');
    }
  } catch (err) { console.log(`  Error: ${err.message}`); }

  const statusPath = path.join(tmpDir, 'muji-pomodoro-status.json');
  try { fs.unlinkSync(statusPath); } catch { }

  if (process.platform !== 'win32') {
    const socketPath = '/tmp/muji-bgm-socket';
    try {
      fs.unlinkSync(socketPath);
      console.log('Removed mpv socket.');
    } catch { /* socket did not exist, nothing to remove */ }
  }

  const bgmPidPath = path.join(tmpDir, 'muji-bgm.pid');
  try {
    if (fs.existsSync(bgmPidPath)) {
      const bgmPid = parseInt(fs.readFileSync(bgmPidPath, 'utf8').trim(), 10);
      if (!isNaN(bgmPid)) {
        if (process.platform === 'win32') {
          require('node:child_process').execSync(`taskkill /f /pid ${bgmPid} 2>nul`, { stdio: 'pipe' });
        } else {
          try { process.kill(bgmPid); } catch { }
        }
      }
      fs.unlinkSync(bgmPidPath);
      console.log(`Killed mpv process (PID: ${bgmPid}).`);
    } else {
      if (process.platform !== 'win32') {
        require('node:child_process').execSync("pkill -f 'mpv.*muji-bgm-socket' 2>/dev/null || true", { stdio: 'pipe' });
      }
      console.log('No mpv PID file found; attempted pattern-based cleanup.');
    }
  } catch {
    console.log('No mpv processes to kill.');
  }

  const researchPath = path.join(tmpDir, 'muji-research-output.md');
  try { fs.unlinkSync(researchPath); } catch { }

  console.log('\n=== Reset Complete ===');
}

main();

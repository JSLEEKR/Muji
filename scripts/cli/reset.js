const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function main() {
  console.log('=== Chill Focus Mate Reset ===\n');

  const tmpDir = process.platform === 'win32' ? os.tmpdir() : '/tmp';

  const pidPath = path.join(tmpDir, 'cfm-pomodoro.pid');
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

  const statusPath = path.join(tmpDir, 'cfm-pomodoro-status.json');
  try { fs.unlinkSync(statusPath); } catch { }

  if (process.platform !== 'win32') {
    const socketPath = '/tmp/cfm-bgm-socket';
    try {
      fs.unlinkSync(socketPath);
      console.log('Removed mpv socket.');
    } catch { /* socket did not exist, nothing to remove */ }
  }

  try {
    if (process.platform === 'win32') {
      require('node:child_process').execSync('taskkill /f /im mpv.exe 2>nul', { stdio: 'pipe' });
    } else {
      require('node:child_process').execSync("pkill -f 'mpv.*cfm-bgm-socket' 2>/dev/null || true", { stdio: 'pipe' });
    }
    console.log('Killed mpv processes.');
  } catch {
    console.log('No mpv processes to kill.');
  }

  const researchPath = path.join(tmpDir, 'cfm-research-output.md');
  try { fs.unlinkSync(researchPath); } catch { }

  console.log('\n=== Reset Complete ===');
}

main();

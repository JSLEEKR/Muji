const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REQUIRED = ['mpv', 'yt-dlp', 'socat'];
const TTS_ENGINES = {
  'edge-tts': 'edge-tts --help',
  'espeak-ng': 'espeak-ng --version',
};

function checkCommand(cmd) {
  try {
    execSync(`${cmd} 2>&1`, { stdio: 'pipe', timeout: 5000 });
    return true;
  } catch {
    try {
      const which = process.platform === 'win32' ? 'where' : 'which';
      execSync(`${which} ${cmd.split(' ')[0]}`, { stdio: 'pipe', timeout: 3000 });
      return true;
    } catch { return false; }
  }
}

function main() {
  console.log('=== Chill Focus Mate Setup ===\n');

  console.log('Checking required dependencies...');
  let allOk = true;
  for (const dep of REQUIRED) {
    const ok = checkCommand(dep);
    console.log(`  ${ok ? '[OK]' : '[MISSING]'} ${dep}`);
    if (!ok) allOk = false;
  }

  if (!allOk) {
    console.log('\nInstall missing dependencies:');
    if (process.platform === 'darwin') {
      console.log('  brew install mpv yt-dlp socat');
    } else if (process.platform === 'linux') {
      console.log('  sudo apt install mpv socat && pip install yt-dlp');
    } else {
      console.log('  Install mpv from https://mpv.io/installation/');
      console.log('  Install yt-dlp: pip install yt-dlp');
      console.log('  Install socat from your package manager');
    }
  }

  console.log('\nChecking TTS engines...');
  let hasTTS = false;
  for (const [name, cmd] of Object.entries(TTS_ENGINES)) {
    const ok = checkCommand(cmd);
    console.log(`  ${ok ? '[OK]' : '[--]'} ${name}`);
    if (ok) hasTTS = true;
  }

  if (process.platform === 'darwin') {
    console.log('  [OK] system (macOS say)');
    hasTTS = true;
  } else if (process.platform === 'linux' && checkCommand('spd-say --version')) {
    console.log('  [OK] system (spd-say)');
    hasTTS = true;
  }

  if (!hasTTS) {
    console.log('\n  No TTS engine found. Install one:');
    console.log('    pip install edge-tts  (recommended, free, natural voices)');
  }

  const configDir = path.join(os.homedir(), '.claude', '.chill-focus-mate');
  fs.mkdirSync(configDir, { recursive: true });
  console.log(`\nConfig directory: ${configDir}`);

  const userConfig = path.join(configDir, 'config.yaml');
  if (!fs.existsSync(userConfig)) {
    const defaultConfig = path.join(__dirname, '..', '..', 'config', 'default.yaml');
    if (fs.existsSync(defaultConfig)) {
      fs.copyFileSync(defaultConfig, userConfig);
      console.log('  Copied default config to user config');
    }
  } else {
    console.log('  User config already exists');
  }

  const cacheDir = path.join(configDir, 'tts-cache');
  fs.mkdirSync(cacheDir, { recursive: true });
  console.log(`  TTS cache: ${cacheDir}`);

  console.log('\n=== Setup Complete ===');
  if (allOk && hasTTS) {
    console.log('All dependencies found. Ready to use!');
  } else {
    console.log('Some dependencies are missing. Install them for full functionality.');
  }
}

main();

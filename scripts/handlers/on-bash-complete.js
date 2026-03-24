const { bootstrap, readStdin } = require('./_bootstrap.js');

(async () => {
  const input = await readStdin();
  const command = input?.tool_input?.command || '';
  const stdout = input?.tool_response?.stdout || '';
  const stderr = input?.tool_response?.stderr || '';
  if (!command) return;

  const { config, notifier } = bootstrap();
  const patterns = config.get('advanced.patterns');
  if (!patterns) return;

  if (command.includes(patterns.git_commit) && !stderr) {
    await notifier.notify('commit_success'); return;
  }
  if (command.includes(patterns.git_push) && !stderr) {
    await notifier.notify('push_success'); return;
  }
  for (const tc of patterns.test_commands || []) {
    if (command.includes(tc)) {
      const failIndicators = ['FAIL', 'FAILED', 'failure', 'Error', 'error'];
      const hasFail = failIndicators.some((f) => stderr.includes(f) || stdout.includes(f));
      if (hasFail) {
        const countMatch = (stderr + stdout).match(/(\d+)\s+fail/i);
        const count = countMatch ? parseInt(countMatch[1], 10) : 1;
        await notifier.notify('test_fail', { count });
      } else { await notifier.notify('build_success'); }
      return;
    }
  }
  for (const bc of patterns.build_commands || []) {
    if (command.includes(bc)) {
      if (stderr && (stderr.includes('error') || stderr.includes('Error'))) {
        await notifier.notify('build_fail');
      } else { await notifier.notify('build_success'); }
      return;
    }
  }
  for (const lc of patterns.lint_commands || []) {
    if (command.includes(lc) && stderr) {
      await notifier.notify('lint_error'); return;
    }
  }
})();

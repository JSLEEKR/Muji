const { bootstrap, readStdin } = require('./_bootstrap.js');

// Check if a command string contains the given pattern as a whole token
// (i.e. at the start of the command or preceded by a shell separator character).
// This prevents "make" from matching "cmake" or "automake".
function commandMatchesPattern(command, pattern) {
  const idx = command.indexOf(pattern);
  if (idx === -1) return false;
  if (idx === 0) return true;
  const before = command[idx - 1];
  return /[\s;&|]/.test(before);
}

(async () => {
  const input = await readStdin();
  const command = input?.tool_input?.command || '';
  const stdout = input?.tool_response?.stdout || '';
  const stderr = input?.tool_response?.stderr || '';
  if (!command) return;

  const { config, notifier } = bootstrap();
  const patterns = config.get('advanced.patterns');
  if (!patterns) return;

  if (commandMatchesPattern(command, patterns.git_commit)) {
    // git writes normal output (branch, hash) to stderr, so we check exit_code
    // rather than the absence of stderr to determine success.
    const exitCode = input?.tool_response?.exit_code;
    if (exitCode === 0 || exitCode === undefined) {
      await notifier.notify('commit_success');
    }
    return;
  }
  if (commandMatchesPattern(command, patterns.git_push)) {
    const exitCode = input?.tool_response?.exit_code;
    if (exitCode === 0 || exitCode === undefined) {
      await notifier.notify('push_success');
    }
    return;
  }
  for (const tc of patterns.test_commands || []) {
    if (commandMatchesPattern(command, tc)) {
      const failIndicators = ['FAIL', 'FAILED', 'failure', 'Error', 'error'];
      const hasFail = failIndicators.some((f) => stderr.includes(f) || stdout.includes(f));
      if (hasFail) {
        const countMatch = (stderr + stdout).match(/(\d+)\s+fail/i);
        const count = countMatch ? parseInt(countMatch[1], 10) : 1;
        await notifier.notify('test_fail', { count });
      } else { await notifier.notify('test_success'); }
      return;
    }
  }
  for (const bc of patterns.build_commands || []) {
    // Use word-boundary matching: the pattern must appear at start of command
    // or after whitespace/semicolon/pipe to avoid matching substrings (e.g. "make" in "cmake")
    if (commandMatchesPattern(command, bc)) {
      const exitCode = input?.tool_response?.exit_code;
      const hasFail = exitCode !== undefined
        ? exitCode !== 0
        : stderr && (stderr.includes('error') || stderr.includes('Error'));
      if (hasFail) {
        await notifier.notify('build_fail');
      } else { await notifier.notify('build_success'); }
      return;
    }
  }
  for (const lc of patterns.lint_commands || []) {
    if (commandMatchesPattern(command, lc)) {
      // Check exit code first; lint tools typically exit non-zero on errors.
      // Fall back to scanning output for error indicators if exit_code is unavailable.
      const exitCode = input?.tool_response?.exit_code;
      const hasErrors = exitCode !== undefined
        ? exitCode !== 0
        : (stderr || stdout) && ['error', 'Error', 'warning', 'Warning'].some(
            (indicator) => stderr.includes(indicator) || stdout.includes(indicator)
          );
      if (hasErrors) {
        await notifier.notify('lint_error');
      }
      return;
    }
  }
})();

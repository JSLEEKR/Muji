const { describe, it } = require('node:test');
const assert = require('node:assert');

describe('on-bash-complete pattern matching', () => {
  function matchCommand(command, patterns) {
    if (command.includes(patterns.git_commit)) return 'commit_success';
    if (command.includes(patterns.git_push)) return 'push_success';
    for (const tc of patterns.test_commands) {
      if (command.includes(tc)) return 'test';
    }
    for (const bc of patterns.build_commands) {
      if (command.includes(bc)) return 'build';
    }
    for (const lc of patterns.lint_commands) {
      if (command.includes(lc)) return 'lint';
    }
    return null;
  }

  const patterns = {
    git_commit: 'git commit',
    git_push: 'git push',
    test_commands: ['npm test', 'npx jest', 'pytest', 'cargo test', 'go test'],
    build_commands: ['npm run build', 'npx next build', 'cargo build', 'go build', 'make'],
    lint_commands: ['npm run lint', 'eslint', 'pylint', 'cargo clippy'],
  };

  it('matches git commit', () => {
    assert.strictEqual(matchCommand('git commit -m "fix"', patterns), 'commit_success');
  });
  it('matches git push', () => {
    assert.strictEqual(matchCommand('git push origin main', patterns), 'push_success');
  });
  it('matches npm test', () => {
    assert.strictEqual(matchCommand('npm test', patterns), 'test');
  });
  it('matches npm run build', () => {
    assert.strictEqual(matchCommand('npm run build', patterns), 'build');
  });
  it('matches eslint', () => {
    assert.strictEqual(matchCommand('eslint src/', patterns), 'lint');
  });
  it('returns null for unrecognized commands', () => {
    assert.strictEqual(matchCommand('ls -la', patterns), null);
  });
});

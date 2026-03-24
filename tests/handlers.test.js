const { describe, it } = require('node:test');
const assert = require('node:assert');

// Replicated from on-bash-complete.js to test the helper in isolation
function commandMatchesPattern(command, pattern) {
  const idx = command.indexOf(pattern);
  if (idx === -1) return false;
  if (idx === 0) return true;
  const before = command[idx - 1];
  return /[\s;&|]/.test(before);
}

function matchCommand(command, patterns) {
  if (command.includes(patterns.git_commit)) return 'commit_success';
  if (command.includes(patterns.git_push)) return 'push_success';
  for (const tc of patterns.test_commands) {
    if (commandMatchesPattern(command, tc)) return 'test';
  }
  for (const bc of patterns.build_commands) {
    if (commandMatchesPattern(command, bc)) return 'build';
  }
  for (const lc of patterns.lint_commands) {
    if (commandMatchesPattern(command, lc)) return 'lint';
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

describe('on-bash-complete pattern matching', () => {
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

describe('commandMatchesPattern word-boundary logic', () => {
  it('matches "make" at start of command', () => {
    assert.strictEqual(commandMatchesPattern('make all', 'make'), true);
  });
  it('does NOT match "make" inside "cmake"', () => {
    assert.strictEqual(commandMatchesPattern('cmake ..', 'make'), false);
  });
  it('does NOT match "make" inside "automake"', () => {
    assert.strictEqual(commandMatchesPattern('automake --install', 'make'), false);
  });
  it('matches "make" after semicolon', () => {
    assert.strictEqual(commandMatchesPattern('cd build; make', 'make'), true);
  });
  it('matches "make" after pipe', () => {
    assert.strictEqual(commandMatchesPattern('echo ok | make', 'make'), true);
  });
  it('matches "pytest" at start', () => {
    assert.strictEqual(commandMatchesPattern('pytest tests/', 'pytest'), true);
  });
  it('matches "go test" as whole phrase', () => {
    assert.strictEqual(commandMatchesPattern('go test ./...', 'go test'), true);
  });
  it('returns false for pattern not present', () => {
    assert.strictEqual(commandMatchesPattern('ls -la', 'make'), false);
  });
});

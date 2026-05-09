import { execSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { given, then, useBeforeAll, when } from 'test-fns';

/**
 * .what = path to the CLI bin/run shim
 * .why = acceptance tests invoke the built artifact
 */
const BIN_PATH = join(__dirname, '../../bin/run');

/**
 * .what = invoke the CLI and capture output
 * .why = acceptance test verifies external behavior
 */
const invokeCli = (input: {
  args: string[];
  cwd: string;
}): { stdout: string; stderr: string; exitCode: number } => {
  const result = spawnSync(BIN_PATH, input.args, {
    cwd: input.cwd,
    encoding: 'utf-8',
    shell: true,
  });
  return {
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.status ?? 1,
  };
};

/**
 * .what = invoke the CLI via npx and capture output
 * .why = proves the consumer experience works via npm package resolution
 */
const invokeCliViaNpx = (input: {
  args: string[];
}): { stdout: string; stderr: string; exitCode: number } => {
  const result = spawnSync('npx', ['sdk-environment', ...input.args], {
    cwd: process.cwd(),
    encoding: 'utf-8',
    shell: true,
  });
  return {
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.status ?? 1,
  };
};

/**
 * .what = create a temp git repo with specified state
 * .why = enables matrix test of different git states
 */
const createTestRepo = (input: {
  tag?: string;
  dirty?: boolean;
}): { path: string; hash: string } => {
  const tempDir = mkdtempSync(join(tmpdir(), 'sdk-env-test-'));

  execSync('git init', { cwd: tempDir });
  execSync('git config user.email "test@test.com"', { cwd: tempDir });
  execSync('git config user.name "test"', { cwd: tempDir });

  // create initial commit
  writeFileSync(join(tempDir, 'README.md'), '# test');
  execSync('git add .', { cwd: tempDir });
  execSync('git commit -m "initial"', { cwd: tempDir });

  // get hash of HEAD
  const hash = execSync('git rev-parse --short HEAD', { cwd: tempDir })
    .toString()
    .trim();

  // add tag if requested
  if (input.tag) {
    execSync(`git tag ${input.tag}`, { cwd: tempDir });
  }

  // add dirty file if requested
  if (input.dirty) {
    writeFileSync(join(tempDir, 'dirty.txt'), 'dirty');
  }

  return { path: tempDir, hash };
};

describe('sdk-environment get commit (acceptance)', () => {
  given('[case1] tag at HEAD, clean worktree', () => {
    const repo = useBeforeAll(async () => createTestRepo({ tag: 'v1.0.0' }));
    afterAll(() => rmSync(repo.path, { recursive: true, force: true }));

    when('[t0] `get commit` is invoked', () => {
      const result = useBeforeAll(async () =>
        invokeCli({ args: ['get', 'commit'], cwd: repo.path }),
      );

      then('exit code is 0', () => {
        expect(result.exitCode).toBe(0);
      });

      then('stdout is tag@hash format', () => {
        expect(result.stdout.trim()).toBe(`v1.0.0@${repo.hash}`);
      });

      then('no dirty indicator', () => {
        expect(result.stdout).not.toContain('+');
      });

      then('output matches snapshot', () => {
        const safe = result.stdout.trim().replace(/@[a-f0-9]+$/i, '@<hash>');
        expect(safe).toMatchSnapshot();
      });
    });
  });

  given('[case2] tag at HEAD, dirty worktree', () => {
    const repo = useBeforeAll(async () =>
      createTestRepo({ tag: 'v1.0.0', dirty: true }),
    );
    afterAll(() => rmSync(repo.path, { recursive: true, force: true }));

    when('[t0] `get commit` is invoked', () => {
      const result = useBeforeAll(async () =>
        invokeCli({ args: ['get', 'commit'], cwd: repo.path }),
      );

      then('exit code is 0', () => {
        expect(result.exitCode).toBe(0);
      });

      then('stdout is tag@hash+ format (dirty)', () => {
        expect(result.stdout.trim()).toBe(`v1.0.0@${repo.hash}+`);
      });

      then('output matches snapshot', () => {
        const safe = result.stdout.trim().replace(/@[a-f0-9]+\+$/i, '@<hash>+');
        expect(safe).toMatchSnapshot();
      });
    });
  });

  given('[case3] branch (no tag), clean worktree', () => {
    const repo = useBeforeAll(async () => createTestRepo({}));
    afterAll(() => rmSync(repo.path, { recursive: true, force: true }));

    when('[t0] `get commit` is invoked', () => {
      const result = useBeforeAll(async () =>
        invokeCli({ args: ['get', 'commit'], cwd: repo.path }),
      );

      then('exit code is 0', () => {
        expect(result.exitCode).toBe(0);
      });

      then('stdout contains branch@hash format', () => {
        // branch name varies (master or main), so just check format
        expect(result.stdout.trim()).toMatch(/^(master|main)@[a-f0-9]+$/i);
      });

      then('no dirty indicator', () => {
        expect(result.stdout).not.toContain('+');
      });

      then('output matches snapshot (branch and hash stripped)', () => {
        // strip branch name (master/main) and hash for stable snapshot
        const safe = result.stdout
          .trim()
          .replace(/^(master|main)@/, '<branch>@')
          .replace(/@[a-f0-9]+$/i, '@<hash>');
        expect(safe).toMatchSnapshot();
      });
    });
  });

  given('[case4] branch (no tag), dirty worktree', () => {
    const repo = useBeforeAll(async () => createTestRepo({ dirty: true }));
    afterAll(() => rmSync(repo.path, { recursive: true, force: true }));

    when('[t0] `get commit` is invoked', () => {
      const result = useBeforeAll(async () =>
        invokeCli({ args: ['get', 'commit'], cwd: repo.path }),
      );

      then('exit code is 0', () => {
        expect(result.exitCode).toBe(0);
      });

      then('stdout contains branch@hash+ format (dirty)', () => {
        expect(result.stdout.trim()).toMatch(/^(master|main)@[a-f0-9]+\+$/i);
      });

      then('output matches snapshot (branch and hash stripped)', () => {
        // strip branch name (master/main) and hash for stable snapshot
        const safe = result.stdout
          .trim()
          .replace(/^(master|main)@/, '<branch>@')
          .replace(/@[a-f0-9]+\+$/i, '@<hash>+');
        expect(safe).toMatchSnapshot();
      });
    });
  });

  given('[case5] not a git repo', () => {
    const scene = useBeforeAll(async () => {
      const tempDir = mkdtempSync(join(tmpdir(), 'sdk-env-test-nogit-'));
      return { path: tempDir };
    });
    afterAll(() => rmSync(scene.path, { recursive: true, force: true }));

    when('[t0] `get commit` is invoked', () => {
      const result = useBeforeAll(async () =>
        invokeCli({ args: ['get', 'commit'], cwd: scene.path }),
      );

      then('exit code is 2 (constraint)', () => {
        expect(result.exitCode).toBe(2);
      });

      then('stderr contains error message', () => {
        expect(result.stderr).toContain('error');
      });

      then('stdout is empty', () => {
        expect(result.stdout).toBe('');
      });

      then('output matches snapshot', () => {
        expect(result.stderr.trim()).toMatchSnapshot();
      });
    });
  });

  given('[case6] unknown command', () => {
    when('[t0] `foo bar` is invoked', () => {
      const result = useBeforeAll(async () =>
        invokeCli({ args: ['foo', 'bar'], cwd: process.cwd() }),
      );

      then('exit code is 2 (constraint)', () => {
        expect(result.exitCode).toBe(2);
      });

      then('stderr contains unknown command', () => {
        expect(result.stderr).toContain('unknown command');
      });

      then('output matches snapshot', () => {
        expect(result.stderr.trim()).toMatchSnapshot();
      });
    });
  });

  given('[case7] invoked via npx sdk-environment', () => {
    when('[t0] `npx sdk-environment get commit` is run', () => {
      const result = useBeforeAll(async () =>
        invokeCliViaNpx({ args: ['get', 'commit'] }),
      );

      then('exit code is 0', () => {
        expect(result.exitCode).toBe(0);
      });

      then('stdout contains ref@hash format', () => {
        expect(result.stdout.trim()).toMatch(/^[^\s]+@[a-f0-9]+\+?$/i);
      });

      then('output matches snapshot (ref and hash stripped)', () => {
        const safe = result.stdout
          .trim()
          .replace(/^[^\s@]+@/, '<ref>@')
          .replace(/@[a-f0-9]+\+?$/i, '@<hash>');
        expect(safe).toMatchSnapshot();
      });
    });
  });
});

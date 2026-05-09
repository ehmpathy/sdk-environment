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

describe('sdk-environment get commit (journey)', () => {
  given('[journey1] developer release workflow', () => {
    /**
     * .what = simulate a developer workflow
     * .why = verifies sequential state changes in git lifecycle:
     *        1. create feature branch → see branch slug
     *        2. add tag → see tag slug (precedence)
     *        3. make dirty change → see dirty suffix
     *        4. cd outside repo → see constraint error
     */
    const scene = useBeforeAll(async () => {
      // create temp git repo
      const repoPath = mkdtempSync(join(tmpdir(), 'sdk-env-journey-'));
      execSync('git init', { cwd: repoPath });
      execSync('git config user.email "test@test.com"', { cwd: repoPath });
      execSync('git config user.name "test"', { cwd: repoPath });
      writeFileSync(join(repoPath, 'README.md'), '# feature');
      execSync('git add .', { cwd: repoPath });
      execSync('git commit -m "feat: initial"', { cwd: repoPath });

      // create non-git dir
      const nonGitPath = mkdtempSync(join(tmpdir(), 'sdk-env-journey-nogit-'));

      return { repoPath, nonGitPath };
    });

    afterAll(() => {
      rmSync(scene.repoPath, { recursive: true, force: true });
      rmSync(scene.nonGitPath, { recursive: true, force: true });
    });

    when('[t0] on feature branch (no tag)', () => {
      then('returns branch@hash slug', () => {
        const result = invokeCli({
          args: ['get', 'commit'],
          cwd: scene.repoPath,
        });
        expect(result.exitCode).toBe(0);
        expect(result.stdout.trim()).toMatch(/^(master|main)@[a-f0-9]+$/i);
        expect(result.stdout).not.toContain('+');
      });
    });

    when('[t1] after tag is added', () => {
      beforeAll(() => {
        execSync('git tag v1.0.0', { cwd: scene.repoPath });
      });

      then('returns tag@hash slug (tag takes precedence)', () => {
        const result = invokeCli({
          args: ['get', 'commit'],
          cwd: scene.repoPath,
        });
        expect(result.exitCode).toBe(0);
        expect(result.stdout.trim()).toMatch(/^v1\.0\.0@[a-f0-9]+$/i);
        expect(result.stdout).not.toContain('+');
      });
    });

    when('[t2] after dirty change', () => {
      beforeAll(() => {
        writeFileSync(join(scene.repoPath, 'dirty.txt'), 'wip');
      });

      then('returns tag@hash+ slug (dirty suffix)', () => {
        const result = invokeCli({
          args: ['get', 'commit'],
          cwd: scene.repoPath,
        });
        expect(result.exitCode).toBe(0);
        expect(result.stdout.trim()).toMatch(/^v1\.0\.0@[a-f0-9]+\+$/i);
      });
    });

    when('[t3] from outside repo', () => {
      then('returns constraint error', () => {
        const result = invokeCli({
          args: ['get', 'commit'],
          cwd: scene.nonGitPath,
        });
        expect(result.exitCode).toBe(2);
        expect(result.stderr).toContain('error');
        expect(result.stdout).toBe('');
      });
    });
  });
});

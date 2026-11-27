import { MalfunctionError } from 'helpful-errors';
import { genTempDir, given, then, useBeforeAll, when } from 'test-fns';

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const SKILL_PATH = path.join(__dirname, 'verify.publish-npm-pin.sh');
const REPO_ROOT = path.join(__dirname, '../../../..');
const SKILL_TIMEOUT_MS = 80_000; // below jest.integration.env.ts's 90s, so the stall hint surfaces

/**
 * .what = run the skill as a caller would, and capture every stream
 * .why = the skill's contract is its stdout, stderr, and exit code
 * .note = spawnSync blocks the worker, so the timeout is the only guard on a stalled registry
 */
const runSkill = (input: {
  args: string[];
  cwd: string;
  path: string | null;
  env: Record<string, string> | null;
}): { stdout: string; stderr: string; exitCode: number } => {
  const result = spawnSync('bash', [SKILL_PATH, ...input.args], {
    cwd: input.cwd,
    env: { ...process.env, ...input.env, PATH: input.path ?? process.env['PATH'] },
    encoding: 'utf-8',
    timeout: SKILL_TIMEOUT_MS,
  });

  // fail loud on a stall or a spawn fault, never as a mystery exit code
  if (result.error || result.signal)
    throw new MalfunctionError('verify.publish-npm-pin did not finish', {
      args: input.args,
      signal: result.signal,
      error: result.error?.message ?? null,
      hint: `a stall past ${SKILL_TIMEOUT_MS}ms points at the npm registry; re-run`,
    });

  return {
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.status ?? 1,
  };
};

/**
 * .what = mask the fields that vary by run, host, registry state, or npm release
 * .why = a snapshot must hold the shape a human sees, not a temp path or npm's advice prose
 */
const asSnapshotSafe = (input: { output: string }): string =>
  input.output
    .replace(/npm 11\.\d+\.\d+/g, 'npm 11.<minor>.<patch>')
    .replace(/\/\S*\/\.npm\/_logs\/\S+/g, '<npm-log>')
    .replace(/no \.nvmrc at \S+;/g, 'no .nvmrc at <repo>;')
    .replace(/(in|at) \S+\.publish-npm\.yml/g, '$1 <repo>/.github/workflows/.publish-npm.yml')
    .replace(/\S+ is not in a git repo/g, '<dir> is not in a git repo')
    .replace(/node is v[\d.]+,/g, 'node is <node>,')
    .replace(/npm@file:\S+/g, 'npm@file:<fake-npm>')
    .replace(/--spec file:\S+/g, '--spec file:<fake-npm>')
    .replace(/(├─ npm error) (?!code |notsup ).*/g, '$1 <npm prose>')
    .replace(/v\d+\.\d+\.\d+/g, 'v<node>')
    .replace(/"npm":"[^"]+"/g, '"npm":"<npm>"');

/**
 * .what = a temp git repo with a chosen .nvmrc and publish workflow
 * .why = the skill reads both from the repo root; each input case needs its own
 */
const genRepoFixture = (input: {
  slug: string;
  nvmrc: string | null;
  workflow: string | null;
}): string => {
  const dir = genTempDir({ slug: input.slug });

  // fail loud if git cannot init, since every case here leans on a repo root
  const gitInit = spawnSync('git', ['init', '-q'], { cwd: dir, encoding: 'utf-8', timeout: 30_000 });
  if (gitInit.error || gitInit.signal || gitInit.status !== 0)
    throw new MalfunctionError('git init failed for the repo fixture', {
      dir,
      status: gitInit.status,
      stderr: gitInit.stderr,
      error: gitInit.error?.message ?? null,
    });

  if (input.nvmrc !== null) fs.writeFileSync(path.join(dir, '.nvmrc'), input.nvmrc);
  if (input.workflow !== null) {
    fs.mkdirSync(path.join(dir, '.github/workflows'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.github/workflows/.publish-npm.yml'), input.workflow);
  }
  return dir;
};

const WORKFLOW_WITH_PIN = 'run: npm install -g npm@11\n';

/**
 * .what = a temp repo whose .nvmrc names the node this test runs on
 * .why = a verdict case must not lean on this repo's .nvmrc, so a .nvmrc bump or a dev
 *        host on another node cannot flip it; only case1 reads the real repo, on purpose
 */
const genRepoOnHostNode = (input: { slug: string }): string =>
  genRepoFixture({ slug: input.slug, nvmrc: `${process.version}\n`, workflow: WORKFLOW_WITH_PIN });

/**
 * .what = a copy of a PATH dir, as symlinks, with every entry but the hidden ones
 * .why = hides only the named commands; bash, git, and the rest in that dir stay reachable
 */
const genDirWithout = (input: { dir: string; hidden: string[] }): string => {
  const shadow = genTempDir({ slug: `verify-pin-path-sans-${input.hidden.join('-')}` });
  fs.readdirSync(input.dir)
    .filter((name) => !input.hidden.includes(name))
    .forEach((name) => fs.symlinkSync(path.join(input.dir, name), path.join(shadow, name)));
  return shadow;
};

/**
 * .what = the PATH, with each dir that holds a hidden command swapped for a copy without it
 * .why = proves the absent-command branches on a host that has those commands
 */
const genPathWithout = (input: { hidden: string[] }): string =>
  (process.env['PATH'] ?? '')
    .split(path.delimiter)
    .map((dir) =>
      input.hidden.some((name) => fs.existsSync(path.join(dir, name)))
        ? genDirWithout({ dir, hidden: input.hidden })
        : dir,
    )
    .join(path.delimiter);

/**
 * .what = a local package named `npm`, with a chosen version, engine, and bin behavior
 * .why = proves each install verdict offline, with no tie to the registry or to the .nvmrc node
 *
 * .mock = the npm package that the step installs
 * .why = a published npm pins the verdict to today's .nvmrc and registry; a bump of either
 *        would flip the case for reasons unrelated to the branch under test
 * .real = npm runs its own self-install engine check on a `file:` spec the same as on a
 *         registry spec (`npm error code EBADENGINE`, `notsup Required/Actual`), and the
 *         skill reads only the install exit, that code, and the bin's `--version`.
 *         case1 stays live against the registry
 */
const genFakeNpm = (input: {
  slug: string;
  version: string;
  engineNode: string | null;
  bin: 'reports-version' | 'notices-then-reports' | 'cannot-start';
}): string => {
  const dir = genTempDir({ slug: input.slug });
  fs.mkdirSync(path.join(dir, 'bin'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({
      name: 'npm',
      version: input.version,
      ...(input.engineNode === null ? {} : { engines: { node: input.engineNode } }),
      bin: { npm: 'bin/npm.js' },
    }),
  );
  const binBodies = {
    'reports-version': `console.log(${JSON.stringify(input.version)});\n`,
    'notices-then-reports': `console.error('npm notice: a newer npm is available');\nconsole.log(${JSON.stringify(input.version)});\n`,
    'cannot-start': "console.error('fake npm: cannot start');\nprocess.exit(3);\n",
  };
  const binBody = binBodies[input.bin];
  fs.writeFileSync(path.join(dir, 'bin/npm.js'), `#!/usr/bin/env node\n${binBody}`, { mode: 0o755 });
  return dir;
};

/**
 * .what = a `--spec file:<dir>` arg pair for a fake npm that reports a chosen version
 * .why = most cases need a plain installable npm; this names that intent once
 */
const asSpecForFakeNpm = (input: { slug: string; version: string }): string[] => [
  '--spec',
  `file:${genFakeNpm({ slug: input.slug, version: input.version, engineNode: null, bin: 'reports-version' })}`,
];

/**
 * .what = a dir that holds an `fnm` whose `exec --using=<v> <cmd>` runs cmd on the test's node
 * .why = proves the dev-host path, where the current node differs from .nvmrc and fnm runs the step
 *
 * .mock = fnm
 * .why = ci has no fnm, and a real fnm holds whatever nodes its owner installed
 * .real = the skill calls only `fnm exec --using=<v> <cmd> [args]`; a real fnm puts that
 *         node and its own npm first on PATH, as this stub does with the test's node
 */
const genFnmStubThatExecs = (input: { pathFirst: string[] }): string => {
  const dir = genTempDir({ slug: 'verify-pin-fnm-exec-stub' });
  const pathFirst = [...input.pathFirst, path.dirname(process.execPath)].join(path.delimiter);
  fs.writeFileSync(
    path.join(dir, 'fnm'),
    `#!/usr/bin/env bash\n# fnm exec --using=<v> <cmd> [args]\nshift 2\nPATH=${JSON.stringify(pathFirst)}:"$PATH" exec "$@"\n`,
    { mode: 0o755 },
  );
  return dir;
};

/**
 * .what = a dir that holds an `npm` which reports a chosen version
 * .why = stands in for the npm a newer node bundles, to prove the skip branch on any node
 *
 * .mock = the npm beside the .nvmrc node
 * .why = the branch needs a node whose own npm is >= 11.5.1; ci's .nvmrc node bundles 10.9.4
 * .real = the skill reads only that npm's `--version`, as the workflow's guard does
 */
const genBundledNpmStub = (input: { version: string }): string => {
  const dir = genTempDir({ slug: 'verify-pin-bundled-npm-stub' });
  fs.writeFileSync(path.join(dir, 'npm'), `#!/usr/bin/env bash\necho ${input.version}\n`, { mode: 0o755 });
  return dir;
};

/**
 * .what = a dir that holds an `fnm` which knows no node
 * .why = proves the fnm-lacks-the-node branch on any host, ci included
 *
 * .mock = fnm
 * .why = ci has no fnm, and a real fnm on a dev host holds whatever nodes its owner installed
 * .real = the branch keys only on `fnm exec --using=<v> node --version` exit code;
 *         a real fnm with no such node exits non-zero the same way
 */
const genFnmStubThatKnowsNoNode = (): string => {
  const dir = genTempDir({ slug: 'verify-pin-fnm-stub' });
  fs.writeFileSync(path.join(dir, 'fnm'), '#!/usr/bin/env bash\nexit 1\n', { mode: 0o755 });
  return dir;
};

/**
 * .what = a local http registry whose `npm` packument holds one version, 1.0.0
 * .why = proves the ETARGET branch offline: npm asks this registry for npm@<absent> and
 *        answers `npm error code ETARGET`, with no tie to the public registry
 *
 * .mock = the npm registry
 * .why = a pr's ci may restore node_modules from cache and make no other registry call;
 *        a live ETARGET case would add one
 * .real = npm decides ETARGET from the packument's `versions` alone; the public registry
 *         serves the same packument shape. case1 stays live against the public registry
 * .note = a child process, since runSkill's spawnSync blocks this worker's event loop
 */
const startFakeRegistry = async (): Promise<{ url: string; stop: () => void }> => {
  const serverCode = `
    const http = require('node:http');
    const server = http.createServer((req, res) => {
      const port = server.address().port;
      const packument = {
        name: 'npm',
        'dist-tags': { latest: '1.0.0' },
        versions: { '1.0.0': { name: 'npm', version: '1.0.0', dist: { tarball: 'http://127.0.0.1:' + port + '/npm-1.0.0.tgz' } } },
      };
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(packument));
    });
    server.listen(0, '127.0.0.1', () => process.stdout.write(String(server.address().port) + '\\n'));
  `;
  const child = spawn(process.execPath, ['-e', serverCode], { stdio: ['ignore', 'pipe', 'inherit'] });
  const port = await new Promise<string>((resolvePort, rejectPort) => {
    child.stdout.once('data', (chunk: Buffer) => resolvePort(chunk.toString().trim()));
    child.once('error', rejectPort);
    child.once('exit', (code) => rejectPort(new MalfunctionError('fake registry exited early', { code })));
  });
  // fail loud if the server spoke aught but a port, since npm would only say "Invalid URL"
  if (!/^\d+$/.test(port))
    throw new MalfunctionError('fake registry did not report a port', { port });

  return { url: `http://127.0.0.1:${port}/`, stop: () => child.kill() };
};

describe('verify.publish-npm-pin', () => {
  given('[case1] the repo workflow, which pins npm@11, on the repo .nvmrc node', () => {
    when('[t0] the skill runs with no flags', () => {
      const result = useBeforeAll(async () =>
        runSkill({ args: [], cwd: REPO_ROOT, path: null, env: null }),
      );

      then('it exits 0 with empty stderr; on red, the diff shows the skill stderr', () => {
        expect({ exitCode: result.exitCode, stderr: result.stderr }).toEqual({ exitCode: 0, stderr: '' });
      });

      then('it reads the spec from the workflow, and installs an 11.x at or above 11.5.1, or skips as the tag would', () => {
        expect(result.stdout).toContain('--spec 11');
        expect(result.stdout).toMatch(
          /✨ npm 11\.\d+\.\d+ runs on node v[\d.]+, >= 11\.5\.1 for oidc|✨ npm [\d.]+ >= 11\.5\.1 already, so the tag skips this step/,
        );
      });
    });
  });

  given('[case2] an npm whose engine excludes the .nvmrc node, as npm 12.2.3 did for v0.1.6', () => {
    when('[t0] the skill runs with --spec file:<an npm whose engine needs node >=99>', () => {
      const result = useBeforeAll(async () =>
        runSkill({
          args: [
            '--spec',
            `file:${genFakeNpm({ slug: 'verify-pin-npm-engine-99', version: '99.0.0', engineNode: '>=99.0.0', bin: 'reports-version' })}`,
          ],
          cwd: genRepoOnHostNode({ slug: 'verify-pin-host-engine' }),
          path: null,
          env: null,
        }),
      );

      then('it exits 2 (constraint)', () => {
        expect(result.exitCode).toBe(2);
      });

      then('stderr names the engine mismatch, the npm ranges, and the fix', () => {
        expect(result.stderr).toContain('✋ ConstraintError: npm@file:');
        expect(result.stderr).toContain('does not run on node');
        expect(result.stderr).toContain('notsup Required: {"node":">=99.0.0"}');
        expect(result.stderr).toContain('fix: pin an npm whose engine accepts');
        expect(asSnapshotSafe({ output: result.stderr })).toMatchSnapshot();
      });

      then('stdout is empty', () => {
        expect(result.stdout).toBe('');
      });
    });
  });

  given('[case3] the installed npm version against the 11.5.1 oidc floor', () => {
    when('[t0] the installed npm is 10.9.4, below the floor', () => {
      const result = useBeforeAll(async () =>
        runSkill({
          args: asSpecForFakeNpm({ slug: 'verify-pin-npm-10', version: '10.9.4' }),
          cwd: genRepoOnHostNode({ slug: 'verify-pin-host-floor' }),
          path: null,
          env: null,
        }),
      );

      then('it exits 2 and names the version, the floor, and the fix', () => {
        expect(result.exitCode).toBe(2);
        expect(result.stderr).toContain('✋ ConstraintError: npm 10.9.4 < 11.5.1, too old for oidc');
        expect(result.stderr).toContain('fix: pin an npm >= 11.5.1');
        expect(asSnapshotSafe({ output: result.stderr })).toMatchSnapshot();
      });
    });

    when('[t1] the installed npm is 12.0.0-pre.1, a prerelease above the floor', () => {
      const result = useBeforeAll(async () =>
        runSkill({
          args: asSpecForFakeNpm({ slug: 'verify-pin-npm-pre', version: '12.0.0-pre.1' }),
          cwd: genRepoOnHostNode({ slug: 'verify-pin-host-pre' }),
          path: null,
          env: null,
        }),
      );

      then('it exits 0, since a prerelease of 12 clears 11.5.1', () => {
        expect(result.stderr).toBe('');
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('✨ npm 12.0.0-pre.1 runs on node');
      });
    });

    when('[t2] the installed npm is 11.5.1-pre.1, a prerelease of the floor itself', () => {
      const result = useBeforeAll(async () =>
        runSkill({
          args: asSpecForFakeNpm({ slug: 'verify-pin-npm-floor-pre', version: '11.5.1-pre.1' }),
          cwd: genRepoOnHostNode({ slug: 'verify-pin-host-floor-pre' }),
          path: null,
          env: null,
        }),
      );

      then('it exits 2, since semver ranks a prerelease below its release', () => {
        expect(result.exitCode).toBe(2);
        expect(result.stderr).toContain('✋ ConstraintError: npm 11.5.1-pre.1 < 11.5.1, too old for oidc');
      });
    });

    when('[t3] the installed npm is 11.5.1+build.7, the floor with build metadata', () => {
      const result = useBeforeAll(async () =>
        runSkill({
          args: asSpecForFakeNpm({ slug: 'verify-pin-npm-build', version: '11.5.1+build.7' }),
          cwd: genRepoOnHostNode({ slug: 'verify-pin-host-build' }),
          path: null,
          env: null,
        }),
      );

      then('it exits 0, since build metadata carries no rank', () => {
        expect(result.stderr).toBe('');
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('✨ npm 11.5.1+build.7 runs on node');
      });
    });
  });

  given('[case4] an npm version the registry does not hold', () => {
    when('[t0] the skill runs with --spec 0.0.0-absent against a registry that holds only 1.0.0', () => {
      const result = useBeforeAll(async () => {
        // the registry lives only as long as the one run that reads it
        const registry = await startFakeRegistry();
        try {
          return runSkill({
            args: ['--spec', '0.0.0-absent'],
            cwd: genRepoOnHostNode({ slug: 'verify-pin-host-etarget' }),
            path: null,
            env: { npm_config_registry: registry.url, npm_config_fetch_retries: '0' },
          });
        } finally {
          registry.stop();
        }
      });

      then('it exits 2 (constraint), since the caller fixes the spec and a re-run cannot help', () => {
        expect(result.exitCode).toBe(2);
      });

      then('stderr names the absent spec and how to list real ones', () => {
        expect(result.stderr).toContain("✋ ConstraintError: the registry holds no npm that matches '0.0.0-absent'");
        expect(result.stderr).toContain('fix: pick a published spec; list them with: npm view npm versions');
        expect(asSnapshotSafe({ output: result.stderr })).toMatchSnapshot();
      });
    });
  });

  given('[case8] a registry the install cannot reach', () => {
    when('[t0] the skill runs --spec 11 against a dead local port', () => {
      const result = useBeforeAll(async () =>
        runSkill({
          args: ['--spec', '11'],
          cwd: genRepoOnHostNode({ slug: 'verify-pin-host-dead-registry' }),
          path: null,
          env: { npm_config_registry: 'http://127.0.0.1:9/', npm_config_fetch_retries: '0' },
        }),
      );

      then('it exits 1 (malfunction), since the failure is no verdict on the pin', () => {
        expect(result.exitCode).toBe(1);
      });

      then('stderr shows the npm error tail and a fix', () => {
        expect(result.stderr).toContain('💥 MalfunctionError: npm install failed for a reason other than engine or spec');
        expect(result.stderr).toContain('ECONNREFUSED');
        expect(result.stderr).toContain('fix: read the npm errors above; on a network or registry fault, re-run');
        expect(asSnapshotSafe({ output: result.stderr })).toMatchSnapshot();
      });
    });
  });

  given('[case9] an installed npm that cannot start', () => {
    when('[t0] the skill runs with --spec file:<a fake npm whose bin exits 3>', () => {
      const result = useBeforeAll(async () =>
        runSkill({
          args: [
            '--spec',
            `file:${genFakeNpm({ slug: 'verify-pin-npm-crash', version: '99.0.0', engineNode: null, bin: 'cannot-start' })}`,
          ],
          cwd: genRepoOnHostNode({ slug: 'verify-pin-host-crash' }),
          path: null,
          env: null,
        }),
      );

      then('it exits 1 (malfunction), names the fault, shows npm stderr, and a fix', () => {
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('💥 MalfunctionError: the installed npm did not report its version');
        expect(result.stderr).toContain('fake npm: cannot start');
        expect(result.stderr).toContain('fix: re-run; if it repeats');
        expect(asSnapshotSafe({ output: result.stderr })).toMatchSnapshot();
      });
    });
  });

  given('[case12] an installed npm that prints a notice to stderr', () => {
    when('[t0] the skill reads the installed version', () => {
      const result = useBeforeAll(async () =>
        runSkill({
          args: [
            '--spec',
            `file:${genFakeNpm({ slug: 'verify-pin-npm-notice', version: '11.9.9', engineNode: null, bin: 'notices-then-reports' })}`,
          ],
          cwd: genRepoOnHostNode({ slug: 'verify-pin-host-notice' }),
          path: null,
          env: null,
        }),
      );

      then('it reads the version from stdout alone and exits 0', () => {
        expect(result.stderr).toBe('');
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('✨ npm 11.9.9 runs on node');
      });
    });
  });

  given('[case5] a caller who asks for help', () => {
    when('[t0] the skill runs with --help', () => {
      const result = useBeforeAll(async () =>
        runSkill({ args: ['--help'], cwd: REPO_ROOT, path: null, env: null }),
      );

      then('it exits 0 and prints usage and exit codes', () => {
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('usage:');
        expect(result.stdout).toContain('exit 2 = constraint');
        expect(result.stdout).toMatchSnapshot();
      });
    });
  });

  given('[case13] the call shape rhx sends', () => {
    when('[t0] the skill runs with --skill <name> first, then --spec=<value>', () => {
      const result = useBeforeAll(async () => {
        const fakeNpm = genFakeNpm({ slug: 'verify-pin-npm-rhx', version: '11.9.9', engineNode: null, bin: 'reports-version' });
        return runSkill({
          args: ['--skill', 'verify.publish-npm-pin', `--spec=file:${fakeNpm}`],
          cwd: genRepoOnHostNode({ slug: 'verify-pin-host-rhx' }),
          path: null,
          env: null,
        });
      });

      then('it skips the --skill pair, reads the = form, and exits 0', () => {
        expect(result.stderr).toBe('');
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('✨ npm 11.9.9 runs on node');
      });
    });
  });

  given('[case6] a caller who passes bad flags', () => {
    when('[t0] the skill runs with an unknown flag', () => {
      const result = useBeforeAll(async () =>
        runSkill({ args: ['--bogus'], cwd: REPO_ROOT, path: null, env: null }),
      );

      then('it exits 2 with the flag named and the help hint', () => {
        expect(result.exitCode).toBe(2);
        expect(result.stderr).toMatchSnapshot();
      });
    });

    when('[t1] the skill runs with --spec and no value', () => {
      const result = useBeforeAll(async () =>
        runSkill({ args: ['--spec'], cwd: REPO_ROOT, path: null, env: null }),
      );

      then('it exits 2 and names the fix', () => {
        expect(result.exitCode).toBe(2);
        expect(result.stderr).toMatchSnapshot();
      });
    });

    when('[t2] the skill runs with --skill and no value', () => {
      const result = useBeforeAll(async () =>
        runSkill({ args: ['--skill'], cwd: REPO_ROOT, path: null, env: null }),
      );

      then('it exits 2 with a qualified error, not a raw shell fault', () => {
        expect(result.exitCode).toBe(2);
        expect(result.stderr).toContain('✋ ConstraintError: --skill needs a value');
        expect(result.stderr).toMatchSnapshot();
      });
    });

    when('[t3] the skill runs with --spec= and no value', () => {
      const result = useBeforeAll(async () =>
        runSkill({ args: ['--spec='], cwd: REPO_ROOT, path: null, env: null }),
      );

      then('it exits 2 and names the fix', () => {
        expect(result.exitCode).toBe(2);
        expect(result.stderr).toContain('✋ ConstraintError: --spec needs a value');
      });
    });
  });

  given('[case7] a repo whose inputs are incomplete or vary', () => {
    when('[t3] the dir is not in a git repo', () => {
      const result = useBeforeAll(async () =>
        runSkill({ args: [], cwd: genTempDir({ slug: 'verify-pin-no-git' }), path: null, env: null }),
      );

      then('it exits 2 and names the fix', () => {
        expect(result.exitCode).toBe(2);
        expect(result.stderr).toContain('is not in a git repo');
        expect(asSnapshotSafe({ output: result.stderr })).toMatchSnapshot();
      });
    });

    when('[t4] the repo has no publish workflow', () => {
      const result = useBeforeAll(async () =>
        runSkill({
          args: [],
          cwd: genRepoFixture({ slug: 'verify-pin-no-workflow', nvmrc: 'v22.21.0\n', workflow: null }),
          path: null,
          env: null,
        }),
      );

      then('it exits 2 and names the absent file', () => {
        expect(result.exitCode).toBe(2);
        expect(result.stderr).toContain('✋ ConstraintError: no publish workflow at');
        expect(asSnapshotSafe({ output: result.stderr })).toMatchSnapshot();
      });
    });

    when('[t6] the .nvmrc names another node and fnm lacks it', () => {
      const result = useBeforeAll(async () =>
        runSkill({
          args: [],
          cwd: genRepoFixture({ slug: 'verify-pin-fnm-no-node', nvmrc: 'v0.0.1\n', workflow: WORKFLOW_WITH_PIN }),
          path: [genFnmStubThatKnowsNoNode(), genPathWithout({ hidden: ['fnm'] })].join(path.delimiter),
          env: null,
        }),
      );

      then('it exits 2 and names the install command, rather than install a node itself', () => {
        expect(result.exitCode).toBe(2);
        expect(result.stderr).toContain('✋ ConstraintError: fnm holds no node v0.0.1');
        expect(asSnapshotSafe({ output: result.stderr })).toMatchSnapshot();
      });
    });

    when('[t5] the workflow holds several npm upgrade lines', () => {
      const result = useBeforeAll(async () =>
        runSkill({
          args: [],
          cwd: genRepoFixture({
            slug: 'verify-pin-several-lines',
            nvmrc: 'v22.21.0\n',
            workflow: 'run: npm install -g npm@11\nrun: npm install -g npm@latest\n',
          }),
          path: null,
          env: null,
        }),
      );

      then('it exits 2 and lists each spec, rather than pick one', () => {
        expect(result.exitCode).toBe(2);
        expect(result.stderr).toContain('(11, latest)');
        expect(asSnapshotSafe({ output: result.stderr })).toMatchSnapshot();
      });
    });

    when('[t0] the workflow holds no npm upgrade line', () => {
      const result = useBeforeAll(async () =>
        runSkill({
          args: [],
          cwd: genRepoFixture({ slug: 'verify-pin-no-line', nvmrc: 'v22.21.0\n', workflow: 'run: echo hi\n' }),
          path: null,
          env: null,
        }),
      );

      then('it exits 2 and names both ways forward', () => {
        expect(result.exitCode).toBe(2);
        expect(result.stderr).toContain('there is no pin left to verify');
        expect(asSnapshotSafe({ output: result.stderr })).toMatchSnapshot();
      });
    });

    when('[t11] the workflow spec is an expression', () => {
      const result = useBeforeAll(async () =>
        runSkill({
          args: [],
          cwd: genRepoFixture({
            slug: 'verify-pin-expression-spec',
            nvmrc: 'v22.21.0\n',
            workflow: 'run: npm install -g npm@${{ env.NPM_SPEC }}\n',
          }),
          path: null,
          env: null,
        }),
      );

      then('it exits 2 and asks for a literal spec, rather than install a guess', () => {
        expect(result.exitCode).toBe(2);
        expect(result.stderr).toContain('is an expression, which only the tag run can expand');
        expect(asSnapshotSafe({ output: result.stderr })).toMatchSnapshot();
      });
    });

    when('[t1] the repo has no .nvmrc', () => {
      const result = useBeforeAll(async () =>
        runSkill({
          args: [],
          cwd: genRepoFixture({ slug: 'verify-pin-no-nvmrc', nvmrc: null, workflow: WORKFLOW_WITH_PIN }),
          path: null,
          env: null,
        }),
      );

      then('it exits 2 and names the absent file', () => {
        expect(result.exitCode).toBe(2);
        expect(result.stderr).toContain('✋ ConstraintError: no .nvmrc at');
        expect(asSnapshotSafe({ output: result.stderr })).toMatchSnapshot();
      });
    });

    when('[t2] the .nvmrc names another node and fnm is absent', () => {
      const result = useBeforeAll(async () =>
        runSkill({
          args: [],
          cwd: genRepoFixture({ slug: 'verify-pin-no-fnm', nvmrc: 'v0.0.1\n', workflow: WORKFLOW_WITH_PIN }),
          path: genPathWithout({ hidden: ['fnm'] }),
          env: null,
        }),
      );

      then('it exits 2 and names both fixes', () => {
        expect(result.exitCode).toBe(2);
        expect(result.stderr).toContain('.nvmrc names v0.0.1, and fnm is absent');
        expect(asSnapshotSafe({ output: result.stderr })).toMatchSnapshot();
      });
    });

    when('[t7] node is absent from PATH', () => {
      const result = useBeforeAll(async () =>
        runSkill({
          args: [],
          cwd: genRepoFixture({ slug: 'verify-pin-no-node', nvmrc: 'v22.21.0\n', workflow: WORKFLOW_WITH_PIN }),
          path: genPathWithout({ hidden: ['node', 'fnm'] }),
          env: null,
        }),
      );

      then('it exits 2 and names the node to install', () => {
        expect(result.exitCode).toBe(2);
        expect(result.stderr).toContain('✋ ConstraintError: node is absent from PATH');
        expect(result.stderr).toContain('fix: install node v22.21.0, or fnm');
        expect(asSnapshotSafe({ output: result.stderr })).toMatchSnapshot();
      });
    });

    when('[t8] the .nvmrc names the current node with no "v" prefix', () => {
      const result = useBeforeAll(async () =>
        runSkill({
          args: asSpecForFakeNpm({ slug: 'verify-pin-npm-bare', version: '11.9.9' }),
          cwd: genRepoFixture({
            slug: 'verify-pin-bare-nvmrc',
            nvmrc: `${process.version.replace(/^v/, '')}\n`,
            workflow: WORKFLOW_WITH_PIN,
          }),
          path: genPathWithout({ hidden: ['fnm'] }),
          env: null,
        }),
      );

      then('it runs on the current node, with no fnm needed, and exits 0', () => {
        expect(result.stderr).toBe('');
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('✨ npm 11.9.9 runs on node');
      });
    });

    when('[t10] the .nvmrc holds a loose major, as setup-node accepts', () => {
      const result = useBeforeAll(async () =>
        runSkill({
          args: asSpecForFakeNpm({ slug: 'verify-pin-npm-loose', version: '11.9.9' }),
          cwd: genRepoFixture({
            slug: 'verify-pin-loose-nvmrc',
            nvmrc: `${process.version.replace(/^v/, '').split('.')[0]}\n`,
            workflow: WORKFLOW_WITH_PIN,
          }),
          path: genPathWithout({ hidden: ['fnm'] }),
          env: null,
        }),
      );

      then('it counts the current node as a match, with no fnm needed, and exits 0', () => {
        expect(result.stderr).toBe('');
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('✨ npm 11.9.9 runs on node');
      });
    });

    when('[t9] the .nvmrc names another node and fnm holds it', () => {
      const result = useBeforeAll(async () =>
        runSkill({
          args: asSpecForFakeNpm({ slug: 'verify-pin-npm-via-fnm', version: '11.9.9' }),
          cwd: genRepoFixture({ slug: 'verify-pin-fnm-exec', nvmrc: 'v0.0.1\n', workflow: WORKFLOW_WITH_PIN }),
          path: [genFnmStubThatExecs({ pathFirst: [] }), genPathWithout({ hidden: ['fnm'] })].join(path.delimiter),
          env: null,
        }),
      );

      then('it runs the step through fnm exec and exits 0', () => {
        expect(result.stderr).toBe('');
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('✨ npm 11.9.9 runs on node v0.0.1, >= 11.5.1 for oidc');
        expect(asSnapshotSafe({ output: result.stdout })).toMatchSnapshot();
      });
    });
  });

  given('[case11] a .nvmrc node whose own npm already clears the floor', () => {
    when('[t0] the skill reads the spec from the workflow', () => {
      const result = useBeforeAll(async () =>
        runSkill({
          args: [],
          cwd: genRepoFixture({ slug: 'verify-pin-skip', nvmrc: 'v0.0.1\n', workflow: WORKFLOW_WITH_PIN }),
          path: [
            genFnmStubThatExecs({ pathFirst: [genBundledNpmStub({ version: '11.6.0' })] }),
            genPathWithout({ hidden: ['fnm'] }),
          ].join(path.delimiter),
          env: null,
        }),
      );

      then('it exits 0 and reports the tag skips the step, as the workflow guard does', () => {
        expect(result.stderr).toBe('');
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('✨ npm 11.6.0 >= 11.5.1 already, so the tag skips this step');
        expect(asSnapshotSafe({ output: result.stdout })).toMatchSnapshot();
      });
    });
  });

  given('[case10] a workflow whose upgrade line is quoted, beside a commented-out one', () => {
    when('[t0] the skill reads the spec from the workflow', () => {
      const result = useBeforeAll(async () => {
        const fakeNpm = genFakeNpm({ slug: 'verify-pin-npm-quoted', version: '11.9.9', engineNode: null, bin: 'reports-version' });
        return runSkill({
          args: [],
          cwd: genRepoFixture({
            slug: 'verify-pin-quoted-line',
            nvmrc: `${process.version}\n`,
            workflow: `# run: npm install -g npm@latest\nrun: "npm install -g npm@file:${fakeNpm}"; echo done\n`,
          }),
          path: null,
          env: null,
        });
      });

      then('it takes the live line, stops the spec at the quote, skips the comment, and exits 0', () => {
        expect(result.stderr).toBe('');
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(/--spec file:\S+verify-pin-npm-quoted\S*\n/);
        expect(result.stdout).not.toContain('"');
        expect(result.stdout).not.toContain('npm@latest');
      });
    });
  });
});

import { ConstraintError, MalfunctionError } from 'helpful-errors';
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
 * .what = fold each run of masked npm prose branches into one branch that keeps the count
 * .why = seven identical placeholder lines read as noise; the count still shows a change in npm's tail
 */
const asNpmProseRunsFolded = (input: { output: string }): string =>
  input.output.replace(/(?:( *)├─ npm error <npm prose>\n)+/g, (run: string, indent: string) =>
    `${indent}├─ npm error <npm prose, ${run.split('\n').length - 1} lines>\n`,
  );

/**
 * .what = mask the fields that vary by run, host, registry state, or npm release
 * .why = a snapshot must hold the shape a human sees, not a temp path or npm's advice prose
 */
const asSnapshotSafe = (input: { output: string }): string =>
  asNpmProseRunsFolded({ output: asSnapshotUnfolded({ output: input.output }) });

/**
 * .what = the node versions that vary by host or by a .nvmrc bump: the test's own node, and the repo's .nvmrc
 * .why = only these are masked; a hardcoded fixture node (v0.0.1) stays literal, so a mismatch reads as one
 */
const NODE_VERSIONS_VOLATILE = [
  ...new Set([process.version, fs.readFileSync(path.join(REPO_ROOT, '.nvmrc'), 'utf-8').trim()]),
];

/**
 * .what = an output with each volatile node version swapped for `v<node>`
 * .why = a snapshot must hold on any host node and across a .nvmrc bump
 */
const asHostNodeMasked = (input: { output: string }): string =>
  NODE_VERSIONS_VOLATILE.reduce((output, version) => output.split(version).join('v<node>'), input.output);

/**
 * .what = a node pin with its digits swapped for the name of each segment
 * .why = the loose-pin cases prove the pin's shape (22, 22.21, 22.21.0); the host's digits are noise
 */
const asNodePinShape = (input: { pin: string }): string =>
  ['<major>', '<minor>', '<patch>'].slice(0, input.pin.split('.').length).join('.');

/**
 * .what = the per-line masks that asSnapshotSafe applies before it folds prose runs
 * .why = each mask targets one volatile field, so the fold reads the masked lines alone
 * .note = a version with a prerelease or build tail is a hardcoded fixture, so it stays literal
 */
const asSnapshotUnfolded = (input: { output: string }): string =>
  asHostNodeMasked({ output: input.output })
    .replace(/npm 11\.\d+\.\d+(?![-+\w])/g, 'npm 11.<minor>.<patch>')
    .replace(/(node:|runs on node) (\d+(?:\.\d+){0,2})(?= \(\.nvmrc\)|,)/g, (_match: string, lead: string, pin: string) =>
      `${lead} ${asNodePinShape({ pin })}`,
    )
    .replace(/\/\S*\/\.npm\/_logs\/\S+/g, '<npm-log>')
    .replace(/no \.nvmrc at \S+;/g, 'no .nvmrc at <repo>;')
    .replace(/(in|at|read) \S+\.publish-npm\.yml/g, '$1 <repo>/.github/workflows/.publish-npm.yml')
    .replace(/\S+ is not in a git repo/g, '<dir> is not in a git repo')
    .replace(/npm@file:\S+/g, 'npm@file:<fake-npm>')
    .replace(/--spec file:\S+/g, '--spec file:<fake-npm>')
    .replace(/(├─ npm error) (?!code |notsup ).*/g, '$1 <npm prose>')
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
 *         case1 (success) and case15 (EBADENGINE) run the same verdicts live on the registry
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
 * .what = a dir that holds an `npm` which reports a chosen version, and hands every other call to the test's real npm
 * .why = pins the guard mirror's verdict on any host, yet still lets the step install for real
 *
 * .mock = the npm beside the .nvmrc node
 * .why = the host npm's own version would otherwise decide skip vs install
 * .real = the skill reads only that npm's `--version` for the guard; the install call runs the real npm
 */
const genBundledNpmStubThatDelegates = (input: { version: string }): string => {
  const dir = genTempDir({ slug: 'verify-pin-bundled-npm-delegates' });
  const npmReal = path.join(path.dirname(process.execPath), 'npm');
  fs.writeFileSync(
    path.join(dir, 'npm'),
    `#!/usr/bin/env bash\nif [[ "$1" == --version ]]; then echo ${input.version}; exit 0; fi\nexec ${JSON.stringify(npmReal)} "$@"\n`,
    { mode: 0o755 },
  );
  return dir;
};

/**
 * .what = a dir that holds an `npm` which cannot start: it prints a fault and exits 3
 * .why = proves the guard-mirror branch, where the npm beside the .nvmrc node is broken
 *
 * .mock = the npm beside the .nvmrc node
 * .why = a real broken node install cannot be built on demand on a ci host
 * .real = the skill reads only that npm's `--version` exit and stderr, as for any npm
 */
const genBundledNpmStubThatCannotStart = (): string => {
  const dir = genTempDir({ slug: 'verify-pin-bundled-npm-broken' });
  fs.writeFileSync(path.join(dir, 'npm'), '#!/usr/bin/env bash\necho "fake bundled npm: cannot start" >&2\nexit 3\n', {
    mode: 0o755,
  });
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
 * .why = proves the ETARGET branch with no network, so it holds when the registry is slow
 * .real = npm decides ETARGET from the packument's `versions` alone; the public registry
 *         serves the same packument shape. case14 runs the same verdict live on it
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

/**
 * .what = the published npm whose engine broke the v0.1.6 tag, and its engine range
 * .why = a published version is immutable, so its engine range is a fixed fact of the registry
 */
const NPM_EXCLUDES_NVMRC_NODE = { spec: '12.2.3', engineNode: '^22.22.2 || ^24.15.0 || >=26.0.0' };

/**
 * .what = succeed when a node version sits inside npm 12.2.3's engine range
 * .why = the live EBADENGINE case needs a host node outside that range, and must say so if not
 */
const isNodeInsideNpm1223Engine = (input: { version: string }): boolean => {
  const [major = 0, minor = 0, patch = 0] = input.version.replace(/^v/, '').split('.').map(Number);
  if (major >= 26) return true;
  if (major === 24) return minor >= 15;
  if (major === 22) return minor > 22 || (minor === 22 && patch >= 2);
  return false;
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

      then('its masked live stdout holds the shape a maintainer sees on the real workflow and registry', () => {
        // a .nvmrc bump to a node whose npm clears the floor flips this to the skip tree; a resnap shows it
        expect(asSnapshotSafe({ output: result.stdout })).toMatchSnapshot();
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
        expect(result.stdout).toBe('');
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
        expect(asSnapshotSafe({ output: result.stdout })).toMatchSnapshot();
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
        expect(result.stdout).toBe('');
        expect(asSnapshotSafe({ output: result.stderr })).toMatchSnapshot();
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
        expect(asSnapshotSafe({ output: result.stdout })).toMatchSnapshot();
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
        expect(result.stdout).toBe('');
        expect(asSnapshotSafe({ output: result.stderr })).toMatchSnapshot();
      });
    });
  });

  given('[case14] the public registry, asked for an npm it does not hold', () => {
    when('[t0] the skill runs with --spec 0.0.0-absent, live', () => {
      const result = useBeforeAll(async () =>
        runSkill({
          args: ['--spec', '0.0.0-absent'],
          cwd: genRepoOnHostNode({ slug: 'verify-pin-host-live-etarget' }),
          path: null,
          env: null,
        }),
      );

      then('it exits 2 on the registry\'s real ETARGET, and names the spec and how to list real ones', () => {
        expect(result.exitCode).toBe(2);
        expect(result.stderr).toContain("✋ ConstraintError: the registry holds no npm that matches '0.0.0-absent'");
        expect(result.stdout).toBe('');
        expect(asSnapshotSafe({ output: result.stderr })).toMatchSnapshot();
      });
    });
  });

  given('[case15] the public registry, asked for npm 12.2.3, whose engine broke the v0.1.6 tag', () => {
    when('[t0] the skill runs with --spec 12.2.3 on a node outside its engine, live', () => {
      const result = useBeforeAll(async () => {
        // fail loud, not silent, on a host node that npm 12.2.3 accepts; the case proves naught there
        // a .nvmrc bump into that range (the case=2 remedy) trips this; repoint NPM_EXCLUDES_NVMRC_NODE to an npm whose engine excludes the new node
        if (isNodeInsideNpm1223Engine({ version: process.version }))
          throw new ConstraintError('this case needs a node outside npm 12.2.3 engine range', {
            node: process.version,
            engineNode: NPM_EXCLUDES_NVMRC_NODE.engineNode,
            hint: 'run on the .nvmrc node, or pick a published npm whose engine excludes this node (npm view npm@<v> engines.node)',
          });
        return runSkill({
          args: ['--spec', NPM_EXCLUDES_NVMRC_NODE.spec],
          cwd: genRepoOnHostNode({ slug: 'verify-pin-host-live-ebadengine' }),
          path: null,
          env: null,
        });
      });

      then('it exits 2 on npm\'s real EBADENGINE, with the real Required range and the fix', () => {
        expect(result.exitCode).toBe(2);
        expect(result.stderr).toContain('✋ ConstraintError: npm@12.2.3 does not run on node');
        expect(result.stderr).toContain(`notsup Required: {"node":"${NPM_EXCLUDES_NVMRC_NODE.engineNode}"}`);
        expect(result.stdout).toBe('');
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
        expect(result.stdout).toBe('');
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
        expect(result.stdout).toBe('');
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
        expect(asSnapshotSafe({ output: result.stdout })).toMatchSnapshot();
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
        expect(asSnapshotSafe({ output: result.stdout })).toMatchSnapshot();
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
        expect(result.stderr).toContain('✋ ConstraintError: unknown flag --bogus');
        expect(result.stderr).toContain('fix: the flags are --spec <spec> and --help; see rhx verify.publish-npm-pin --help');
        expect(result.stdout).toBe('');
        expect(result.stderr).toMatchSnapshot();
      });
    });

    when('[t1] the skill runs with --spec and no value', () => {
      const result = useBeforeAll(async () =>
        runSkill({ args: ['--spec'], cwd: REPO_ROOT, path: null, env: null }),
      );

      then('it exits 2 and names the fix', () => {
        expect(result.exitCode).toBe(2);
        expect(result.stderr).toContain('✋ ConstraintError: --spec needs a value');
        expect(result.stderr).toContain('fix: rhx verify.publish-npm-pin --spec <spec>, e.g. --spec 11');
        expect(result.stdout).toBe('');
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
        expect(result.stdout).toBe('');
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
        expect(result.stdout).toBe('');
        expect(asSnapshotSafe({ output: result.stderr })).toMatchSnapshot();
      });
    });

    when('[t4] the skill runs with --spec followed by another flag', () => {
      const result = useBeforeAll(async () =>
        runSkill({ args: ['--spec', '--skill', 'x'], cwd: REPO_ROOT, path: null, env: null }),
      );

      then('it exits 2 and reads the flag as an absent value, not as spec "--skill"', () => {
        expect(result.exitCode).toBe(2);
        expect(result.stderr).toContain('✋ ConstraintError: --spec needs a value');
        expect(result.stderr).not.toContain('npm@--skill');
        expect(result.stdout).toBe('');
        expect(asSnapshotSafe({ output: result.stderr })).toMatchSnapshot();
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
        expect(result.stdout).toBe('');
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
        expect(result.stdout).toBe('');
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
        expect(result.stdout).toBe('');
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
        expect(result.stdout).toBe('');
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
        expect(result.stderr).toContain("if the workflow still upgrades npm, write the step as 'npm install -g npm@<spec>'");
        expect(result.stderr).toContain('there is no pin left to verify');
        expect(result.stdout).toBe('');
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
        expect(result.stderr).toContain("the workflow's npm spec '${{ env.NPM_SPEC }}' is an expression, which only the tag run can expand");
        expect(result.stdout).toBe('');
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
        expect(result.stdout).toBe('');
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
        expect(result.stdout).toBe('');
        expect(asSnapshotSafe({ output: result.stderr })).toMatchSnapshot();
      });
    });

    when('[t7] node is absent from PATH', () => {
      const result = useBeforeAll(async () =>
        runSkill({
          args: [],
          cwd: genRepoFixture({ slug: 'verify-pin-no-node', nvmrc: 'v0.0.1\n', workflow: WORKFLOW_WITH_PIN }),
          path: genPathWithout({ hidden: ['node', 'fnm'] }),
          env: null,
        }),
      );

      then('it exits 2 and names the node to install', () => {
        expect(result.exitCode).toBe(2);
        expect(result.stderr).toContain('✋ ConstraintError: node is absent from PATH');
        expect(result.stderr).toContain('fix: install node v0.0.1, or fnm');
        expect(result.stdout).toBe('');
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
        expect(asSnapshotSafe({ output: result.stdout })).toMatchSnapshot();
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
        expect(asSnapshotSafe({ output: result.stdout })).toMatchSnapshot();
      });
    });

    when('[t12] the .nvmrc holds a major.minor, as setup-node accepts', () => {
      const result = useBeforeAll(async () =>
        runSkill({
          args: asSpecForFakeNpm({ slug: 'verify-pin-npm-major-minor', version: '11.9.9' }),
          cwd: genRepoFixture({
            slug: 'verify-pin-major-minor-nvmrc',
            nvmrc: `${process.version.replace(/^v/, '').split('.').slice(0, 2).join('.')}\n`,
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
        expect(asSnapshotSafe({ output: result.stdout })).toMatchSnapshot();
      });
    });

    when('[t13] the .nvmrc holds an alias, lts/*, and fnm is absent', () => {
      const result = useBeforeAll(async () =>
        runSkill({
          args: [],
          cwd: genRepoFixture({ slug: 'verify-pin-alias-nvmrc', nvmrc: 'lts/*\n', workflow: WORKFLOW_WITH_PIN }),
          path: genPathWithout({ hidden: ['fnm'] }),
          env: null,
        }),
      );

      then('it never matches the alias to the current node, and asks for fnm to expand it', () => {
        expect(result.exitCode).toBe(2);
        expect(result.stderr).toContain('.nvmrc names lts/*, and fnm is absent');
        expect(result.stderr).toContain('fix: install fnm (https://github.com/Schniz/fnm), which expands the alias lts/*');
        expect(result.stderr).not.toContain('switch to node lts/*');
        expect(result.stdout).toBe('');
        expect(asSnapshotSafe({ output: result.stderr })).toMatchSnapshot();
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

    when('[t1] the skill runs with --spec, on that same node', () => {
      const result = useBeforeAll(async () =>
        runSkill({
          args: asSpecForFakeNpm({ slug: 'verify-pin-npm-spec-bypass', version: '11.9.9' }),
          cwd: genRepoFixture({ slug: 'verify-pin-spec-bypass', nvmrc: 'v0.0.1\n', workflow: WORKFLOW_WITH_PIN }),
          path: [
            genFnmStubThatExecs({ pathFirst: [genBundledNpmStubThatDelegates({ version: '11.6.0' })] }),
            genPathWithout({ hidden: ['fnm'] }),
          ].join(path.delimiter),
          env: null,
        }),
      );

      then('it runs the install anyway, since an explicit spec is a request to try it, and exits 0', () => {
        expect(result.stderr).toBe('');
        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain('skips this step');
        expect(result.stdout).toContain('✨ npm 11.9.9 runs on node v0.0.1, >= 11.5.1 for oidc');
        expect(asSnapshotSafe({ output: result.stdout })).toMatchSnapshot();
      });
    });
  });

  given('[case16] a host fault before the install', () => {
    when('[t0] the npm beside the .nvmrc node cannot report its version', () => {
      const result = useBeforeAll(async () =>
        runSkill({
          args: [],
          cwd: genRepoFixture({ slug: 'verify-pin-bundled-broken', nvmrc: 'v0.0.1\n', workflow: WORKFLOW_WITH_PIN }),
          path: [
            genFnmStubThatExecs({ pathFirst: [genBundledNpmStubThatCannotStart()] }),
            genPathWithout({ hidden: ['fnm'] }),
          ].join(path.delimiter),
          env: null,
        }),
      );

      then('it exits 1 (malfunction) under the run tree, as case9 does, with that npm stderr as a branch and a fix', () => {
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('🐚 verify.publish-npm-pin --spec 11');
        expect(result.stderr).toContain('   └─ 💥 MalfunctionError: the npm beside node v0.0.1 did not report its version\n');
        expect(result.stderr).toContain('      ├─ fake bundled npm: cannot start');
        expect(result.stderr).toContain('      └─ fix: check the node install, then re-run');
        expect(result.stdout).toBe('');
        expect(asSnapshotSafe({ output: result.stderr })).toMatchSnapshot();
      });
    });

    when('[t1] the publish workflow cannot be read', () => {
      const result = useBeforeAll(async () => {
        // fail loud, not silent, as root: root reads a mode 000 file, so the case proves naught there
        if (process.getuid?.() === 0)
          throw new ConstraintError('this case needs a non-root user, since root ignores file modes', {
            uid: 0,
            hint: 'run the suite as a non-root user',
          });
        const repo = genRepoFixture({ slug: 'verify-pin-workflow-unreadable', nvmrc: 'v0.0.1\n', workflow: WORKFLOW_WITH_PIN });
        fs.chmodSync(path.join(repo, '.github/workflows/.publish-npm.yml'), 0o000);
        return runSkill({ args: [], cwd: repo, path: null, env: null });
      });

      then('it exits 1 (malfunction), names the file, and the fix, with no raw tool fault above it', () => {
        expect(result.exitCode).toBe(1);
        expect(result.stderr.startsWith('🐢 bummer dude...')).toBe(true);
        expect(result.stderr).toContain('💥 MalfunctionError: could not read');
        expect(result.stderr).toContain("fix: check the file's read permission, then re-run");
        expect(result.stdout).toBe('');
        expect(asSnapshotSafe({ output: result.stderr })).toMatchSnapshot();
      });
    });

    when('[t2] the temp dir for the npm prefix cannot be made', () => {
      const result = useBeforeAll(async () =>
        runSkill({
          args: asSpecForFakeNpm({ slug: 'verify-pin-npm-no-tmp', version: '11.9.9' }),
          cwd: genRepoOnHostNode({ slug: 'verify-pin-host-no-tmp' }),
          path: null,
          env: { TMPDIR: '/nonexistent/verify-pin-tmpdir' },
        }),
      );

      then('it exits 1 (malfunction), names the dir it tried, and TMPDIR in the fix, with no raw tool fault above it', () => {
        expect(result.exitCode).toBe(1);
        expect(result.stderr.startsWith('🐢 bummer dude...')).toBe(true);
        expect(result.stderr).toContain('🐚 verify.publish-npm-pin --spec file:');
        expect(result.stderr).toContain(
          '   └─ 💥 MalfunctionError: could not make a temp dir under /nonexistent/verify-pin-tmpdir for the npm prefix',
        );
        expect(result.stdout).toBe('');
        expect(asSnapshotSafe({ output: result.stderr })).toMatchSnapshot();
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
            nvmrc: 'v0.0.1\n',
            workflow: `# run: npm install -g npm@latest\nrun: "npm install -g npm@file:${fakeNpm}"; echo done\n`,
          }),
          // the guard mirror reads a pinned 10.0.0, so the host npm's own version never flips this case to the skip tree
          path: [
            genFnmStubThatExecs({ pathFirst: [genBundledNpmStubThatDelegates({ version: '10.0.0' })] }),
            genPathWithout({ hidden: ['fnm'] }),
          ].join(path.delimiter),
          env: null,
        });
      });

      then('it takes the live line, stops the spec at the quote, skips the comment, and exits 0', () => {
        expect(result.stderr).toBe('');
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(/--spec file:\S+verify-pin-npm-quoted\S*\n/);
        expect(result.stdout).not.toContain('"');
        expect(result.stdout).not.toContain('npm@latest');
        expect(asSnapshotSafe({ output: result.stdout })).toMatchSnapshot();
      });
    });
  });
});

# howto: selftest CLI via self-link

## .what

enable `npx $package-name` to work within the package's own repo for local CLI self-test.

## .why

- test the actual consumer experience (`npx sdk-environment get commit`)
- verify bin shim works before publish
- playtest commands match what consumers will run

## .how

### step 1: add self-link to devDependencies

```json
{
  "devDependencies": {
    "sdk-environment": "link:."
  }
}
```

use `link:.` not `file:.` — `link` creates a symlink to the repo, so built artifacts are available immediately. `file` copies files at install time, so artifacts built after install are absent.

### step 2: install

```bash
pnpm install
```

### step 3: invoke via npx

```bash
npx sdk-environment get commit
```

## .alternative: direct bin invocation

if self-link is not set up, invoke the bin shim directly:

```bash
./bin/run get commit
```

this works without install but bypasses the symlink resolution that `npx` uses.

## .when to use each

| method | use case |
|--------|----------|
| `npx $package` | consumer experience test, after `pnpm install` |
| `./bin/run` | quick iteration, no install needed |

## .note

the self-link appears in `node_modules/.bin/$package-name` after install, which is what `npx` resolves.


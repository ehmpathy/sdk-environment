# sdk-environment

![test](https://github.com/ehmpathy/sdk-environment/workflows/test/badge.svg)
![publish](https://github.com/ehmpathy/sdk-environment/workflows/publish/badge.svg)

parse and expose the environment your code runs in

# install

```sh
npm install sdk-environment
```

# what

an environment is defined by three attributes:

```ts
interface Environment {
  access: 'test' | 'prep' | 'prod';
  server: string;  // 'local' | 'local@cicd' | 'cloud@aws.lambda' | ...
  commit: string;  // '$gitref@$hash' or '$gitref@$hash+' if dirty
}
```

| attribute | what | why |
|-----------|------|-----|
| `access` | what resources can we touch? | controls which databases, apis, secrets, etc. are reachable |
| `server` | where does this run? | enables server-specific behavior (log format, cache strategy, etc.) |
| `commit` | what code is this? | enables traceability and debug |

## access

which tier of resources this process can access.

| value | what | examples |
|-------|------|----------|
| `test` | ephemeral, isolated, disposable | in-memory db, mocked apis, test fixtures |
| `prep` | persistent, shared, pre-production | prep db, sandbox apis, qa data |
| `prod` | persistent, shared, production | production db, live apis, real users |

## server

where this process executes. format: `$tier` or `$tier@$platform`

| value | what | examples |
|-------|------|----------|
| `local` | developer machine | laptop, docker compose |
| `local@cicd` | ci runner | github actions, circleci |
| `cloud@aws.lambda` | aws lambda | serverless functions |
| `cloud@aws.ecs` | aws ecs | containerized services |
| `cloud@aws.ec2` | aws ec2 | virtual machines |
| `cloud@gcp.cloudrun` | gcp cloud run | containerized services |

the tier (`local` or `cloud`) is always parseable:

```ts
const tier = environment.server.split('@')[0]; // 'local' | 'cloud'
```

## commit

what code this process runs. format: `$gitref@$hash` or `$gitref@$hash+` if dirty

| context | format | example |
|---------|--------|---------|
| tagged release | `v$tag@$hash` | `v1.2.3@a1b2c3d` |
| branch build | `$branch@$hash` | `feat/auth@e4f5g6h` |
| local dev | `$branch@$hash` | `main@i7j8k9l` |
| dirty (uncommitted changes) | `$gitref@$hash+` | `main@i7j8k9l+` |

the `+` suffix indicates uncommitted changes exist. enables:
- trace logs back to exact code version
- detect if deployed with uncommitted changes
- debug production issues
- track releases

# use

```ts
import { getEnvironment } from 'sdk-environment';

const environment = await getEnvironment();

console.log(environment);
// {
//   access: 'prod',
//   server: 'cloud@aws.lambda',
//   commit: 'v1.2.3@a1b2c3d'
// }
```

## pluggable parsers

each attribute is derived via an ordered list of parsers. first parser to return a value wins.

```ts
import {
  getEnvironment,
  fromEnvar,
  fromAwsAccountAlias,
  fromNodeEnv,
  fromLambdaTaskRoot,
  fromCiEnvar,
  fromGit,
} from 'sdk-environment';

// default parsers (what getEnvironment() uses out of the box)
const environment = await getEnvironment({
  parsers: {
    access: [
      fromEnvar('ACCESS'),           // explicit override via ACCESS=prod
      fromAwsAccountAlias(),         // infer from aws account alias (e.g., 'myorg-prod' → prod)
      fromNodeEnv(),                 // fallback: NODE_ENV=test → test
    ],
    server: [
      fromEnvar('SERVER'),           // explicit override via SERVER=cloud@aws.lambda
      fromLambdaTaskRoot(),          // LAMBDA_TASK_ROOT present → cloud@aws.lambda
      fromCiEnvar(),                 // CI=true → local@cicd
      () => 'local',                 // default to local
    ],
    commit: [
      fromEnvar('COMMIT'),           // explicit override via COMMIT=v1.0.0@abc123
      fromGit(),                     // git describe + rev-parse + dirty check → v1.0.0@abc123+
    ],
  },
});
```

### custom parsers

a parser is a function that returns a value or null:

```ts
type Parser<T> = () => T | null | Promise<T | null>;
```

add custom parsers for your infrastructure:

```ts
import { getEnvironment, fromEnvar } from 'sdk-environment';

// custom parser: infer access from k8s namespace
const fromK8sNamespace = (): 'test' | 'prep' | 'prod' | null => {
  const ns = process.env.K8S_NAMESPACE;
  if (ns?.endsWith('-prod')) return 'prod';
  if (ns?.endsWith('-prep')) return 'prep';
  if (ns?.endsWith('-test')) return 'test';
  return null;
};

const environment = await getEnvironment({
  parsers: {
    access: [
      fromEnvar('ACCESS'),
      fromK8sNamespace(),        // your custom parser
      fromAwsAccountAlias(),
      fromNodeEnv(),
    ],
  },
});
```

## with config

pair with config to load secrets per-environment:

```ts
import { getEnvironment } from 'sdk-environment';
import { getConfig } from './config';

const environment = await getEnvironment();
const config = await getConfig({ environment });

// config.database.password loaded from:
// - test: local .env or mock
// - prep: aws ssm /myapp/prep/database.password
// - prod: aws ssm /myapp/prod/database.password
```

## override via env vars

set explicit values when parsers can't infer correctly:

```sh
ACCESS=prod SERVER=cloud@aws.lambda COMMIT=v1.2.3@abc123 node app.js
```

# design

## why these three?

every runtime question reduces to one of:

1. **what can i touch?** → `access`
2. **where am i?** → `server`
3. **what code is this?** → `commit`

other concerns (region, account, cluster) are derivable or orthogonal.

## access vs server

these are independent axes:

| access | server | example |
|--------|--------|---------|
| test | local | `npm test` on laptop |
| test | local@cicd | ci runner runs tests |
| prep | local | dev laptop against prep db |
| prep | cloud@aws.lambda | prep lambda |
| prod | local | production debug session |
| prod | cloud@aws.lambda | production lambda |

this separation enables precise behavior:

```ts
// fail loudly in test, warn in prod
if (environment.access === 'test') {
  throw new SchemaError('config drift detected');
} else {
  log.warn('config drift detected', { diff });
}

// verbose logs locally, structured logs in cloud
const tier = environment.server.split('@')[0];
if (tier === 'local') {
  log.pretty();
} else {
  log.json();
}
```

## prep over dev

we use `prep` (preparation) instead of `dev` (development):

| term | describes | semantic fit |
|------|-----------|--------------|
| prod | where we **produce** value | what happens there |
| prep | where we **prepare** for production | what happens there |
| dev | who uses it (developers) | who, not what |

`test → prep → prod` reads as a progression of readiness.

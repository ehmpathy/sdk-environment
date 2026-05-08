# rule.prefer.optional-input-for-sdk-ux

## .what

public SDK functions use optional input parameters (`input?:`) to maximize developer experience.

## .why

SDK consumers should not need to pass explicit null or empty objects for default behavior:

```ts
// good — optional input, zero friction
const env = await getEnvironment();
const env = getEnvironment.static();

// bad — required input, unnecessary friction
const env = await getEnvironment({});
const env = await getEnvironment(null);
```

## .where

applies to:
- `getEnvironment()` and `getEnvironment.filled()`
- `getEnvironment.static()`
- any public SDK entry point in `src/contract/`

## .exception

this overrides `rule.forbid.undefined-inputs` which applies to internal contracts.

public SDK boundaries prioritize ergonomics over strictness because:
- consumers are external, not team members
- friction at SDK boundary compounds across all consumers
- default behavior is the common case

## .examples

### good — optional for public SDK

```ts
export const getEnvironment = (
  input?: {
    parsers?: { ... } | null;
    cache?: 'skip' | null;
  } | null,
): Promise<Environment> => { ... };
```

### bad — required for public SDK

```ts
export const getEnvironment = (
  input: {
    parsers: { ... } | null;
    cache: 'skip' | null;
  },
): Promise<Environment> => { ... };
```

## .note

internal contracts (inside `domain.operations/`, `access/`) still follow `rule.forbid.undefined-inputs` for strictness.

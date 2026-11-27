# fulcrum F02: pin npm, not bump `.nvmrc` past `22.22.2`

## .the fork

- a) pin the upgrade to `npm@11`
- b) bump `.nvmrc` to `>= 22.22.2` (or node 24, which ships npm 11 natively), keep `npm@latest`

## .taken, why

a). b) moves the runtime for every job — install cache key, unit, integration, acceptance — to cure one publish step, and keeps `npm@latest` unpinned, so the next npm major whose engine outruns the node breaks the publish again. a) touches one line and matches upstream.

## .rework

clean — b) is a one-line `.nvmrc` edit if preferred later.

## .confidence

95%. listed because the alternative is the one a reader reaches for first.

## .where

`.github/workflows/.publish-npm.yml` vs `.nvmrc`.

## .verdict

open.

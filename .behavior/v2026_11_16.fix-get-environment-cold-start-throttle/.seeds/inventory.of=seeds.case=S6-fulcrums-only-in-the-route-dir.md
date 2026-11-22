# S6 — fulcrums only in the route dir

## .said
why is there a fulcrums dir outside of the route dir? that should be forbidden and dispatch upstream to fix that. behaver should know where fulcrums are allowed

## .settled
fulcrums live at `$route/.fulcrums/` only; a dir elsewhere is forbidden, and the behaver is taught so upstream.

## .landed
- `.fulcrums/` moved to `$route/.fulcrums/`; reseed dream `v2026_11_22.reseed.fulcrums-live-only-in-a-route-dir`

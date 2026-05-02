## Summary

- <!-- 1-3 bullets on why this change exists -->

## Migration Safety Checklist

- [ ] I ran `npm run check:migration` locally and it passed.
- [ ] All Ten storage/streak behavior was verified unchanged (or expected and documented).
- [ ] No cross-runtime React imports were introduced between `src/allten/runtime` and suite source.
- [ ] I centralized behavior/contracts only; game-specific copy/content remains local.

## All Ten runtime (`src/allten/runtime/`)

If this PR touches the Webpack/TypeScript subpackage, also run from repo root:

- `npm --prefix src/allten/runtime run lint`
- `npm --prefix src/allten/runtime run pretty-check`
- `npm --prefix src/allten/runtime run ts-check`
- `npm --prefix src/allten/runtime run test`

GitHub Actions only loads workflows from the repository root `.github/workflows/` (not under `src/allten/runtime/.github`).

## Test Plan

- [ ] Manual smoke test completed for affected puzzle(s).
- [ ] If UI changed, I verified header/help/links/stats behavior for impacted games.

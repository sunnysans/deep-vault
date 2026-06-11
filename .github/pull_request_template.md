## Summary

<!-- What does this PR do and why? -->

## Type of change

- [ ] `feat` — new feature
- [ ] `fix` — bug fix
- [ ] `docs` — documentation only
- [ ] `refactor` — code restructuring, no behaviour change
- [ ] `test` — test additions or changes
- [ ] `chore` — build, CI, or tooling changes

## Release Gate

> Complete all items before merging to `main`. Feature → `dev` merges require only the first two.

**Every merge to dev**
- [ ] `npm run build` passes with zero errors
- [ ] `npm run test` passes with zero failures

**Before merging dev → main (release)**
- [ ] No `console.log` or `eval()` in `src/`
- [ ] `manifest.json` and `package.json` versions match
- [ ] `manifest.json` version updated for this release
- [ ] Regression matrix TC-01 → TC-09 signed off in `TESTING.md`
- [ ] Tested on Windows
- [ ] Tested on Linux
- [ ] Tested on Obsidian Mobile
- [ ] Tested with empty vault and no API key

## Screenshots / Notes

<!-- Add screenshots for UI changes. Add notes for non-obvious decisions. -->

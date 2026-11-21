## Setup

- Execute `bun install` from the root folder

## Run

`bun test` runs the unit tests of `src` (`test/unit/three.source.test.js`) and of the addons (`test/unit/three.addons.test.js`) with the Bun test runner and happy-dom. Run one file with `bun test test/unit/three.source.test.js` and filter by name with `--test-name-pattern`.

The suites are written with the QUnit API (`QUnit.module`, `QUnit.test`, `assert.*`). `test/unit/qunit-bun.ts` is preloaded by `bunfig.toml` and maps that API onto `bun:test`, serves the repository root so loaders can fetch relative URLs, and resolves `three`, `three/webgpu` and `three/tsl` to `/src`.

## Notes

Tests that need real image decoding or GPU access cannot run in Bun: GPU suites are skipped when `navigator.gpu` is missing, and the tests listed in `browserOnly` in `qunit-bun.ts` are skipped.

## Troubleshooting

When adding or updating tests, the most common cause of test failure is forgetting to change `QUnit.todo` to `QUnit.test` when the test is ready.

An error that indicates "no tests were found" means that an import statement could not be resolved. This is usually caused by a typo in the import path.

## Debugging

Add `debugger;` to the test code and run `bun --inspect-wait test test/unit/three.source.test.js`, or filter with `--test-name-pattern`.

# Test Suite

Vitest tests live here instead of being colocated with production code.

- `tests/src/...` mirrors `src/...`.
- `tests/supabase/...` mirrors `supabase/...`.
- `tests/setup.js` is the global Vitest setup file.
- `tests/helpers/` holds shared test-only helpers.

Keep tests that protect behavior or regressions:

- pure logic edge cases and malformed input handling
- database/query wrappers with meaningful Supabase call assertions
- user flows that verify rendered state changes or callback payloads
- failure paths that should not throw or should preserve user data

Avoid adding tests that only prove a component mounts, only check implementation
classes, or assert transient loading states without a stable user-visible outcome.

Known coverage gaps after the cleanup:

- large shell views such as `ArchiveView`, `CareerView`, `SettingsView`,
  `MigrationView`, and `TidyView` still have little or no direct coverage
- several async UI tests still rely on mocked Supabase chains rather than
  integration-style fixtures
- edge function entrypoints outside `_shared` are mostly untested

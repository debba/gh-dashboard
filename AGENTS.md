# Agent Rules

- Keep all code identifiers, comments, filenames, and documentation in English.
- Preserve the current visual layout unless a task explicitly asks for UI changes.
- Prefer React components for rendering and keep component files focused on one responsibility.
- Put pure business logic in `src/utils` and cover it with unit tests under the mirrored `tests/utils` path.
- Keep tests outside `src`; the `tests` folder must sit at the repository root and mirror the relevant `src` structure.
- Do not mix unrelated refactors with feature work.
- Use TypeScript for new source files unless an existing JavaScript integration requires otherwise.
- Keep GitHub API and `gh` CLI access behind server-side endpoints; do not expose tokens to the browser.
- Run `npm test` and `npm run build` after behavior changes when dependencies are available.

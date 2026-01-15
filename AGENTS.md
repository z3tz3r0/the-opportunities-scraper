# Repository Guidelines

## Project Structure & Module Organization
- `src/index.js` is the entry point that orchestrates the scrape run.
- `src/scraper.js` handles Facebook scraping via Playwright + a CDP endpoint.
- `src/sheets.js` contains Google Sheets API integration and persistence logic.
- `src/config.js` centralizes environment variables, scraping limits, and helpers.
- `package.json` defines dependencies and scripts; `pnpm-lock.yaml` pins versions.

## Build, Test, and Development Commands
- `pnpm install` installs dependencies.
- `node src/index.js` runs the scraper locally (requires env vars and a CDP endpoint).
- `pnpm test` currently exits with “no test specified” and is a placeholder.

## Configuration & Secrets
- Required env vars: `FB_EMAIL`, `FB_PASSWORD`, `SPREADSHEET_ID`, `GOOGLE_CREDENTIALS`.
- `GOOGLE_CREDENTIALS` is expected to be a base64-encoded service account JSON.
- Optional: `CDP_ENDPOINT` (defaults to `ws://localhost:9222`).
- Keep credentials out of git; provide them via shell/env in CI or local tooling.

## Coding Style & Naming Conventions
- Use ES modules (`import`/`export`) and 2-space indentation.
- Prefer `camelCase` for variables/functions, `PascalCase` for classes, and UPPER_SNAKE_CASE for constants.
- Keep selectors, limits, and timeouts in `src/config.js` rather than inlined literals.

## Testing Guidelines
- No test framework is configured yet. If you add tests, standardize on `*.test.js` or `*.spec.js` naming and place them under a `tests/` directory or alongside modules.
- Update `pnpm test` to run the chosen test runner once tests exist.

## Commit & Pull Request Guidelines
- Follow Conventional Commits as seen in history: `feat(scope): ...`, `chore(scope): ...`.
- Pull requests should include a short summary, manual run notes (what sources were used), and any Google Sheets schema changes.
- If scraping behavior changes, include before/after samples or logs.

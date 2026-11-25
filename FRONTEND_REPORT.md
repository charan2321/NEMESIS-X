# NEMESIS-X Frontend Report

## Summary

The frontend is a tested local demonstration, not a production-ready,
backend-connected video intelligence dashboard. The most important local
flows now pass: demo auth and route return, registration validation, upload
checks/progress/cancel/completion simulation, six-stage sample processing,
event drawer, seek, search, exports, history deletion, keyboard help, and
responsive overflow checks. A standalone mock API and synthetic five-second
video fixture are provided for future integration.

Final verification: 6 Vitest tests, 5 mock API tests, and 6 Playwright/axe
scenarios pass. ESLint, TypeScript, production build, and dependency audit
pass; audit reports zero vulnerabilities. Browser checks cover the
search-result-to-drawer Escape regression, single job identity through
processing, and playback cleanup after leaving results. The production bundle
is 196.57 kB JavaScript (60.19 kB gzip) and 45.92 kB CSS (10.68 kB gzip).
Production-preview median FCP is 136 ms and measured search-modal DOM response
is 25.5 ms. No browser console
errors or failed requests occurred on the routes exercised.

## Fixes made

| File | Problem | Fix |
|---|---|---|
| `src/App.tsx` | A delayed processing completion redirect could navigate away after the user opened an event drawer | Retain and clear the pending redirect timer during route-effect cleanup |
| `src/App.tsx` | A detached search input could be mistaken for an active editable target and block Escape from closing the event drawer | Ignore disconnected keyboard event targets in the typing guard |
| `src/App.tsx` | React Strict Mode could replay side effects inside upload/stage state updaters, producing duplicate job IDs and redirects | Keep state updaters pure; move completion actions into guarded effects and persist job state separately |
| `src/App.tsx` | Playback timer continued updating after navigating away from results | Stop playback on non-player routes and scope interval cleanup to player routes |
| `src/styles.css` | Search and no-result text missed WCAG AA contrast in axe checks | Add a higher-contrast modal text token and apply it to low-contrast labels |
| `src/styles.css` | Remote Google Fonts import delayed first contentful paint and required a third-party request | Remove the remote import; prefer Inter/Geist and JetBrains Mono with system fallbacks |
| `vite.config.ts` | Vitest discovered Playwright specs and Node mock tests as browser unit tests | Restrict Vitest discovery to `src/**/*.test.{ts,tsx}` |
| `eslint.config.js` | New Node mock scripts were linted without Node globals | Add Node globals for scripts and the Node `fetch` global |
| `e2e/frontend.spec.ts` | Important validation, empty/no-result, responsive, feedback, deep-link, and timer lifecycle paths lacked coverage | Expand Chromium/axe scenarios; assert stable job identity and playback cleanup; generate additional 1440 px state screenshots |
| `scripts/mock-api.mjs` | No API fixture server existed for the PRD contract | Add a local-only, in-memory fixture server and demo media endpoints |
| `scripts/mock-api.test.mjs` | Mock API behavior had no contract checks | Add five Node test cases covering fixture routes and media |
| `public/mock-media/sample.webm` | No sample media fixture existed | Add a five-second synthetic scene video; it contains no real footage |
| `package.json` | No mock API scripts existed | Add `mock:api` and `test:mock-api` commands |

## Remaining issues, ranked

1. **Critical — no production API/session integration.** The app has no API
   client; auth is a local demo account and localStorage boolean. Upload,
   processing, results, history, search, feedback, and exports are not
   backend-backed. Integrate the API contract and secure sessions before
   production.
2. **High — no real video intelligence player.** The results “player” is a
   synthetic CSS scene, not a video element with canvas overlays. Timeline
   data, overlays, event details, and thumbnails are demo/static. Implement
   synchronized playback and validate real media at 30 fps.
3. **High — incomplete processing/error states.** No server polling, restored
   progress, failed-job retry, API-down retry/cache, skeleton, or
   no-anomalies state is wired. The mock API has failed and processing
   fixtures, but the UI does not use them.
4. **High — unverified scale behavior.** Event lists are not virtualized.
   500-event smoothness, five-minute media, lazy thumbnails, and 20-route
   memory-leak checks were not run and are not supported by the current
   synthetic implementation.
5. **Medium — design-system divergence.** CSS inventory still reports 242 hex
   colors, 115 rgb/rgba values, 18 font sizes, and 229 spacing/layout values.
   The requested full token migration, three text sizes, single accent,
   consistent radii/icon strokes, and removal of pure black/white values
   remain incomplete.
6. **Medium — incomplete interaction details.** Timeline drag/hover tooltip,
   keyboard Up/Down/J/L/Space against a real player, focus-trap sequence,
   history re-run, and full deep-link/backend integration need follow-up.
7. **Low — export semantics.** JSON is a client-side download; PDF opens the
   browser print dialog rather than returning a generated report.

## Commands

Run from the frontend root:

```powershell
npm ci
npm run dev
npm run mock:api
npm test
npm run test:mock-api
npm run test:e2e
npm run lint
npx tsc --noEmit
npm run build
npm audit
```

The mock server listens on `http://127.0.0.1:8081`. The frontend does not
consume it yet; API contract tests run independently. Playwright starts the
frontend on port 4179.

See [FRONTEND_AUDIT.md](./FRONTEND_AUDIT.md) for phase-by-phase evidence,
feature statuses, test boundaries, screenshot inventory, and performance and
security details.

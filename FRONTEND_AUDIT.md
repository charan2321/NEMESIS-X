# NEMESIS-X Frontend Audit

## Scope and implementation profile

The workspace is a React 18 + TypeScript + Vite frontend. Routing is a small
`history.pushState`/`popstate` implementation in `src/App.tsx`; state uses React
hooks; styling is a single CSS file; there is no production API client, router
package, or external state library. The visible application is a local demo,
not a backend-connected dashboard.

```text
frontend-
|-- e2e/
|-- public/mock-media/sample.webm
|-- screenshots/
|-- scripts/mock-api.mjs
|-- scripts/mock-api.test.mjs
|-- src/
|   |-- test/setup.ts
|   |-- App.test.tsx
|   |-- App.tsx
|   |-- main.tsx
|   `-- styles.css
|-- eslint.config.js
|-- package.json
|-- playwright.config.ts
|-- vite.config.ts
`-- tsconfig.json
```

### Phase 1 — project health

Commands were run in the frontend root. The clean `npm ci` install completed
successfully. Final verification output:

```text
npx.cmd tsc --noEmit
exit code 0; no diagnostics

npm.cmd run lint
exit code 0; no warnings

npm.cmd run build
vite v6.4.6 building for production...
✓ 1577 modules transformed.
dist/index.html                   0.57 kB │ gzip:  0.34 kB
dist/assets/index-uR4cr90W.css   45.92 kB │ gzip:  10.68 kB
dist/assets/index-Diw3jWuv.js   196.57 kB │ gzip:  60.19 kB
✓ built in 13.10s

npm.cmd audit --audit-level=low
found 0 vulnerabilities
```

The Vite dev server started successfully on port 5175 during the health check.
Production-preview browser checks visited `/login`, `/`, `/jobs`,
`/jobs/NX-2408`, `/jobs/NX-2408/results`, the event deep link, search, and
`/register`; the command reported `console_errors: []` and
`failed_requests: []`. The dev preview used local demo data.

## Phase 1 — PRD section 7 feature matrix

“Partial” means the UI behavior exists in the local demo but is not a complete
backend-backed implementation.

| Feature | Route/component | Status | Evidence | Fix needed |
|---|---|---|---|---|
| Login | `/login`, auth form | Partial | Playwright wrong-password, success, protected return, refresh, and logout flow passes | Replace demo account map and localStorage boolean with real auth/session handling |
| Register | `/register`, auth form | Partial | E2E covers empty name, invalid email, weak password, duplicate email, and success | Persist accounts through the auth API |
| Upload | `/`, upload zone | Partial | E2E covers invalid extension, oversize rejection, progress/cancel, valid completion, and verifies one job ID from processing through results | Send multipart upload to the API; drag-and-drop gesture itself is not E2E-tested |
| Processing view | `/jobs/:jobId` | Partial | Six stage labels render; sample flow reaches results without duplicate job routes | Implement 2-second API polling, restored server progress, failure reason, and retry |
| Results — player | `/jobs/:jobId/results` | Partial | Synthetic scene, controls, and seek UI render; playback timer stops when navigating away | Replace the CSS illustration/timer with a real video player and synchronized media |
| Results — overlays | Results player | Partial | Boxes/Trails/Heat/Graph toggles render and respond | Implement the canvas overlays and synchronize them on play, seek, resize, and fullscreen |
| Results — timeline | Anomaly timeline | Partial | Static SVG chart and event bands render; seek controls work | Use API data; implement drag seeking and hover time/score tooltip |
| Results — event cards | Event list | Partial | Threat chips, filtering, sorting, selection, and seek are present | Reconcile displayed event totals; add virtualization and 500-event coverage |
| Event drawer | `/jobs/:jobId/events/:eventId` | Partial | Card and direct deep links open it; evidence timestamps seek; JSON, clipboard, and feedback confirmations tested | Use real keyframes/API feedback; PDF currently invokes browser print |
| Search | Cmd/Ctrl+K command bar | Partial | Local query, result selection, empty/no-result screens, and input-safe `?` tested | Connect natural-language search API and real thumbnails; result list is not server-driven |
| History | `/jobs` | Partial | Filename/date/status/event/threat rows, open, confirmed delete, persistence, and empty state tested | Add re-run action and API-backed job operations |
| Export | Drawer JSON/PDF actions | Partial | JSON download is verified by Playwright | PDF is a print dialog, not a generated PDF/export endpoint |
| Shortcuts | Global keyboard handler/help | Partial | `?`, Cmd/Ctrl+K, Escape (including after selecting a search result), and typing guard have E2E coverage | Verify all J/L, Space, Up/Down semantics against a real player; add focus-navigation assertions |
| Loading, empty, error, offline, no-anomalies states | Forms, upload, search, history, processing | Partial | Form/upload errors, upload progress, empty history, and no-result search are present and screens captured | Add skeletons, API error/offline retry, failed-job/retry, and no-anomalies UI |

## Phase 2 — functional review

| Area | Result | Evidence and boundary |
|---|---|---|
| Registration | Pass in demo | E2E verifies missing name, malformed email, weak password, duplicate seeded account, and successful registration; accounts live only in memory |
| Login/session | Pass in demo | Wrong-password message is calm; protected return, refresh, and logout pass; no auth token is placed in the URL |
| 401 handling | Not implemented | The UI has no API client, so API 401 logout/redirect cannot be exercised |
| Upload validation | Pass in demo | Invalid extension and an overridden `File.size` above 500 MB are rejected before the simulated upload; oversize test avoids allocating a huge buffer |
| Upload actions | Partial | Picker, cancel, progress, sample chip, and simulated valid-file navigation pass; upload regression asserts one job ID through results; no bytes are transmitted to a backend; drag/drop handler exists but was not gesture-tested |
| Processing | Partial | Sample flow displays all six stages and reaches results; stage timers are bounded and cleaned up; status is timer-driven, not polled; failure/retry and refresh restoration are absent |
| Player and overlays | Not verified against media | Current screen is an illustration and timer, not a video element or synchronized canvas; E2E verifies playback stops after navigating away |
| Timeline/cards | Partial | Timeline click math, event timestamp click-to-seek, card selection/filter/sort, and J/L/Space/Up/Down on the simulated clock pass; drag/hover and long-list virtualization are absent |
| Drawer | Pass for local UI; partial overall | Card/deep-link open, timestamp seek, JSON download, copy-link confirmation, feedback confirmation, Escape, and cautious wording are exercised; persistence/API and actual PDF are absent |
| Search | Pass for local UI; partial overall | Cmd/Ctrl+K flow, query/no-results, selection/deep link, and typing guard are covered; search is in-memory string matching |
| History | Partial | Open, confirm-delete, persistence after refresh, and empty state pass; re-run action is missing |
| API-down/failed job | Not implemented in app | The mock server has fixtures for both, but the UI does not consume them or render a retry/error screen |

Browser-run coverage: six Playwright scenarios pass (`6 passed (1.2m)` in the
final full run). Axe checks cover login,
overview/upload, processing, results, drawer, search and no-result search,
history, and empty history. These are smoke checks, not a claim that every
interactive element or route has a complete accessibility audit.

## Phase 3 — UI/UX and design-system review

- Responsive overflow assertions pass for auth and protected main routes at
  1920, 1440, 1280, 1024, 768, and 390 px.
- Axe reports no violations in the exercised states after improving contrast
  in search and no-result UI. Focus trap behavior is implemented but has not
  been independently keyboard-sequence tested. Keyframe visuals are CSS
  illustrations rather than `<img>` elements with alt text.
- Reduced-motion CSS is present. Motion durations are not consistently within
  the requested 200–300 ms range.
- The remote Google Fonts import was removed to prevent render-blocking network
  access. The stack now prefers Inter/Geist and JetBrains Mono with local system
  fallbacks. Exact font availability depends on the client machine.
- A literal stylesheet inventory still finds **242 unique hex colors, 115
  unique rgb/rgba colors, 18 font-size values, and 229 distinct
  spacing/layout values**. Apart from the existing partial tokens and the
  search contrast correction, these literals have not been comprehensively
  migrated. This does not meet the PRD’s full tokenization or three-text-size
  rules; a wholesale token remap would be a visual redesign and needs a
  separate, reviewable design-system pass.
- Pure white/black values, mixed accent hues, and several small text sizes
  remain in CSS; the visual rules are therefore only partially met.
- 1440 px captures are in `screenshots/`: login, login error, register,
  register validation, overview, upload home, invalid upload, oversize upload,
  processing, results, event drawer, search, no-result search, history,
  delete confirmation, and empty history. Failed-job, API-offline, skeleton,
  and no-anomalies screenshots are unavailable because those UI states do not
  exist.

## Phase 4 — automated tests and mock API

The frontend had no API client to integrate with a running backend. A separate
Node mock server is available with `npm run mock:api` on port 8081. It serves
the PRD endpoint paths, a seeded demo user, a finished job with six events at
three threat levels, timeline series, SVG keyframes, a five-second synthetic
WebM, plus failed and processing jobs. Upload status and fixtures are
in-memory; this server is not wired into the application.

Final command results:

```text
npm.cmd test
Test Files  1 passed (1)
Tests       6 passed (6)

npm.cmd run test:mock-api
tests 5
pass 5
fail 0

npm.cmd run test:e2e
Running 6 tests using 1 worker
6 passed (1.2m)
```

Vitest covers auth form, upload, keyboard, and local UI behaviors. Mock API
tests cover auth, protected routes, jobs/statuses, six-event results, timeline,
event detail, search, JSON/PDF response types, feedback, multipart upload,
keyframe, and sample video. Playwright covers auth, upload, sample processing,
results/drawer/seek/search/export, responsive widths, history, and axe smoke
checks. API tests validate the mock server itself and do not imply API-client
integration.

## Phase 5 — performance and security

Production-preview measurements after removing the remote font import:

```text
FCP samples: 148 ms, 136 ms, 136 ms
Median FCP: 136 ms (target < 2000 ms: pass)
Control+K-to-modal DOM latency: 25.5 ms (target < 100 ms: pass)
Browser console errors: []
Failed requests: []
```

The prior preview measured FCP at 3288 ms before the remote font import was
removed; the post-change numbers are the final measurement. Bundle output is
one 196.57 kB JS chunk (60.19 kB gzip), 45.92 kB CSS (10.68 kB gzip), and
0.57 kB HTML. Heavy parts are not code-split.

Not measured: sustained 30 fps on a five-minute clip, 500-event list
performance, thumbnail lazy-loading, or memory stability over 20 route
navigations. The frontend does not contain a real video player, virtualized
list, or image-backed thumbnails to measure those requirements against.

Security findings:

- The demo stores only `nemesis-auth=true` in localStorage, not a token. This
  still is not a secure session and must be replaced with an in-memory token
  or httpOnly-cookie backend integration before production.
- The mock server's `nemesis-mock-token` is a public test fixture, not a
  production credential. The demo account/password are also intentionally
  sample data.
- No `dangerouslySetInnerHTML` use was found in application or mock-server
  source. Server-like strings and filenames are rendered as React text.
- No API key or production secret was found in application source. No
  environment-based API client is configured.
- The mock server returns 401 for missing auth, but the frontend does not
  handle API 401s because it does not call the server.

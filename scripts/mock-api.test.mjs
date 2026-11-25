import assert from "node:assert/strict";
import { once } from "node:events";
import { after, before, test } from "node:test";
import { createMockServer } from "./mock-api.mjs";

const server = createMockServer();
let baseUrl;
const headers = { Authorization: "Bearer nemesis-mock-token" };

before(async () => {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));

test("auth endpoints return a token and protect authenticated routes", async () => {
  const unauthenticated = await fetch(`${baseUrl}/jobs`);
  assert.equal(unauthenticated.status, 401);
  const login = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "operator@example.test", password: "DemoPass123!" }),
  });
  assert.equal(login.status, 200);
  assert.equal((await login.json()).token, "nemesis-mock-token");
});

test("job list includes finished, failed, and processing fixtures", async () => {
  const response = await fetch(`${baseUrl}/jobs`, { headers });
  assert.equal(response.status, 200);
  const { jobs } = await response.json();
  assert.deepEqual(jobs.map(({ status }) => status).sort(), ["done", "failed", "processing"]);
});

test("results contract includes six events, timeline, detail, search, exports, and feedback", async () => {
  const resultsResponse = await fetch(`${baseUrl}/jobs/NX-2408/results`, { headers });
  const results = await resultsResponse.json();
  assert.equal(results.events.length, 6);
  assert.deepEqual(new Set(results.events.map(({ threat }) => threat)), new Set(["high", "medium", "low"]));

  const timeline = await fetch(`${baseUrl}/jobs/NX-2408/timeline`, { headers }).then((response) => response.json());
  assert.ok(timeline.series.length > 0);

  const detail = await fetch(`${baseUrl}/jobs/NX-2408/events/EV-2048`, { headers }).then((response) => response.json());
  assert.ok(detail.what_happened);
  assert.ok(detail.keyframes[0].url.startsWith("/media/"));

  const search = await fetch(`${baseUrl}/jobs/NX-2408/search`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ query: "unattended object" }),
  }).then((response) => response.json());
  assert.equal(search.results[0].id, "EV-2047");

  const exportResponse = await fetch(`${baseUrl}/jobs/NX-2408/export?format=json`, { headers });
  assert.match(exportResponse.headers.get("content-disposition"), /attachment/);

  const feedbackResponse = await fetch(`${baseUrl}/jobs/NX-2408/events/EV-2048/feedback`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ feedback: "not_interesting" }),
  });
  assert.equal(feedbackResponse.status, 200);
});

test("multipart uploads create a processing job", async () => {
  const response = await fetch(`${baseUrl}/videos`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "multipart/form-data; boundary=fixture" },
    body: "--fixture\r\nContent-Disposition: form-data; name=\"file\"; filename=\"clip.mp4\"\r\nContent-Type: video/mp4\r\n\r\nfixture\r\n--fixture--\r\n",
  });
  assert.equal(response.status, 202);
  const { job_id: jobId } = await response.json();
  const status = await fetch(`${baseUrl}/jobs/${jobId}`, { headers }).then((result) => result.json());
  assert.equal(status.status, "processing");
});

test("session, failure states, PDF, keyframes, and sample video are served", async () => {
  const user = await fetch(`${baseUrl}/auth/me`, { headers }).then((response) => response.json());
  assert.equal(user.email, "operator@example.test");

  const failed = await fetch(`${baseUrl}/jobs/NX-FAILED`, { headers }).then((response) => response.json());
  assert.equal(failed.status, "failed");
  assert.equal((await fetch(`${baseUrl}/jobs/NX-FAILED/results`, { headers })).status, 409);

  const processing = await fetch(`${baseUrl}/jobs/NX-PROCESSING`, { headers }).then((response) => response.json());
  assert.equal(processing.status, "processing");

  const pdf = await fetch(`${baseUrl}/jobs/NX-2408/export?format=pdf`, { headers });
  assert.equal(pdf.headers.get("content-type"), "application/pdf");
  const pdfContents = await pdf.text();
  assert.match(pdfContents, /^%PDF-1\.4/);
  assert.match(pdfContents, /startxref\n\d+\n%%EOF/);

  const keyframe = await fetch(`${baseUrl}/media/keyframe-1.svg`, { headers });
  assert.match(keyframe.headers.get("content-type"), /image\/svg\+xml/);

  const video = await fetch(`${baseUrl}/media/sample-video.webm`, { headers });
  assert.equal(video.headers.get("content-type"), "video/webm");
  assert.ok((await video.arrayBuffer()).byteLength > 0);

  const logout = await fetch(`${baseUrl}/auth/logout`, { method: "POST", headers });
  assert.equal(logout.status, 200);
});

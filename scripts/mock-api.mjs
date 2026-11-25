import { createReadStream, existsSync } from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));
const videoPath = path.join(root, "..", "public", "mock-media", "sample.webm");
const token = "nemesis-mock-token";
const stages = ["Sampling", "Tracking", "Memory", "Interactions", "Anomaly", "Reasoning"];

const events = [
  { id: "EV-2048", title: "Movement against flow", threat: "high", confidence: 0.94, score: 94, start: 18, end: 24, summary: "A person moves against the dominant direction of pedestrian traffic.", track_ids: ["TRK-082"], keyframes: ["keyframe-1.svg"], score_breakdown: { motion: 91, context: 96, duration: 88 }, validator: "review-recommended" },
  { id: "EV-2047", title: "Unattended object", threat: "medium", confidence: 0.81, score: 78, start: 42, end: 51, summary: "An object remains stationary after its carrier leaves the area.", track_ids: ["TRK-116"], keyframes: ["keyframe-2.svg"], score_breakdown: { motion: 75, context: 83, duration: 79 }, validator: "review-recommended" },
  { id: "EV-2046", title: "Rapid direction change", threat: "medium", confidence: 0.69, score: 64, start: 66, end: 70, summary: "A subject changes direction abruptly near the platform edge.", track_ids: ["TRK-039"], keyframes: ["keyframe-3.svg"], score_breakdown: { motion: 64, context: 71, duration: 58 }, validator: "needs-context" },
  { id: "EV-2045", title: "Restricted area entry", threat: "low", confidence: 0.51, score: 42, start: 94, end: 101, summary: "A subject briefly enters a low-traffic perimeter zone.", track_ids: ["TRK-211"], keyframes: ["keyframe-4.svg"], score_breakdown: { motion: 39, context: 47, duration: 41 }, validator: "needs-context" },
  { id: "EV-2044", title: "Brief crowding", threat: "low", confidence: 0.43, score: 35, start: 118, end: 126, summary: "Several tracks briefly converge near the east entrance.", track_ids: ["TRK-014", "TRK-019"], keyframes: ["keyframe-5.svg"], score_breakdown: { motion: 36, context: 34, duration: 35 }, validator: "low-confidence" },
  { id: "EV-2043", title: "Unusual dwell time", threat: "low", confidence: 0.32, score: 24, start: 148, end: 156, summary: "A track remains in the area longer than the local baseline.", track_ids: ["TRK-103"], keyframes: ["keyframe-6.svg"], score_breakdown: { motion: 22, context: 29, duration: 21 }, validator: "low-confidence" },
];

const jobs = new Map([
  ["NX-2408", { id: "NX-2408", filename: "station_west_cam_04.mp4", status: "done", duration: 204, event_count: events.length, top_threat: "high", progress: 100 }],
  ["NX-FAILED", { id: "NX-FAILED", filename: "loading_bay_failed.mp4", status: "failed", error: "The video could not be decoded. Try uploading an MP4 or MOV file.", progress: 42 }],
  ["NX-PROCESSING", { id: "NX-PROCESSING", filename: "concourse_processing.mp4", status: "processing", current_stage: "Interactions", progress: 58, estimated_seconds: 24 }],
]);
const users = new Map([["operator@example.test", { name: "Alex Lane", email: "operator@example.test", password: "DemoPass123!" }]]);
const registrations = new Map();
const feedback = [];
let nextUpload = 1;

function json(response, status, value) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(value));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1024 * 1024) throw Object.assign(new Error("Request body is too large"), { status: 413 });
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw Object.assign(new Error("Request body must be valid JSON"), { status: 400 });
  }
}

function eventDetail(event) {
  return {
    ...event,
    what_happened: event.summary,
    why_unusual_here: "This pattern differs from the observed movement baseline for this area and time window.",
    keyframes: event.keyframes.map((asset_id, index) => ({ asset_id, timestamp: event.start + index, url: `/media/${asset_id}` })),
    score_breakdown: Object.entries(event.score_breakdown).map(([label, score]) => ({ label, score })),
  };
}

function createPdfFixture() {
  const content = "BT /F1 16 Tf 72 720 Td (NEMESIS-X local mock export) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n% NEMESIS-X mock fixture\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf, "ascii"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, "ascii");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return pdf;
}

export function createMockServer() {
  return createServer(async (request, response) => {
    const origin = request.headers.origin;
    if (origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      response.setHeader("Access-Control-Allow-Origin", origin);
      response.setHeader("Vary", "Origin");
    }
    response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    const url = new URL(request.url || "/", "http://127.0.0.1");
    const { pathname } = url;
    const method = request.method || "GET";

    try {
      if (method === "POST" && pathname === "/auth/register") {
        const body = await readJson(request);
        const email = String(body.email || "").toLowerCase();
        if (users.has(email) || registrations.has(email)) return json(response, 409, { message: "An account with this email already exists." });
        if (!email || !body.name || !body.password) return json(response, 422, { message: "Name, email, and password are required." });
        registrations.set(email, { name: String(body.name), email, password: String(body.password) });
        return json(response, 201, { user: { name: body.name, email }, token });
      }

      if (method === "POST" && pathname === "/auth/login") {
        const body = await readJson(request);
        const email = String(body.email || "").toLowerCase();
        const user = users.get(email) || registrations.get(email);
        if (!user || user.password !== body.password) return json(response, 401, { message: "Email or password does not match our records." });
        return json(response, 200, { user: { name: user.name, email: user.email }, token });
      }

      const authenticated = request.headers.authorization === `Bearer ${token}`;
      if (!authenticated) return json(response, 401, { message: "Authentication required." });

      if (method === "GET" && pathname === "/auth/me") {
        return json(response, 200, { name: "Alex Lane", email: "operator@example.test" });
      }
      if (method === "POST" && pathname === "/auth/logout") {
        return json(response, 200, { ok: true });
      }
      if (method === "GET" && pathname === "/jobs") {
        return json(response, 200, { jobs: Array.from(jobs.values()) });
      }
      if (method === "POST" && pathname === "/videos") {
        if (!String(request.headers["content-type"] || "").startsWith("multipart/form-data;")) {
          return json(response, 415, { message: "Upload must use multipart/form-data." });
        }
        for await (const chunk of request) {
          // Consume the upload stream; fixture processing is simulated by the job status endpoint.
          void chunk;
        }
        const id = `NX-UPLOAD-${nextUpload++}`;
        jobs.set(id, { id, filename: "uploaded-video.mp4", status: "processing", current_stage: stages[0], progress: 8, estimated_seconds: 30 });
        return json(response, 202, { job_id: id });
      }

      const jobMatch = pathname.match(/^\/jobs\/([^/]+)(?:\/(.*))?$/);
      if (jobMatch) {
        const jobId = decodeURIComponent(jobMatch[1]);
        const subpath = jobMatch[2] || "";
        const job = jobs.get(jobId);
        if (!job) return json(response, 404, { message: "Analysis not found." });

        if (!subpath && method === "GET") return json(response, 200, job);
        if (subpath === "results" && method === "GET") {
          if (job.status !== "done") return json(response, 409, { message: "Results are not ready." });
          return json(response, 200, { job, events, media: { video: "/media/sample-video.webm" } });
        }
        if (subpath === "timeline" && method === "GET") {
          return json(response, 200, { duration: job.duration || 204, series: Array.from({ length: 41 }, (_, index) => ({ time: index * 5, score: (index * 17 + 23) % 100 })), events: events.map(({ id, start, end, threat }) => ({ id, start, end, threat })) });
        }
        if (subpath === "search" && method === "POST") {
          const body = await readJson(request);
          const query = String(body.query || "").trim().toLowerCase();
          const matches = events.filter((event) => `${event.title} ${event.summary}`.toLowerCase().includes(query));
          return json(response, 200, { results: matches.map((event) => ({ ...event, thumbnail: `/media/${event.keyframes[0]}` })) });
        }
        if (subpath === "export" && method === "GET") {
          if (url.searchParams.get("format") === "json") {
            response.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="${jobId}-results.json"` });
            response.end(JSON.stringify({ job, events }));
            return;
          }
          if (url.searchParams.get("format") === "pdf") {
            response.writeHead(200, { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${jobId}-results.pdf"` });
            response.end(createPdfFixture());
            return;
          }
          return json(response, 400, { message: "format must be json or pdf." });
        }
        const eventMatch = subpath.match(/^events\/([^/]+)(?:\/feedback)?$/);
        if (eventMatch) {
          const eventId = decodeURIComponent(eventMatch[1]);
          const event = events.find((item) => item.id === eventId);
          if (!event) return json(response, 404, { message: "Event not found." });
          if (subpath.endsWith("/feedback") && method === "POST") {
            const body = await readJson(request);
            feedback.push({ job_id: jobId, event_id: eventId, feedback: body.feedback || body.value || "not_interesting" });
            return json(response, 200, { ok: true });
          }
          if (subpath === `events/${eventId}` && method === "GET") return json(response, 200, eventDetail(event));
        }
      }

      if (method === "GET" && pathname.startsWith("/media/")) {
        const asset = decodeURIComponent(pathname.slice("/media/".length));
        if (asset === "sample-video.webm") {
          if (!existsSync(videoPath)) return json(response, 503, { message: "Sample video fixture has not been generated." });
          response.writeHead(200, { "Content-Type": "video/webm", "Cache-Control": "public, max-age=3600" });
          createReadStream(videoPath).pipe(response);
          return;
        }
        if (/^keyframe-\d+\.svg$/.test(asset)) {
          response.writeHead(200, { "Content-Type": "image/svg+xml; charset=utf-8" });
          response.end('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><rect width="320" height="180" fill="#222b36"/><path d="M0 130h320M55 0v180m110-180v180m100-180v180" stroke="#576575"/><rect x="134" y="46" width="44" height="108" fill="none" stroke="#70d7cf" stroke-width="3"/><circle cx="156" cy="68" r="13" fill="#70d7cf"/></svg>');
          return;
        }
      }

      return json(response, 404, { message: "Endpoint not found." });
    } catch (error) {
      if (response.headersSent) {
        response.destroy(error);
        return;
      }
      return json(response, error.status || 500, { message: error.message || "Mock API request failed." });
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.MOCK_API_PORT || 8081);
  createMockServer().listen(port, "127.0.0.1", () => {
    console.log(`NEMESIS-X mock API listening at http://127.0.0.1:${port}`);
  });
}

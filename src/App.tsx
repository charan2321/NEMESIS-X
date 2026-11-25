import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, FormEvent, KeyboardEvent } from "react";
import {
  Activity, ArrowRight, ArrowUp, Bell, Check, ChevronDown, ChevronRight,
  CircleHelp, Clock3, Command, Download, FileVideo2, Film, Filter, Gauge,
  Layers3, LogOut, Menu, MoreHorizontal, Pause, Play, Plus, Search, Settings2,
  ShieldCheck, SlidersHorizontal, Sparkles, Upload, X,
} from "lucide-react";

type Threat = "High" | "Medium" | "Low";
type EventItem = {
  id: string;
  title: string;
  time: string;
  start: number;
  end: number;
  level: Threat;
  score: number;
  summary: string;
  track: string;
};
type Job = { id: string; name: string; date: string; duration: string; status: string; events: number; level: Threat };
type OverlayToggles = { Boxes: boolean; Trails: boolean; Heat: boolean; Graph: boolean };

const stages = ["Sampling", "Tracking", "Memory", "Interactions", "Anomaly", "Reasoning"];
const events: EventItem[] = [
  { id: "EV-2048", title: "Movement against flow", time: "00:18 – 00:24", start: 18, end: 24, level: "High", score: 94, summary: "A person moves against the dominant direction of pedestrian traffic.", track: "TRK-082" },
  { id: "EV-2047", title: "Unattended object", time: "00:42 – 00:51", start: 42, end: 51, level: "Medium", score: 78, summary: "An object remains stationary after its carrier leaves the area.", track: "TRK-116" },
  { id: "EV-2046", title: "Rapid direction change", time: "01:06 – 01:10", start: 66, end: 70, level: "Medium", score: 64, summary: "A subject changes direction abruptly near the platform edge.", track: "TRK-039" },
  { id: "EV-2045", title: "Restricted area entry", time: "01:34 – 01:41", start: 94, end: 101, level: "Low", score: 42, summary: "A subject briefly enters a low-traffic perimeter zone.", track: "TRK-211" },
];

const initialJobs: Job[] = [
  { id: "NX-2408", name: "station_west_cam_04.mp4", date: "Today, 10:42 AM", duration: "03:24", status: "Complete", events: 12, level: "High" },
  { id: "NX-2407", name: "concourse_evening.mov", date: "Yesterday, 6:18 PM", duration: "12:08", status: "Complete", events: 8, level: "Medium" },
  { id: "NX-2406", name: "loading_bay_02.mp4", date: "Nov 22, 2026", duration: "08:51", status: "Complete", events: 3, level: "Low" },
];
const demoAccounts = new Map([["operator@example.test", { name: "Alex Lane", password: "DemoPass123!" }]]);

const fmtTime = (seconds: number) => `00:${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

function useModalFocus(ref: React.RefObject<HTMLElement>, active = true) {
  useEffect(() => {
    if (!active) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const container = ref.current;
    if (!container) return;
    const focusable = () => Array.from(container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ));
    focusable()[0]?.focus();
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [active, ref]);
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function readJobs(): Job[] {
  try {
    const saved = localStorage.getItem("nemesis-jobs");
    const deleted = JSON.parse(localStorage.getItem("nemesis-deleted-jobs") || "[]") as string[];
    const allJobs = saved ? [...JSON.parse(saved) as Job[], ...initialJobs] : initialJobs;
    return allJobs.filter((job, index) =>
      !deleted.includes(job.id) && allJobs.findIndex((candidate) => candidate.id === job.id) === index,
    );
  } catch {
    console.error("Could not read saved analyses.");
    return initialJobs;
  }
}

function App() {
  const [path, setPath] = useState(window.location.pathname);
  const [authenticated, setAuthenticated] = useState(localStorage.getItem("nemesis-auth") === "true");
  const [jobs, setJobs] = useState<Job[]>(readJobs);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [time, setTime] = useState(19);
  const [playing, setPlaying] = useState(false);
  const [activeFilter, setActiveFilter] = useState("All events");
  const [sortBy, setSortBy] = useState("Score");
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [showLoginError, setShowLoginError] = useState("");
  const [fileError, setFileError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentJob, setCurrentJob] = useState<Job | null>(null);
  const [stageIndex, setStageIndex] = useState(0);
  const [toggles, setToggles] = useState({ Boxes: true, Trails: true, Heat: false, Graph: false });
  const [showMenu, setShowMenu] = useState(false);
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);
  const pendingRoute = useRef("");
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLDivElement>(null);
  const uploadCompletionHandled = useRef(false);
  const completedJobId = useRef("");

  const go = useCallback((to: string, replace = false) => {
    if (replace) window.history.replaceState({}, "", to);
    else window.history.pushState({}, "", to);
    setPath(to);
  }, []);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (!authenticated && path !== "/login" && path !== "/register") {
      pendingRoute.current = path;
      go("/login", true);
    }
    if (authenticated && (path === "/login" || path === "/register")) {
      go(pendingRoute.current || "/", true);
      pendingRoute.current = "";
    }
  }, [authenticated, path, go]);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        if (shortcutHelpOpen) setShortcutHelpOpen(false);
        else if (searchOpen) setSearchOpen(false);
        else if (selectedEvent) closeDrawer();
        return;
      }

      const target = event.target;
      const isEditable = target instanceof HTMLElement && target.isConnected &&
        (target.isContentEditable || Boolean(target.closest("input, textarea, select, [contenteditable='true']")));
      if (isEditable) return;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((open) => !open);
      } else if (event.key === "?") {
        setShortcutHelpOpen(true);
      } else if (!searchOpen && path.startsWith("/jobs/")) {
        if (event.code === "Space") {
          event.preventDefault();
          setPlaying((current) => !current);
        }
        if (event.key.toLowerCase() === "j") setTime((current) => Math.max(0, current - 5));
        if (event.key.toLowerCase() === "l") setTime((current) => current + 5);
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          const index = selectedEvent ? events.findIndex((item) => item.id === selectedEvent.id) : -1;
          const next = (index + (event.key === "ArrowDown" ? 1 : events.length - 1)) % events.length;
          setSelectedEvent(events[next]);
          setTime(events[next].start);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [path, searchOpen, selectedEvent, shortcutHelpOpen]);

  useEffect(() => {
    if (!path.includes("/results") && !path.includes("/events/")) setPlaying(false);
  }, [path]);

  useEffect(() => {
    if (!playing || (!path.includes("/results") && !path.includes("/events/"))) return;
    const timer = window.setInterval(() => setTime((current) => current + 1), 1000);
    return () => window.clearInterval(timer);
  }, [path, playing]);

  useEffect(() => {
    if (!uploading) return;
    const timer = window.setInterval(() => {
      setUploadProgress((current) => Math.min(100, current + 4));
    }, 120);
    return () => window.clearInterval(timer);
  }, [uploading, go]);

  useEffect(() => {
    if (!uploading || uploadProgress < 100 || uploadCompletionHandled.current) return;
    uploadCompletionHandled.current = true;
    setUploading(false);
    const job: Job = {
      id: `NX-${Math.floor(2409 + Math.random() * 900)}`,
      name: sessionStorage.getItem("nemesis-upload-name") || "footage.mp4",
      date: "Just now",
      duration: "03:24",
      status: "Processing",
      events: 0,
      level: "Low",
    };
    setCurrentJob(job);
    setStageIndex(0);
    go(`/jobs/${job.id}`);
  }, [uploading, uploadProgress, go]);

  useEffect(() => {
    localStorage.setItem("nemesis-jobs", JSON.stringify(jobs.slice(0, 5)));
  }, [jobs]);

  useEffect(() => {
    if (!path.startsWith("/jobs/") || path.includes("/events/") || !currentJob) return;
    if (stageIndex < stages.length - 1) {
      const timer = window.setTimeout(() => setStageIndex(stageIndex + 1), 1500);
      return () => window.clearTimeout(timer);
    }
    if (completedJobId.current === currentJob.id) return;
    completedJobId.current = currentJob.id;
    const completed = { ...currentJob, status: "Complete", events: 12, level: "High" as Threat };
    setJobs((previous) => [completed, ...previous.filter((job) => job.id !== completed.id)]);
    const redirectTimer = window.setTimeout(() => go(`/jobs/${completed.id}/results`), 750);
    return () => window.clearTimeout(redirectTimer);
  }, [path, currentJob, stageIndex, go]);

  useEffect(() => {
    const eventMatch = path.match(/\/jobs\/[^/]+\/events\/([^/]+)/);
    setSelectedEvent(eventMatch ? events.find((event) => event.id === eventMatch[1]) || events[0] : null);
    if (eventMatch) setTime((events.find((event) => event.id === eventMatch[1]) || events[0]).start);
  }, [path]);

  const filteredEvents = useMemo(() => {
    const filtered = events.filter((event) => activeFilter === "All events" || event.level === activeFilter);
    return [...filtered].sort((a, b) => sortBy === "Time" ? a.start - b.start : b.score - a.score);
  }, [activeFilter, sortBy]);

  const isAuth = path === "/login" || path === "/register";
  const isHistory = path === "/jobs";
  const isProcessing = path.startsWith("/jobs/") && !path.includes("/results") && !path.includes("/events/");
  const isResults = path.startsWith("/jobs/") && !isProcessing;
  const currentJobId = path.split("/")[2] || "NX-2408";
  const currentAnalysis = currentJob?.id === currentJobId ? currentJob : jobs.find((job) => job.id === currentJobId) || initialJobs[0];

  function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") || "").trim();
    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "");
    const isRegister = path === "/register";
    if (isRegister && !name) {
      setShowLoginError("Enter your name to create an account.");
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setShowLoginError("Enter a valid email address to continue.");
      return;
    }
    if (password.length < 8 || (isRegister && !(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)))) {
      setShowLoginError(isRegister
        ? "Use at least 8 characters with uppercase, lowercase, and a number."
        : "Your password must be at least 8 characters.");
      return;
    }
    if (isRegister && demoAccounts.has(email.toLowerCase())) {
      setShowLoginError("An account with this email already exists. Sign in instead.");
      return;
    }
    if (isRegister) {
      demoAccounts.set(email.toLowerCase(), { name, password });
    } else {
      const account = demoAccounts.get(email.toLowerCase());
      if (!account || account.password !== password) {
        setShowLoginError("Email or password doesn’t match our records. Try again.");
        return;
      }
    }
    localStorage.setItem("nemesis-auth", "true");
    setAuthenticated(true);
    setShowLoginError("");
    const destination = pendingRoute.current || "/";
    pendingRoute.current = "";
    go(destination);
  }

  function handleFile(file?: File) {
    setFileError("");
    if (!file) return;
    if (!/\.(mp4|avi|mov|mkv)$/i.test(file.name)) {
      setFileError("Unsupported format. Choose an MP4, AVI, MOV, or MKV file.");
      return;
    }
    if (file.size > 500 * 1024 * 1024) {
      setFileError("This video is larger than the 500 MB limit.");
      return;
    }
    sessionStorage.setItem("nemesis-upload-name", file.name);
    setUploadProgress(0);
    uploadCompletionHandled.current = false;
    setUploading(true);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    handleFile(event.dataTransfer.files[0]);
  }

  function selectEvent(item: EventItem) {
    setSelectedEvent(item);
    setTime(item.start);
    go(`/jobs/${path.split("/")[2] || "NX-2408"}/events/${item.id}`);
  }

  function closeDrawer() {
    setSelectedEvent(null);
    go(`/jobs/${path.split("/")[2] || "NX-2408"}/results`, true);
  }

  function seek(value: number) {
    setTime(value);
    if (videoRef.current) videoRef.current.focus();
  }

  function handleSeekKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight") setTime((current) => current + 1);
    if (event.key === "ArrowLeft") setTime((current) => Math.max(0, current - 1));
  }

  function signOut() {
    localStorage.removeItem("nemesis-auth");
    setAuthenticated(false);
    go("/login");
  }

  function deleteJob(id: string) {
    const nextJobs = jobs.filter((job) => job.id !== id);
    const deletedIds = new Set(JSON.parse(localStorage.getItem("nemesis-deleted-jobs") || "[]") as string[]);
    deletedIds.add(id);
    localStorage.setItem("nemesis-deleted-jobs", JSON.stringify([...deletedIds]));
    localStorage.setItem(
      "nemesis-jobs",
      JSON.stringify(nextJobs.filter((job) => !initialJobs.some((initialJob) => initialJob.id === job.id))),
    );
    setJobs(nextJobs);
  }

  if (isAuth) {
    return (
      <main className="auth-page">
        <div className="auth-glow" />
        <div className="auth-brand"><LogoMark /><span>NEMESIS<span className="brand-dash">—</span>X</span></div>
        <section className="auth-card">
          <div className="eyebrow">VIDEO INTELLIGENCE PLATFORM</div>
          <h1>{path === "/register" ? "Create your account" : "Welcome back"}</h1>
          <p className="auth-description">Your footage, understood in context.</p>
          <form onSubmit={signIn} noValidate>
            {path === "/register" && <label>Full name<input name="name" placeholder="How should we address you?" autoComplete="name" /></label>}
            <label>Email address<input name="email" placeholder="name@organization.com" type="email" autoComplete="email" /></label>
            <label>Password<input name="password" placeholder="At least 8 characters" type="password" autoComplete={path === "/register" ? "new-password" : "current-password"} /></label>
            {showLoginError && <p className="form-error" role="alert">{showLoginError}</p>}
            <button className="button primary full" type="submit">{path === "/register" ? "Create account" : "Sign in"} <ArrowRight size={16} /></button>
          </form>
          <p className="auth-switch">{path === "/register" ? "Already have an account?" : "New to NEMESIS-X?"}{" "}
            <button className="text-button" onClick={() => { setShowLoginError(""); go(path === "/register" ? "/login" : "/register"); }}>{path === "/register" ? "Sign in" : "Create account"}</button>
          </p>
          <div className="auth-foot"><ShieldCheck size={14} /> Secure, private workspace</div>
        </section>
        <p className="auth-caption">OBSERVE · UNDERSTAND · VERIFY</p>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${showMenu ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand"><LogoMark /><span>NEMESIS<span className="brand-dash">—</span>X</span></div>
        <div className="workspace-label">WORKSPACE <ChevronDown size={13} /></div>
        <div className="workspace-row"><div className="workspace-avatar">N</div><div><strong>Northstar Ops</strong><small>Investigation team</small></div><MoreHorizontal className="workspace-more" size={17} /></div>
        <div className="nav-label">ANALYZE</div>
        <button className={`nav-item ${!isHistory ? "selected" : ""}`} onClick={() => go("/")}><Activity size={17} /> Overview</button>
        <button className={`nav-item ${isHistory ? "selected" : ""}`} onClick={() => go("/jobs")}><Layers3 size={17} /> Analysis history <span className="nav-count">{jobs.length}</span></button>
        <div className="nav-label nav-label-spaced">TOOLS</div>
        <button className="nav-item" onClick={() => setSearchOpen(true)}><Search size={17} /> Search moments <kbd>⌘ K</kbd></button>
        <button className="nav-item" onClick={() => setSearchOpen(true)}><SlidersHorizontal size={17} /> Query explorer</button>
        <div className="sidebar-spacer" />
        <div className="storage-card"><div className="storage-heading"><span>Workspace storage</span><span>38%</span></div><div className="storage-bar"><i /></div><small>19.2 GB <span>of 50 GB used</span></small></div>
        <button className="nav-item" onClick={() => setShortcutHelpOpen(true)}><CircleHelp size={17} /> Help & shortcuts</button>
        <button className="profile-button" onClick={signOut}><div className="profile-avatar">AL</div><div><strong>Alex Lane</strong><small>Operator</small></div><LogOut size={16} className="profile-logout" /></button>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu icon-button" aria-label="Open menu" onClick={() => setShowMenu((open) => !open)}><Menu size={19} /></button>
          <div className="breadcrumbs"><span>Workspace</span><ChevronRight size={14} /><strong>{isHistory ? "Analysis history" : isResults ? "Analysis" : isProcessing ? "Processing" : "Overview"}</strong></div>
          <div className="topbar-actions"><div className="system-status" title="This frontend is running on local demonstration data"><i /> Demo mode · API not connected</div><button className="icon-button" aria-label="Notifications"><Bell size={17} /></button><div className="top-avatar">AL</div></div>
        </header>

        {isHistory ? (
          <HistoryPage jobs={jobs} onOpen={(id) => go(`/jobs/${id}/results`)} onDelete={deleteJob} onRun={() => go("/")} />
        ) : isProcessing ? (
          <section className="processing-page">
            <div className="processing-orbit"><div className="orbit-core"><Activity size={26} /></div><i /><b /></div>
            <div className="eyebrow">ANALYSIS IN PROGRESS <span className="live-dot" /></div>
            <h1>Finding the signal<br />in <span>the noise.</span></h1>
            <p className="processing-file"><Film size={16} /> {currentJob?.name || "station_west_cam_04.mp4"} <span>·</span> 04:32</p>
            <div className="stepper">{stages.map((stage, index) => <div key={stage} className={`step ${index < stageIndex ? "done" : ""} ${index === stageIndex ? "active" : ""}`}><div className="step-marker">{index < stageIndex ? <Check size={13} /> : <span>{String(index + 1).padStart(2, "0")}</span>}</div><div className="step-copy"><strong>{stage}</strong><small>{index < stageIndex ? "Complete" : index === stageIndex ? "In progress" : "Queued"}</small></div></div>)}</div>
            <div className="processing-progress"><div><span>Analysis progress</span><strong>{Math.min(96, Math.round((stageIndex + 1) / stages.length * 100))}%</strong></div><div className="progress-track"><i style={{ width: `${Math.min(96, Math.round((stageIndex + 1) / stages.length * 100))}%` }} /></div><small>Estimated time remaining <b>~ 01:42</b></small></div>
            <button className="text-button leave-button" onClick={() => go("/")}>You can leave this page — we’ll keep working <ArrowRight size={14} /></button>
          </section>
        ) : isResults ? (
          <ResultsPage
            analysis={currentAnalysis}
            time={time} onSeek={seek} playing={playing} setPlaying={setPlaying} filteredEvents={filteredEvents}
            selectedEvent={selectedEvent} onSelect={selectEvent} filter={activeFilter} setFilter={setActiveFilter}
            sortBy={sortBy} setSortBy={setSortBy} toggles={toggles} setToggles={setToggles}
            videoRef={videoRef} onSeekKey={handleSeekKey} onCloseDrawer={closeDrawer}
          />
        ) : (
          <section className="dashboard-page">
            <div className="dashboard-heading"><div><div className="eyebrow">TUESDAY, NOVEMBER 25, 2026 <span className="heading-dot">·</span> GOOD EVENING, ALEX</div><h1>See what stands out.</h1><p>Review footage. Find the moments that matter.</p></div><button className="button secondary" onClick={() => go("/jobs")}><Clock3 size={15} /> Analysis history</button></div>
            <div className="upload-layout">
              <div className={`upload-card ${uploading ? "is-uploading" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>
                <div className="upload-top"><div className="upload-icon"><Upload size={19} /></div><div><strong>New analysis</strong><span>Upload source footage to get started</span></div><span className="private-badge"><ShieldCheck size={13} /> PRIVATE</span></div>
                <div className="drop-zone" onClick={() => !uploading && inputRef.current?.click()}>
                  <input ref={inputRef} type="file" accept=".mp4,.avi,.mov,.mkv,video/mp4,video/quicktime,video/x-msvideo,video/x-matroska" hidden onChange={(event: ChangeEvent<HTMLInputElement>) => handleFile(event.target.files?.[0])} />
                  {uploading ? <><div className="uploading-icon"><FileVideo2 size={22} /></div><strong>Uploading your footage</strong><span>{sessionStorage.getItem("nemesis-upload-name")}</span><div className="progress-track upload-progress"><i style={{ width: `${uploadProgress}%` }} /></div><div className="upload-progress-label"><span>{uploadProgress}% uploaded</span><button className="text-button" onClick={(event) => { event.stopPropagation(); setUploading(false); }}>Cancel</button></div></> : <><div className="drop-icon"><Upload size={21} /></div><strong>Drop your footage here</strong><span>or <button className="browse-button" onClick={(event) => { event.stopPropagation(); inputRef.current?.click(); }}>browse files</button> from your computer</span><small>MP4, AVI, MOV, MKV <i /> Up to 500 MB</small></>}
                </div>
                {fileError && <p className="file-error" role="alert">{fileError}</p>}
                <div className="samples-row"><span>TRY A SAMPLE</span>{["Station concourse", "Retail entrance", "Loading bay"].map((sample, index) => <button key={sample} className="sample-chip" onClick={() => { sessionStorage.setItem("nemesis-upload-name", ["station_concourse_demo.mp4", "retail_entrance_demo.mp4", "loading_bay_demo.mp4"][index]); setUploadProgress(0); uploadCompletionHandled.current = false; setUploading(true); }}><Play size={11} fill="currentColor" /> {sample}</button>)}</div>
              </div>
              <div className="insight-card"><div className="insight-header"><span className="insight-icon"><Sparkles size={16} /></span><span>YOUR WORKSPACE</span><MoreHorizontal size={18} /></div><div className="insight-number">24 <span>analyses this month</span></div><div className="insight-divider" /><div className="insight-stat"><div className="stat-icon"><Activity size={15} /></div><div><strong>156 moments surfaced</strong><small>Across all reviewed footage</small></div><span className="stat-trend">+12%</span></div><div className="insight-stat"><div className="stat-icon amber"><ShieldCheck size={15} /></div><div><strong>92% evidence verified</strong><small>Claims supported by keyframes</small></div></div><button className="insight-link" onClick={() => go("/jobs")}>View all activity <ArrowRight size={14} /></button></div>
            </div>
            <div className="recent-header"><div><h2>Recent analyses</h2><p>Your latest footage, all in one place.</p></div><button className="subtle-button" onClick={() => go("/jobs")}>View all <ArrowRight size={14} /></button></div>
            <div className="recent-list">{jobs.slice(0, 3).map((job, index) => <button className="recent-row" key={job.id} onClick={() => go(`/jobs/${job.id}/results`)}><div className={`recent-thumb thumb-${index}`}><Film size={17} /></div><div className="recent-file"><strong>{job.name}</strong><small>{job.date} <i /> {job.duration}</small></div><div className="recent-events"><strong>{job.events}</strong><small>moments</small></div><ThreatChip level={job.level} /><span className="row-status"><i /> {job.status}</span><ChevronRight className="row-chevron" size={16} /></button>)}</div>
            <div className="dashboard-foot"><span><ShieldCheck size={13} /> Your footage is encrypted and private</span><span>Need help getting started? <button className="text-button" onClick={() => setSearchOpen(true)}>View the 2-minute guide</button></span></div>
          </section>
        )}
      </main>
      {searchOpen && <SearchModal query={query} setQuery={setQuery} onClose={() => setSearchOpen(false)} onSelect={(item) => { setSearchOpen(false); go(`/jobs/${currentJobId}/events/${item.id}`); }} />}
      {shortcutHelpOpen && <ShortcutHelp onClose={() => setShortcutHelpOpen(false)} />}
    </div>
  );
}

function ResultsPage(props: {
  analysis: Job;
  time: number; onSeek: (value: number) => void; playing: boolean; setPlaying: (value: boolean) => void;
  filteredEvents: EventItem[]; selectedEvent: EventItem | null; onSelect: (item: EventItem) => void;
  filter: string; setFilter: (value: string) => void; sortBy: string; setSortBy: (value: string) => void;
  toggles: OverlayToggles; setToggles: React.Dispatch<React.SetStateAction<OverlayToggles>>;
  videoRef: React.RefObject<HTMLDivElement>; onSeekKey: (event: KeyboardEvent<HTMLDivElement>) => void; onCloseDrawer: () => void;
}) {
  const { analysis, time, onSeek, playing, setPlaying, filteredEvents, selectedEvent, onSelect, filter, setFilter, sortBy, setSortBy, toggles, setToggles, videoRef, onSeekKey, onCloseDrawer } = props;
  const timePercentage = Math.min(100, (time / 180) * 100);
  return (
    <section className="results-page">
      <div className="results-titlebar"><div><div className="eyebrow">ANALYSIS <span className="heading-dot">·</span> {analysis.id}</div><h1>{analysis.name}</h1><p><span className="completed-dot" /> Analysis complete <i /> {analysis.duration} duration <i /> {analysis.date}</p></div><div className="results-actions"><button className="button secondary" onClick={() => downloadBlob(`${analysis.id.toLowerCase()}-analysis.json`, new Blob([JSON.stringify({ jobId: analysis.id, events }, null, 2)], { type: "application/json" }))}><Download size={15} /> Export report <ChevronDown size={13} /></button><button className="icon-button" aria-label="More analysis options"><MoreHorizontal size={18} /></button></div></div>
      <div className="analysis-summary"><div className="summary-item"><span>EVENTS DETECTED</span><strong>12</strong><small>Across 03:24 of footage</small></div><div className="summary-separator" /><div className="summary-item"><span>HIGHEST CONFIDENCE</span><strong>94<em>%</em></strong><small>Movement against flow</small></div><div className="summary-separator" /><div className="summary-item"><span>EVIDENCE VERIFIED</span><strong>92<em>%</em></strong><small><ShieldCheck size={12} /> Claims backed by evidence</small></div><div className="summary-spacer" /><button className="summary-link" onClick={() => onSelect(events[0])}>Review top moment <ArrowRight size={14} /></button></div>
      <div className="analysis-columns">
        <div className="player-column">
          <div className="video-frame" ref={videoRef} tabIndex={0} onKeyDown={onSeekKey} aria-label="Video player">
            <div className="video-scene">
              <div className="scene-vignette" /><div className="scene-ceiling" /><div className="scene-light light-left" /><div className="scene-light light-center" /><div className="scene-light light-right" /><div className="scene-floor" />
              <div className="scene-pillar pillar-left" /><div className="scene-pillar pillar-right" /><div className="scene-sign">PLATFORM 04 <span>↓</span></div><div className="scene-track track-one"><i /><b /><span>TRK-082</span></div><div className="scene-track track-two"><i /><b /><span>TRK-116</span></div><div className="scene-track track-three"><i /><b /><span>TRK-039</span></div>
              {toggles.Heat && <div className="heat-spot" />}{toggles.Graph && <div className="graph-overlay">TRK-082 → TRK-116<br />distance: 2.4m</div>}
              <div className="camera-label"><span>CAM 04 — WEST CONCOURSE</span><span>LIVE ANALYSIS <i /></span></div>
            </div>
            <div className="player-controls"><button className="play-control" aria-label={playing ? "Pause video" : "Play video"} onClick={() => setPlaying(!playing)}>{playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}</button><span className="mono-time">{fmtTime(time)}</span><div className="video-scrub" role="slider" aria-label="Seek video" aria-valuemin={0} aria-valuemax={180} aria-valuenow={time} tabIndex={0} onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); onSeek(Math.round(((event.clientX - rect.left) / rect.width) * 180)); }} onKeyDown={(event) => { if (event.key === "ArrowRight") onSeek(Math.min(180, time + 1)); if (event.key === "ArrowLeft") onSeek(Math.max(0, time - 1)); }}><i style={{ width: `${timePercentage}%` }} /><b style={{ left: `${timePercentage}%` }} /></div><span className="mono-time">03:24</span><button className="volume-button" aria-label="Playback speed"><Settings2 size={15} /></button><button className="volume-button" aria-label="Fullscreen"><MoreHorizontal size={17} /></button></div>
          </div>
          <div className="overlay-row"><span>OVERLAYS</span>{(["Boxes", "Trails", "Heat", "Graph"] as const).map((name) => <button key={name} className={`toggle-pill ${toggles[name] ? "on" : ""}`} aria-pressed={toggles[name]} onClick={() => setToggles((old) => ({ ...old, [name]: !old[name] }))}><span />{name}</button>)}<button className="keyboard-hint"><span>SPACE</span> play/pause <i /> <span>J / L</span> seek</button></div>
          <div className="timeline-card"><div className="timeline-heading"><div><h2>Anomaly timeline</h2><span>Score across the full duration</span></div><div className="timeline-legend"><i /> Anomaly score <i className="band-legend" /> Flagged moment</div></div><div className="timeline-chart"><div className="timeline-ylabels"><span>100</span><span>50</span><span>0</span></div><svg viewBox="0 0 760 118" preserveAspectRatio="none" role="img" aria-label="Anomaly score over time"><defs><linearGradient id="area" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#8290ff" stopOpacity=".22" /><stop offset="100%" stopColor="#8290ff" stopOpacity="0" /></linearGradient><linearGradient id="line" x1="0" x2="1"><stop offset="0%" stopColor="#7b88f5" /><stop offset="100%" stopColor="#67e4d3" /></linearGradient></defs>{filteredEvents.map((event) => <rect key={event.id} x={`${event.start / 180 * 100}%`} y="0" width={`${(event.end - event.start) / 180 * 100}%`} height="110" fill={event.level === "High" ? "#ff5d6c" : event.level === "Medium" ? "#f5b454" : "#7c8cff"} opacity=".09" />)}<path d="M0,96 C30,96 42,82 60,84 S92,98 120,89 S154,93 180,74 S212,85 245,81 S280,89 312,57 S347,73 376,70 S410,88 438,65 S475,79 505,44 S540,67 570,61 S598,76 625,50 S658,73 690,32 S726,52 760,28 L760,110 L0,110 Z" fill="url(#area)" /><path d="M0,96 C30,96 42,82 60,84 S92,98 120,89 S154,93 180,74 S212,85 245,81 S280,89 312,57 S347,73 376,70 S410,88 438,65 S475,79 505,44 S540,67 570,61 S598,76 625,50 S658,73 690,32 S726,52 760,28" fill="none" stroke="url(#line)" strokeWidth="2" vectorEffect="non-scaling-stroke" />{filteredEvents.map((event) => <circle key={event.id} cx={`${event.start / 180 * 100}%`} cy={`${110 - event.score * 0.8}px`} r="3.5" fill={event.level === "High" ? "#ff7882" : "#f6c372"} stroke="#10131a" strokeWidth="2" />)}<line x1={`${timePercentage}%`} x2={`${timePercentage}%`} y1="0" y2="110" stroke="#e9ebf5" strokeOpacity=".7" strokeDasharray="3 4" /></svg><div className="timeline-hit" onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); onSeek(Math.round(((event.clientX - rect.left) / rect.width) * 180)); }} role="slider" aria-label="Timeline position" aria-valuenow={time} aria-valuemin={0} aria-valuemax={180} tabIndex={0} /><div className="timeline-xlabels"><span>00:00</span><span>00:45</span><span>01:30</span><span>02:15</span><span>03:00</span><span>03:24</span></div></div><div className="timeline-current"><span className="timeline-current-dot" /> PLAYHEAD <strong>{fmtTime(time)}</strong></div></div>
        </div>
        <aside className="events-column"><div className="events-heading"><div><div className="events-title"><h2>Flagged moments</h2><span className="event-total">12</span></div><p>Ranked by confidence score</p></div><button className="icon-button small-icon" aria-label="Filter events"><Filter size={15} /></button></div><div className="event-controls"><button className="filter-select" onClick={() => setFilter(filter === "All events" ? "High" : filter === "High" ? "Medium" : filter === "Medium" ? "Low" : "All events")}><span className="filter-indicator" />{filter}<ChevronDown size={13} /></button><button className="sort-select" onClick={() => setSortBy(sortBy === "Score" ? "Time" : "Score")}>Sort: {sortBy} <ChevronDown size={13} /></button></div><div className="event-list">{filteredEvents.map((item, index) => <EventCard key={item.id} item={item} index={index} selected={selectedEvent?.id === item.id} onClick={() => onSelect(item)} />)}</div><button className="all-events-button">View all 12 moments <ArrowRight size={14} /></button></aside>
      </div>
      {selectedEvent && <EventDrawer item={selectedEvent} jobId={analysis.id} onClose={onCloseDrawer} onSeek={onSeek} />}
    </section>
  );
}

function EventCard({ item, index, selected, onClick }: { item: EventItem; index: number; selected: boolean; onClick: () => void }) {
  return <button className={`event-card ${selected ? "event-selected" : ""}`} onClick={onClick}><div className={`event-thumb event-thumb-${index}`}><div className="thumb-grid" /><span className="thumb-cam">CAM 04</span><div className={`thumb-box box-${index}`} /><span className="thumb-time">{item.time.split(" – ")[0]}</span></div><div className="event-card-body"><div className="event-card-title"><strong>{item.title}</strong><ThreatChip level={item.level} /></div><div className="event-meta"><span>{item.time}</span><span className="confidence">{item.score}%</span></div><p>{item.summary}</p><div className="confidence-track"><i style={{ width: `${item.score}%` }} /></div></div></button>;
}

function EventDrawer({ item, jobId, onClose, onSeek }: { item: EventItem; jobId: string; onClose: () => void; onSeek: (value: number) => void }) {
  const [feedback, setFeedback] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState("");
  const drawerRef = useRef<HTMLDivElement>(null);
  useModalFocus(drawerRef);
  function downloadJson() {
    downloadBlob(`${item.id.toLowerCase()}-evidence.json`, new Blob([JSON.stringify(item, null, 2)], { type: "application/json" }));
  }
  async function copyMomentLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/jobs/${jobId}/events/${item.id}`);
      setCopyFeedback("Moment link copied.");
    } catch (error) {
      console.error("Could not copy the moment link.", error);
      setCopyFeedback("Could not copy. Copy the address from your browser.");
    }
  }
  return (
    <>
      <button className="drawer-scrim" aria-label="Close event details" onClick={onClose} />
      <div ref={drawerRef} className="event-drawer" role="dialog" aria-modal="true" aria-labelledby="event-drawer-title">
        <div className="drawer-top">
          <div className="eyebrow">MOMENT DETAILS <span className="heading-dot">·</span> {item.id}</div>
          <button className="icon-button" aria-label="Close details" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="drawer-scroll">
          <div className="drawer-title-row"><h2 id="event-drawer-title">{item.title}</h2><ThreatChip level={item.level} /></div>
          <div className="drawer-meta">
            <span><Clock3 size={13} /> {item.time}</span>
            <span><Gauge size={13} /> {item.score}% confidence</span>
          </div>
          <div className={`drawer-hero event-thumb-${events.indexOf(item)}`}>
            <div className="thumb-grid" />
            <span className="thumb-cam">CAM 04 — WEST CONCOURSE</span>
            <div className="thumb-box box-0" />
            <button aria-label="Seek to event" onClick={() => onSeek(item.start)}><Play size={14} fill="currentColor" /></button>
          </div>
          <section className="drawer-section">
            <div className="eyebrow">WHAT HAPPENED</div>
            <p>{item.summary} This pattern may warrant a closer look in context.</p>
          </section>
          <section className="drawer-section">
            <div className="eyebrow">WHY IT STANDS OUT HERE</div>
            <p>Movement in this direction is uncommon for this area and time. The observed path differs from the surrounding flow across several sampled frames.</p>
          </section>
          <section className="drawer-section evidence-section">
            <div className="drawer-section-head">
              <div className="eyebrow">EVIDENCE</div>
              <button className="text-button" onClick={() => onSeek(item.start)}>View in player <ArrowRight size={13} /></button>
            </div>
            <div className="evidence-strip">
              {[item.start, item.start + 2, item.end - 1].map((second, index) => (
                <button key={second} className={`evidence-frame event-thumb-${index}`} aria-label={`Seek to ${fmtTime(second)}`} onClick={() => onSeek(second)}>
                  <div className="thumb-grid" /><div className="thumb-box box-0" /><span>{fmtTime(second)}</span>
                </button>
              ))}
            </div>
            <div className="track-line">
              <span>INVOLVED TRACKS</span>
              <button onClick={() => onSeek(item.start)}><span className="track-dot" />{item.track}<ArrowUp size={12} /></button>
              <button onClick={() => onSeek(item.start + 2)}><span className="track-dot muted-track" />TRK-116<ArrowUp size={12} /></button>
            </div>
            <div className="score-breakdown">
              <div className="eyebrow">SCORE BREAKDOWN</div>
              {[["Motion", 91], ["Interaction", 76], ["Appearance", 54], ["Context", 88]].map(([label, score]) => (
                <div className="score-row" key={label}>
                  <span>{label}</span><div className="score-track"><i style={{ width: `${score}%` }} /></div><strong>{score}</strong>
                </div>
              ))}
            </div>
          </section>
          <div className="verified-card">
            <div className="verified-icon"><ShieldCheck size={17} /></div>
            <div><strong>Evidence verified</strong><span>92% of claims supported by keyframes</span></div>
            <span className="verified-percent">92%</span>
          </div>
          <div className="drawer-actions">
            <button className="button secondary" onClick={downloadJson}><Download size={14} /> Export JSON</button>
            <button className="button secondary" onClick={() => window.print()}><Download size={14} /> Export PDF</button>
            <button className="button secondary" onClick={copyMomentLink}><ArrowRight size={14} /> Copy moment link</button>
          </div>
          {copyFeedback && <p className="copy-feedback" role="status">{copyFeedback}</p>}
          <button className={`not-interesting ${feedback ? "feedback-sent" : ""}`} onClick={() => setFeedback(true)}>
            {feedback ? <><Check size={14} /> Feedback recorded — thank you</> : "Mark as not interesting"}
          </button>
        </div>
      </div>
    </>
  );
}

function HistoryPage({ jobs, onOpen, onDelete, onRun }: { jobs: Job[]; onOpen: (id: string) => void; onDelete: (id: string) => void; onRun: () => void }) {
  const [confirmId, setConfirmId] = useState("");
  return (
    <section className="history-page">
      <div className="history-heading">
        <div><div className="eyebrow">YOUR WORKSPACE</div><h1>Analysis history</h1><p>Every review, ready when you need it.</p></div>
        <button className="button primary" onClick={onRun}><Plus size={16} /> New analysis</button>
      </div>
      <div className="history-toolbar">
        <div><span className="history-count">{jobs.length}</span> analyses</div>
        <button className="filter-select"><Filter size={14} /> All statuses <ChevronDown size={13} /></button>
      </div>
      {jobs.length ? (
        <div className="history-table-wrap">
          <table className="history-table">
            <thead>
              <tr><th>FOOTAGE</th><th>DATE ADDED</th><th>DURATION</th><th>STATUS</th><th>MOMENTS</th><th>HIGHEST LEVEL</th><th>ACTIONS</th></tr>
            </thead>
            <tbody>
              {jobs.map((job, index) => (
                <tr key={job.id}>
                  <td>
                    <button className="history-file" onClick={() => onOpen(job.id)}>
                      <div className={`recent-thumb thumb-${index % 3}`} aria-hidden="true"><Film size={16} /></div>
                      <span><strong>{job.name}</strong><small>{job.id}</small></span>
                    </button>
                  </td>
                  <td>{job.date}</td>
                  <td className="mono-cell">{job.duration}</td>
                  <td><span className="table-status"><i />{job.status}</span></td>
                  <td>{job.events}</td>
                  <td><ThreatChip level={job.level} /></td>
                  <td>
                    <div className="table-actions">
                      <button title="Open analysis" aria-label={`Open ${job.name}`} onClick={() => onOpen(job.id)}><ArrowRight size={15} /></button>
                      <button title="Delete analysis" aria-label={`Delete ${job.name}`} onClick={() => setConfirmId(job.id)}><MoreHorizontal size={16} /></button>
                    </div>
                    {confirmId === job.id && (
                      <div className="confirm-popover" role="dialog" aria-label={`Delete ${job.name}?`}>
                        <strong>Delete this analysis?</strong><span>This cannot be undone.</span>
                        <div>
                          <button onClick={() => setConfirmId("")}>Cancel</button>
                          <button className="delete-confirm" onClick={() => { onDelete(job.id); setConfirmId(""); }}>Delete</button>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-history">
          <div><Film size={24} /></div><h2>No analyses yet</h2><p>Upload footage to see your reviewed videos here.</p>
          <button className="button primary" onClick={onRun}><Plus size={15} /> Start an analysis</button>
        </div>
      )}
      <div className="history-foot"><span><ShieldCheck size={13} /> Your footage is encrypted and private</span><span>Showing all analyses</span></div>
    </section>
  );
}

function SearchModal({ query, setQuery, onClose, onSelect }: { query: string; setQuery: (value: string) => void; onClose: () => void; onSelect: (item: EventItem) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  useModalFocus(modalRef);
  const results = query.trim() ? events.filter((event) => `${event.title} ${event.summary}`.toLowerCase().includes(query.toLowerCase())) : events.slice(0, 3);
  return <div className="search-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section ref={modalRef} className="search-modal" role="dialog" aria-modal="true" aria-label="Search moments"><div className="search-input-row"><Search size={19} /><input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Describe a moment, person, or behavior..." aria-label="Search analysis moments" /><kbd>ESC</kbd><button className="icon-button" aria-label="Close search" onClick={onClose}><X size={17} /></button></div><div className="search-results-heading">{query.trim() ? "MATCHING MOMENTS" : "SUGGESTED MOMENTS"}<span>{results.length} results</span></div>{results.length ? results.map((item, index) => <button className="search-result" key={item.id} onClick={() => onSelect(item)}><div className={`search-result-thumb event-thumb-${index}`}><div className="thumb-grid" /><div className="thumb-box box-0" /></div><div><strong>{item.title}</strong><span>{item.summary}</span></div><div className="search-result-time">{item.time}<ArrowRight size={13} /></div></button>) : <div className="search-empty"><Search size={20} /><strong>No moments found</strong><span>Try a different description, like “unattended object”.</span></div>}<div className="search-footer"><span><Command size={12} /> <b>↵</b> to open moment</span><span>Searches across this analysis</span></div></section></div>;
}

function ShortcutHelp({ onClose }: { onClose: () => void }) {
  const helpRef = useRef<HTMLDivElement>(null);
  useModalFocus(helpRef);
  return <div className="search-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section ref={helpRef} className="search-modal shortcut-modal" role="dialog" aria-modal="true" aria-labelledby="shortcut-help-title">
      <div className="search-input-row"><h2 id="shortcut-help-title">Keyboard shortcuts</h2><button className="icon-button" aria-label="Close shortcuts" onClick={onClose}><X size={17} /></button></div>
      <div className="shortcut-list">
        <div><span>Open moment search</span><kbd>⌘ / Ctrl</kbd><kbd>K</kbd></div>
        <div><span>Play or pause video</span><kbd>Space</kbd></div>
        <div><span>Seek backward / forward</span><kbd>J</kbd><kbd>L</kbd></div>
        <div><span>Previous / next moment</span><kbd>↑</kbd><kbd>↓</kbd></div>
        <div><span>Close this panel or drawer</span><kbd>Esc</kbd></div>
      </div>
    </section>
  </div>;
}

function ThreatChip({ level }: { level: Threat }) {
  return <span className={`threat-chip threat-${level.toLowerCase()}`}><i />{level}</span>;
}

function LogoMark() {
  return <span className="logo-mark"><span /><i /><b /></span>;
}

export default App;

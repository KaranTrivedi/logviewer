import { useState, useEffect, useRef, useCallback } from "react";

const LEVELS = ["ALL", "DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"];

const LEVEL_STYLES = {
  DEBUG:    { text: "#6fcf6f", badge: "#264726", badgeText: "#6fcf6f" },
  INFO:     { text: "#60a8f8", badge: "#1e3050", badgeText: "#60a8f8" },
  WARNING:  { text: "#f5c842", badge: "#3a2e08", badgeText: "#f5c842" },
  ERROR:    { text: "#f87171", badge: "#3d1515", badgeText: "#f87171" },
  CRITICAL: { text: "#ff6bd6", badge: "#3d0a25", badgeText: "#ff6bd6" },
  DEFAULT:  { text: "#c8c8c8", badge: "#2a2a2a", badgeText: "#888888" },
};

function parseLevel(line) {
  const u = line.toUpperCase();
  if (u.includes("CRITICAL")) return "CRITICAL";
  if (u.includes("ERROR"))    return "ERROR";
  if (u.includes("WARNING") || u.includes("WARN")) return "WARNING";
  if (u.includes("INFO"))     return "INFO";
  if (u.includes("DEBUG"))    return "DEBUG";
  return "DEFAULT";
}

const DEMO_LINES = [
  "[INFO] 12:00:01 — app.server: Server listening on 0.0.0.0:8080",
  "[DEBUG] 12:00:02 — app.database: Query executed in 45ms",
  "[INFO] 12:00:03 — app.auth: User user_42 logged in",
  "[WARNING] 12:00:05 — app.cache: Memory usage at 78%",
  "[ERROR] 12:00:07 — app.server: SMTP timeout for user_99@example.com",
  "[DEBUG] 12:00:08 — app.worker: Job job_1234 picked up by worker 3",
  "[INFO] 12:00:10 — app.server: GET /api/v1/orders — 200 OK (112ms)",
  "[CRITICAL] 12:00:12 — app.server: Disk usage at 95% — writes failing!",
  "[INFO] 12:00:14 — app.database: Backup completed: 2.1 GB",
  "[DEBUG] 12:00:16 — app.cache: Cache hit for cache:users:201",
];
let demoIdx = 0;

const isElectron = typeof window !== "undefined" && !!window.electronAPI;

export default function LogViewer() {
  const [logs, setLogs]           = useState([]);
  const [filter, setFilter]       = useState("ALL");
  const [search, setSearch]       = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [filePath, setFilePath]   = useState("");
  const [status, setStatus]       = useState("idle");  // idle | watching | stopped | error | demo
  const [showSettings, setShowSettings] = useState(true);
  const [demoMode, setDemoMode]   = useState(false);

  const bottomRef       = useRef(null);
  const demoIntervalRef = useRef(null);
  const logIdRef        = useRef(0);

  const addLog = useCallback((text) => {
    const level = parseLevel(text);
    setLogs(prev => [...prev, {
      id: logIdRef.current++,
      ts: new Date().toISOString().replace("T", " ").slice(0, 23),
      text,
      level,
    }]);
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

  // Electron IPC listeners
  useEffect(() => {
    if (!isElectron) return;
    window.electronAPI.onLine(addLog);
    window.electronAPI.onStopped(() => setStatus("stopped"));
    return () => window.electronAPI.removeAllListeners();
  }, [addLog]);

  // Demo mode
  useEffect(() => {
    if (demoMode) {
      setStatus("demo");
      demoIntervalRef.current = setInterval(() => {
        addLog(DEMO_LINES[demoIdx % DEMO_LINES.length]);
        demoIdx++;
      }, 700);
    } else {
      clearInterval(demoIntervalRef.current);
      if (status === "demo") setStatus("idle");
    }
    return () => clearInterval(demoIntervalRef.current);
  }, [demoMode]);

  const pickFile = async () => {
    if (!isElectron) return;
    const picked = await window.electronAPI.pickFile();
    if (picked) setFilePath(picked);
  };

  // Watch tail — only new lines from now
  const watchTail = async () => {
    if (!isElectron || !filePath) return;
    setLogs([]);
    const result = await window.electronAPI.watchFile(filePath);
    if (result.ok) setStatus("watching");
    else { addLog(`[ERROR] ${result.error}`); setStatus("error"); }
  };

  // Read whole file then watch
  const readAll = async () => {
    if (!isElectron || !filePath) return;
    setLogs([]);
    const result = await window.electronAPI.readAll(filePath);
    if (result.ok) setStatus("watching");
    else { addLog(`[ERROR] ${result.error}`); setStatus("error"); }
  };

  const stop = async () => {
    if (!isElectron) return;
    await window.electronAPI.stopWatch();
    setStatus("stopped");
  };

  const filtered = logs.filter(l => {
    const levelOk  = filter === "ALL" || l.level === filter;
    const searchOk = !search || l.text.toLowerCase().includes(search.toLowerCase());
    return levelOk && searchOk;
  });

  const counts = logs.reduce((acc, l) => {
    acc[l.level] = (acc[l.level] || 0) + 1;
    return acc;
  }, {});

  const statusColor = {
    watching: "#6fcf6f",
    demo:     "#60a8f8",
    error:    "#f87171",
    stopped:  "#888",
    idle:     "#444",
  }[status] || "#444";

  const isWatching = status === "watching";

  return (
    <div style={{ fontFamily: "'JetBrains Mono','Fira Code','Cascadia Code',monospace", background: "#0d0f12", height: "100vh", display: "flex", flexDirection: "column", color: "#c8c8c8", overflow: "hidden" }}>

      {/* Header */}
      <div style={{ background: "#13151a", borderBottom: "1px solid #252830", padding: "0 16px", display: "flex", alignItems: "center", gap: 12, height: 48, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.12em", color: "#e8e8e8" }}>⬡ LOGWATCH</span>
        {!isElectron && (
          <span style={{ fontSize: 10, background: "#3a2e08", color: "#f5c842", borderRadius: 3, padding: "2px 8px", letterSpacing: "0.08em" }}>BROWSER — DEMO ONLY</span>
        )}
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: statusColor, boxShadow: `0 0 6px ${statusColor}` }} />
          <span style={{ color: statusColor, textTransform: "uppercase", letterSpacing: "0.1em" }}>{status}</span>
        </div>
        <button onClick={() => setShowSettings(s => !s)} style={{ background: showSettings ? "#1e2a3a" : "transparent", border: "1px solid #2a2e38", borderRadius: 4, color: "#888", padding: "4px 10px", fontSize: 11, cursor: "pointer", letterSpacing: "0.05em", fontFamily: "inherit" }}>
          {showSettings ? "▼ CONFIG" : "▶ CONFIG"}
        </button>
      </div>

      {/* Settings */}
      {showSettings && (
        <div style={{ background: "#13151a", borderBottom: "1px solid #252830", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          {/* File path row */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "#555", letterSpacing: "0.08em", minWidth: 48 }}>FILE</span>
            <input
              value={filePath}
              onChange={e => setFilePath(e.target.value)}
              placeholder="C:\path\to\your\app.log"
              disabled={demoMode}
              style={{ flex: 1, background: "#0d0f12", border: "1px solid #2a2e38", borderRadius: 4, padding: "5px 10px", fontSize: 12, color: "#c8c8c8", fontFamily: "inherit", outline: "none", opacity: demoMode ? 0.4 : 1 }}
            />
            <button onClick={pickFile} disabled={!isElectron || demoMode} style={{ background: "#1e2233", border: "1px solid #2a3550", borderRadius: 4, color: "#60a8f8", padding: "5px 14px", fontSize: 11, cursor: "pointer", letterSpacing: "0.06em", fontFamily: "inherit", opacity: (!isElectron || demoMode) ? 0.4 : 1 }}>
              BROWSE
            </button>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={readAll} disabled={!isElectron || isWatching || demoMode || !filePath}
              style={{ background: "#1a2e1a", border: "1px solid #264726", borderRadius: 4, color: "#6fcf6f", padding: "5px 14px", fontSize: 11, cursor: "pointer", letterSpacing: "0.06em", fontFamily: "inherit", opacity: (!isElectron || isWatching || demoMode || !filePath) ? 0.4 : 1 }}>
              ▶ LOAD &amp; WATCH
            </button>
            <button onClick={watchTail} disabled={!isElectron || isWatching || demoMode || !filePath}
              style={{ background: "#1a2233", border: "1px solid #1e3050", borderRadius: 4, color: "#60a8f8", padding: "5px 14px", fontSize: 11, cursor: "pointer", letterSpacing: "0.06em", fontFamily: "inherit", opacity: (!isElectron || isWatching || demoMode || !filePath) ? 0.4 : 1 }}>
              ⟳ TAIL ONLY
            </button>
            <button onClick={stop} disabled={!isElectron || !isWatching}
              style={{ background: "#2a1515", border: "1px solid #3d1515", borderRadius: 4, color: "#f87171", padding: "5px 14px", fontSize: 11, cursor: "pointer", letterSpacing: "0.06em", fontFamily: "inherit", opacity: (!isElectron || !isWatching) ? 0.4 : 1 }}>
              ■ STOP
            </button>
            <div style={{ borderLeft: "1px solid #252830", height: 22, margin: "0 4px" }} />
            <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: "#60a8f8", cursor: "pointer", letterSpacing: "0.06em" }}>
              <input type="checkbox" checked={demoMode} onChange={e => setDemoMode(e.target.checked)} style={{ accentColor: "#60a8f8" }} />
              DEMO MODE
            </label>
          </div>

          {/* Helper text */}
          <div style={{ fontSize: 10, color: "#444", letterSpacing: "0.05em" }}>
            <span style={{ color: "#6fcf6f99" }}>LOAD &amp; WATCH</span> — reads the whole file then tails for new lines &nbsp;|&nbsp;
            <span style={{ color: "#60a8f899" }}>TAIL ONLY</span> — shows only new lines written from now
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div style={{ background: "#10121a", borderBottom: "1px solid #1e2028", padding: "8px 16px", display: "flex", alignItems: "center", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 4 }}>
          {LEVELS.map(lvl => {
            const s = LEVEL_STYLES[lvl] || LEVEL_STYLES.DEFAULT;
            const active = filter === lvl;
            const cnt = lvl === "ALL" ? logs.length : (counts[lvl] || 0);
            return (
              <button key={lvl} onClick={() => setFilter(lvl)} style={{
                background: active ? s.badge : "transparent",
                border: `1px solid ${active ? s.badgeText : "#252830"}`,
                borderRadius: 3, color: active ? s.badgeText : "#555",
                padding: "3px 8px", fontSize: 10, cursor: "pointer",
                letterSpacing: "0.08em", fontFamily: "inherit",
              }}>
                {lvl}{cnt > 0 && <span style={{ marginLeft: 4, opacity: 0.7 }}>{cnt}</span>}
              </button>
            );
          })}
        </div>
        <div style={{ flex: 1 }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="SEARCH..."
          style={{ background: "#0d0f12", border: "1px solid #252830", borderRadius: 4, padding: "4px 10px", fontSize: 11, color: "#c8c8c8", fontFamily: "inherit", outline: "none", width: 180 }} />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "#666", cursor: "pointer", letterSpacing: "0.08em" }}>
          <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)} style={{ accentColor: "#60a8f8" }} />
          AUTO-SCROLL
        </label>
        <button onClick={() => setLogs([])} style={{ background: "transparent", border: "1px solid #252830", borderRadius: 3, color: "#555", padding: "3px 10px", fontSize: 10, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.06em" }}>
          CLEAR
        </button>
      </div>

      {/* Log lines */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
        {filtered.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 300, gap: 16, color: "#383838" }}>
            <div style={{ fontSize: 40 }}>▣</div>
            <div style={{ fontSize: 12, letterSpacing: "0.1em" }}>NO LOGS</div>
            <div style={{ fontSize: 11, color: "#2a2e38" }}>
              {isElectron ? "BROWSE TO A LOG FILE AND CLICK LOAD & WATCH" : "ENABLE DEMO MODE TO PREVIEW"}
            </div>
          </div>
        ) : filtered.map((log, i) => {
          const s = LEVEL_STYLES[log.level] || LEVEL_STYLES.DEFAULT;
          return (
            <div key={log.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "2px 16px", background: i % 2 === 0 ? "transparent" : "rgba(255, 255, 255, 0)", borderLeft: `2px solid ${log.level !== "DEFAULT" ? s.badgeText + "33" : "transparent"}` }}>
              <span style={{ fontSize: 10, color: "#a39d9d", whiteSpace: "nowrap", lineHeight: "20px", minWidth: 155 }}>{log.ts}</span>
              <span style={{ fontSize: 9, fontWeight: 700, background: s.badge, color: s.badgeText, borderRadius: 2, padding: "2px 5px", letterSpacing: "0.12em", whiteSpace: "nowrap", minWidth: 52, textAlign: "center", alignSelf: "center" }}>
                {log.level === "DEFAULT" ? "LOG" : log.level}
              </span>
              <span style={{ fontSize: 12, color: s.text, lineHeight: "20px", wordBreak: "break-all", flex: 1 }}>{log.text}</span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Footer */}
      <div style={{ background: "#13151a", borderTop: "1px solid #1e2028", padding: "4px 16px", display: "flex", gap: 16, fontSize: 10, color: "#333", letterSpacing: "0.08em", flexShrink: 0 }}>
        <span>TOTAL: {logs.length}</span>
        <span>FILTERED: {filtered.length}</span>
        {Object.entries(counts).map(([lvl, n]) => (
          <span key={lvl} style={{ color: (LEVEL_STYLES[lvl] || LEVEL_STYLES.DEFAULT).badgeText + "99" }}>{lvl}: {n}</span>
        ))}
        {filePath && <span style={{ marginLeft: "auto", color: "#2a2e38", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 400 }}>{filePath}</span>}
      </div>
    </div>
  );
}
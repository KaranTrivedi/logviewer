import { useState, useEffect, useRef, useCallback } from "react";

const LEVELS = ["ALL", "DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"];

const LEVEL_STYLES = {
  DEBUG:    { bg: "#1e2a1e", text: "#6fcf6f", badge: "#264726", badgeText: "#6fcf6f" },
  INFO:     { bg: "#1a2233", text: "#60a8f8", badge: "#1e3050", badgeText: "#60a8f8" },
  WARNING:  { bg: "#2a2210", text: "#f5c842", badge: "#3a2e08", badgeText: "#f5c842" },
  ERROR:    { bg: "#2a1515", text: "#f87171", badge: "#3d1515", badgeText: "#f87171" },
  CRITICAL: { bg: "#2a0a1a", text: "#ff6bd6", badge: "#3d0a25", badgeText: "#ff6bd6" },
  DEFAULT:  { bg: "transparent", text: "#c8c8c8", badge: "#2a2a2a", badgeText: "#aaaaaa" },
};

function parseLevel(line) {
  const upper = line.toUpperCase();
  if (upper.includes("CRITICAL")) return "CRITICAL";
  if (upper.includes("ERROR"))    return "ERROR";
  if (upper.includes("WARNING") || upper.includes("WARN")) return "WARNING";
  if (upper.includes("INFO"))     return "INFO";
  if (upper.includes("DEBUG"))    return "DEBUG";
  return "DEFAULT";
}

const DEMO_MESSAGES = [
  "[INFO] Server started on port 8080",
  "[DEBUG] Loading config from /etc/app/config.yaml",
  "[INFO] Connected to database: postgres://localhost:5432/prod",
  "[DEBUG] Cache initialized: 512 MB allocated",
  "[INFO] Worker pool started: 8 workers",
  "[WARNING] Memory usage at 78% — consider scaling",
  "[INFO] Request received: GET /api/users (200ms)",
  "[DEBUG] Query executed: SELECT * FROM users WHERE active=true (45ms)",
  "[INFO] Request received: POST /api/orders (312ms)",
  "[ERROR] Failed to send email to user@example.com: SMTP timeout",
  "[DEBUG] Retrying connection to mail server (attempt 1/3)",
  "[WARNING] Rate limit approaching: 880/1000 requests this minute",
  "[INFO] Scheduled job 'cleanup' started",
  "[DEBUG] Deleted 1,204 expired sessions",
  "[INFO] Scheduled job 'cleanup' completed in 2.4s",
  "[CRITICAL] Disk usage at 95% on /dev/sda1 — immediate action required",
  "[ERROR] DB connection pool exhausted — queue: 47 pending queries",
  "[INFO] Auto-scaling triggered: adding 2 instances",
  "[DEBUG] Health check passed: all services nominal",
  "[INFO] Backup completed: 2.3 GB → s3://backups/2024-01-15.tar.gz",
];

let demoIdx = 0;

export default function LogViewer() {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [wsUrl, setWsUrl] = useState("ws://localhost:8765");
  const [status, setStatus] = useState("disconnected");
  const [demoMode, setDemoMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const bottomRef = useRef(null);
  const wsRef = useRef(null);
  const demoIntervalRef = useRef(null);
  const logIdRef = useRef(0);

  const addLog = useCallback((text) => {
    const level = parseLevel(text);
    setLogs(prev => [...prev, {
      id: logIdRef.current++,
      ts: new Date().toISOString().replace("T", " ").slice(0, 23),
      text,
      level,
    }]);
  }, []);

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

  const connect = useCallback(() => {
    if (wsRef.current) wsRef.current.close();
    setStatus("connecting");
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    ws.onopen  = () => setStatus("connected");
    ws.onclose = () => setStatus("disconnected");
    ws.onerror = () => setStatus("error");
    ws.onmessage = (e) => addLog(e.data);
  }, [wsUrl, addLog]);

  const disconnect = useCallback(() => {
    if (wsRef.current) wsRef.current.close();
  }, []);

  useEffect(() => {
    if (demoMode) {
      demoIntervalRef.current = setInterval(() => {
        addLog(DEMO_MESSAGES[demoIdx % DEMO_MESSAGES.length]);
        demoIdx++;
      }, 800);
      setStatus("demo");
    } else {
      clearInterval(demoIntervalRef.current);
      if (status === "demo") setStatus("disconnected");
    }
    return () => clearInterval(demoIntervalRef.current);
  }, [demoMode, addLog]);

  const filtered = logs.filter(l => {
    const levelOk = filter === "ALL" || l.level === filter;
    const searchOk = !search || l.text.toLowerCase().includes(search.toLowerCase());
    return levelOk && searchOk;
  });

  const counts = logs.reduce((acc, l) => {
    acc[l.level] = (acc[l.level] || 0) + 1;
    return acc;
  }, {});

  const statusColor = { connected: "#6fcf6f", connecting: "#f5c842", disconnected: "#888", error: "#f87171", demo: "#60a8f8" }[status] || "#888";

  return (
    <div style={{ fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace", background: "#0d0f12", minHeight: "100vh", display: "flex", flexDirection: "column", color: "#c8c8c8" }}>

      {/* Header */}
      <div style={{ background: "#13151a", borderBottom: "1px solid #252830", padding: "0 16px", display: "flex", alignItems: "center", gap: 12, height: 48, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.1em", color: "#e8e8e8" }}>⬡ LOGWATCH</span>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: statusColor, boxShadow: `0 0 6px ${statusColor}` }} />
          <span style={{ color: statusColor, textTransform: "uppercase", letterSpacing: "0.1em" }}>{status}</span>
        </div>
        <button onClick={() => setShowSettings(s => !s)} style={{ background: showSettings ? "#1e2a3a" : "transparent", border: "1px solid #2a2e38", borderRadius: 4, color: "#888", padding: "4px 10px", fontSize: 11, cursor: "pointer", letterSpacing: "0.05em" }}>
          {showSettings ? "▼ CONFIG" : "▶ CONFIG"}
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div style={{ background: "#13151a", borderBottom: "1px solid #252830", padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: "#666", letterSpacing: "0.08em" }}>WS_URL</span>
          <input
            value={wsUrl}
            onChange={e => setWsUrl(e.target.value)}
            style={{ flex: 1, minWidth: 220, background: "#0d0f12", border: "1px solid #2a2e38", borderRadius: 4, padding: "5px 10px", fontSize: 12, color: "#c8c8c8", fontFamily: "inherit", outline: "none" }}
            placeholder="ws://localhost:8765"
          />
          <button onClick={connect} disabled={demoMode} style={{ background: "#1a2e1a", border: "1px solid #264726", borderRadius: 4, color: "#6fcf6f", padding: "5px 14px", fontSize: 11, cursor: "pointer", letterSpacing: "0.06em", opacity: demoMode ? 0.4 : 1 }}>CONNECT</button>
          <button onClick={disconnect} disabled={status === "disconnected" || demoMode} style={{ background: "#2a1515", border: "1px solid #3d1515", borderRadius: 4, color: "#f87171", padding: "5px 14px", fontSize: 11, cursor: "pointer", letterSpacing: "0.06em", opacity: (status === "disconnected" || demoMode) ? 0.4 : 1 }}>DISCONNECT</button>
          <div style={{ borderLeft: "1px solid #252830", height: 24, margin: "0 4px" }} />
          <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: "#60a8f8", cursor: "pointer", letterSpacing: "0.06em" }}>
            <input type="checkbox" checked={demoMode} onChange={e => setDemoMode(e.target.checked)} style={{ accentColor: "#60a8f8" }} />
            DEMO MODE
          </label>
        </div>
      )}

      {/* Toolbar */}
      <div style={{ background: "#10121a", borderBottom: "1px solid #1e2028", padding: "8px 16px", display: "flex", alignItems: "center", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
        {/* Level filters */}
        <div style={{ display: "flex", gap: 4 }}>
          {LEVELS.map(lvl => {
            const style = LEVEL_STYLES[lvl] || LEVEL_STYLES.DEFAULT;
            const active = filter === lvl;
            const cnt = lvl === "ALL" ? logs.length : (counts[lvl] || 0);
            return (
              <button key={lvl} onClick={() => setFilter(lvl)} style={{
                background: active ? (style.badge || "#2a2a2a") : "transparent",
                border: `1px solid ${active ? (style.badgeText || "#555") : "#252830"}`,
                borderRadius: 3,
                color: active ? (style.badgeText || "#aaa") : "#555",
                padding: "3px 8px",
                fontSize: 10,
                cursor: "pointer",
                letterSpacing: "0.08em",
                fontFamily: "inherit",
                transition: "all 0.1s",
              }}>
                {lvl}{cnt > 0 && <span style={{ marginLeft: 4, opacity: 0.7 }}>{cnt}</span>}
              </button>
            );
          })}
        </div>

        <div style={{ flex: 1 }} />

        {/* Search */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="SEARCH..."
          style={{ background: "#0d0f12", border: "1px solid #252830", borderRadius: 4, padding: "4px 10px", fontSize: 11, color: "#c8c8c8", fontFamily: "inherit", outline: "none", width: 180, letterSpacing: "0.04em" }}
        />

        {/* Auto-scroll */}
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "#666", cursor: "pointer", letterSpacing: "0.08em" }}>
          <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)} style={{ accentColor: "#60a8f8" }} />
          AUTO-SCROLL
        </label>

        {/* Clear */}
        <button onClick={() => setLogs([])} style={{ background: "transparent", border: "1px solid #252830", borderRadius: 3, color: "#555", padding: "3px 10px", fontSize: 10, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.06em" }}>
          CLEAR
        </button>
      </div>

      {/* Log area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
        {filtered.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 300, gap: 16, color: "#333" }}>
            <div style={{ fontSize: 40 }}>▣</div>
            <div style={{ fontSize: 12, letterSpacing: "0.1em" }}>NO LOGS</div>
            <div style={{ fontSize: 11, color: "#2a2e38" }}>
              {status === "disconnected" ? "CONFIGURE A CONNECTION OR ENABLE DEMO MODE" : "WAITING FOR OUTPUT..."}
            </div>
          </div>
        ) : (
          filtered.map((log, i) => {
            const style = LEVEL_STYLES[log.level] || LEVEL_STYLES.DEFAULT;
            return (
              <div key={log.id} style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "2px 16px",
                background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.012)",
                borderLeft: `2px solid ${log.level !== "DEFAULT" ? style.badgeText + "33" : "transparent"}`,
              }}>
                <span style={{ fontSize: 10, color: "#333", whiteSpace: "nowrap", lineHeight: "20px", minWidth: 155, letterSpacing: "0.02em" }}>{log.ts}</span>
                <span style={{
                  fontSize: 9,
                  fontWeight: 700,
                  background: style.badge,
                  color: style.badgeText,
                  borderRadius: 2,
                  padding: "2px 5px",
                  letterSpacing: "0.12em",
                  whiteSpace: "nowrap",
                  lineHeight: "16px",
                  minWidth: 52,
                  textAlign: "center",
                  alignSelf: "center",
                }}>{log.level === "DEFAULT" ? "LOG" : log.level}</span>
                <span style={{ fontSize: 12, color: style.text, lineHeight: "20px", wordBreak: "break-all", flex: 1, letterSpacing: "0.02em" }}>{log.text}</span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Footer */}
      <div style={{ background: "#13151a", borderTop: "1px solid #1e2028", padding: "4px 16px", display: "flex", gap: 16, fontSize: 10, color: "#333", letterSpacing: "0.08em" }}>
        <span>TOTAL: {logs.length}</span>
        <span>FILTERED: {filtered.length}</span>
        {Object.entries(counts).map(([lvl, n]) => (
          <span key={lvl} style={{ color: (LEVEL_STYLES[lvl] || LEVEL_STYLES.DEFAULT).badgeText + "99" }}>
            {lvl}: {n}
          </span>
        ))}
      </div>
    </div>
  );
}

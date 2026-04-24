const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs   = require("fs");

const isDev = !app.isPackaged;
let mainWindow;
let watcher = null;
let filePos = 0;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 500,
    backgroundColor: "#0d0f12",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// ── Helpers ────────────────────────────────────────────────────────────────

function sendLine(line) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("file:line", line);
  }
}

function stopWatching() {
  if (watcher) { watcher.close(); watcher = null; }
  filePos = 0;
}

// Read any new bytes since last known position, emit complete lines
function readNewLines(filePath) {
  try {
    const stat = fs.statSync(filePath);
    if (stat.size < filePos) filePos = 0; // file was rotated/truncated

    if (stat.size === filePos) return;

    const buf = Buffer.alloc(stat.size - filePos);
    const fd  = fs.openSync(filePath, "r");
    fs.readSync(fd, buf, 0, buf.length, filePos);
    fs.closeSync(fd);

    filePos = stat.size;

    const lines = buf.toString("utf8").split(/\r?\n/);
    // Last element may be a partial line mid-write — hold it back
    for (let i = 0; i < lines.length - 1; i++) {
      if (lines[i].length > 0) sendLine(lines[i]);
    }
    const tail = lines[lines.length - 1];
    if (tail.length > 0) {
      filePos -= Buffer.byteLength(tail, "utf8"); // re-read next tick
    }
  } catch (err) {
    sendLine(`[ERROR] Read failed: ${err.message}`);
  }
}

function startWatcher(filePath) {
  watcher = fs.watch(filePath, { persistent: true }, (event) => {
    if (event === "change") readNewLines(filePath);
  });
  watcher.on("error", (err) => {
    sendLine(`[ERROR] Watcher: ${err.message}`);
    stopWatching();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("file:stopped");
    }
  });
}

// ── IPC ────────────────────────────────────────────────────────────────────

// Open a native file picker and return the chosen path
ipcMain.handle("file:pick", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Select a log file",
    filters: [
      { name: "Log Files", extensions: ["log", "txt", "out", "err", "json", "jsonl"] },
      { name: "All Files", extensions: ["*"] },
    ],
    properties: ["openFile"],
  });
  return result.canceled ? null : result.filePaths[0];
});

// Watch from the END of file — only show new lines written after this call
ipcMain.handle("file:watch", async (_event, filePath) => {
  stopWatching();
  if (!fs.existsSync(filePath)) return { ok: false, error: "File not found: " + filePath };
  try {
    filePos = fs.statSync(filePath).size; // start at end
    sendLine(`[INFO] Watching for new lines: ${filePath}`);
    startWatcher(filePath);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// Read entire file from the beginning, then keep watching
ipcMain.handle("file:readAll", async (_event, filePath) => {
  stopWatching();
  if (!fs.existsSync(filePath)) return { ok: false, error: "File not found: " + filePath };
  try {
    filePos = 0;
    sendLine(`[INFO] Loading full file: ${filePath}`);
    readNewLines(filePath);      // dump existing content
    startWatcher(filePath);      // then tail for new additions
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// Stop watching
ipcMain.handle("file:stop", async () => {
  stopWatching();
  return { ok: true };
});
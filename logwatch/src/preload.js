const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  pickFile:   ()         => ipcRenderer.invoke("file:pick"),
  watchFile:  (filePath) => ipcRenderer.invoke("file:watch", filePath),
  readAll:    (filePath) => ipcRenderer.invoke("file:readAll", filePath),
  stopWatch:  ()         => ipcRenderer.invoke("file:stop"),

  onLine:    (cb) => ipcRenderer.on("file:line",    (_e, data) => cb(data)),
  onStopped: (cb) => ipcRenderer.on("file:stopped", ()        => cb()),

  removeAllListeners: () => {
    ipcRenderer.removeAllListeners("file:line");
    ipcRenderer.removeAllListeners("file:stopped");
  },
});
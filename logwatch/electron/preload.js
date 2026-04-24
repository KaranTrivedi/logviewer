const { contextBridge, ipcRenderer } = require("electron");

const electronAPI = {
  pickFile: () => ipcRenderer.invoke("file:pick"),
  watchFile: (filePath) => ipcRenderer.invoke("file:watch", filePath),
  readAll: (filePath) => ipcRenderer.invoke("file:readAll", filePath),
  stopWatch: () => ipcRenderer.invoke("file:stop"),
  onLine: (callback) => ipcRenderer.on("file:line", (_event, line) => callback(line)),
  onStopped: (callback) => ipcRenderer.on("file:stopped", callback),
  removeAllListeners: () => ipcRenderer.removeAllListeners(),
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  openAudio: () => ipcRenderer.invoke("dialog:openAudio"),
  saveWav: (bufferData) => ipcRenderer.invoke("dialog:saveWav", bufferData),
  getVersion: () => ipcRenderer.invoke("app:getVersion"),

  onMenuOpenFile: (callback) => ipcRenderer.on("menu-open-file", callback),
  onMenuExportWav: (callback) => ipcRenderer.on("menu-export-wav", callback),
});

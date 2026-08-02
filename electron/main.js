import { app, BrowserWindow, ipcMain, dialog, globalShortcut } from "electron";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;

const isDev = process.env.NODE_ENV === "development";

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    title: "Granular Sound Sculptor Z.42",
    backgroundColor: "#000000",
    titleBarStyle: "hidden",
    titleBarOverlay: { color: "#000000", symbolColor: "#ffffff", height: 40 },
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.center();

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  globalShortcut.register("F12", () => mainWindow?.webContents.toggleDevTools());
  globalShortcut.register("CmdOrCtrl+R", () => mainWindow?.webContents.reload());
}

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

// --- IPC Handlers ---

ipcMain.handle("dialog:openAudio", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Load Audio Sample",
    filters: [
      { name: "Audio Files", extensions: ["wav", "mp3", "ogg", "flac", "aiff", "m4a"] },
      { name: "All Files", extensions: ["*"] },
    ],
    properties: ["openFile"],
  });

  if (result.canceled || result.filePaths.length === 0) return null;

  const filePath = result.filePaths[0];
  const fileName = path.basename(filePath);
  const buffer = fs.readFileSync(filePath);
  const uint8 = new Uint8Array(buffer);

  return {
    name: fileName.replace(/\.[^/.]+$/, "").toUpperCase(),
    data: Array.from(uint8),
    mimeType: `audio/${path.extname(filePath).slice(1)}`,
  };
});

ipcMain.handle("dialog:saveWav", async (_event, arrayBufferData) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: "Export Sculpted WAV",
    defaultPath: "SCULPTED_OUTPUT.wav",
    filters: [{ name: "WAV Audio", extensions: ["wav"] }],
  });

  if (result.canceled || !result.filePath) return false;

  const buffer = Buffer.from(arrayBufferData);
  fs.writeFileSync(result.filePath, buffer);
  return true;
});

ipcMain.handle("app:getVersion", () => {
  return app.getVersion();
});

// --- App Lifecycle ---

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

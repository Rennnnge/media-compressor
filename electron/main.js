import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { processMediaFile } from "./media-processor.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = !app.isPackaged;

function registerIpcHandlers() {
  ipcMain.handle("dialog:select-files", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openFile", "multiSelections"],
      filters: [
        { name: "Media Files", extensions: ["jpg", "jpeg", "png", "webp", "mp4", "mov", "webm"] },
        { name: "Images", extensions: ["jpg", "jpeg", "png", "webp"] },
        { name: "Videos", extensions: ["mp4", "mov", "webm"] }
      ]
    });

    return result.canceled ? [] : result.filePaths;
  });

  ipcMain.handle("dialog:select-output-dir", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory", "createDirectory"]
    });

    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle("shell:open-path", async (_event, targetPath) => {
    return shell.openPath(targetPath);
  });

  ipcMain.handle("media:process-files", async (_event, payload) => {
    const results = [];

    for (const filePath of payload.filePaths) {
      try {
        results.push(await processMediaFile(filePath, payload.outputDir, payload.outputFormat, payload.strength));
      } catch (error) {
        results.push({
          filePath,
          status: "failed",
          reason: error instanceof Error ? error.message : "处理失败"
        });
      }
    }

    return results;
  });
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 900,
    minHeight: 680,
    title: "Media Compressor",
    backgroundColor: "#e8edf3",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (isDev) {
    window.loadURL("http://127.0.0.1:5173");
    return;
  }

  window.loadFile(path.join(__dirname, "../dist/index.html"));
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

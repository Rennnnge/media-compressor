import { contextBridge, ipcRenderer, webUtils } from "electron";

contextBridge.exposeInMainWorld("mediaCompressor", {
  version: "0.1.0",
  selectFiles: () => ipcRenderer.invoke("dialog:select-files"),
  getDroppedFilePaths: (files) =>
    Array.from(files)
      .map((file) => webUtils.getPathForFile(file))
      .filter(Boolean),
  selectOutputDirectory: () => ipcRenderer.invoke("dialog:select-output-dir"),
  openPath: (targetPath) => ipcRenderer.invoke("shell:open-path", targetPath),
  processFiles: (payload) => ipcRenderer.invoke("media:process-files", payload)
});

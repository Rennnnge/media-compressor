import { contextBridge, ipcRenderer, webUtils } from "electron";

function getDroppedFilePaths(files) {
  return Array.from(files ?? [])
    .map((file) => {
      try {
        return webUtils.getPathForFile(file);
      } catch {
        return file.path;
      }
    })
    .filter(Boolean);
}

contextBridge.exposeInMainWorld("mediaCompressor", {
  version: "0.1.0",
  selectFiles: () => ipcRenderer.invoke("dialog:select-files"),
  getDroppedFilePaths,
  onFileDrop: (callback) => {
    const findDropZone = (event) => {
      const target = event.target;
      if (target instanceof Element) return target.closest(".drop-zone");
      if (target instanceof Node) return target.parentElement?.closest(".drop-zone");
      return null;
    };

    const handleDragOver = (event) => {
      if (!findDropZone(event)) return;
      event.preventDefault();
    };

    const handleDrop = (event) => {
      if (!findDropZone(event)) return;
      event.preventDefault();
      event.stopPropagation();
      callback(getDroppedFilePaths(event.dataTransfer?.files));
    };

    window.addEventListener("dragover", handleDragOver, true);
    window.addEventListener("drop", handleDrop, true);

    return () => {
      window.removeEventListener("dragover", handleDragOver, true);
      window.removeEventListener("drop", handleDrop, true);
    };
  },
  selectOutputDirectory: () => ipcRenderer.invoke("dialog:select-output-dir"),
  openPath: (targetPath) => ipcRenderer.invoke("shell:open-path", targetPath),
  processFiles: (payload) => ipcRenderer.invoke("media:process-files", payload)
});

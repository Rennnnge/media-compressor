import React, { DragEvent, useEffect, useMemo, useState } from "react";
import { createRoot, Root } from "react-dom/client";
import "./styles.css";

type MediaTask = {
  id: string;
  name: string;
  kind: "图片" | "视频" | "未知";
  size: number;
  progress: number;
  previewUrl?: string;
  path?: string;
  status: "waiting" | "processing" | "completed" | "failed";
  outputPath?: string;
  outputSize?: number;
  reason?: string;
};

type LocalFile = File & {
  path?: string;
};

type ProcessResult = {
  filePath: string;
  outputPath?: string;
  status: "completed" | "failed";
  originalSize?: number;
  outputSize?: number;
  savedBytes?: number;
  reason?: string;
};

type OutputOption = {
  value: string;
  label: string;
};

type MediaCompressorApi = {
  selectFiles: () => Promise<string[]>;
  selectOutputDirectory: () => Promise<string | null>;
  openPath: (targetPath: string) => Promise<string>;
  processFiles: (payload: {
    filePaths: string[];
    outputDir: string;
    outputFormat: string;
    strength: string;
  }) => Promise<ProcessResult[]>;
};

declare global {
  interface Window {
    mediaCompressor?: MediaCompressorApi;
    mediaCompressorRoot?: Root;
  }
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function getKind(file: File): MediaTask["kind"] {
  if (file.type.startsWith("image/")) return "图片";
  if (file.type.startsWith("video/")) return "视频";
  return getKindFromPath(file.name);
}

function getKindFromPath(filePath: string): MediaTask["kind"] {
  const ext = filePath.split(".").pop()?.toLowerCase();
  if (ext && ["jpg", "jpeg", "png", "webp"].includes(ext)) return "图片";
  if (ext && ["mp4", "mov", "webm"].includes(ext)) return "视频";
  return "未知";
}

function getNameFromPath(filePath: string) {
  return filePath.split("/").pop() ?? filePath;
}

function getPreviewUrlFromPath(filePath: string, kind: MediaTask["kind"]) {
  if (kind === "未知") return undefined;
  return `file://${encodeURI(filePath)}`;
}

function getOutputOptions(kind: MediaTask["kind"] | null): OutputOption[] {
  if (kind === "视频") {
    return [
      { value: "auto", label: "自动推荐" },
      { value: "mp4", label: "视频 MP4" },
      { value: "webm", label: "视频 WebM" }
    ];
  }

  return [
    { value: "auto", label: "自动推荐" },
    { value: "webp", label: "图片 WebP" },
    { value: "jpg", label: "图片 JPG" },
    { value: "png", label: "图片 PNG" }
  ];
}

function App() {
  const [tasks, setTasks] = useState<MediaTask[]>([]);
  const [dragging, setDragging] = useState(false);
  const [running, setRunning] = useState(false);
  const [outputDir, setOutputDir] = useState("");
  const [outputFormat, setOutputFormat] = useState("auto");
  const [strength, setStrength] = useState("2");
  const [notice, setNotice] = useState("");
  const [toast, setToast] = useState("");
  const [processingPhraseIndex, setProcessingPhraseIndex] = useState(0);
  const strengthProgress = ((Number(strength) - 1) / 2) * 100;
  const isSuccess = tasks.length > 0 && tasks.every((task) => task.status === "completed");
  const isProcessing = tasks.some((task) => task.status === "processing");
  const selectedKind = tasks.find((task) => task.kind !== "未知")?.kind ?? null;
  const outputOptions = getOutputOptions(selectedKind);
  const processingPhrases = ["正在压缩中", "正在碾碎", "压力山大", "咔咔咔咔"];
  const processingPhrase = processingPhrases[processingPhraseIndex % processingPhrases.length];

  useEffect(() => {
    if (!isProcessing) {
      setProcessingPhraseIndex(0);
      return;
    }

    const timer = window.setInterval(() => {
      setProcessingPhraseIndex((current) => current + 1);
    }, 900);

    return () => window.clearInterval(timer);
  }, [isProcessing]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!outputOptions.some((option) => option.value === outputFormat)) {
      setOutputFormat("auto");
    }
  }, [outputFormat, outputOptions]);

  const summary = useMemo(() => {
    if (running) return "模拟处理中";
    if (tasks.length === 0) return "等待文件";
    return `${tasks.length} 个文件待处理`;
  }, [running, tasks.length]);

  function applyTaskLimits(current: MediaTask[], incoming: MediaTask[]) {
    let imageCount = current.filter((task) => task.kind === "图片").length;
    let videoCount = current.filter((task) => task.kind === "视频").length;
    const accepted: MediaTask[] = [];
    let skippedImages = 0;
    let skippedVideos = 0;
    let skippedUnknown = 0;

    incoming.forEach((task) => {
      if (task.kind === "图片") {
        if (imageCount < 8) {
          accepted.push(task);
          imageCount += 1;
        } else {
          skippedImages += 1;
        }
        return;
      }

      if (task.kind === "视频") {
        if (videoCount < 1) {
          accepted.push(task);
          videoCount += 1;
        } else {
          skippedVideos += 1;
        }
        return;
      }

      skippedUnknown += 1;
    });

    const messages = [];
    if (skippedImages > 0) messages.push("图片最多上传 8 张");
    if (skippedVideos > 0) messages.push("视频最多上传 1 个");
    if (skippedUnknown > 0) messages.push("已忽略不支持的文件");
    return { accepted, notice: messages.join("，") };
  }

  function revokeTaskPreviews(items: MediaTask[]) {
    items.forEach((task) => {
      if (task.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(task.previewUrl);
    });
  }

  function hasMixedMedia(items: MediaTask[]) {
    const hasImage = items.some((task) => task.kind === "图片");
    const hasVideo = items.some((task) => task.kind === "视频");
    return hasImage && hasVideo;
  }

  function addTasks(nextTasks: MediaTask[]) {
    const baseTasks = isSuccess ? [] : tasks;
    if (hasMixedMedia([...baseTasks, ...nextTasks])) {
      revokeTaskPreviews(nextTasks);
      setToast("看把你能的，图片和视频还想一起压？");
      return;
    }

    if (isSuccess) {
      revokeTaskPreviews(tasks);
    }
    const { accepted, notice: nextNotice } = applyTaskLimits(baseTasks, nextTasks);
    setNotice(nextNotice);
    if (isSuccess) {
      setTasks(accepted);
      return;
    }
    if (accepted.length > 0) setTasks((current) => [...current, ...accepted]);
  }

  function clearTasks() {
    revokeTaskPreviews(tasks);
    setTasks([]);
    setNotice("");
    setRunning(false);
  }

  function showEmptyToast() {
    setToast("您还没有上传文件，你让我怎么给你压，我压你个香蕉扒拉");
  }

  function removeTask(taskId: string) {
    setTasks((current) => {
      const target = current.find((task) => task.id === taskId);
      if (target?.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(target.previewUrl);
      return current.filter((task) => task.id !== taskId);
    });
    setNotice("");
  }

  function addFiles(fileList: FileList | null) {
    if (!fileList) return;

    const nextTasks = Array.from(fileList).map((file) => {
      const localFile = file as LocalFile;
      const kind = getKind(file);
      return {
        id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
        name: file.name,
        kind,
        size: file.size,
        path: localFile.path,
        previewUrl: localFile.path ? getPreviewUrlFromPath(localFile.path, kind) : URL.createObjectURL(file),
        progress: 0,
        status: "waiting" as const
      };
    });

    addTasks(nextTasks);
  }

  async function selectFiles() {
    if (!window.mediaCompressor) {
      return;
    }

    const filePaths = await window.mediaCompressor.selectFiles();
    const nextTasks = filePaths.map((filePath) => ({
      id: `${filePath}-${crypto.randomUUID()}`,
      name: getNameFromPath(filePath),
      kind: getKindFromPath(filePath),
      size: 0,
      path: filePath,
      previewUrl: getPreviewUrlFromPath(filePath, getKindFromPath(filePath)),
      progress: 0,
      status: "waiting" as const
    }));

    addTasks(nextTasks);
  }

  async function selectOutputDirectory() {
    if (!window.mediaCompressor) return;
    const selected = await window.mediaCompressor.selectOutputDirectory();
    if (selected) setOutputDir(selected);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    addFiles(event.dataTransfer.files);
  }

  function startMockProcessing() {
    if (tasks.length === 0 || running) return;

    setRunning(true);
    setTasks((current) => current.map((task) => ({ ...task, status: "processing", progress: 0 })));

    tasks.forEach((task, index) => {
      let progress = 0;
      const timer = window.setInterval(() => {
        progress += 10 + Math.random() * 18;
        setTasks((current) =>
          current.map((item) =>
            item.id === task.id ? { ...item, progress: Math.min(progress, 100) } : item
          )
        );

        if (progress >= 100) {
          window.clearInterval(timer);
          setTasks((current) =>
            current.map((item) =>
              item.id === task.id ? { ...item, status: "completed", progress: 100 } : item
            )
          );
          if (index === tasks.length - 1) {
            setRunning(false);
          }
        }
      }, 220 + index * 80);
    });
  }

  async function startProcessing() {
    if (!window.mediaCompressor) {
      startMockProcessing();
      return;
    }

    const filePaths = tasks.map((task) => task.path).filter((item): item is string => Boolean(item));
    if (filePaths.length === 0) {
      setToast("拖拽文件没有拿到本地路径，请用选择文件添加。");
      return;
    }
    if (!outputDir || running) return;

    setRunning(true);
    setTasks((current) =>
      current.map((task) => ({ ...task, status: "processing", progress: task.path ? 35 : task.progress }))
    );

    const results = await window.mediaCompressor.processFiles({
      filePaths,
      outputDir,
      outputFormat,
      strength
    });

    setTasks((current) =>
      current.map((task) => {
        const result = results.find((item) => item.filePath === task.path);
        if (!result) return task;

        return {
          ...task,
          progress: 100,
          status: result.status,
          size: result.originalSize ?? task.size,
          outputPath: result.outputPath,
          outputSize: result.outputSize,
          reason: result.reason
        };
      })
    );
    setRunning(false);
  }

  function handleStartProcessing() {
    if (tasks.length === 0) {
      showEmptyToast();
      return;
    }

    if (window.mediaCompressor && !outputDir) {
      setToast("你还没选择输出地址呢");
      return;
    }

    void startProcessing();
  }

  return (
    <main className="app-shell">
      <section className="app-window" aria-label="媒体压缩转换器">
        <header className="app-header">
          <div className="brand-mark" aria-hidden="true">↧</div>

          <div className="header-copy">
            <h1>超级无敌图片视频压缩工具</h1>
            <p>批量处理图片与视频，格式变对，体积变小，文件只留在本地。</p>
          </div>

          <div className="header-actions">
            <span className="status-pill plan-pill">Free</span>
            <button className="icon-button" type="button" aria-label="设置">
              <span>⌘</span>
            </button>
          </div>
        </header>

        <div className="content-grid">
          <section
            className={`glass-panel drop-zone${dragging ? " dragging" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <div className="drop-tray">
              <div className={`drop-content${tasks.length > 0 ? " has-files" : ""}`}>
                {isSuccess ? (
                  <div className="success-burst" aria-hidden="true">
                    {Array.from({ length: 14 }).map((_, index) => (
                      <span key={index} />
                    ))}
                  </div>
                ) : null}
                <div className={`drop-icon${isSuccess ? " success" : ""}${isProcessing ? " processing" : ""}`} aria-hidden="true">
                  {isSuccess ? "✓" : isProcessing ? "↯" : tasks.length > 0 ? tasks.length : "＋"}
                </div>
                <div>
                  <h2 className={isProcessing ? "processing-title" : undefined}>
                    {isSuccess ? "压缩完成" : isProcessing ? processingPhrase : tasks.length > 0 ? "已添加素材" : "拖入图片或视频"}
                  </h2>
                  <p>
                    {isSuccess
                      ? "文件已处理完成，可以继续添加新的素材。"
                      : isProcessing
                        ? "素材正在处理中，请稍等片刻。"
                      : tasks.length > 0
                        ? "图片最多 8 张，视频最多 1 个"
                        : "支持 jpg、png、webp、mp4、mov、webm"}
                  </p>
                </div>

                {tasks.length > 0 ? (
                  <div className="preview-grid" aria-label="已上传素材预览">
                    {tasks.map((task) => (
                      <div className="preview-tile" key={`preview-${task.id}`}>
                        {!isProcessing && !isSuccess ? (
                          <button
                            className="preview-remove"
                            type="button"
                            aria-label={`删除 ${task.name}`}
                            onClick={() => removeTask(task.id)}
                          >
                            ×
                          </button>
                        ) : null}
                        {task.kind === "视频" ? (
                          <video src={task.previewUrl} muted playsInline preload="metadata" />
                        ) : task.previewUrl ? (
                          <img src={task.previewUrl} alt={task.name} />
                        ) : (
                          <span>{task.kind}</span>
                        )}
                        <div className="preview-name">{task.name}</div>
                      </div>
                    ))}
                  </div>
                ) : null}

                {isSuccess ? (
                  <button className="primary-button select-button" type="button" onClick={clearTasks}>
                    清空
                  </button>
                ) : (
                  <label className="primary-button select-button" onClick={window.mediaCompressor ? selectFiles : undefined}>
                    {tasks.length > 0 ? "继续添加" : "选择文件"}
                    {window.mediaCompressor ? null : (
                      <input
                        type="file"
                        multiple
                        hidden
                        accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
                        onChange={(event) => {
                          addFiles(event.target.files);
                          event.target.value = "";
                        }}
                      />
                    )}
                  </label>
                )}
                {notice ? <div className="upload-notice">{notice}</div> : null}
              </div>
            </div>
          </section>

          <aside className="glass-panel settings-panel">
            <div className="panel-heading">
              <span>处理设置</span>
            </div>

            <label className="field">
              <span>输出格式</span>
              <select value={outputFormat} onChange={(event) => setOutputFormat(event.target.value)}>
                {outputOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>压缩强度</span>
              <input
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={strength}
                style={{ "--range-progress": `${strengthProgress}%` } as React.CSSProperties}
                onChange={(event) => setStrength(event.target.value)}
              />
              <div className="range-labels">
                <span>高质量</span>
                <span>平衡</span>
                <span>小体积</span>
              </div>
            </label>

            <button className="secondary-button" type="button" onClick={selectOutputDirectory}>
              <span>{outputDir ? "已选择输出目录" : "选择输出目录"}</span>
              <span aria-hidden="true">…</span>
            </button>
            {outputDir ? <div className="path-hint">{outputDir}</div> : null}
            <button
              className={`primary-button full${tasks.length === 0 ? " is-idle" : ""}`}
              type="button"
              data-empty={tasks.length === 0 ? "true" : "false"}
              onClick={handleStartProcessing}
            >
              {running ? "处理中..." : "开始处理"}
            </button>
          </aside>
        </div>

        <section className="glass-panel queue-panel">
          <div className="panel-heading">
            <span>任务队列</span>
            <span>{summary}</span>
          </div>
          <div className="task-list">
            {tasks.length === 0 ? (
              <div className="empty-state">还没有文件。拖入一组素材，任务会出现在这里。</div>
            ) : (
              tasks.map((task) => (
                <article className="task-card" key={task.id}>
                  {!isProcessing && !isSuccess ? (
                    <button
                      className="task-remove"
                      type="button"
                      aria-label={`删除 ${task.name}`}
                      onClick={() => removeTask(task.id)}
                    >
                      ×
                    </button>
                  ) : null}
                  <div className="task-thumb" aria-hidden="true">
                    {task.kind === "视频" ? (
                      <video src={task.previewUrl} muted playsInline preload="metadata" />
                    ) : task.previewUrl ? (
                      <img src={task.previewUrl} alt="" />
                    ) : (
                      <span>{task.kind}</span>
                    )}
                  </div>
                  <div>
                    <div className="task-name">{task.name}</div>
                    <div className="task-meta">
                      {task.kind} · {task.size ? formatBytes(task.size) : "待读取"} ·{" "}
                      {task.status === "completed"
                        ? `完成，输出 ${task.outputSize ? formatBytes(task.outputSize) : ""}`
                        : task.status === "failed"
                          ? `失败：${task.reason ?? "未知错误"}`
                          : task.status === "processing"
                            ? "处理中"
                            : "等待处理"}
                    </div>
                  </div>
                  <div className={`progress-track${task.status === "completed" ? " completed" : ""}`} aria-label="进度">
                    <div className="progress-bar" style={{ width: `${task.progress}%` }} />
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </section>
      {toast ? <div className="toast-message" role="status">{toast}</div> : null}
    </main>
  );
}

const rootElement = document.querySelector("#root")!;
window.mediaCompressorRoot ??= createRoot(rootElement);
window.mediaCompressorRoot.render(<App />);

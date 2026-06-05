import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const videoExtensions = new Set([".mp4", ".mov", ".webm"]);
const ffmpegCandidates = [
  process.env.FFMPEG_PATH,
  process.resourcesPath ? path.join(process.resourcesPath, "ffmpeg") : undefined,
  "/opt/homebrew/bin/ffmpeg",
  "/usr/local/bin/ffmpeg"
].filter(Boolean);

function getImageFormat(filePath, requestedFormat) {
  if (["jpg", "jpeg", "png", "webp"].includes(requestedFormat)) return requestedFormat;
  const ext = path.extname(filePath).toLowerCase().replace(".", "");
  if (ext === "jpg" || ext === "jpeg") return "webp";
  if (ext === "png") return "webp";
  if (ext === "webp") return "jpg";
  return "webp";
}

function getVideoFormat(requestedFormat) {
  if (requestedFormat === "webm") return "webm";
  return "mp4";
}

function getQuality(strength) {
  const value = Number(strength);
  if (!Number.isFinite(value)) return 82;
  const clamped = Math.min(3, Math.max(1, value));
  return Math.round(92 - ((clamped - 1) / 2) * 22);
}

function getVideoCrf(strength, format) {
  const value = Number(strength);
  const clamped = Number.isFinite(value) ? Math.min(3, Math.max(1, value)) : 2;
  const normalized = (clamped - 1) / 2;
  const highQuality = format === "webm" ? 26 : 20;
  const smallSize = format === "webm" ? 38 : 31;
  return Math.round(highQuality + normalized * (smallSize - highQuality));
}

async function getAvailableOutputPath(outputDir, inputPath, format) {
  const parsed = path.parse(inputPath);
  const extension = format === "jpeg" ? "jpg" : format;
  let candidate = path.join(outputDir, `${parsed.name}_compressed.${extension}`);
  let index = 1;

  while (true) {
    try {
      await fs.access(candidate);
      candidate = path.join(outputDir, `${parsed.name}_compressed-${index}.${extension}`);
      index += 1;
    } catch {
      return candidate;
    }
  }
}

async function processImage(filePath, outputDir, outputFormat, strength) {
  const ext = path.extname(filePath).toLowerCase();
  if (!imageExtensions.has(ext)) {
    return {
      filePath,
      status: "failed",
      reason: "暂时只支持 jpg、png、webp 图片处理"
    };
  }

  const format = getImageFormat(filePath, outputFormat);
  const quality = getQuality(strength);
  const outputPath = await getAvailableOutputPath(outputDir, filePath, format);
  const inputStat = await fs.stat(filePath);
  let pipeline = sharp(filePath).rotate();

  if (format === "jpg" || format === "jpeg") {
    pipeline = pipeline.jpeg({ quality, mozjpeg: true });
  } else if (format === "png") {
    pipeline = pipeline.png({ compressionLevel: 9, quality });
  } else {
    pipeline = pipeline.webp({ quality });
  }

  await pipeline.toFile(outputPath);
  const outputStat = await fs.stat(outputPath);

  return {
    filePath,
    outputPath,
    status: "completed",
    originalSize: inputStat.size,
    outputSize: outputStat.size,
    savedBytes: inputStat.size - outputStat.size
  };
}

export async function resolveFfmpegPath() {
  for (const candidate of ffmpegCandidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Try the next known install location.
    }
  }

  return "ffmpeg";
}

export function runFfmpeg(executable, args) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(executable, args);
    let stderr = "";

    ffmpeg.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    ffmpeg.on("error", (error) => {
      reject(new Error(error.message.includes("ENOENT") ? "未找到 ffmpeg，请先安装 ffmpeg" : error.message));
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      const lastMessage = stderr.trim().split("\n").slice(-1)[0];
      reject(new Error(lastMessage || `ffmpeg 处理失败，退出码 ${code}`));
    });
  });
}

async function processVideo(filePath, outputDir, outputFormat, strength) {
  const ext = path.extname(filePath).toLowerCase();
  if (!videoExtensions.has(ext)) {
    return {
      filePath,
      status: "failed",
      reason: "暂时只支持 mp4、mov、webm 视频处理"
    };
  }

  const format = getVideoFormat(outputFormat);
  const crf = getVideoCrf(strength, format);
  const outputPath = await getAvailableOutputPath(outputDir, filePath, format);
  const inputStat = await fs.stat(filePath);
  const commonArgs = ["-y", "-i", filePath, "-map_metadata", "0"];
  const codecArgs =
    format === "webm"
      ? ["-c:v", "libvpx-vp9", "-crf", String(crf), "-b:v", "0", "-row-mt", "1", "-c:a", "libopus", "-b:a", "96k"]
      : ["-c:v", "libx264", "-preset", "medium", "-crf", String(crf), "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart"];

  const ffmpegPath = await resolveFfmpegPath();
  await runFfmpeg(ffmpegPath, [...commonArgs, ...codecArgs, outputPath]);
  const outputStat = await fs.stat(outputPath);

  return {
    filePath,
    outputPath,
    status: "completed",
    originalSize: inputStat.size,
    outputSize: outputStat.size,
    savedBytes: inputStat.size - outputStat.size
  };
}

export async function processMediaFile(filePath, outputDir, outputFormat, strength) {
  const ext = path.extname(filePath).toLowerCase();
  if (imageExtensions.has(ext)) return processImage(filePath, outputDir, outputFormat, strength);
  if (videoExtensions.has(ext)) return processVideo(filePath, outputDir, outputFormat, strength);

  return {
    filePath,
    status: "failed",
    reason: "暂时只支持 jpg、png、webp、mp4、mov、webm"
  };
}

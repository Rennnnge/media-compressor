import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { processMediaFile, resolveFfmpegPath } from "../electron/media-processor.js";

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args);
    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr.trim().split("\n").slice(-1)[0] || `${command} exited with ${code}`));
    });
  });
}

async function assertCompleted(result, expectedExtension) {
  if (result.status !== "completed" || !result.outputPath) {
    throw new Error(`Expected completed result, got ${JSON.stringify(result)}`);
  }

  const stat = await fs.stat(result.outputPath);
  if (stat.size <= 0) {
    throw new Error(`Output file is empty: ${result.outputPath}`);
  }

  if (path.extname(result.outputPath).toLowerCase() !== expectedExtension) {
    throw new Error(`Expected ${expectedExtension} output, got ${result.outputPath}`);
  }

  return {
    outputPath: result.outputPath,
    originalSize: result.originalSize,
    outputSize: result.outputSize,
    savedBytes: result.savedBytes
  };
}

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "media-compressor-verify-"));
const outputDir = path.join(tempDir, "output");
await fs.mkdir(outputDir);

const imageInput = path.join(tempDir, "sample-image.png");
await sharp({
  create: {
    width: 640,
    height: 360,
    channels: 4,
    background: "#007aff"
  }
})
  .composite([
    {
      input: Buffer.from(
        `<svg width="640" height="360"><text x="42" y="190" font-size="56" fill="white" font-family="Arial">Media Test</text></svg>`
      )
    }
  ])
  .png()
  .toFile(imageInput);

const ffmpegPath = await resolveFfmpegPath();
const videoInput = path.join(tempDir, "sample-video.mp4");
await run(ffmpegPath, [
  "-y",
  "-f",
  "lavfi",
  "-i",
  "testsrc=size=320x180:rate=24:duration=1",
  "-pix_fmt",
  "yuv420p",
  videoInput
]);

const imageResult = await processMediaFile(imageInput, outputDir, "auto", "2");
const videoResult = await processMediaFile(videoInput, outputDir, "mp4", "2");
const imageEvidence = await assertCompleted(imageResult, ".webp");
const videoEvidence = await assertCompleted(videoResult, ".mp4");

await sharp(imageEvidence.outputPath).metadata();
await run(ffmpegPath, ["-v", "error", "-i", videoEvidence.outputPath, "-f", "null", "-"]);

console.log(
  JSON.stringify(
    {
      status: "passed",
      tempDir,
      ffmpegPath,
      image: imageEvidence,
      video: videoEvidence
    },
    null,
    2
  )
);

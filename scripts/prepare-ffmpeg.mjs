import fs from "node:fs/promises";
import path from "node:path";

const projectRoot = new URL("..", import.meta.url);
const resourcesDir = new URL("../resources/", import.meta.url);
const targetPath = new URL("../resources/ffmpeg", import.meta.url);
const candidates = [
  process.env.FFMPEG_PATH,
  "/opt/homebrew/bin/ffmpeg",
  "/usr/local/bin/ffmpeg"
].filter(Boolean);

async function findFfmpeg() {
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Try the next candidate.
    }
  }

  throw new Error("未找到 ffmpeg。请先安装 ffmpeg，或设置 FFMPEG_PATH=/path/to/ffmpeg");
}

const ffmpegPath = await findFfmpeg();
await fs.mkdir(resourcesDir, { recursive: true });
await fs.copyFile(ffmpegPath, targetPath);
await fs.chmod(targetPath, 0o755);

console.log(
  JSON.stringify(
    {
      status: "prepared",
      projectRoot: path.normalize(projectRoot.pathname),
      source: ffmpegPath,
      target: path.normalize(targetPath.pathname)
    },
    null,
    2
  )
);

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const iconDir = "resources/icons";
const source = path.join(iconDir, "app-icon-source.png");
const preview = path.join(iconDir, "app-icon.png");
const iconset = path.join(iconDir, "app-icon.iconset");
const icns = path.join(iconDir, "app-icon.icns");
const sizes = [
  [16, "icon_16x16.png"],
  [32, "icon_16x16@2x.png"],
  [32, "icon_32x32.png"],
  [64, "icon_32x32@2x.png"],
  [128, "icon_128x128.png"],
  [256, "icon_128x128@2x.png"],
  [256, "icon_256x256.png"],
  [512, "icon_256x256@2x.png"],
  [512, "icon_512x512.png"],
  [1024, "icon_512x512@2x.png"]
];

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
      reject(new Error(stderr || `${command} exited with ${code}`));
    });
  });
}

await fs.rm(iconset, { force: true, recursive: true });
await fs.mkdir(iconset, { recursive: true });
await sharp(source).png().resize(1024, 1024, { fit: "cover" }).toFile(preview);

for (const [size, fileName] of sizes) {
  await sharp(source)
    .png()
    .resize(size, size, { fit: "cover" })
    .toFile(path.join(iconset, fileName));
}

try {
  await run("iconutil", ["--convert", "icns", "--output", icns, iconset]);
} catch (error) {
  console.warn(`iconutil skipped: ${error instanceof Error ? error.message.trim() : "unknown error"}`);
}

console.log(
  JSON.stringify(
    {
      status: "generated",
      preview,
      icns
    },
    null,
    2
  )
);

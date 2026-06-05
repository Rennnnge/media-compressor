# Media Compressor

本地图片和视频格式转换、压缩练手项目。

## 当前阶段

现在先做轻拟物 UI 原型和产品流程骨架。当前机器缺少 `npm` 和 `ffmpeg`，所以第一阶段先用纯 HTML/CSS/JS 预览界面；环境补齐后再升级为 Electron + React + Sharp + FFmpeg。

## MVP 范围

- 图片：`jpg / png / webp` 转换与压缩
- 视频：`mp4 / mov / webm` 转换与压缩
- 批量拖拽文件
- 输出目录选择
- 任务进度、成功/失败状态
- 压缩前后大小对比
- 轻拟物视觉风格

## 本机需要补齐

```bash
npm -v
ffmpeg -version
```

如果两条命令不可用，需要先安装 Node.js LTS 和 FFmpeg。

## 预览当前 UI 原型

```bash
cd media-compressor
python3 -m http.server 5173 -d src
```

然后打开：

```text
http://localhost:5173
```

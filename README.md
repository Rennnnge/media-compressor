# 超级无敌图片视频压缩工具

这是我这个体验设计师人生中第一个微产品，Codex打开了新世界的大门，amazing
一个运行在 macOS 本地的图片与视频压缩转换工具。它支持拖拽上传、批量图片处理、单视频处理、输出目录选择、任务队列和处理状态反馈。文件处理发生在本机，素材不会上传到云端。


## 功能

- 图片压缩与格式转换：`jpg`、`png`、`webp`
- 视频压缩与格式转换：`mp4`、`mov`、`webm`
- 批量图片处理，最多 8 张图片
- 单视频处理，最多 1 个视频
- 图片和视频类型互斥，避免混合任务造成误操作
- 本地输出目录选择
- 上传缩略图预览、任务队列、进度状态
- 压缩完成成功态与动效反馈
- macOS 风格桌面端界面

## 技术栈

- Electron
- React
- Vite
- TypeScript
- Sharp
- FFmpeg
- electron-builder

## 本地开发

安装依赖：

```bash
npm install
```

启动前端预览：

```bash
npm run dev
```

启动 Electron 桌面端：

```bash
npm run desktop
```

## 真实压缩测试

项目内置了媒体处理验证脚本，会生成测试图片和测试视频，并验证压缩输出是否可用。

```bash
npm run verify:media
```

## 打包 macOS 安装包

打包前需要本机可用的 FFmpeg：

```bash
ffmpeg -version
```

生成 `.app` 和 `.dmg`：

```bash
npm run dist:mac
```

打包产物会生成在：

```text
release/
```

说明：`release/` 和 `.dmg` 不提交到 GitHub。安装包建议通过 GitHub Releases 发布。

## 项目结构

```text
electron/          Electron 主进程、预加载脚本、媒体处理逻辑
src/               React 前端界面
scripts/           图标生成、FFmpeg 准备、媒体验证脚本
resources/icons/   应用图标资源
```

## 注意事项

- `node_modules/` 不提交到仓库，克隆项目后运行 `npm install`
- `resources/ffmpeg` 是本机打包时复制的二进制文件，不提交到仓库
- 图片和视频不要混合拖入，同一轮任务只处理一种媒体类型
- macOS 首次打开未签名应用时，可能需要在系统设置中允许打开

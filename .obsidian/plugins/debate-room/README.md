# 论场 · Obsidian 桌面插件

将完整的论场工作区放进 Obsidian 标签页：辩题讨论、多角色辩论、联网资料、赛后评审、分析助手、辩论训练、中英文及朗读均沿用原项目。

## 安装

1. 安装 Node.js 20 或更新版本。
2. 在项目根目录运行 `npm.cmd run build:obsidian`。
3. 将 **整个** `dist/debate-room` 文件夹复制到你的仓库 `.obsidian/plugins/debate-room`。必须包含 `runtime/`，不能只复制三个插件文件。
4. 重启 Obsidian，在「设置 → 第三方插件」中启用「论场 · Debate Room」。这是本地安装包，尚未发布到社区插件市场。
5. 点击左侧论场图标，或在命令面板执行「论场 · Debate Room：打开论场」。插件自动启动独立的本机服务，无需另外运行 `npm start`。

找不到 Node 时，在插件设置填写完整路径，例如 Windows 的 `C:\Program Files\nodejs\node.exe`，再点「重启」。macOS/Linux 如桌面应用没有继承 shell 的 PATH，也需填写 Node 完整路径。插件需要桌面文件系统与 Node 子进程，不支持手机端。

## 笔记与辩论

- **用当前笔记创建辩题**：在笔记中选中文字，再执行该命令；未选中文字时使用笔记文件名。仅传入最多 500 字的辩题，不自动上传整篇笔记。切到论场后，工具栏也可使用最近打开的 Markdown 笔记。
- **保存当前辩论到仓库**：先在论场创建或打开一场辩论，再点击工具栏或执行命令。发言、点评、共享资料和运行提示保存为 Markdown，默认在 `论场/`，可在设置更改目录。每次创建新文件，不覆盖已有笔记。正在生成的辩论也可保存当前快照。
- 模型连接在论场内「模型设置」配置。默认演示模式；支持 Ollama、兼容 API、MiMo Token Plan。模型及搜索密钥只在子进程内存中，重启后需重新填写。选择云端模型、搜索或 Edge 语音时，相关内容会发给相应服务，沿用项目 README 的数据说明。

## 运行与数据

插件在首次打开论场时启动 Node 服务，绑定 `127.0.0.1` 随机空闲端口，避免与网页版或其他仓库冲突。关闭标签页后服务继续运行，重新打开可查历史；关闭 Obsidian、禁用插件或重启服务时会停止生成并关闭服务，已完成发言保留，可继续辩论。

数据位于 `.obsidian/plugins/debate-room/runtime-data/store.json`；插件设置位于 `data.json`。安装包不包含原项目的 `data/store.json`、API 密钥、测试记录或 `.runtime`。更新时覆盖代码文件和 `runtime/`，保留 `runtime-data/` 与 `data.json`。已导出的 Markdown 是普通仓库笔记，可参与链接、搜索与备份。服务数据是否同步由你使用的同步工具决定。

默认 Edge 神经语音还需要 Python 与 `edge-tts`。在你的 Python 环境安装 `python -m pip install edge-tts`，在插件设置填该 Python 路径并重启；或在论场语音设置改用系统朗读。Obsidian 内语音输入依赖 Electron 是否支持 SpeechRecognition，不支持时使用文字输入。

## 开发与验证

插件入口源代码为 `obsidian-plugin/main.cjs`，无构建依赖；构建脚本复制入口为 `main.js` 并打包运行资源。`npm.cmd test` 包含现有业务测试及插件包/消息桥/服务生命周期测试。修改后重新构建并复制到测试仓库，可用 Obsidian CLI 的 `plugin:reload id=debate-room`、`dev:errors`、`dev:console level=error` 验证实际运行。

插件结构遵循 [Obsidian 官方插件开发文档](https://docs.obsidian.md/Plugins/Getting%20started/Build%20a%20plugin)。此版本采用嵌入现有应用与随附 Node 服务的桌面架构，不是移动端原生实现。

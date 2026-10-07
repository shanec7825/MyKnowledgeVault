# 注意力分配器 0.2.0

桌面 Obsidian 插件；安装目录就是当前目录。完整使用说明在知识库的 `wiki/meta/attention-allocator.md`。

## 开发

源文件：`plugin.js`（Thino 风格界面、日记、活动状态）、`core.js`（注意力过渡、QMD、Mem0、小米、图片接口）、`ui.css`。`main.js` 和 `styles.css` 为安装产物，不要直接编辑。

```powershell
node .obsidian/plugins/attention-allocator/build.cjs
node --check .obsidian/plugins/attention-allocator/main.js
node --test .obsidian/plugins/attention-allocator/core.test.js
```

无额外 npm 安装。QMD 复用 `.vault-meta/search` 的既有依赖与本地模型；Mem0 复用 `.vault-meta/memory` 的既有 HTTP 服务与启动脚本。日记用 Vault.process 追加，保留原文并去重；输出后更新日记目录并维护 QMD。单元测试含本机临时 HTTP 服务，需要允许本机连接。

在运行的 Obsidian 中使用 `plugin:reload id=attention-allocator`；Windows 控制台入口为 `C:/Program Files/Obsidian/Obsidian.com`。`live-check.js` 是可通过 CLI eval 执行的本地开发检查：真实检索与召回、模拟模型响应、开始/暂停/完成与落盘；结束时清除自身测试活动。无付费模型调用，也不写 Mem0 事实。

## 验证范围

已验证双语精简首页、动态日记卡片、番茄钟、真实 QMD 原文读取与文件跳转、Mem0 浏览筛选与召回、活动流程和本地持久化；32 项核心测试通过。2026-10-07 当前中国 Token Plan 与 mimo-v2.6-pro 的 SSE 流式结构化生成已实测成功，前端不展示原始 JSON，也不保存中断结果。套餐集群加入原生 web_search 会返回 400，因此仅在独立按量 API 下发送该工具；套餐保留资源搜索入口并明确提示，不自动切换付费地址。

首页为输入区与独立对话卡片，左右翻同日对话，上下换日期；可点击露边对话与下层日期纸片，带翻页动画，尊重减少动画设置。右上角中文 / EN 切换语言，记忆、检索、最近活动、资料库统一收进菜单。完整回复立即保存为 Me / AI callout，成功后清空提交输入，保留等待期间的新草稿。`cards-check.js` 验证真实界面卡片翻页、双语与草稿保留；`diary-check.js` 通过虚拟 Vault 验证生产日记写入、去重、原生 callout / 代码渲染及输入清理，不写真实测试日记。带插件标记的 callout 缩进可修正为独立引用块；不重写手写记录。

Memory 的 ChatGPT 导入入口支持粘贴、勾选复核、明确事实写入和文本去重，来源为 chatgpt-memory-import；当前未连接可读取 ChatGPT 保存记忆的数据源。导入写入、图片及独立按量联网仍仅有模拟验证，不用测试事实污染现有 Mem0。

活动与测试报告保存在被 Git 忽略的 `.vault-meta/attention-allocator/`。插件设置 `data.json` 被忽略；API Key 优先使用 Electron safeStorage 加密，不支持时仅保留会话，或使用环境变量。已保存的加密 Key 不适合跨机器同步。

新增 `interaction-check.js`：验证纯记录不调用模型、检索或 Mem0，等待期间新草稿保留，滚轮左右/上下翻页，以及点击外部空白收起菜单。测试使用虚拟写入，不写真实日记，不调用付费模型。纯记录正文在后续插件 AI 上下文与总结中排除，保留本地显示和索引；其他插件不受此约定限制。

Memory 窗口支持启动现有 Mem0、自动提取与提取最近对话；用户输入在有效回复后入队，实际反馈单独入队，AI 建议不作为用户事实。Context 将非 calendar 知识检索与最多两篇近期日记分组，历史来源保留原记录。

---
type: meta
title: Agent 搜索引擎
created: 2026-10-01
updated: 2026-10-07
tags:
  - meta
  - search
  - agent
---

# Agent 搜索引擎

Obsidian 内的使用入口：[[wiki/meta/attention-allocator|注意力分配器]]，复用本页的检索配置及现有本地 Mem0。

本库安装了 [QMD](https://github.com/tobi/qmd) 2.8.3，提供本地 SQLite FTS5/BM25 全文检索、中文语义检索、结构化混合检索、JSON 输出和 MCP。它直接读取原有 Markdown，不产生来源页副本。当前不是 Obsidian 内的搜索面板插件；关闭 Obsidian 后仍可检索。

## Agent 查阅流程

从知识库根目录运行，先读根目录 `AGENTS.md`；Claude 客户端同时读取 `CLAUDE.md`。领域入口按需要读取 [[drafts/EnglishLearning/README]]、[[Connections]]、[[MusicLearning/README]] 或 [[lessons/操作系统基础/实验参考指南与可视化索引]]。

```powershell
# 显式绑定本库，避免误用用户级默认索引
$env:QMD_CONFIG_DIR = Join-Path $PWD '.qmd'
$env:INDEX_PATH = Join-Path $PWD '.qmd/index.sqlite'
$env:QMD_TRUST_LOCAL_CONFIG = '1' # 仅用于本库已核查的本地配置

# 笔记可能变化时，先增量刷新一次
npm.cmd run --silent qmd -- update

# 已知关键词：快，不需要加载模型
npm.cmd run --silent qmd -- search "神经可塑性" --json -n 8

# 换一种措辞查相关概念：使用本地中文嵌入模型
npm.cmd run --silent qmd -- query "vec: 如何让学习效果保持得更久" --no-rerank --json -n 8

# Agent 自己提供关键词和语义表达，免下载扩写/重排模型
$query = "lex: 间隔 学习`nvec: 如何让学习效果保持得更久"
node .vault-meta/search/node_modules/@tobilu/qmd/dist/cli/qmd.js query $query --no-rerank --json -n 8

# 使用实际返回的 docid；只读需要的行
npm.cmd run --silent qmd -- get "#d7065e" --from 15 -l 50

# 健康检查
npm.cmd run --silent qmd -- status
```

返回 docid、原文路径、标题、摘要、上下文及分数。候选摘要用于定位；事实、引用与结论应读取原文再给出，引用真实 vault 路径和行号。分数用于排序，不当作事实置信度。默认只取 5–10 个候选，再沿双链查阅，不把整库塞进上下文。

`get` 的例子 ID 对应安装时的笔记；内容改变后 ID 可能改变，应使用最新检索结果。

## 收录范围

配置文件为 `.qmd/index.yml`。`vault` collection 收录 `lessons/`、`words/`、`EnglishLearning/`、`calendar/`、`wiki/`、`MusicLearning/`、`全国大学生数学竞赛/`、`drafts/` 及根目录 Markdown；`raw` collection 单独收录 `.raw/captured/**/*.md`。目录上下文帮助 agent 区分学习笔记、未完成草稿与原始证据。新增其他内容目录时，应同步扩展配置中的 pattern 和 context。

排除隐藏配置、会话、插件、缓存、`.raw/captured/` 之外的隐藏原始资料目录及 Excalidraw 压缩绘图文件。当前配置只收录上述范围的 Markdown，不读取 PDF 正文、图片 OCR、HTML 页面或压缩绘图内部文字。精确字符串核验和未收录内容仍使用 `rg` 或直接读文件。

## 增量更新与规模

```powershell
$env:QMD_CONFIG_DIR = Join-Path $PWD '.qmd'
$env:INDEX_PATH = Join-Path $PWD '.qmd/index.sqlite'
$env:QMD_TRUST_LOCAL_CONFIG = '1' # 使用已经安装的本地 Qwen 模型
npm.cmd run --silent qmd -- update
npm.cmd run --silent qmd -- embed --max-docs-per-batch 16 --max-batch-mb 8
npm.cmd run --silent qmd -- status
```

`update` 识别新建、修改和删除；`embed` 只处理缺失或变化的向量。没有常驻文件监听。Agent 在新建、修改、移动或删除收录范围内的 Markdown 后，必须在该批次结束时依次执行上述三个命令，并检查退出码和 Pending 数。仅刷新全文索引并不会自动刷新语义向量。失败时报告实际状态，不宣称更新成功。

上述信任设置针对已经核查的本库配置：collection 路径位于本库内，嵌入模型为已有本地 GGUF，未配置外部更新命令。若配置被修改或从其他项目导入，应先重新检查路径、模型和更新命令；不要直接沿用信任设置。未信任时 QMD 会跳过指定模型，可能改用需要下载的默认模型。

目录页与搜索数据库分别维护：新增英语学习笔记时补充 [[drafts/EnglishLearning/README]]，相关概念联系按内容更新 [[Connections]]；其他领域按已有入口组织。目录页是 Markdown 链接列表，不会因新增文件自动添加链接。Obsidian 的链接与属性缓存、Dataview 的事件索引也不会代替 QMD 刷新。

若 `status` 显示孤立向量，可先运行 `npm.cmd run --silent qmd -- cleanup --dry-run` 查看计划，再运行 `npm.cmd run --silent qmd -- cleanup` 清理生成数据。原始 Markdown 不属于清理对象。清理后再次检查状态。

2026-10-07 更新前核查收录 193 篇 Markdown（`vault` 104、`raw` 89），路径与正文哈希均匹配现有文件；141 篇等待生成向量。这是更新前的诊断快照，实时规模与完成状态以 `qmd status` 为准。尚未做十万篇规模压测。大规模使用应保持增量索引和有限 top-k，按需要拆分 collection；批次限制控制单次嵌入的内存占用。不要为日常检索运行 `embed -f`。

## 模型与本地数据

中文模型：[Qwen3-Embedding-0.6B-GGUF](https://huggingface.co/Qwen/Qwen3-Embedding-0.6B-GGUF)，Q8_0，639,150,592 字节，官方 HTTPS 下载。本机 RTX 4060 Laptop GPU，安装时全部嵌入耗时约 1 分 56 秒。

- 引擎：`.vault-meta/search/node_modules/@tobilu/qmd/`，版本固定为 2.8.3。
- 模型：`.vault-meta/search/models/Qwen3-Embedding-0.6B-Q8_0.gguf`。
- 配置：`.qmd/index.yml`；绝对路径绑定当前 Windows 知识库位置。
- 索引：`.qmd/index.sqlite`；包含笔记内容，留在本机并被 Git 忽略。
- 可移植的配置、命令入口和文档可提交；依赖、模型、索引和 `.mcp.json` 不提交。

当前已经安装并验证 BM25 与语义检索。直接运行未加类型的 `query "自然语言"` 会启用自动扩写和重排，可能另外下载约 1.7 GB 的模型；本次没有安装这两个模型。`vsearch` 在此版本也会调用扩写模型。默认使用上面的 `search` 或结构化 `query --no-rerank`。Windows 的 npm.cmd 会破坏多行参数；多行混合查询请按示例直接调用 Node，或通过 MCP 传 searches 数组。

迁移路径或模型时更新配置并运行 `trust`；改变嵌入模型后必须重新 `embed -f`，不同模型的向量不可混用。不要把本次配置原样用于另一台机器。

## MCP 接入

根目录 `.mcp.json` 已配置 `qmd` stdio 服务器，使用 Node 绝对路径启动已安装引擎，并显式设置本库的 `QMD_CONFIG_DIR` 与 `INDEX_PATH`。兼容客户端刷新 MCP 配置后可以接入；此文件不会自动把服务器注册进所有 agent 客户端。

提供 `query`、`get`、`multi_get`、`status`，不提供 update 或 embed 工具。MCP 接入不会自动刷新索引，维护仍通过上述本地命令执行。安装时已验证真实 MCP 初始化、工具发现和中文关键词查询。

快速查询参数：

```json
{
  "searches": [{"type": "lex", "query": "神经可塑性"}],
  "collections": ["vault"],
  "limit": 8,
  "rerank": false
}
```

混合检索可添加 `{"type":"vec","query":"如何让学习效果保持得更久"}`；保持 `rerank:false` 即可使用已安装模型。检索源文档请再调用 `get`，按需设置 `fromLine` 与 `maxLines`。

## 恢复与卸载

重新安装引擎：

```powershell
npm.cmd install --prefix .vault-meta/search --save-exact @tobilu/qmd@2.8.3
npm.cmd run --silent qmd -- trust
npm.cmd run --silent qmd -- update
npm.cmd run --silent qmd -- embed
```

上述安装不自动恢复模型文件；如模型缺失，从官方模型页下载同名 GGUF 到配置路径，再运行 embed。全文搜索无需模型即可工作。

卸载时移除 `.mcp.json` 中的 qmd 项与 `package.json` 中的 qmd script，随后可移除 `.qmd/` 和 `.vault-meta/search/`。这两处均为搜索配置或生成数据，原始知识笔记在原目录。

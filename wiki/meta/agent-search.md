---
type: meta
title: Agent 搜索引擎
created: 2026-10-01
updated: 2026-10-01
tags:
  - meta
  - search
  - agent
---

# Agent 搜索引擎

本库安装了 [QMD](https://github.com/tobi/qmd) 2.8.3，提供本地 SQLite FTS5/BM25 全文检索、中文语义检索、结构化混合检索、JSON 输出和 MCP。它直接读取原有 Markdown，不产生来源页副本。当前不是 Obsidian 内的搜索面板插件；关闭 Obsidian 后仍可检索。

## Agent 查阅流程

从知识库根目录运行，先读 OVERVIEW.md 和 CLAUDE.md。

```powershell
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

配置文件为 `.qmd/index.yml`。收录 `wiki/`、`inbox/`、`calendar/`、`drafts/` 及根目录 Markdown；为概念、原文、归档和日记添加上下文说明，帮助 agent 判断来源性质。

排除隐藏配置、会话、插件、缓存、`.raw/`、回收站、模板及 Excalidraw 压缩绘图文件。当前仅索引 Markdown 文本，不读取 PDF 正文、图片 OCR 或压缩绘图内部文字。精确字符串核验和未收录内容仍使用 `rg` 或直接读文件。

## 增量更新与规模

```powershell
npm.cmd run --silent qmd -- update
npm.cmd run --silent qmd -- embed --max-docs-per-batch 16 --max-batch-mb 8
```

`update` 识别新建、修改和删除；`embed` 只处理缺失或变化的向量。没有常驻文件监听：agent 在可能发生修改后先刷新；批量导入后依次运行以上两个命令。仅刷新全文索引并不会自动刷新语义向量。

安装验收时收录 169 篇文档，生成 924 个向量片段。这是当前小库的实测，尚未做十万篇规模压测。大规模使用应保持增量索引和有限 top-k，按需要拆分 collection；批次限制控制单次嵌入的内存占用。不要为日常检索运行 `embed -f`。

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

提供 `query`、`get`、`multi_get`、`status`。安装时已验证真实 MCP 初始化、工具发现和中文关键词查询。

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

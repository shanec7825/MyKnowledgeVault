# MyKnowledgeVault 规范（极简版）

> Agent 入口：先读根目录 **OVERVIEW.md**（全局地图），再按需跳转到领域与项目。本文件只定规则，2026-08-29 起生效；此前的脚手架（账本、模板、脚本、Dataview 查询、address 编号、HTML 成果页）已全部拆除，**不要重建**。

## 1. 目录结构

```
MyKnowledgeVault/
├── OVERVIEW.md            全局地图（agent 入口，领域/项目变动时同步更新）
├── CLAUDE.md              本规范
├── inbox/                 源文档（原文 / 剪藏），保留原文
├── wiki/
│   ├── areas/             领域页（无终点：active / dormant / evergreen）
│   ├── projects/          项目页（有终点：active / paused / completed）
│   ├── archives/          已完结项目
│   └── resources/         消化与精读材料：concept/ 概念页 · resource/ 精读原文 · words/ 精读单词
├── calendar/              日记（YYYY-MM-DD.md）
└── Excalidraw/            图示源文件
```

## 2. 层级判定

有明确完成日期和交付物 → **project**；只有方向 → **area**；一个可复用的知识点 → **concept**（放 resources/concept）。

## 3. Frontmatter（最简，够用就好）

```yaml
# area
type: area / title / created / updated / status / tags / related（指向核心 project）

# project
type: project / title / created / updated / status / area: "领域名" / goal / prerequisites / code / related（指向概念页）/ tags

# concept
type: concept / title / created / updated / status / tags / related

# resource（精读原文 / 单词页）
type: resource / title / created / updated / related / tags
```

## 4. 规则

1. **双链优先**：层间关系一律用 `[[wiki/areas/xxx]]` 这类双链，写在 frontmatter `related` 和正文 Related 段。不用 Dataview、查询块、账本或任何自动关联机制。
2. **inbox 放源文档，concept 放消化产出**：源文档留在 inbox 不删；读完用自己的话写成 `wiki/resources/concept/<主题>.md`，**不复制原文、不建来源页副本、不建 entity/ 等多余分层**。英文精读例外：原文放 `wiki/resources/resource/`、配套单词放 `wiki/resources/words/`；inbox 其余源文件保持原位。
3. **先查后建**：新建任何文件前先全局搜索，避免重复。
4. **git 纪律**：移动用 `git mv`；一批改动完成后提交。写文件用 LF 换行（Python 脚本 `newline="\n"`）。
5. **完结归档**：project 交付物全部勾选后 `status: completed`，`git mv` 进 `wiki/archives/`，并更新 OVERVIEW.md 的领域地图。
6. **谨慎删除**：不做批量删除；确要清理先向用户列出清单确认。
7. **记录**：每次整理后把做了什么追加到 `.workbuddy/memory/YYYY-MM-DD.md`。

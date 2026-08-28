# MyKnowledgeVault 规范

> 本文件是知识库（Obsidian vault）的机器可读规范。任何 AI agent 在整理、写入、移动本库文件前**必须先读本文件**，并按此执行。人类用户修改本文件即等于修改规则。

## 0. 核心原则

- **笔记不是代码仓库**。代码、数据集、大体积二进制一律留在库外（`D:/projects`），库内只存**指针 + 认知产出**。
- **宏观与微观分离**：`areas` 管方向（无终点），`projects` 管交付（有终点），`resources` 管可复用的细粒度知识（无状态）。三者靠 Dataview 自动关联，不靠手工维护链接表。
- **一切可检验**：project 必须有 `goal` 和「完成标准」清单；没有完成标准的不是 project，降级为 area 或归档。
- **先查后建**：新建任何文件前先全局搜索是否已有同类条目，避免重复。

## 1. 目录结构

```
MyKnowledgeVault/
├── CLAUDE.md              本规范（agent 入口）
├── scripts/               库维护脚本（gen-area-html.py 等）
├── wiki/
│   ├── areas/             长期关注领域，一个领域一个 .md + 同名 .html 成果页
│   ├── projects/          有交付目标的项目笔记，平铺 .md，不建子目录
│   ├── archives/          已完结（status: completed）的项目，从 projects/ 移入
│   ├── resources/         可被检索查阅的细粒度知识
│   │   ├── concept/       概念综合页 type: concept
│   │   ├── resource/      来源/原文笔记 type: source
│   │   └── entity/        人物/组织/工具/论文条目 type: entity
│   └── meta/              账本、映射表等元数据（ledgers/、code-repos.md）
├── inbox/                 未分类速记，处理后清空到对应层
├── drafts/                写作草稿与中间产物
├── calendar/              日记（YYYY-MM-DD.md）
├── Excalidraw/            绘图源文件（导出 PNG/SVG 到同目录即可被成果页嵌入）
├── templates/             Obsidian Templater 模板
└── .raw/                  Obsidian 忽略，抓取的原文与克隆的仓库
```

### 库外约定（重要）

**项目代码一律放 `D:/projects/<项目名>/`，不进本库。** 需要在笔记中引用时：

1. project 的 frontmatter 写 `code: ["D:/projects/<项目名>"]`；
2. 正文用 `> [!info] 代码位置` callout 写明绝对路径；
3. 需要少量代码片段时，贴关键片段（几十行内）并在其上方注明源文件相对路径，禁止整份拷贝。

`D:/projects` 与 `wiki/projects` 的对应关系维护在 [[wiki/meta/code-repos]]。

## 2. 四层语义与判定

| 层             | 判定问题           | 有终点？ | 状态流转                                                     |
| ------------- | -------------- | ---- | -------------------------------------------------------- |
| **areas**     | 我想长期在这个方向上保持水准 | 否    | `active → dormant`（永不 completed）                         |
| **projects**  | 我要交付什么、何时算完    | 是    | `active → completed → archives/`；也可 `paused` / `dropped` |
| **archives**  | 已交付完结          | 已结束  | 只读，不再编辑（可补 `\n\n> 归档后记` ）                                |
| **resources** | 这个知识点以后还会被查    | 否    | `developing → mature`；无状态要求                              |

**判定口诀**：有明确完成日期和交付物 → project；只有方向 → area；一个可复用的知识点 → resource。

## 3. Frontmatter 字段规范

### Project（`wiki/projects/*.md`）

```yaml
---
type: project
title: "项目名"
created: YYYY-MM-DD
updated: YYYY-MM-DD
status: active            # active | paused | completed | dropped
area: "<areas 页文件名，不含 .md>"   # 必填，供 Dataview 匹配，如「人工智能」
domain: machine-learning  # 可选细分标签
complexity: intermediate  # beginner | intermediate | advanced
goal: "一句话说明交付什么"
prerequisites:            # 前置 project，做这个之前必须先完成的
  - "[[wiki/projects/xxx]]"
code:                     # 库外代码路径
  - "D:/projects/xxx"
sources:                  # 支撑来源（resources/resource 下的页）
  - "[[某来源页]]"
related:                  # 相关概念页 / 其他 project
  - "[[某概念页]]"
tags:
  - project
---
```

**正文固定四段**（顺序即阅读顺序，不要调换）：

| 小节 | 写什么 |
|---|---|
| `## 前置` | **前置项目**（同步 frontmatter `prerequisites`）+ **知识框架体系**：完成此项目需要掌握的知识结构，按概念层 / 技能层 / 工具层列要点，链接到 `wiki/resources/concept/` |
| `## 目标产出` | 一句话目标（同步 `goal`）+ **交付物**勾选清单；最后一条固定为「全部完成后：`status: completed` → 移入 `wiki/archives/`」 |
| `## 项目关键点` | 这个项目的核心内容与关键难点，几条即可，写「为什么这里难」而不是抄目录 |
| `## 自动关联` | 四个 Dataview 查询（见第 4 节），勿手工编辑 |

### Area（`wiki/areas/*.md`）

```yaml
type: area
title: "领域名"
created: / updated:
status: active            # active | dormant | evergreen
tags: [area, ...]
related: []               # 指向该领域下的核心 project
```

**正文固定三段**：

| 小节 | 写什么 |
|---|---|
| `## 领域概览` | **特征**（最突出的性质、推进方式、难点）+ **目标**（聚焦最核心最长远的那一个，宏观视角写成一段，要能回答「十年后为什么还在乎它」，不列任务清单）+ **范围**（子主题清单） |
| `## 进展概览` | 分 `### 已知`（已掌握 / 已完成）与 `### 未知`（待学、待解，用 `- [ ]` 清单） |
| `## 进行中的项目` | Dataview 自动列出（见第 4 节） |

**Area 页不做知识容器**：不堆概念解释、不列资源清单、不放已完结项目列表 —— 知识沉淀到 `resources/`，已完结项目由同名 `.html` 成果页承载。
需要概念或资源时，走 `resources/` 的检索或 project 页的关联，不要在 area 页维护链接表。

### Resource（`wiki/resources/**`）

```yaml
type: source | concept | entity
title: "..."
created: / updated:
status: developing        # developing | mature | active
sources: []               # 该页的出处（source 页可为空）
related: []
tags: [source|concept|entity, ...]
```

`source` 页另需 `address: c-0000xx`（由 `wiki/meta/ledgers/` 分配，存量沿用）。

## 4. Dataview 关联规范

Dataview 插件已启用。**area ↔ project 的关联一律用 Dataview 自动生成，禁止手工维护项目列表**，否则必然腐化。

### Area 页自动列出进行中的 project

**一律使用 DataviewJS，不用 DQL**：

```text
```dataviewjs
const AREA = "后端";
const rows = dv.pages('"wiki/projects"')
  .where(p => p.area === AREA && p.status !== "completed")
  .sort(p => p.updated, "desc")
  .map(p => [p.file.link, p.goal || "", p.status || "", p.updated || ""]);
dv.table(["项目", "交付主线", "状态", "更新"], rows);
```
```

理由与纪律：

1. **领域名硬编码在 `const AREA`**，禁止 `dv.current().file.name` —— `this`/`current()` 在悬浮预览、嵌入场景会指向别的文件，曾导致 area 页检索出其他领域的项目。
2. **用 JS 而不是 DQL**：本 vault 的领域名与字段值都是中文，DQL 的 `WHERE area = "后端"` 与 `FROM #area/后端` 在本库实测均失效（返回空/报错），而 JS 的 `p.area === AREA` 字符串比较是原生可靠的。
3. 新建 area 后确认 `const AREA` 已被替换（模板用 `{{title}}`）。
4. **已完结项目不出现在 area 页** —— 它们由 `wiki/areas/<领域>.html` 成果页承载（见第 5 节）。

### Dataview 不工作的排查清单（按顺序，别跳步）

1. **先验证索引**：在任意笔记贴 `LIST FROM "wiki/projects"`（无 WHERE）。
   - 显示 14 行 → 索引正常，问题在查询语法 → 改用 DataviewJS。
   - 显示 0 行 → Dataview 没索引到该目录，往下查。
2. 检查 `.obsidian/app.json` 的 `userIgnoreFilters` 是否排除了目标目录（本库排除了 `.raw/`、`.vault-meta/`）。
3. 检查 frontmatter 是否可解析：用 PyYAML 逐个 `yaml.safe_load(frontmatter)` 验证；同时查 tab、中文引号、BOM 等隐蔽字符（js-yaml 比 PyYAML 严格）。
4. 数据正确但渲染不对 → Obsidian 缓存：Ctrl+P 执行「Reload app without saving」；注意这会丢弃未保存的编辑。
5. 仍不行 → 检查 Dataview 版本（本库 0.5.68）与插件启用状态。

### Project 页自动列出前置 / 后继

后继（谁依赖我）：

```text
LIST
FROM "wiki/projects"
WHERE contains(prerequisites, this.file.link)
```

前置（我依赖谁，直接展平自身字段）：

```text
LIST WITHOUT ID P
FROM "wiki/projects"
WHERE file.path = this.file.path
FLATTEN prerequisites AS P
```

### Project 页自动列出关联知识

本项目声明的来源与概念（正向展平 `sources` + `related`）：

```text
LIST WITHOUT ID R
FROM "wiki/projects"
WHERE file.path = this.file.path
FLATTEN (sources + related) AS R
SORT R ASC
```

反向引用本项目的资源（resources 侧指回来）：

```text
LIST
FROM "wiki/resources"
WHERE contains(related, this.file.link) OR contains(sources, this.file.link)
SORT file.name ASC
```

> 存量 project 页末尾已统一追加「## 自动关联」区，含上述四个查询；新建 project 用 [[templates/project]] 即可。

### 全局导航（放在 `wiki/meta/` 或日记模板）

```text
TABLE area AS 领域, status AS 状态, updated AS 更新
FROM "wiki/projects"
WHERE status = "active"
SORT area ASC, updated DESC
```

## 5. 归档流程（project → archives）

1. 交付物清单全部勾选；
2. frontmatter 改 `status: completed`，更新 `updated`；
3. `git mv wiki/projects/X.md wiki/archives/X.md`（若项目有附属资产，一并移入 `wiki/archives/<同名目录>/`）；
4. 在文件末尾追加 `## 归档小结`：交付了什么、耗时、可复用的经验、遗留问题（这段会被成果页读取展示）；
5. 检查正文中的 `[[wiki/projects/X]]` 链接失效，批量替换为 `[[wiki/archives/X]]`；
6. **重跑领域成果页脚本**：`python scripts/gen-area-html.py`。

反向操作（复活）：`status: active` 后移回 `wiki/projects/`，清掉归档小结，重跑脚本。

## 5.1 领域成果页（`wiki/areas/<领域>.html`）

每个 area 有一个同名 HTML，承载**已完结项目 + 相关图示**，由脚本生成：

```bash
python scripts/gen-area-html.py
```

- 数据源：`wiki/areas/*.md` 的「## 领域概览」与「进展概览（已知/未知）」+ `wiki/projects/` 的进行中项目 + `wiki/archives/**/*.md` 的 frontmatter 与「## 归档小结」+ `Excalidraw/` 目录扫描。每领域一套主题色与图形母题（后端=蓝/网络，人工智能=紫/神经层，认知=青/神经元），杂志式科普排版。
- 按 project 的 `area` 字段分组归档项目；`goal` 为空时回退 `description`。
- **图示**：Excalidraw 源文件会被列出；把导出的 PNG/SVG 放到 `Excalidraw/` 同名路径即可自动嵌入。
- 生成物**勿手工编辑**，改动回源 md 后重跑脚本。

## 6. Agent 操作纪律

1. **先读本文件 + `templates/`**，再动手。
2. **移动文件用 `git mv`**，保持历史；仓库已启用 git。
3. **改 frontmatter 时保留未知字段**，不要顺手删除没见过的键。
4. **不要重命名他人笔记的标题**除非用户要求；重命名后必须全局替换双链。
5. **禁止批量删除**。清理走 `wiki/archives/` 或 `.trash/`。
6. **单次改动超过 10 个文件时**，先向用户报告计划再执行。
7. **写文件保持 LF 换行**（本库绝大多数文件为 LF；Python 脚本写入时务必 `newline="\n"`，否则会把文件改成 CRLF）。
8. **不要在 area 页加资源/概念清单**，也不要在 area 页列已完结项目 —— 前者靠 `resources/` 检索，后者归 `.html` 成果页。
9. 完成整理后，把本次做了什么追加到 `.workbuddy/memory/YYYY-MM-DD.md`。

## 7. 常用入口

- 领域导航：[[wiki/areas/README]]
- 代码仓库映射：[[wiki/meta/code-repos]]
- 项目模板：[[templates/project]]、[[templates/area]]

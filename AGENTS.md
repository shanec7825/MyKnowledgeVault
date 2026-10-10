# Knowledge vault agent instructions

This workspace is a Chinese-first Obsidian knowledge vault. Read `wiki/meta/agent-search.md` for search configuration and commands. Preserve existing notes and unrelated user changes.

## 学习知识库的组织约定（默认原则，可灵活调整）

**核心思想：稳定结构放领域，真实进展放日期，使用双链建立联系；少维护重复状态。** 这是帮助查找和持续学习的默认做法，不是需要机械执行的文件模板。优先尊重用户当次要求、实际课程目录和已有资料，不为“统一格式”大规模重构。

- **领域/课程目录**：课程目标、阶段路线、能力标准、概念地图、长期可复用的教程或作品，尽量就近保存在该课程目录，例如 `lessons/数字逻辑与系统/课程阶段.md`。目录名与层级不是固定规范；已有课程在其他目录时沿用现状。阶段可以增删、合并、重新排序，允许交叉学习，不以阶段序号推断先修内容已经掌握。
- **按日期记录学习事实**：当天真正研究的问题、作业、首次独立尝试、反馈、错误、证据和下一次启动线索，可记录在 `calendar/YYYY-MM-DD.md` 的一个清晰小标题下。优先在已有日记中追加小节并保留原文；不要为了每一条交流或普通阅读强制写日志，也不要求每日计划、固定学习时长或完整打卡。计划与实际完成应清楚区分。
- **课程阶段链接到日记的具体事件**：在相关阶段留下简短、可点击的学习证据入口，例如 `[[calendar/2026-10-10#21:57 · 数字逻辑与系统｜数据选择器（MUX）家庭作业学习启动|2026-10-10 · MUX 习题]]`。尽量使用真实、稳定、能唯一定位的 Markdown 标题；新增日记后检查链接所指标题确实存在。旧记录继续保留，允许一个阶段关联多天、多种证据。
- **双向可追溯，不双份维护**：日记小节可反向链接课程阶段，例如 `[[lessons/数字逻辑与系统/课程阶段#阶段 3｜组合模块|阶段 3 · 组合模块]]`。课程阶段以相对稳定的目标/范围/验收要求为主；“当前在做什么、做到哪里、是否独立验证、下一步是什么”等动态事实主要由日记承载，不必再维护另一份实时状态面板或课程卡 YAML。若有可靠的自动汇总，可从日记/证据生成视图，而非手工重复写同样的结论。
- **证据优于形式**：提及、阅读、AI 生成、独立推演和实际验证是不同层次，不能自动把“讨论过”记为“掌握”。有价值的记录可以只有一行关键错误、一道作业链接或一个测试结果；深入学习时再扩充。需要长篇复用说明、代码、图片或交互资料时，放进最合适的课程/资源位置，并从日记链接过去。
- **旧结构和例外**：`drafts/计划与目标/` 是曾经使用过的组织方式，不再视为新课程默认存放处或权威进度来源。不要因本约定批量移动、改写或删除其中及其他目录的历史资料；仅按实际需要渐进迁移并修复引用。非课程项目、零散想法、长期研究、无需当天进度的资料，可以采用更合适的组织形式。用户明确指定其他结构时以用户要求为准。

**完成相关写入时**：检查新建文件是否重复、阶段与日记小标题链接是否可定位、是否保留既有内容；只维护真正有用的导航页，不自动创造第二套目标/计划/状态体系。后续可以根据使用摩擦简化甚至调整本规则。

## Search before writing

- Search existing notes before creating a new note. Use QMD keyword search or typed `lex`/`vec` queries with `--no-rerank`; do not trigger model downloads for routine lookups.
- Run commands from the vault root. Set `QMD_CONFIG_DIR` to `<vault>/.qmd` and `INDEX_PATH` to `<vault>/.qmd/index.sqlite` explicitly.
- If files may have changed since indexing, run `qmd update` before searching. Before relying on semantic results, run `qmd embed` if status reports pending embeddings.
- Read original notes after retrieving candidates. Cite real vault paths; search scores are ranking signals, not factual confidence.
- PDF, images, HTML and Excalidraw payloads are outside QMD's current text coverage. Use appropriate direct inspection for them.

## Finish every note-writing batch

After creating, editing, moving or deleting Markdown covered by `.qmd/index.yml`:

1. Maintain the relevant human navigation pages. New English daily notes belong in `EnglishLearning/README.md`; update `EnglishLearning/Connections.md` when the content supplies useful cross-note connections. Maintain other existing domain entry pages as appropriate.
2. From the vault root, run:

   ```powershell
   $env:QMD_CONFIG_DIR = Join-Path $PWD '.qmd'
   $env:INDEX_PATH = Join-Path $PWD '.qmd/index.sqlite'
   # This vault's reviewed config uses the existing local Qwen GGUF model.
   $env:QMD_TRUST_LOCAL_CONFIG = '1'
   npm.cmd run --silent qmd -- update
   npm.cmd run --silent qmd -- embed --max-docs-per-batch 16 --max-batch-mb 8
   npm.cmd run --silent qmd -- status
   ```

3. Check each command's exit code; stop dependent steps if a command fails. Confirm `Pending: 0` before claiming semantic indexing is complete. If maintenance cannot finish, report what succeeded and what remains.
4. If orphaned vectors are reported, inspect `qmd cleanup --dry-run` before cleaning generated data with `qmd cleanup`; then check status again.

Do this once after the batch's final edits, including navigation or instruction edits, rather than after each file. Read-only work does not require rebuilding an already-current index. Do not routinely use `embed -f`.

## Coverage and automation limits

`vault` covers the configured Markdown content folders and root notes; `raw` covers `.raw/captured/**/*.md`. Add new content folders to the pattern and context when expanding coverage.

The trust setting applies to the reviewed `.qmd/index.yml` in this vault, whose collections stay inside the vault and whose embed model is already installed locally. Re-review paths, models and any update commands before trusting a changed or imported configuration. Without trust, QMD skips the configured embed model and may select a downloadable default.

These instructions require agents to run maintenance; they do not install a filesystem watcher. QMD MCP exposes query/get/multi_get/status only. Obsidian and Dataview cache updates do not refresh QMD or write human navigation pages.

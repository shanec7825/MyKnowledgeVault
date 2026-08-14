# claude-obsidian ingest 操作备忘（vault 本地）

> 用途：本 vault 任何「ingest 文档/URL」任务。会话开始时读本文件一次即可，
> 无需再读插件契约全文。自包含、无任何外部引用，删除不影响 vault 架构。

## 0. 环境（Windows 宿主）

- Git Bash 的 python3（mingw64）**没有 fcntl** → 引擎必须走 WSL 执行。
- 每条引擎命令用 `wsl -e bash -lc '...'` 包裹（防 MSYS 改写 `/mnt/c/...` 路径）。
- `VAULT=/mnt/c/Users/Lenovo/Documents/MyKnowledgeVault`
- `CORE=$(find ~/.claude/plugins/cache/agricidaniel-claude-obsidian -name claude-obsidian.py | sort | tail -1)`（插件版本目录可能更新）
- wsl 输出开头的 NAT 乱码警告无害；vault 文件全部 **CRLF**，写入内容须 CRLF（bundle 文件本身 LF 即可）。

## 1. 摄入前置（读这些就够）

- `.claude-obsidian.json`、`.vault-meta/mode.json`（PARA：`wiki/resources/`、`wiki/projects/`）
- `wiki/hot.md`、`wiki/index.md`、`wiki/log.md`、`wiki/overview.md`
- `wiki/meta/ledgers/source-ledger.json`、`claim-ledger.json`、`.raw/.manifest.json`、`.vault-meta/address-counter.txt`
- 契约文档（需要时）：插件 `skills/wiki/references/{provenance,operation-transactions}.md`
  ⚠️ wiki-ingest 技能里写的 `../wiki/references/` 相对路径是错的，实际在 `skills/wiki/references/`。

## 2. 铁律（全部是踩过的坑，违者校验失败）

1. **禁止手写 `.raw/.manifest.json` 与 `.vault-meta/address-counter.txt` 到 writes** —— 它们 request-owned，
   由引擎从 `address_requests` + `source_manifest_updates` 自动展开。手写 = `MANAGED_METADATA_COLLISION`。
2. **来源 ID 必须用稳定公式**：`src-` + `sha256("file\0<vault相对locator>\0<内容sha256>")[:20]`。
   自造 ID = `INVALID_PROVENANCE_LEDGER`（公式见引擎 `claude_obsidian/ledgers.py: stable_source_id`）。
3. **新路径先查 casefold 冲突**：`find . -iname "*<名字>*"`。Windows 大小写不敏感，
   如 `wiki/projects/Backend Introduction` 已存在就勿建 `backend introduction` = `CASEFOLD_PATH_ALIAS`。
4. **writes 只有 `create` / `replace` 两种 mode** —— 引擎不能移动/删除文件。
   搬迁 = 引擎外物理移动 + 单独事务更新 source-ledger / manifest 的 locator。
5. **勿删、勿移 inbox 源文件**：ledger locator 指向它们（如 `inbox/xxx.md`），删除会断溯源链。
   inbox 是用户自有暂存区，摄入动作不改动它。

## 3. 事务速查（schema: `claude-obsidian.transaction.v1`）

- `operation_type: "ingest"`，`operation_id: "ingest-<短名>-YYYYMMDD"`
- `expected_hashes`：现有目标 = 当前 sha256（先 `sha256sum`），新页面 = `null`
- `address_requests`：每个新页面 `{path, prefix:"c"}`，地址按 counter 递增预分配（如 c-000017…）
- `source_manifest_updates`：每个新来源一条（locator / sha256 / pages_created / authority / independence_key）
- 耦合写入：新页面 + source-ledger + claim-ledger + index + log + hot（overview 仅当全局图变化）
- claim 惯例：id `clm-<主题>-<要点>`；evidence 挂 `source_id` + locator；location 挂 `{anchor, path}`
- 来源权威性：official / primary / secondary / community / synthetic；claim 评估 accepted / provisional / contested / unsupported / deprecated

## 4. 执行流程

1. 起草新页面 + 元页面（可脚本化：读 ledger 合并新条目 → 生成 bundle，草稿放 `%TEMP%/ingest-*`，完成即删）
2. `wsl -e bash -lc "python3 $CORE transaction inspect <bundle> --vault $VAULT"` → 取 `approval_sha256`
3. 向用户展示：输入 / 预算 / 创建路径 / claim 评估 / 矛盾 / 跳过项
4. `wsl -e bash -lc "python3 $CORE transaction apply <bundle> --vault $VAULT --approved-plan-sha256 <hash>"`
5. 报告 operation_id + changed paths
- 退出码 75 = vault 已变 / 锁占用 → 重读重建再 inspect
- 同 operation_id 同 bundle 重放 = no-op（幂等）

## 5. 省时提示

- **不要整读旧 bundle.json 当 schema 范例**（26k token 还常被截断）——本文件第 3 节即范例。
- 引擎本身校验+写入 < 1 秒；耗时全在起草与校验循环，按第 2 节自查后再 inspect。
- 参考先例：本 vault 每次摄入 = 1 来源页（英文）+ 1 概念页（中文讲解）+ 项目页/索引联动。

---

**删除安全声明**：本文件不占 wiki 地址、不进 ledger / manifest、无任何链接指向或被指向。
直接删除不影响 vault 架构与历史事务。

---
type: session
title: "Task Tracker CLI 开发记录"
created: 2026-08-07
updated: 2026-08-08
status: mature
tags:
  - session
  - python
  - cli
related:
  - "[[Task Tracker CLI]]"
---

# Task Tracker CLI 开发记录

## 项目

[[Task Tracker CLI]]（roadmap.sh 入门项目）：命令行待办工具，JSON 文件持久化，纯 Python 标准库（无外部依赖）。代码：[[task-cli.py]]，数据文件：`tasks.json`。**2026-08-08 完结**：所有剩余问题已修完。

## 技术要点（本会话学到）

1. **sys.argv 是已切好的词列表**：`[脚本名, 命令, 参数...]`，按固定位置取（`msg[0]`/`msg[1]`/`msg[2]`），不是边读边猜。每种命令参数个数固定。
2. **json.load/dump**：文件 ↔ Python 互转；`indent=2` 只影响排版。`loads/dumps`（带 s）操作字符串。
3. **open() 模式**：`'r'` 读（默认）、`'w'` 写（会清空重建）、`'a'` 追加。用 `'w'` 写时必须写完整列表。
4. **数据模型**：JSON 数组 → Python list，JSON 对象 → dict；`for task in tasks` 逐个取；字典改字段直接赋值。
5. **删除元素**：列表推导过滤 `[t for t in tasks if t['head'] != id]`（推荐）或 `del tasks[i]`（需先找下标）。
6. **无状态列出**：`def list_tasks(status=None)` —— None 默认值 =「没传就全列」。
7. **id 生成**：`max(task['head'] for task in tasks) + 1 if tasks else 1`。CLI 每次运行是独立进程，全局变量不保留，必须从文件现算。
8. **类型陷阱**：命令行参数是 str，JSON 里数字是 int，比较前要 `int(msg[2])`。
9. **for 循环里直接删元素会跳过**：删除用过滤式或加 `break` 提前退出。

## 调试记录（2026-08-07）

初版 7 个 bug **全部修复**：

1. `task.json` / `tasks.json` 拼写不一致 → 读写不是同一个文件，数据不落盘（致命）
2. `update_task` 遍历模块级空列表 → 循环不执行，还把空列表写回文件（致命）
3. `delete_task` 用 `'r'` 模式打开却写 → `UnsupportedOperation`（致命）
4. `list_tasks()` 无参调用 → `TypeError`（致命）
5. 打印 `task['id']` 但键名是 `'head'` → `KeyError`
6. id 类型 str vs int → 永不匹配（静默失败），需 `int()` 转换
7. `new_head += 1` → `UnboundLocalError`，且进程间不保留 → 删掉，id 用 max+1 现算

## 后续修复（2026-08-08，完结前收尾）

- [x] tasks.json 不存在/为空 → 抽 `load_file()` / `dump_file()` 统一处理（但 create 仍用裸 `open('r')`，留待下一轮）
- [x] `list in-progress` 静默返回空 → 状态名统一为 `in-progress`（连字符）
- [x] 无参数运行加 `len(sys.argv) < 2` 守卫
- [x] 新任务添加 `updated_at` 字段，默认 status 改为 `todo`
- [x] 补 `mark-in-progress` / `mark-done` 命令
- [x] 补成功提示 `Task added successfully (ID: N)`
- [x] 删除死代码全局 `tasks = []`

## 实测状态（2026-08-08，完结验证）

- ✅ `create` / `list` / `update` / `delete` 全流程通过
- ✅ `mark-in-progress` / `mark-done` 通过
- ✅ `list todo` / `list in-progress` / `list done` 过滤正确
- ✅ 文件不存在时自动创建
- ✅ 无参数运行时打印用法提示

## 关键教训

- **静默失败最坑**：不崩不报错但结果不对（类型不匹配、状态名不一致）
- **数据流闭环**：读文件 → 改内存 → 写回文件，任何一步断链数据就丢
- **规格一致性**：状态命名（`in-progress`）必须前后统一，照抄规格最省事
- **文件双态处理**：不存在和为空是两种不同情况，都要处理

---
type: project
title: "HotKeysMap · Windows 快捷键查询与修改工具"
created: 2026-08-31
updated: 2026-08-31
status: active
area: ""
domain: software-engineering
complexity: intermediate
goal: "适配本机（Windows 11）的快捷键管理工具：跨软件查询快捷键、直接修改可写软件键位、注册自定义全局热键。"
code:
  - "D:/Projects/HotKeysMap"
tags:
  - project
  - python
  - react
  - windows
  - hotkeys
  - tooling
---

# HotKeysMap · Windows 快捷键查询与修改工具

> 项目页：目标、完成标准与关键点。支持软件矩阵见 `D:/Projects/HotKeysMap/README.md`。

## 前置
**前置项目**：无

**知识框架体系**：概念层（快捷键冲突、配置文件覆盖机制、SSE 长连接）；技能层（Python 标准库后端、React 18 免构建前端、文件监控）；工具层（VS Code keybindings.json、Obsidian hotkeys.json、JetBrains keymaps、浏览器扩展命令、桌面快捷方式）。

## 目标产出
> 查询操作系统与各软件快捷键，直接修改可写软件键位，并支持注册自定义全局热键；零第三方依赖。

**交付工作区**：`D:/Projects/HotKeysMap`（交付成果放此；过时版本移入其 `archive/`。全局映射见 [[wiki/meta/code-repos]]）

**交付物**：

- [x] 查询：跨软件搜索三种模式（动作名 / 按键 / 命令 ID），支持按下组合键反查占用
- [x] 修改：VS Code、Obsidian、JetBrains、Chrome/Edge 扩展命令、桌面快捷方式（系统级启动热键）
- [x] 内置数据库：Windows 系统 ~90 条、微信 / WPS / Office / 浏览器通用（仅查询）
- [x] v1.3 实时更新：SSE 长连接 + 配置文件外部变更约 2 秒自动刷新 + 20 秒轮询兜底
- [x] 启动：`HotKeysMap.bat` / `python run.py`，已有实例运行时直接复用页面
- [ ] 全部完成后：`status: completed` → 移入 `wiki/archives/`

## 项目关键点
**核心内容**：把散落在各软件配置文件里的快捷键统一成可搜索、可修改、可感知变更的本地服务——后端纯 Python 标准库，前端 React 18 本地运行时无需构建。

**关键难点**：

- 各软件配置机制差异大：VS Code 是覆盖式 JSON、JetBrains 需在 IDE 内激活 keymap、浏览器扩展需完全退出后改写——每种都要按官方机制写入，不能硬改。
- SSE 实时同步：多标签页 / 外部 curl / 软件外部改文件三条变更路径都要即时广播到所有页面。

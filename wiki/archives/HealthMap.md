---
type: project
title: "康记 HealthMap · 本地健康管理"
created: 2026-08-31
updated: 2026-08-31
status: active
area: ""
domain: software-engineering
complexity: beginner
goal: "纯本地的健康管理 Web 应用：饮水、饮食、睡眠、运动四大模块 + 总览仪表盘 + 统计报表，数据全部保存在本机。"
code:
  - "D:/Projects/HealthMap"
tags:
  - project
  - react
  - local-first
  - health
  - pwa
---

# 康记 HealthMap · 本地健康管理

> 项目页：目标、完成标准与关键点。功能总览见 `D:/Projects/HealthMap/README.md`。

## 前置
**前置项目**：无

**知识框架体系**：概念层（local-first、localStorage 数据层、PWA）；技能层（React 19 + Vite 重构、单文件构建内联）；工具层（v1 原生 JS 版留存 `legacy/`，两版数据互通）。

## 目标产出
> 饮水、饮食、睡眠、运动四大模块 + 总览仪表盘 + 统计报表；数据全部在本机浏览器 localStorage，不上传任何服务器。

**交付工作区**：`D:/Projects/HealthMap`（交付成果放此；过时版本移入其 `archive/`。全局映射见 [[wiki/meta/code-repos]]）

**交付物**：

- [x] v2.0：React 19 + Vite 重构，数据层与逻辑层一轮 bug 修复与优化；v1 完整保留在 `legacy/`
- [x] 零依赖使用：`app/dist/index.html` 单文件（JS/CSS 全内联），file:// 离线双击即用
- [x] 总览仪表盘：四模块当日进度环形卡、连胜激励（连续记录 N 天）、近 7 日热力格（点击可补记）
- [x] PWA：http 访问时可安装到桌面/主屏并离线使用
- [x] 数据管理：JSON 导出备份 / 导入恢复（两版共用 `healthmap.db.v1` 键，数据互通）
- [ ] 全部完成后：`status: completed` → 移入 `wiki/archives/`

## 项目关键点
**核心内容**：local-first 健康记录——四大模块 + 连胜激励机制驱动持续记录；v1→v2 重构保留完整旧版且数据互通。

**关键难点**：

- localStorage 即数据库：清除浏览器数据即丢记录，必须靠「导出备份」的用户习惯兜底。
- v1/v2 双版共存：共用同一存储键保证数据互通，重构时不能破坏旧版读写格式。

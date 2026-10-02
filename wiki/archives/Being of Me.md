---
type: project
title: "Being of Me · 个人数字生命档案馆"
created: 2026-08-31
updated: 2026-08-31
status: active
area: ""
domain: software-engineering
complexity: intermediate
goal: "在自己电脑上运行的本地个人系统：生命周历、日记、网站、书架、本地文件，统一收进一个安静的空间。"
code:
  - "D:/Projects/Being of Me"
tags:
  - project
  - react
  - nodejs
  - local-first
  - personal-system
---

# Being of Me · 个人数字生命档案馆

> 项目页：目标、完成标准与关键点。运行与开发细节见 `D:/Projects/Being of Me/README.md`。

## 前置
**前置项目**：无

**知识框架体系**：概念层（local-first 个人数据主权、数字生命档案）；技能层（React 19 + Vite 前端、零依赖 Node 后端）；工具层（git 版本管理、CHANGELOG 驱动迭代）。

## 目标产出
> 生命周历 · 日记 · 网站 · 书架 · 本地文件，统一收进一个安静的空间里——只监听 127.0.0.1 的纯本地系统。

**交付工作区**：`D:/Projects/Being of Me`（交付成果放此；过时版本移入其 `archive/`。全局映射见 [[wiki/meta/code-repos]]）

**交付物**：

- [x] React 19 + Vite 前端 + 零依赖 `server.js`（Node 自带模块即可运行）
- [x] 一键启动：`启动.bat` 首次自动装依赖并构建，访问 http://localhost:2006
- [x] 版本管理：git 启用，版本号在 `package.json`，更新日志 `CHANGELOG.md`；个人数据 `data/*.json` 与构建产物 `dist/` 均 gitignore
- [x] 开发模式：`npm run dev` Vite 热更新（API 转发至 2006）
- [ ] 各模块（周历 / 日记 / 书架）按实际使用持续打磨
- [ ] 全部完成后：`status: completed` → 移入 `wiki/archives/`

## 项目关键点
**核心内容**：local-first 的个人数字档案馆——数据不出本机，服务只监听回环地址；前端现代化（React 19 + Vite），后端刻意保持零依赖。

**关键难点**：

- 个人数据与代码的边界：`data/*.json` 是个人数据不入库，备份与迁移策略要靠使用习惯兜底。
- 零依赖后端 vs 功能扩展的张力：加功能时守住「Node 自带模块即可运行」这条线。

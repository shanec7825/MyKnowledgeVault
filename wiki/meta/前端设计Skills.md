---
tags:
  - ai-tools
  - frontend
  - skill
  - codex
created: 2026-10-21
status: reproducible-setup
---

# 前端设计 Skills｜Frontend Design + UI UX Pro Max

本笔记记录知识库 **MyKnowledgeVault** 的两项 UI/UX Skill 来源、真实安装范围和本地同步方法。它们服务于课程可视化、小实验与互动学习网页；不是 ChatGPT 聊天界面本身的样式插件。

## 现有仓库内容

| Skill | GitHub 内实际内容 | 本地使用方式 |
| --- | --- | --- |
| **Frontend Design** | 已纳入完整的 [SKILL.md](../../.agents/skills/frontend-design/SKILL.md) 和 [Apache-2.0 LICENSE](../../.agents/skills/frontend-design/LICENSE.txt) | 从 GitHub pull 后即有文件；重启 Codex 以发现项目级 Skill |
| **UI UX Pro Max** | 此处维护**官方安装配方**，不镜像约 3.6 MB 的搜索目录、Python 脚本及测试数据 | pull 后运行 [安装脚本](../../tools/design-skills/Install-DesignSkills.ps1)，把官方数据生成到本地的 .agents/skills/ui-ux-pro-max/ |

注意：**云端此时只提交了 Frontend Design 的完整文件和 UI UX Pro Max 的安装配方。** 如果另一台机器仅执行 git pull，而没有在本地运行安装脚本，它不会自动获得 UI UX Pro Max 的搜索数据。不要把“配置已推送”误称为“两项已在本机安装”。

## 官方来源

- Frontend Design: https://github.com/anthropics/skills/tree/main/skills/frontend-design  
  本库镜像来源：\`dbd4588f9e1033efb41dad4bef2f7947c8993d44\`（保留原始 SKILL.md 和 LICENSE.txt，未改写）。
- UI UX Pro Max: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill  
  安装器：\`ui-ux-pro-max-cli@2.15.0\`；仅在本地明确执行时下载、生成所需 Skill 文件。生成内容及其许可证按上游发行包为准。

外部 Skill 属于第三方说明和代码；使用前以当前用户要求、仓库 [AGENTS.md](../../AGENTS.md) 及安全规范为优先，不盲目执行来源不明的命令。

## 本地同步（Windows PowerShell）

在电脑上打开**已经克隆好的 MyKnowledgeVault 根目录**：

\`\`\`powershell
git status --short
git pull --ff-only origin main
powershell -NoProfile -File .\tools\design-skills\Install-DesignSkills.ps1 -RefreshQMD
\`\`\`

- 若 git pull 因本地未提交修改或冲突而停止，**先处理本地修改**；不要强制覆盖或 reset。
- 需要 Node.js / npx；UI UX Pro Max 的本地搜索还需要 Python 3。
- 安装脚本不会覆写已有 UI UX Pro Max Skill。如果发现残缺目录，会报错并要求人工检查。
- \`-RefreshQMD\` 按本仓库 AGENTS.md 约定顺序运行 update → embed → status。只有看到 \`Pending: 0\` 才算索引更新完成；脚本不会假设已经成功。
- 安装器生成的 UI UX Pro Max 文件是**本地工作区新文件**。不会自动 git commit/push，以免未经检查把第三方生成文件写回仓库。

## 在 Codex 中怎样用

重新打开或刷新 Codex 后，检查 Skills 列表。生成交互式学习页面时先说明“预测 → 操作 → 反馈”的教学目标，再调用 frontend-design 确定设计方向，用 ui-ux-pro-max 检查对比度、可访问性、组件一致性与响应式布局。课程进度仍按 [[AGENTS]] 约定写到相应课程与日记中。

如果要在多个独立仓库使用相同 Skill，需要**另外**按官方说明安装为全局 Skill；这里只配置当前知识仓库的项目级目录。

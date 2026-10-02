---
type: project
title: informationFinding · AI 研究工作台
created: 2026-08-31
updated: 2026-09-11
status: active
area: 人工智能
domain: ai
complexity: intermediate
goal: 搭建一个本地 AI 研究工作台：实时追踪 GitHub AI/Agent 热点与前沿论文，多维评分筛选，生成中文日报，并提供本地 Web 看板。
code:
  - D:/Projects/informationFinding
related:
  - "[[What is ML and its types|What is ML and its types]]"
  - "[[前沿内容的分层阅读法|前沿内容的分层阅读法]]"
tags:
  - project
  - ai
  - information-retrieval
  - python
  - react
  - area/人工智能
---

# informationFinding · AI 研究工作台

> 项目页：目标、完成标准与关键点。实现细节见 `D:/Projects/informationFinding/README.md` 与《搭建参考.md》。

## 前置
**前置项目**：无

**知识框架体系**：概念层（信息检索、star velocity、跨源去重、加权评分）；技能层（Python 标准库后端、React 看板、OpenAI 兼容 API 接入）；工具层（GitHub Search API、Hugging Face Daily Papers、arXiv、Semantic Scholar、镜像兜底）。

## 目标产出
> 实时追踪 GitHub AI/Agent 热点与前沿论文，多维评分筛选，生成中文日报，并提供本地 Web 看板。

**交付工作区**：`D:/Projects/informationFinding`（交付成果放此；过时版本移入其 `archive/`。全局映射见 [[wiki/meta/code-repos]]）

**交付物**：

- [x] GitHub 热榜：近 N 天高增速 AI/Agent 新仓库（Search API 按 star velocity 检索）
- [x] 论文速递：HF Daily Papers + arXiv + Semantic Scholar，跨源自动去重
- [x] 多维评分：来源权威性 / 社会热度 / 内容质量 / 时效性 / 领域相关性加权合成 0-100 分
- [x] 中文日报：每天一份 Markdown 日报写入 `data/reports/`（可选 LLM 中文摘要，未配置自动回退规则摘要）
- [x] 本地看板：React 前端 + Python 后端，热榜 / 论文 / 收藏三个 Tab（http://127.0.0.1:8765）
- [ ] 评分权重按实际使用体验调校一轮
- [ ] 全部完成后：`status: completed` → 移入 `wiki/archives/`

## 项目关键点
**核心内容**：AI 信息差工作台——按《搭建参考.md》的 MVP 路线实现，抓取 → 评分 → 入库 → 日报 → 看板全链路；`run_daily.bat` 支持每日自动运行。

**关键难点**：

- 网络鲁棒性：每个数据源直连优先、镜像兜底（huggingface.co → hf-mirror.com），单源失败不阻塞整体。
- 跨源去重：HF 论文 id 即 arXiv id，以此为主键合并多源结果。
- 评分体系：五个维度权重需要在真实阅读中反复校准，否则日报会偏向「热闹但无用」的仓库。

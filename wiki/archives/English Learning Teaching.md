---
type: project
title: English Learning Teaching · 英语教学视频配音
created: 2026-08-31
updated: 2026-08-31
status: active
area: 英语学习
domain: language-learning
complexity: intermediate
goal: 打通英语教学视频的制作管线：调研开源配音/字幕工具链，搭建配音 pipeline，确定音色方案，产出可用的中文配音与中文字幕工作流。
code:
  - D:/Projects/English Learning Teaching
related:
  - "[[wiki/archives/How To Do Great Work|How To Do Great Work]]"
tags:
  - project
  - english
  - dubbing
  - tts
  - video
  - area/英语学习
---

# English Learning Teaching · 英语教学视频配音

> 项目页：目标、完成标准与关键点。调研全文与 pipeline 见 `D:/Projects/English Learning Teaching/`。

## 前置
**前置项目**：无

**知识框架体系**：概念层（ASR → LLM 翻译 → TTS → 音视频合成的配音管线、声音克隆、口型同步）；技能层（开源工具选型与部署、pipeline 编排）；工具层（pyVideoTrans、VideoLingo、Linly-Dubbing、YouDub、KrillinAI、SmartSub）。

## 目标产出
> 调研并落地英语教学视频的制作管线：开源工具选型 → 配音 pipeline → 音色方案 → 中文字幕与配音实现。

**交付工作区**：`D:/Projects/English Learning Teaching`（交付成果放此；过时版本移入其 `archive/`。全局映射见 [[wiki/meta/code-repos]]）

**交付物**：

- [x] 《github开源项目.md》：六款主流开源配音工具对比（功能 / 声音克隆 / 多说话人 / 部署难度 / 适用场景）
- [x] 《英语教学视频配音调研报告》（md + pdf）
- [x] 《适合视频配音的音色调研报告》（md + pdf）
- [x] 《中文字幕与中文配音实现详解》（md + pdf）
- [x] `dubbing_pipeline/`、`voice_persona_demo/`、`voiceover_demo/`、`ai_workbench/` 等管线与 demo
- [ ] 用选定方案完整产出一条英语教学视频成片
- [ ] 全部完成后：`status: completed` → 移入 `wiki/archives/`

## 项目关键点
**核心内容**：把「英语视频 → 中文配音 + 中文字幕」这条创作者刚需管线调研清楚并搭出可用的本地 pipeline；三份报告（工具选型 / 音色 / 实现详解）是核心认知产出。

**关键难点**：

- 工具链取舍：pyVideoTrans 功能最全、VideoLingo 字幕质量最高、Linly-Dubbing 专攻口型同步——按「英语教学视频」场景选组合而非求全。
- 声音克隆与多说话人：教学视频常有多角色，音色一致性与说话人分离直接影响成片质量。

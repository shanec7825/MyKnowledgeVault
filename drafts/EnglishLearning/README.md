---
type: index
title: English Learning Hub
created: 2026-10-02
updated: 2026-10-06
tags:
  - english
  - learning
  - index
---

# English Learning Hub

这是每日英语训练资源的总入口。目标不是积累孤立材料，而是把每天的输入、表达、篇章结构和主动调用逐步连接成一个可复习的知识网络。

## Daily Notes

- [[2026-09-24-English-Spider-Webs-Brain-inspired-Computing|2026-09-24 · Spider Webs × Brain-inspired Computing]]
- [[2026-09-25-English-Rhythm-AI-Reliability|2026-09-25 · Rhythm × AI Reliability]]
- [[2026-09-26-English-Explainable-AI-Self-driving-Cars|2026-09-26 · Explainable AI × Self-driving Cars]]
- [[2026-09-27-English-REM-Sleep-Evidence-and-Interpretation|2026-09-27 · REM Sleep × Evidence and Interpretation]]
- [[2026-09-28-English-Decision-making-Working-Memory|2026-09-28 · Decision-making × Working Memory]]
- [[2026-09-29-English-AI-RNA-Vaccine-Stability|2026-09-29 · AI × RNA Vaccine Stability]]
- [[2026-09-30-English-Biohybrid-Robot-Mechanism|2026-09-30 · Biohybrid Robot × Mechanism]]
- [[2026-10-01-English-Strategic-AI-Hidden-Information|2026-10-01 · Strategic AI × Hidden Information]]
- [[2026-10-02-English-AI-3D-Models-Appearance-vs-Function|2026-10-02 · AI 3D Models · Appearance vs Function]]
- [[2026-10-03-English-Division-of-Labor-Complex-Systems|2026-10-03 · Division of Labor × Complex Systems]]
- [[2026-10-04-English-Worker-Voice-Tech-Responsibility|2026-10-04 · Worker Voice × Tech Responsibility]]
- [[2026-10-05-English-Music-Meaning-Making|2026-10-05 · Music × Meaning-Making]]

- [[2026-10-06-English-Wind-Farms-Scaling-Evidence|2026-10-06 · Wind Farms × Scaling Evidence]]

## Core Training Loop

**Complete the task → Find the breakdown → Targeted practice → Transfer to a new context → Review**

每篇 Daily Note 固定包含：
- Listening：泛听 + 全局模型
- Reading：精读 + 篇章结构识别
- Active Expressions：只保留少量高价值表达
- Speaking：从复述到迁移
- Connections：与旧词、旧结构、旧主题建立链接
- Reflection：记录真正的断点，而不是“学了多久”

## Cumulative Maps

- [[Connections|Connections · 跨日联想与汇总]]
- [[threshold|threshold]]：已有词汇库示例

## Reading Frameworks

阅读时优先问：**What is the writer doing here?**

常见功能：
- Background — What do I need to know first?
- Problem / Question — What is difficult or unknown?
- Method / Approach — What did they do?
- Mechanism — How does it work?
- Result — What happened?
- Interpretation — What might the result mean?
- Contrast — What changed or differs?
- Cause → Effect — What causes what?
- Limitation — What should I NOT conclude?
- Implication — Why does this matter?

> 不要求每篇文章都套同一模板。重点是识别段落之间的关系，并持续维护全文模型。


## Multimedia Daily Package

从 2026-10-07 起，每日英语资源优先生成一个多媒体学习包，而不只是 Markdown：

- **Markdown** — Obsidian 知识网络、Previous / Next、Connections、词汇反链。
- **Interactive HTML** — 原音播放器、原始文章跳转、词汇点击朗读、retrieval 自测、折叠提示、复盘输入等交互。
- **Original listening audio link** — 优先寻找并验证媒体提供方的直接 MP3/audio URL；若只能获得播放器页面，则保留原始媒体页和可用下载入口，不伪造直链。
- **Visual** — 主题/词汇视觉辅助；能持久化生成图片时保存到 `EnglishLearning/assets/`，否则在 HTML 内提供原创视觉卡片。
- **Speech** — HTML 默认可使用浏览器 Web Speech API 进行单词/句子朗读；若后续连接可用的高质量语音服务，可额外生成 voiceover 文件。

推荐命名：
- `EnglishLearning/YYYY-MM-DD-English-<TopicSlug>.md`
- `EnglishLearning/YYYY-MM-DD-English-<TopicSlug>.html`
- `EnglishLearning/assets/YYYY-MM-DD-<TopicSlug>-*.png`（有可持久化图片时）


### Real-time MiMo reading

Daily English pages use the Obsidian plugin `.obsidian/plugins/mimo-english-coach/` as the only MiMo credential holder.

- **Markdown reading mode:** the plugin automatically adds a subtle speaker button to English paragraphs/headings/list items. The button is hidden until hover and calls MiMo TTS in real time.
- **Markdown editing mode:** select English text and run `MiMo English Coach: Speak selected text with MiMo`.
- **HTML companion:** when the learner selects text, show a small temporary `Listen` button near the selection. It should call `obsidian://mimo-tts?text=<URL-encoded text>`, so the Obsidian plugin performs MiMo TTS without exposing the API key to the HTML file.
- Do not store API keys in Markdown or HTML.
- Do not pre-generate audio for ordinary words or sentences; generate speech on demand. Preserve original source audio separately for listening practice.
- Keep the TTS control visually unobtrusive: no permanent audio toolbar and no repeated speaker icons cluttering the content.

---
type: guide
title: MiMo Voice Bridge
tags:
  - english
  - mimo
  - tts
---

# MiMo Voice Bridge

This helper lets the interactive English HTML lessons use Xiaomi MiMo TTS without putting your API key in GitHub.

## First-time setup

1. Double-click `MiMo-Voice-Server.cmd` on Windows.
2. Open `http://127.0.0.1:8765/setup`.
3. On your Xiaomi MiMo Token Plan page, copy:
   - your Token Plan API key (`tp-...` or `ttp-...`)
   - the Token Plan Base URL shown for your plan
4. Paste them into the local setup page and choose an English voice: Mia, Chloe, Milo, or Dean.
5. Click **Encrypt & Save**, then test TTS.

The API key is encrypted with **Windows DPAPI** and stored only in:

`EnglishLearning/.mimo/config.dpapi`

That directory is ignored by Git. Do **not** paste the key into ChatGPT, Markdown, HTML, GitHub issues, or commits.

## Daily use

Start `MiMo-Voice-Server.cmd` before opening a daily interactive HTML lesson. MiMo buttons call the local bridge at `127.0.0.1:8765`. If the bridge is unavailable, daily pages can fall back to browser speech synthesis.

## What is sent to MiMo?

Only the requested text, a short pronunciation/style instruction, the selected voice, and the authentication request are sent to the Base URL you configured.

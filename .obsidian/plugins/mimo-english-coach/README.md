# MiMo English Coach

A desktop-only Obsidian plugin for the `EnglishLearning/` workflow.

## Main views

- **Today** — one clean overview of today's English note, source links, active expressions, and MiMo review.
- **Library** — historical overview of `YYYY-MM-DD-English-*.md` files.
- **Coach** — ask MiMo about today, a selected day, or the latest seven days.

The same Token Plan API key is also used for MiMo TTS.

## First setup

1. Open Obsidian Settings → Community plugins and enable **MiMo English Coach**.
2. Open Settings → MiMo English Coach.
3. Pick the Token Plan region matching your account.
4. Paste your `tp-...` or `ttp-...` key once and click **Save key**.
5. Use `mimo-v2.6-flash` for fast daily coaching or `mimo-v2.6-pro` for deeper review.
6. Click **Test**.

The key is encrypted with Electron/OS secure storage when available. Plugin data is excluded from Git.

## Important behavior

The coach is explicitly told not to mistake exercise instructions for evidence that you actually completed the exercise. If the note has no writing/reflection/output, it should say that evidence is missing instead of pretending the skill was demonstrated.


## Open the interactive HTML companion in Obsidian

The `Open lesson` button in Today and Library now calls `vault-html-webviewer` directly, rather than asking Obsidian to open HTML as a generic text file. In the command palette use **Open today's interactive English HTML lesson** or, while reading any dated English Markdown note (including archives), **Open HTML companion for the active English note**.

Both community plugins need to be enabled. After pulling plugin changes, restart Obsidian or disable/re-enable **Vault HTML Web Viewer** and **MiMo English Coach**. If the embedded HTML display is blank, use the local viewer toolbar's **网页查看器** or **外部浏览器** action. The HTML files and their shared `assets/` folder must be available locally; GitHub's file preview is not a rendered HTML app.

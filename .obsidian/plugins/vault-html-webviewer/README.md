# Vault HTML Web Viewer (desktop)

This plugin serves local HTML and its relative CSS, JavaScript and images from a **loopback-only HTTP server**. Files open as a native Obsidian HTML view with an embedded preview; toolbar actions let you switch to the Obsidian Web viewer core plugin or the system browser. It also registers `.html` / `.htm` in the File Explorer.

## Open a daily English lesson

1. After Git sync, restart Obsidian or disable/re-enable both community plugins **Vault HTML Web Viewer** and **MiMo English Coach**.
2. In MiMo English Coach, click **Open lesson** (or command palette: **Open today's interactive English HTML lesson**). This now invokes the viewer directly.
3. Alternatively, click `EnglishLearning/YYYY-MM-DD-English-*.html` from the File Explorer. It should render in the local HTML tab.
4. If you see a blank page, click **网页查看器** to use the Obsidian built-in Web viewer, or **外部浏览器**. Both use the same loopback server so images, styles and localStorage work without internet. The Web viewer core plugin may need to be enabled.

The port can change if the default is taken. Draft text is stored in the browser's localStorage (per origin), **not** automatically written back into Obsidian Markdown; keep important writing and reflection in the Markdown file.

## Security

- Server binds only to `127.0.0.1`, protects URLs with a random token regenerated each start, refuses hidden files and unknown formats, and serves no JSON or Markdown.
- The bearer token is NEVER stored in `data.json` or Git. Remove any previously tracked token from local plugin settings before distributing this vault.
- No Token Plan key is used or embedded by this HTML viewer; MiMo credentials remain in MiMo English Coach's secure storage.

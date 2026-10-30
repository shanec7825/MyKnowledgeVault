# Audio / visual policy for English lesson companions

- Shared CSS: `daily-lesson.css`; shared interactive navigation: `daily-lesson.js`; simple low-cost speech adapter: `study-voice.js`.
- For archived materials without verified original audio, use the browser's speech synthesis or the Obsidian plugin-provided `obsidian://mimo-tts?text=...` action on a **short originally authored study narration**. These narrations are clearly marked and must not be presented as the publisher's audio or transcript. The HTML does not store, request or expose MiMo API tokens.
- Original article text is read through the linked publisher site, not copied in full. SVG storybook landscapes are original and versioned under `assets/art`.
- All daily lessons build a full-text model, focus on 1–3 paragraphs, use one 20–40s sound check and one expression in a new scenario, and keep real writing and reflection blank until completed.
- React is used as a progressive enhancement for navigation when available; static semantic HTML remains usable without React, styled with shadcn-inspired tokens rather than a full installed shadcn component build.

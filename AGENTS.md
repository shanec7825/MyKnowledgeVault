# Agent instructions

Read `OVERVIEW.md` for the vault map and `CLAUDE.md` for the authoritative vault rules before edits.

## Local knowledge retrieval

QMD 2.8.3 is installed locally. Run commands from this vault root.

- After notes may have changed, run `npm.cmd run --silent qmd -- update` once before retrieval. The index is incremental; it is not a live file watcher.
- Exact words/titles: `npm.cmd run --silent qmd -- search "神经可塑性" --json -n 8`.
- Read the actual source: `npm.cmd run --silent qmd -- get "#docid" -l 100`. Use the returned ID, not the literal placeholder. Cite the original vault path and line numbers; snippets alone are not evidence.
- Semantic recall, once vectors are available: `npm.cmd run --silent qmd -- query "vec: 如何让学习效果保持得更久" --no-rerank --json -n 8`.
- Check availability with `npm.cmd run --silent qmd -- status`; if embeddings are pending, use BM25 and `rg` rather than assuming semantic retrieval is complete.
- Use bounded top-k and line ranges, then follow wikilinks. Avoid `--all` and full-vault reads unless the task requires an exhaustive audit.
- Use `rg -n --glob '*.md' --glob '!*.excalidraw.md' "literal" wiki inbox calendar` for exact verification, new content, and an independent fallback.
- Hidden configuration/session folders and Excalidraw compressed payloads are intentionally outside the index. It indexes Markdown text, not PDF bodies or image OCR.
- After bulk note edits, run `update`, then `embed` to refresh semantic vectors. Do not change models or rebuild all vectors without a reason.

MCP clients that honor `.mcp.json` can start the configured `qmd` server after reloading their MCP configuration. Its query tool accepts `searches: [{type: "lex", query: "神经可塑性"}]` and `rerank: false` for fast retrieval without a reranker model. This file does not automatically register a server in every client.

See `wiki/meta/agent-search.md` for maintenance and installation details.

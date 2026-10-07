# Knowledge vault agent instructions

This workspace is a Chinese-first Obsidian knowledge vault. Read `wiki/meta/agent-search.md` for search configuration and commands. Preserve existing notes and unrelated user changes.

## Search before writing

- Search existing notes before creating a new note. Use QMD keyword search or typed `lex`/`vec` queries with `--no-rerank`; do not trigger model downloads for routine lookups.
- Run commands from the vault root. Set `QMD_CONFIG_DIR` to `<vault>/.qmd` and `INDEX_PATH` to `<vault>/.qmd/index.sqlite` explicitly.
- If files may have changed since indexing, run `qmd update` before searching. Before relying on semantic results, run `qmd embed` if status reports pending embeddings.
- Read original notes after retrieving candidates. Cite real vault paths; search scores are ranking signals, not factual confidence.
- PDF, images, HTML and Excalidraw payloads are outside QMD's current text coverage. Use appropriate direct inspection for them.

## Finish every note-writing batch

After creating, editing, moving or deleting Markdown covered by `.qmd/index.yml`:

1. Maintain the relevant human navigation pages. New English daily notes belong in `EnglishLearning/README.md`; update `EnglishLearning/Connections.md` when the content supplies useful cross-note connections. Maintain other existing domain entry pages as appropriate.
2. From the vault root, run:

   ```powershell
   $env:QMD_CONFIG_DIR = Join-Path $PWD '.qmd'
   $env:INDEX_PATH = Join-Path $PWD '.qmd/index.sqlite'
   # This vault's reviewed config uses the existing local Qwen GGUF model.
   $env:QMD_TRUST_LOCAL_CONFIG = '1'
   npm.cmd run --silent qmd -- update
   npm.cmd run --silent qmd -- embed --max-docs-per-batch 16 --max-batch-mb 8
   npm.cmd run --silent qmd -- status
   ```

3. Check each command's exit code; stop dependent steps if a command fails. Confirm `Pending: 0` before claiming semantic indexing is complete. If maintenance cannot finish, report what succeeded and what remains.
4. If orphaned vectors are reported, inspect `qmd cleanup --dry-run` before cleaning generated data with `qmd cleanup`; then check status again.

Do this once after the batch's final edits, including navigation or instruction edits, rather than after each file. Read-only work does not require rebuilding an already-current index. Do not routinely use `embed -f`.

## Coverage and automation limits

`vault` covers the configured Markdown content folders and root notes; `raw` covers `.raw/captured/**/*.md`. Add new content folders to the pattern and context when expanding coverage.

The trust setting applies to the reviewed `.qmd/index.yml` in this vault, whose collections stay inside the vault and whose embed model is already installed locally. Re-review paths, models and any update commands before trusting a changed or imported configuration. Without trust, QMD skips the configured embed model and may select a downloadable default.

These instructions require agents to run maintenance; they do not install a filesystem watcher. QMD MCP exposes query/get/multi_get/status only. Obsidian and Dataview cache updates do not refresh QMD or write human navigation pages.

"use strict";

const {
  Plugin, ItemView, PluginSettingTab, Setting, Notice,
  TFile, MarkdownRenderer, requestUrl, MarkdownView
} = require("obsidian");

const VIEW_TYPE = "mimo-english-coach-view";

const ENDPOINTS = {
  cn: "https://token-plan-cn.xiaomimimo.com/v1",
  sgp: "https://token-plan-sgp.xiaomimimo.com/v1",
  ams: "https://token-plan-ams.xiaomimimo.com/v1"
};

const DEFAULT_SETTINGS = {
  region: "cn",
  customBaseUrl: "",
  model: "mimo-v2.6-flash",
  ttsModel: "mimo-v2.5-tts",
  voice: "Mia",
  folder: "EnglishLearning",
  encryptedKey: "",
  maxLibraryDays: 60
};

function localDay(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + d;
}

function cleanBase(url) {
  return String(url || "").trim().replace(/\/+$/, "");
}

function stripFrontmatter(text) {
  return String(text || "").replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, "");
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^()|[\]\\{}$]/g, "\\$&");
}

function extractSection(text, keywords) {
  const body = stripFrontmatter(text);
  const lines = body.split(/\r?\n/);
  let start = -1;
  let level = 2;
  for (let i = 0; i < lines.length; i++) {
    const m = /^(#{2,4})\s+(.+)$/.exec(lines[i]);
    if (!m) continue;
    const title = m[2].toLowerCase();
    if (keywords.some(k => title.includes(k.toLowerCase()))) {
      start = i + 1;
      level = m[1].length;
      break;
    }
  }
  if (start < 0) return "";
  let end = lines.length;
  for (let i = start; i < lines.length; i++) {
    const m = /^(#{1,4})\s+/.exec(lines[i]);
    if (m && m[1].length <= level) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join("\n").trim();
}

function topicFromTitle(title, date) {
  if (!title) return "";
  let t = String(title).trim();
  if (date && t.startsWith(date)) t = t.slice(date.length).replace(/^[\s·—-]+/, "");
  return t;
}

function compactText(text, limit = 9000) {
  const clean = String(text || "").replace(/\n{3,}/g, "\n\n");
  return clean.length > limit ? clean.slice(0, limit) + "\n…[truncated]" : clean;
}

function activeExpressions(content) {
  const section = extractSection(content, ["active expressions", "active vocabulary"]);
  const found = [];
  const seen = new Set();
  const wiki = /\[\[words\/([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  let m;
  while ((m = wiki.exec(section))) {
    const label = (m[2] || m[1]).trim();
    if (!seen.has(label)) {
      seen.add(label);
      found.push(label);
    }
  }
  const bold = /\*\*([^*\n]{2,40})\*\*/g;
  while ((m = bold.exec(section))) {
    const label = m[1].trim();
    if (/^[A-Za-z][A-Za-z\s-]{1,38}$/.test(label) && !seen.has(label)) {
      seen.add(label);
      found.push(label);
    }
  }
  return found.slice(0, 6);
}

function externalLinks(content) {
  const out = [];
  const seen = new Set();
  const re = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
  let m;
  while ((m = re.exec(content))) {
    if (seen.has(m[2])) continue;
    seen.add(m[2]);
    out.push({ label: m[1].trim().slice(0, 90), url: m[2] });
  }
  return out.slice(0, 6);
}

class EnglishCoachPlugin extends Plugin {
  async onload() {
    const saved = await this.loadData() || {};
    this.data = {
      settings: { ...DEFAULT_SETTINGS, ...(saved.settings || {}) },
      analyses: saved.analyses || {},
      chats: saved.chats || {}
    };
    this.settings = this.data.settings;
    this.sessionKey = "";

    try {
      const electron = require("electron");
      this.secretStorage = electron.safeStorage || electron.remote?.safeStorage || null;
    } catch {
      this.secretStorage = null;
    }

    this.registerView(VIEW_TYPE, leaf => new EnglishCoachView(leaf, this));
    this.addRibbonIcon("languages", "MiMo English Coach", () => this.openView());
    this.addCommand({
      id: "open-coach",
      name: "Open MiMo English Coach",
      callback: () => this.openView()
    });
    this.addCommand({
      id: "analyze-today",
      name: "Analyze today's English learning",
      callback: async () => {
        const view = await this.openView();
        await view.analyzeToday();
      }
    });
    this.addCommand({
      id: "speak-selection",
      name: "Speak selected text with MiMo",
      callback: async () => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        const text = view?.editor?.getSelection()?.trim();
        if (!text) {
          new Notice("Select some English text first.");
          return;
        }
        try {
          await this.speak(text);
        } catch (e) {
          new Notice(e.message, 6000);
        }
      }
    });

    this.addSettingTab(new EnglishCoachSettings(this.app, this));

    for (const event of ["create", "modify", "delete", "rename"]) {
      this.registerEvent(this.app.vault.on(event, file => {
        if (file?.path?.startsWith(this.settings.folder + "/")) this.refreshViews();
      }));
    }
  }

  onunload() {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) leaf.detach();
  }

  async savePluginData() {
    await this.saveData(this.data);
  }

  async saveSettings() {
    this.data.settings = this.settings;
    await this.savePluginData();
  }

  refreshViews() {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      leaf.view.render?.();
    }
  }

  async openView() {
    let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
      leaf = this.app.workspace.getRightLeaf(false);
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    this.app.workspace.revealLeaf(leaf);
    return leaf.view;
  }

  baseUrl() {
    if (this.settings.region === "custom") return cleanBase(this.settings.customBaseUrl);
    return ENDPOINTS[this.settings.region] || ENDPOINTS.cn;
  }

  async getKey() {
    if (this.sessionKey) return this.sessionKey;
    if (this.settings.encryptedKey) {
      if (!this.secretStorage?.isEncryptionAvailable()) {
        throw new Error("Secure storage is unavailable. Re-enter the MiMo key in settings.");
      }
      try {
        return this.secretStorage.decryptString(
          Buffer.from(this.settings.encryptedKey, "base64")
        );
      } catch {
        throw new Error("Saved MiMo key cannot be decrypted on this computer.");
      }
    }
    return process.env.MIMO_API_KEY || "";
  }

  async setKey(value) {
    const key = String(value || "").trim();
    this.sessionKey = key;
    this.settings.encryptedKey = "";

    if (key && this.secretStorage?.isEncryptionAvailable()) {
      this.settings.encryptedKey = this.secretStorage
        .encryptString(key)
        .toString("base64");
    }

    await this.saveSettings();

    if (!key) new Notice("MiMo API key cleared.");
    else if (this.settings.encryptedKey) {
      new Notice("MiMo API key saved with OS encryption.");
    } else {
      new Notice("Secure storage unavailable: key is kept only for this Obsidian session.");
    }
  }

  async chat(messages, options = {}) {
    const key = await this.getKey();
    if (!key) throw new Error("Configure your MiMo Token Plan API key first.");

    const base = this.baseUrl();
    if (!/^https:\/\//.test(base)) {
      throw new Error("MiMo Base URL must use HTTPS.");
    }

    const body = {
      model: options.model || this.settings.model,
      messages,
      max_completion_tokens: options.maxTokens || 1800,
      temperature: options.temperature ?? 0.4,
      stream: false
    };

    const response = await requestUrl({
      url: base + "/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": key
      },
      body: JSON.stringify(body)
    });

    const text = response.json?.choices?.[0]?.message?.content;
    if (!text) throw new Error("MiMo returned no text response.");
    return text;
  }

  async testConnection() {
    const result = await this.chat([
      { role: "system", content: "Reply with exactly: OK" },
      { role: "user", content: "Connection test." }
    ], {
      maxTokens: 16,
      temperature: 0
    });
    return result.trim();
  }

  async speak(text) {
    const key = await this.getKey();
    if (!key) throw new Error("Configure your MiMo Token Plan API key first.");

    const body = {
      model: this.settings.ttsModel,
      messages: [
        {
          role: "user",
          content: "Natural, clear English for language learning. Moderate pace and precise pronunciation."
        },
        {
          role: "assistant",
          content: String(text).slice(0, 2500)
        }
      ],
      audio: {
        format: "wav",
        voice: this.settings.voice
      }
    };

    const response = await requestUrl({
      url: this.baseUrl() + "/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": key
      },
      body: JSON.stringify(body)
    });

    const b64 = response.json?.choices?.[0]?.message?.audio?.data;
    if (!b64) throw new Error("MiMo TTS returned no audio.");

    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
    const audio = new Audio(url);
    audio.addEventListener("ended", () => URL.revokeObjectURL(url), { once: true });
    await audio.play();
  }

  dailyNotes() {
    const prefix = this.settings.folder.replace(/\/+$/, "") + "/";
    const re = new RegExp(
      "^" + escapeRegExp(prefix) + "(\\d{4}-\\d{2}-\\d{2})-English-(.+)\\.md$"
    );

    return this.app.vault.getMarkdownFiles()
      .map(file => {
        const m = re.exec(file.path);
        if (!m) return null;

        const cache = this.app.metadataCache.getFileCache(file);
        const fm = cache?.frontmatter || {};
        const date = m[1];
        const topic = String(
          fm.topic ||
          topicFromTitle(fm.title, date) ||
          m[2].replace(/-/g, " ")
        );
        const htmlPath = file.path.replace(/\.md$/, ".html");
        const htmlFile = this.app.vault.getAbstractFileByPath(htmlPath);

        return {
          file,
          date,
          topic,
          htmlFile: htmlFile instanceof TFile ? htmlFile : null
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  todayNote() {
    const notes = this.dailyNotes();
    return notes.find(n => n.date === localDay()) || notes[0] || null;
  }

  async openFile(file) {
    if (!(file instanceof TFile)) return;
    await this.app.workspace.getLeaf("tab").openFile(file);
  }

  async buildContext(mode, notePath) {
    const notes = this.dailyNotes();
    if (!notes.length) return "No EnglishLearning daily notes were found.";

    if (mode === "week") {
      const chunks = [];
      for (const n of notes.slice(0, 7)) {
        const text = await this.app.vault.cachedRead(n.file);
        const focus = extractSection(text, ["today's focus", "today’s focus"]);
        const active = extractSection(text, ["active expressions", "active vocabulary"]);
        const writing = extractSection(text, ["writing"]);
        const reflection = extractSection(text, ["reflection"]);

        chunks.push(
          "# " + n.date + " · " + n.topic + "\n" +
          compactText(
            [focus, active, writing, reflection].filter(Boolean).join("\n\n"),
            5500
          )
        );
      }
      return chunks.join("\n\n---\n\n");
    }

    let note = notePath
      ? notes.find(n => n.file.path === notePath)
      : this.todayNote();

    if (!note) note = notes[0];

    const content = await this.app.vault.cachedRead(note.file);
    return "# " + note.date + " · " + note.topic + "\n\n" +
      compactText(content, 22000);
  }

  async analyze(mode = "today", notePath = "") {
    const context = await this.buildContext(mode, notePath);

    const prompt = mode === "week"
      ? "Review the last week of English learning notes. Identify repeated bottlenecks, expressions that appear to be moving from recognition to retrieval, weak evidence of actual completion, and design three concrete retrieval tests for next week."
      : "Analyze this English-learning day. Separate planned exercises from evidence that the learner actually completed them. Evaluate global-model reading, active vocabulary retrieval, speaking/writing output if present, and propose a very small next-day retrieval test.";

    return this.chat([
      {
        role: "system",
        content: [
          "You are a precise English-learning coach inside an Obsidian vault.",
          "Reply in concise Chinese, keeping useful English terms.",
          "Never pretend an exercise was completed merely because the note contains instructions.",
          "Use evidence from the supplied note. If completion evidence is missing, say so.",
          "Distinguish recognition, retrieval, discourse/global-model comprehension, speaking, writing, pronunciation, and retention.",
          "Prefer 4 short sections: 今日证据, 主要断点, 已建立连接, 明日检验.",
          "Do not give generic encouragement and do not overwhelm the learner with many tasks."
        ].join("\n")
      },
      {
        role: "user",
        content: prompt + "\n\nVAULT CONTEXT:\n" + context
      }
    ]);
  }

  async askCoach(question, mode = "today", notePath = "") {
    const context = await this.buildContext(mode, notePath);

    return this.chat([
      {
        role: "system",
        content: [
          "You are MiMo English Coach embedded in Obsidian.",
          "Answer in Chinese unless the user asks otherwise.",
          "Use the provided EnglishLearning notes as evidence.",
          "Do not confuse exercise instructions with completed work.",
          "When giving feedback on writing, focus first on idea organization and retrieval, then on grammar.",
          "Keep the answer compact and actionable."
        ].join("\n")
      },
      {
        role: "user",
        content: question + "\n\nVAULT CONTEXT:\n" + context
      }
    ]);
  }
}

class EnglishCoachView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.tab = "today";
    this.selectedPath = "";
    this.busy = false;
  }

  getViewType() {
    return VIEW_TYPE;
  }

  getDisplayText() {
    return "MiMo English Coach";
  }

  getIcon() {
    return "languages";
  }

  async onOpen() {
    await this.render();
  }

  async render() {
    const root = this.contentEl;
    root.empty();
    root.addClass("mec-root");

    const shell = root.createDiv({ cls: "mec-shell" });

    const header = shell.createDiv({ cls: "mec-header" });
    const title = header.createDiv();
    title.createEl("h2", { text: "English" });
    title.createEl("div", {
      text: "Learn · retrieve · review",
      cls: "mec-subtle"
    });

    const refresh = header.createEl("button", {
      cls: "mec-icon-btn",
      attr: { "aria-label": "Refresh" }
    });
    refresh.setText("↻");
    refresh.onclick = () => this.render();

    const nav = shell.createDiv({ cls: "mec-tabs" });
    [
      ["today", "Today"],
      ["library", "Library"],
      ["coach", "Coach"]
    ].forEach(([id, label]) => {
      const b = nav.createEl("button", {
        text: label,
        cls: this.tab === id ? "is-active" : ""
      });
      b.onclick = () => {
        this.tab = id;
        this.render();
      };
    });

    const body = shell.createDiv({ cls: "mec-body" });

    if (this.tab === "today") await this.renderToday(body);
    else if (this.tab === "library") await this.renderLibrary(body);
    else await this.renderCoach(body);
  }

  async renderToday(body) {
    const note = this.plugin.todayNote();

    if (!note) {
      const empty = body.createDiv({ cls: "mec-empty" });
      empty.createEl("h3", { text: "No daily English note yet" });
      empty.createEl("p", {
        text: "The plugin will pick up files matching YYYY-MM-DD-English-*.md in EnglishLearning."
      });
      return;
    }

    const content = await this.plugin.app.vault.cachedRead(note.file);
    const expressions = activeExpressions(content);
    const links = externalLinks(content);

    const hero = body.createDiv({ cls: "mec-today" });
    hero.createEl("div", { text: note.date, cls: "mec-kicker" });
    hero.createEl("h1", { text: note.topic });

    const actions = hero.createDiv({ cls: "mec-actions" });
    this.button(actions, "Open note", () => this.plugin.openFile(note.file), true);

    if (note.htmlFile) {
      this.button(actions, "Open lesson", () => this.plugin.openFile(note.htmlFile));
    }

    this.button(actions, "Analyze today", () => this.analyzeToday());

    const grid = body.createDiv({ cls: "mec-grid" });

    const materials = grid.createDiv({ cls: "mec-panel" });
    materials.createEl("div", { text: "MATERIAL", cls: "mec-label" });

    const meaningful = links
      .filter(x => !/English Learning Hub|Connections/i.test(x.label))
      .slice(0, 3);

    if (!meaningful.length) {
      materials.createEl("p", {
        text: "Open the note to view today's sources.",
        cls: "mec-subtle"
      });
    }

    for (const link of meaningful) {
      const row = materials.createEl("button", { cls: "mec-link-row" });
      row.createEl("span", { text: link.label });
      row.createEl("span", { text: "↗", cls: "mec-subtle" });
      row.onclick = () => window.open(link.url);
    }

    const words = grid.createDiv({ cls: "mec-panel" });
    words.createEl("div", {
      text: "ACTIVE LANGUAGE",
      cls: "mec-label"
    });

    if (!expressions.length) {
      words.createEl("p", {
        text: "No active expressions detected.",
        cls: "mec-subtle"
      });
    }

    const chips = words.createDiv({ cls: "mec-chips" });

    expressions.slice(0, 4).forEach(exp => {
      const chip = chips.createEl("button", {
        text: exp,
        cls: "mec-chip"
      });

      chip.onclick = async () => {
        chip.addClass("is-loading");
        try {
          await this.plugin.speak(exp);
        } catch (e) {
          new Notice(e.message, 6000);
        } finally {
          chip.removeClass("is-loading");
        }
      };
    });

    const focus = body.createDiv({ cls: "mec-panel mec-focus" });
    focus.createEl("div", { text: "TODAY", cls: "mec-label" });

    const focusText = extractSection(content, ["today's focus", "today’s focus"]);
    const one = compactText(
      focusText.replace(/[#>*_\x60]/g, "").trim(),
      420
    );

    focus.createEl("p", {
      text: one || "Open the note for today's focus."
    });

    const cached = this.plugin.data.analyses[note.date];
    if (cached) {
      await this.renderAnalysis(body, cached, "Coach review");
    }
  }

  async renderLibrary(body) {
    const notes = this.plugin.dailyNotes().slice(
      0,
      Number(this.plugin.settings.maxLibraryDays) || 60
    );

    const bar = body.createDiv({ cls: "mec-library-bar" });
    const input = bar.createEl("input", {
      attr: { type: "search", placeholder: "Search topics…" }
    });

    const list = body.createDiv({ cls: "mec-library" });

    const draw = () => {
      list.empty();
      const q = input.value.trim().toLowerCase();

      notes
        .filter(n => !q || (n.date + " " + n.topic).toLowerCase().includes(q))
        .forEach(n => {
          const row = list.createDiv({ cls: "mec-day-row" });

          const main = row.createDiv({ cls: "mec-day-main" });
          main.createEl("div", {
            text: n.date,
            cls: "mec-day-date"
          });
          main.createEl("div", {
            text: n.topic,
            cls: "mec-day-topic"
          });

          const meta = row.createDiv({ cls: "mec-day-meta" });

          if (n.htmlFile) {
            meta.createSpan({ text: "HTML", cls: "mec-badge" });
          }

          if (this.plugin.data.analyses[n.date]) {
            meta.createSpan({ text: "Reviewed", cls: "mec-badge" });
          }

          row.onclick = () => this.plugin.openFile(n.file);

          const coach = meta.createEl("button", {
            text: "Coach",
            cls: "mec-small-btn"
          });

          coach.onclick = ev => {
            ev.stopPropagation();
            this.selectedPath = n.file.path;
            this.tab = "coach";
            this.render();
          };
        });
    };

    input.oninput = draw;
    draw();
  }

  async renderCoach(body) {
    const notes = this.plugin.dailyNotes();

    const top = body.createDiv({ cls: "mec-coach-top" });
    top.createEl("div", { text: "COACH", cls: "mec-label" });
    top.createEl("h3", {
      text: "Ask MiMo about your learning evidence"
    });
    top.createEl("p", {
      text: "The coach reads your EnglishLearning notes. It is instructed not to treat exercise instructions as proof that you completed them.",
      cls: "mec-subtle"
    });

    const contextRow = body.createDiv({ cls: "mec-context-row" });

    const mode = contextRow.createEl("select");
    const todayOption = mode.createEl("option", { text: "Today / selected day" });
    todayOption.value = "today";
    const weekOption = mode.createEl("option", { text: "Last 7 days" });
    weekOption.value = "week";

    const noteSelect = contextRow.createEl("select");

    notes.slice(0, 30).forEach(n => {
      const opt = noteSelect.createEl("option", {
        text: n.date + " · " + n.topic
      });
      opt.value = n.file.path;

      if (this.selectedPath === n.file.path) opt.selected = true;
    });

    if (!this.selectedPath && notes[0]) {
      this.selectedPath = notes[0].file.path;
    }

    noteSelect.onchange = () => {
      this.selectedPath = noteSelect.value;
    };

    mode.onchange = () => {
      noteSelect.disabled = mode.value === "week";
    };

    const presets = body.createDiv({ cls: "mec-presets" });

    const textarea = body.createEl("textarea", {
      cls: "mec-coach-input",
      attr: {
        placeholder: "Ask about today's reading, vocabulary, writing, speaking, or review…"
      }
    });

    [
      [
        "今天学得怎么样？",
        "分析今天的学习证据：哪些只是训练设计，哪些能看出我真的完成了；我目前最明显的断点是什么？"
      ],
      [
        "只看写作",
        "如果笔记里有我的写作内容，请只分析写作：先看观点组织和主动表达调用，再看最重要的语言问题。若没有实际写作内容，请直接告诉我缺少证据。"
      ],
      [
        "一周回顾",
        "总结最近一周真正反复出现的英语学习断点，并给我三个下周可以验证的 retrieval 测试。"
      ],
      [
        "明天怎么复习",
        "基于已有证据，为明天设计一个不超过8分钟的复习检验，重点测试 retrieval，而不是再次阅读。"
      ]
    ].forEach(([label, prompt]) => {
      const b = presets.createEl("button", {
        text: label,
        cls: "mec-preset"
      });

      b.onclick = () => {
        textarea.value = prompt;

        if (label === "一周回顾") {
          mode.value = "week";
          noteSelect.disabled = true;
        }
      };
    });

    const askRow = body.createDiv({ cls: "mec-actions" });
    const ask = this.button(
      askRow,
      "Ask MiMo",
      async () => {
        const q = textarea.value.trim();
        if (!q) return;
        await this.runCoach(body, q, mode.value, noteSelect.value);
      },
      true
    );

    ask.disabled = this.busy;

    const last = this.plugin.data.chats.last;
    if (last) {
      await this.renderAnalysis(body, last, "Last answer");
    }
  }

  button(parent, label, handler, primary = false) {
    const b = parent.createEl("button", {
      text: label,
      cls: primary ? "mec-btn is-primary" : "mec-btn"
    });
    b.onclick = handler;
    return b;
  }

  async analyzeToday() {
    if (this.busy) return;

    const note = this.plugin.todayNote();
    if (!note) {
      new Notice("No English daily note found.");
      return;
    }

    this.busy = true;
    await this.render();

    try {
      const text = await this.plugin.analyze("today", note.file.path);
      this.plugin.data.analyses[note.date] = text;
      await this.plugin.savePluginData();
      this.tab = "today";
      await this.render();
    } catch (e) {
      new Notice(e.message, 6000);
    } finally {
      this.busy = false;
    }
  }

  async runCoach(body, question, mode, path) {
    if (this.busy) return;
    this.busy = true;

    const loading = body.createDiv({
      text: "MiMo is reading your notes…",
      cls: "mec-loading"
    });

    try {
      const answer = await this.plugin.askCoach(question, mode, path);
      this.plugin.data.chats.last = answer;
      await this.plugin.savePluginData();
      loading.remove();
      await this.renderAnalysis(body, answer, "MiMo");
    } catch (e) {
      loading.remove();
      new Notice(e.message, 6000);
    } finally {
      this.busy = false;
    }
  }

  async renderAnalysis(parent, markdown, title) {
    const panel = parent.createDiv({
      cls: "mec-panel mec-analysis"
    });

    panel.createEl("div", {
      text: title.toUpperCase(),
      cls: "mec-label"
    });

    const content = panel.createDiv({ cls: "mec-markdown" });

    await MarkdownRenderer.render(
      this.app,
      markdown,
      content,
      "",
      this
    );
  }
}

class EnglishCoachSettings extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "MiMo English Coach" });
    containerEl.createEl("p", {
      text: "One Token Plan key powers both coaching and TTS. The key is encrypted with your operating system when secure storage is available.",
      cls: "setting-item-description"
    });

    new Setting(containerEl)
      .setName("Token Plan region")
      .setDesc("Choose the Base URL region matching your MiMo Token Plan.")
      .addDropdown(d => d
        .addOption("cn", "China")
        .addOption("sgp", "Singapore")
        .addOption("ams", "Amsterdam")
        .addOption("custom", "Custom")
        .setValue(this.plugin.settings.region)
        .onChange(async value => {
          this.plugin.settings.region = value;
          await this.plugin.saveSettings();
          this.display();
        }));

    if (this.plugin.settings.region === "custom") {
      new Setting(containerEl)
        .setName("Custom Base URL")
        .setDesc("Example: https://…/v1")
        .addText(t => t
          .setValue(this.plugin.settings.customBaseUrl)
          .onChange(async value => {
            this.plugin.settings.customBaseUrl = cleanBase(value);
            await this.plugin.saveSettings();
          }));
    }

    new Setting(containerEl)
      .setName("Coach model")
      .setDesc("Flash is faster; Pro is better for harder analysis.")
      .addDropdown(d => d
        .addOption("mimo-v2.6-flash", "mimo-v2.6-flash")
        .addOption("mimo-v2.6-pro", "mimo-v2.6-pro")
        .setValue(this.plugin.settings.model)
        .onChange(async value => {
          this.plugin.settings.model = value;
          await this.plugin.saveSettings();
        }));

    let keyDraft = "";

    const keySetting = new Setting(containerEl)
      .setName("Token Plan API key")
      .setDesc(
        this.plugin.settings.encryptedKey
          ? "A key is securely saved on this computer."
          : "Paste tp-… or ttp-… once. Do not commit it to the vault."
      );

    keySetting.addText(t => {
      t.inputEl.type = "password";
      t.setPlaceholder(
        this.plugin.settings.encryptedKey
          ? "••••••••••••"
          : "tp-…"
      );
      t.onChange(value => {
        keyDraft = value;
      });
    });

    keySetting.addButton(b => b
      .setButtonText("Save key")
      .setCta()
      .onClick(async () => {
        if (!keyDraft.trim()) {
          new Notice("Paste the key first.");
          return;
        }
        await this.plugin.setKey(keyDraft);
        keyDraft = "";
        this.display();
      }));

    keySetting.addButton(b => b
      .setButtonText("Clear")
      .onClick(async () => {
        await this.plugin.setKey("");
        this.display();
      }));

    new Setting(containerEl)
      .setName("Test connection")
      .setDesc("Sends a tiny request to the selected MiMo model.")
      .addButton(b => b
        .setButtonText("Test")
        .onClick(async () => {
          b.setDisabled(true);
          b.setButtonText("Testing…");

          try {
            const result = await this.plugin.testConnection();
            new Notice("MiMo connected: " + result.slice(0, 40));
          } catch (e) {
            new Notice(e.message, 6000);
          } finally {
            b.setDisabled(false);
            b.setButtonText("Test");
          }
        }));

    new Setting(containerEl)
      .setName("TTS voice")
      .setDesc("Used by the 'Speak selected text' command and active-language buttons.")
      .addDropdown(d => d
        .addOption("Mia", "Mia")
        .addOption("Chloe", "Chloe")
        .addOption("Milo", "Milo")
        .addOption("Dean", "Dean")
        .setValue(this.plugin.settings.voice)
        .onChange(async value => {
          this.plugin.settings.voice = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("EnglishLearning folder")
      .setDesc("Daily notes are discovered from YYYY-MM-DD-English-*.md.")
      .addText(t => t
        .setValue(this.plugin.settings.folder)
        .onChange(async value => {
          this.plugin.settings.folder = String(value || "EnglishLearning")
            .replace(/^\/+|\/+$/g, "");
          await this.plugin.saveSettings();
          this.plugin.refreshViews();
        }));

    containerEl.createEl("h3", { text: "Privacy" });
    containerEl.createEl("p", {
      text: "The plugin sends only the note context needed for the coaching request to the MiMo Base URL you selected. API keys are never inserted into notes, HTML files, or prompts.",
      cls: "setting-item-description"
    });
  }
}

module.exports = EnglishCoachPlugin;

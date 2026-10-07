const { Plugin, ItemView, PluginSettingTab, Setting, Notice, MarkdownView, FileSystemAdapter, normalizePath, requestUrl } = require('obsidian');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const VIEW = 'debate-room-view';
const DEFAULTS = { nodePath: 'node', exportFolder: '论场', pythonPath: '', autoExport: true, exportFormat: 'both' };

function exportFolder(value) {
  const folder = String(value || '').trim().replace(/\\/g, '/');
  if (!folder || folder.startsWith('/') || /[:\x00-\x1f]/.test(folder) || folder.split('/').some(p => !p || p === '.' || p === '..')) {
    throw new Error('保存目录必须是仓库内的相对路径，例如：论场/辩论');
  }
  if (folder.split('/').some(p => p.startsWith('.'))) throw new Error('不能保存到隐藏目录');
  return normalizePath(folder);
}

class DebateView extends ItemView {
  constructor(leaf, plugin) { super(leaf); this.plugin = plugin; this.token = randomUUID(); this.ready = false; this.pendingTopic = null; }
  getViewType() { return VIEW; }
  getDisplayText() { return '论场'; }
  getIcon() { return 'messages-square'; }
  async onOpen() {
    this.contentEl.empty(); this.contentEl.addClass('debate-room-view');
    const toolbar = this.contentEl.createDiv({ cls: 'debate-room-toolbar' });
    toolbar.createSpan({ text: '论场 · Debate Room' });
    const button = (text, action) => {
      const el = toolbar.createEl('button', { text });
      this.registerDomEvent(el, 'click', () => { void action().catch(e => new Notice(e.message)); });
    };
    button('用当前笔记创建辩题', () => this.plugin.importNote());
    button('保存当前辩论到仓库', () => this.plugin.saveDebate(this));
    button('重启服务', () => this.plugin.restart());
    this.status = this.contentEl.createDiv({ cls: 'debate-room-status', text: '正在启动本地服务…' });
    try {
      const origin = await this.plugin.startService();
      if (this.closed) return;
      this.origin = origin;
      this.frame = this.contentEl.createEl('iframe', { cls: 'debate-room-frame', attr: { title: '论场工作区', sandbox: 'allow-scripts allow-same-origin allow-forms allow-downloads', allow: 'microphone' } });
      this.registerDomEvent(window, 'message', event => {
        if (event.source !== this.frame.contentWindow || event.origin !== this.origin || event.data?.token !== this.token || event.data?.channel !== 'debate-room') return;
        if (event.data.type === 'ready') { this.ready = true; this.status.hidden = true; this.sendTopic(); }
        if (event.data.type === 'state') this.debateId = /^[a-f0-9-]{36}$/.test(event.data.id || '') ? event.data.id : null;
      });
      this.frame.src = `${origin}/#obsidian=${encodeURIComponent(this.token)}`;
    } catch (e) { this.status.textContent = `服务启动失败：${e.message}\n请在设置 → 论场中填写 Node.js 20+ 可执行文件的完整路径，再重启服务。`; }
  }
  sendTopic() {
    if (!this.ready || !this.pendingTopic) return;
    this.frame.contentWindow.postMessage({ channel: 'debate-room', token: this.token, type: 'topic', topic: this.pendingTopic }, this.origin);
    this.pendingTopic = null;
  }
  async onClose() { this.closed = true; this.ready = false; this.frame?.remove(); }
}

class DebateSettings extends PluginSettingTab {
  constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }
  display() {
    this.containerEl.empty();
    this.containerEl.createEl('p', { text: '插件自动启动随附的本地服务，需要 Node.js 20+。模型和搜索密钥在论场内配置，仅保存在服务内存，重启后需重新填写。' });
    new Setting(this.containerEl).setName('Node.js 可执行文件').setDesc('默认 node；找不到时填写完整路径，如 C:\\Program Files\\nodejs\\node.exe。修改后重启服务。').addText(t => t.setValue(this.plugin.settings.nodePath).onChange(async value => { this.plugin.settings.nodePath = value.trim() || 'node'; await this.plugin.saveSettings(); }));
    new Setting(this.containerEl).setName('笔记保存目录').setDesc('仓库内的相对路径。每次保存创建新笔记，不覆盖已有笔记。').addText(t => t.setValue(this.plugin.settings.exportFolder).onChange(async value => { try { this.plugin.settings.exportFolder = exportFolder(value); await this.plugin.saveSettings(); } catch (e) { new Notice(e.message); } }));
    new Setting(this.containerEl).setName('语音 Python 路径（可选）').setDesc('使用 Edge 神经语音时填写已安装 edge-tts 的 Python 路径；也可在论场内选择系统朗读。修改后重启服务。').addText(t => t.setValue(this.plugin.settings.pythonPath).onChange(async value => { this.plugin.settings.pythonPath = value.trim(); await this.plugin.saveSettings(); }));
    new Setting(this.containerEl).setName('自动归档辩论与训练').setDesc('每次发言、点评、练习提交和教练反馈后更新专用归档文件；包括未得到反馈的练习。').addToggle(t => t.setValue(this.plugin.settings.autoExport !== false).onChange(async value => { this.plugin.settings.autoExport = value; await this.plugin.saveSettings(); }));
    new Setting(this.containerEl).setName('自动归档格式').setDesc('默认同时保存 Markdown 与可独立打开的 HTML。').addDropdown(d => d.addOptions({ both: 'MD + HTML', md: 'Markdown', html: 'HTML' }).setValue(this.plugin.settings.exportFormat || 'both').onChange(async value => { this.plugin.settings.exportFormat = value; await this.plugin.saveSettings(); }));
    new Setting(this.containerEl).setName('重启本地服务').setDesc('会中止生成并保留已完成发言。').addButton(b => b.setButtonText('重启').onClick(() => { void this.plugin.restart().catch(e => new Notice(e.message)); }));
  }
}

class DebatePlugin extends Plugin {
  async onload() {
    this.settings = { ...DEFAULTS, ...await this.loadData() };
    this.archiveWrites = Promise.resolve();
    this.archiveStatus = this.addStatusBarItem(); this.archiveStatus.setText('论场：自动归档已启用');
    this.registerView(VIEW, leaf => new DebateView(leaf, this));
    this.addRibbonIcon('messages-square', '打开论场', () => { void this.openView().catch(e => new Notice(e.message)); });
    this.addCommand({ id: 'open', name: '打开论场', callback: () => { void this.openView().catch(e => new Notice(e.message)); } });
    this.addCommand({ id: 'from-note', name: '用当前笔记创建辩题', callback: () => { void this.importNote().catch(e => new Notice(e.message)); } });
    this.addCommand({ id: 'save-debate', name: '保存当前辩论到仓库', callback: () => { void this.saveDebate().catch(e => new Notice(e.message)); } });
    this.addSettingTab(new DebateSettings(this.app, this));
    this.registerEvent(this.app.workspace.on('file-open', file => { if (file?.extension === 'md') this.notePath = file.path; }));
    this.notePath = this.app.workspace.getActiveFile()?.path;
  }
  async saveSettings() { await this.saveData(this.settings); }
  async openView() {
    let leaf = this.app.workspace.getLeavesOfType(VIEW)[0];
    if (!leaf) { leaf = this.app.workspace.getLeaf('tab'); await leaf.setViewState({ type: VIEW, active: true }); }
    await this.app.workspace.revealLeaf(leaf);
    return leaf.view;
  }
  startService() {
    if (this.starting) return this.starting;
    if (!(this.app.vault.adapter instanceof FileSystemAdapter)) return Promise.reject(new Error('需要桌面版文件系统仓库'));
    const base = this.app.vault.adapter.getBasePath();
    const pluginDir = path.resolve(base, this.manifest.dir);
    const env = { ...process.env, PORT: '0', DATA_DIR: path.join(pluginDir, 'runtime-data'), PROVIDER: 'demo', OBSIDIAN_EMBED: '1' };
    // Do not implicitly reuse provider credentials inherited from the desktop environment.
    for (const key of ['MODEL_BASE_URL', 'MODEL_NAME', 'MODEL_API_KEY', 'TAVILY_API_KEY']) delete env[key];
    if (this.settings.pythonPath) env.VOICE_PYTHON = this.settings.pythonPath;
    this.starting = new Promise((resolve, reject) => {
      const child = spawn(this.settings.nodePath, [path.join(pluginDir, 'runtime', 'server.mjs')], { cwd: path.join(pluginDir, 'runtime'), env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
      this.child = child;
      let settled = false, errorText = '';
      const fail = error => { if (settled) return; settled = true; clearTimeout(timer); this.starting = null; if (this.child === child) this.child = null; child.kill(); reject(error); };
      const timer = setTimeout(() => fail(new Error('启动超时（20 秒）')), 20000);
      child.stdout.resume();
      child.stderr.on('data', chunk => { errorText = (errorText + chunk.toString()).slice(-1500); });
      child.once('error', e => fail(new Error(`无法启动 Node.js：${e.message}`)));
      child.once('exit', () => {
        if (!settled) { fail(new Error(errorText || '服务在启动时退出，请确认 Node.js 版本至少为 20')); return; }
        if (this.child === child) {
          this.child = null; this.starting = null;
          for (const leaf of this.app.workspace.getLeavesOfType(VIEW)) {
            const view = leaf.view; view.ready = false; view.status.hidden = false; view.status.textContent = '本地服务已退出，请点击重启服务。';
          }
          if (!this.stopping) new Notice('论场服务已退出，请重启服务');
        }
      });
      child.on('message', message => {
        if (message?.type === 'archive' && this.child === child) { this.queueArchive(message.documents); return; }
        if (message?.type === 'archive-error') { new Notice(message.error); return; }
        if (settled || message?.type !== 'ready' || !Number.isInteger(message.port) || message.port < 1 || message.port > 65535) return;
        settled = true; clearTimeout(timer); this.origin = `http://127.0.0.1:${message.port}`; resolve(this.origin);
      });
    });
    return this.starting;
  }
  async stopService() {
    const child = this.child; this.stopping = true; this.starting = null; this.origin = null;
    if (!child || child.exitCode !== null) { this.child = null; this.stopping = false; await this.archiveWrites; return; }
    await new Promise(resolve => {
      const timer = setTimeout(() => { child.kill(); resolve(); }, 10000);
      child.once('exit', () => { clearTimeout(timer); resolve(); });
      if (child.connected) child.send({ type: 'shutdown' }, error => { if (error) child.kill(); }); else child.kill();
    });
    if (this.child === child) this.child = null;
    this.stopping = false;
    await this.archiveWrites;
  }
  queueArchive(documents) {
    if (this.settings.autoExport === false) return;
    this.archiveWrites = (this.archiveWrites || Promise.resolve()).then(() => this.writeArchive(documents)).catch(error => {
      this.archiveStatus?.setText('论场：自动归档失败');
      new Notice(`论场自动归档失败：${error.message}。原始记录及服务端归档仍保留。`);
    });
  }
  async writeArchive(documents) {
    if (!documents || !['debate', 'coach'].includes(documents.type) || !/^[a-f0-9-]{36}$/.test(documents.id || '')) throw new Error('归档记录无效');
    const marker = `<!-- debate-room:auto:${documents.type}:${documents.id} -->`;
    if (typeof documents.markdown !== 'string' || typeof documents.html !== 'string' || !documents.markdown.startsWith(marker) || !documents.html.includes(marker)) throw new Error('归档内容无效');
    const folder = exportFolder(this.settings.exportFolder) + '/自动归档/' + (documents.type === 'debate' ? '辩论' : '训练');
    let current = '';
    for (const part of folder.split('/')) { current = current ? `${current}/${part}` : part; if (!this.app.vault.getAbstractFileByPath(current)) await this.app.vault.createFolder(current); }
    const title = (String(documents.title || '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').replace(/[. ]+$/, '').slice(0, 55) || '记录');
    const format = this.settings.exportFormat || 'both';
    for (const [extension,content] of [['md',documents.markdown],['html',documents.html]]) {
      if (format !== 'both' && format !== extension) continue;
      const filename = normalizePath(`${folder}/${title}-${documents.id}.${extension}`);
      const existing = this.app.vault.getAbstractFileByPath(filename);
      if (existing) {
        if (!(await this.app.vault.read(existing)).includes(marker)) throw new Error(`发现同名非归档文件，未覆盖：${filename}`);
        await this.app.vault.modify(existing,content);
      } else await this.app.vault.create(filename,content);
    }
    this.archiveStatus?.setText('论场：辩论与训练已自动归档');
  }
  async restart() {
    await this.app.workspace.detachLeavesOfType(VIEW);
    await this.stopService();
    await this.openView();
  }
  async importNote() {
    const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
    const file = markdownView?.file || this.app.vault.getAbstractFileByPath(this.notePath || '');
    if (!file || file.extension !== 'md') throw new Error('请先打开一篇 Markdown 笔记');
    const selection = markdownView?.editor.getSelection().trim();
    const topic = (selection || file.basename).slice(0, 500);
    const view = await this.openView(); view.pendingTopic = topic; view.sendTopic();
    new Notice('已填入辩题，请确认双方角色及模型后开始辩论');
  }
  async saveDebate(view) {
    view ||= this.app.workspace.getLeavesOfType(VIEW)[0]?.view;
    if (!view?.ready || !view.debateId) throw new Error('请先在论场中创建或打开一场辩论');
    const origin = await this.startService(), id = view.debateId;
    const response = await requestUrl({ url: `${origin}/api/debates/${id}/export`, throw: false });
    if (response.status !== 200) throw new Error('导出失败，请确认辩论记录仍然存在');
    const folder = exportFolder(this.settings.exportFolder);
    let current = '';
    for (const part of folder.split('/')) { current = current ? `${current}/${part}` : part; if (!this.app.vault.getAbstractFileByPath(current)) await this.app.vault.createFolder(current); }
    const title = (response.text.split('\n')[0].replace(/^#\s*/, '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').replace(/[. ]+$/, '').slice(0, 70) || '辩论');
    const filename = normalizePath(`${folder}/${title}-${randomUUID()}.md`);
    const file = await this.app.vault.create(filename, response.text);
    await this.app.workspace.getLeaf('tab').openFile(file);
    new Notice(`已保存：${filename}`);
  }
  onunload() { void this.stopService(); }
}

module.exports = DebatePlugin;
// Exposed for package tests; Obsidian loads the default CommonJS class above.
module.exports.exportFolder = exportFolder;

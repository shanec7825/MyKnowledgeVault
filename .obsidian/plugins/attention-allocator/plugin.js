"use strict";

const { Plugin, ItemView, PluginSettingTab, Setting, Notice, MarkdownRenderer, Modal, TFile } = require("obsidian");
const path = require("node:path");
const { randomUUID, createHash } = require("node:crypto");
const { latestConversationLine, artifactHtml, generateAudio, within, DEFAULTS, QmdClient, Mem0Client, generatePlan, generateSummary, generateImage, redact, shanghaiClock, journalEntry, appendJournal, memoryImportRows, journalCallout, conversationText, normalizeJournalCallouts, diaryCards, aiReadable, diarySelection, conversationHistory } = require("./core");

const VIEW = "attention-allocator-home";
const STATE = ".vault-meta/attention-allocator/state.json";


const ZH = {
  'Voice preview':'音色试听', 'Preview':'试听', 'Use this voice':'使用此音色', 'Automatic style':'情境风格', 'Default style':'默认风格', 'Custom':'自定义', 'Gentle':'舒缓', 'Curious':'好奇', 'Clear':'利落', 'Story':'故事',
  'Audio':'声音', 'Audio model':'声音模型', 'Voice':'音色', 'Voice style':'声音风格', 'Audio key':'声音密钥', 'Separate MiMo API key':'独立 MiMo API 密钥', 'Generate audio':'生成声音', 'Creating audio…':'生成声音中…', 'Export works':'生成作品文件',
  'Record outcome':'记录成果', 'Continue conversation':'继续对话', 'New conversation':'新建对话',
  'Focus complete. Take a break.':'专注时间结束，休息一下。', 'Break complete.':'休息时间结束。', 'Timer complete':'计时结束', 'OK':'知道了',
  'Reply here…':'在这里继续对话…', 'Continuing':'正在继续对话',
  'Start service':'启动服务', 'Auto learn':'自动提取', 'Learn latest':'提取最近对话',
  'Learn this':'提取这段对话', 'All notes':'全部笔记', 'Knowledge':'知识笔记', 'Journals':'日记',
  'Recent journals':'近期日记', 'No matching notes':'没有匹配的知识笔记',
  'Memory extraction queued':'已提交记忆提取，等待处理', 'Memory extraction not queued':'未提交记忆提取',
  'AI guidance':'AI 引导', 'Record only':'仅记录', 'AI reading':'AI 读取',
  'Saved without AI reading':'已记录，AI 不读取',
  'AI guidance · on':'AI 引导 · 开', 'Record only · AI off':'仅记录 · AI 关',
  'Attention':'注意力', 'Menu':'菜单', 'Memory':'记忆', 'Search':'检索', 'Settings':'设置',
  'Recent':'最近活动', 'Library':'资料库', 'Open':'打开日记', 'Review':'回顾', 'Today':'今天',
  'What’s on your mind?':'此刻在想什么？', 'Continue':'继续', 'Cancel':'取消', 'Save':'保存',
  'Context':'检索关键词', 'Search keywords (optional)':'检索关键词（可选）', 'Search keywords':'检索关键词',
  'Reflect':'反省', 'Reflection':'反省', 'What did you notice?':'你发现了什么？', 'More':'更多',
  'Timer':'番茄钟', 'Focus · 25m':'专注 · 25 分钟', 'Break · 5m':'休息 · 5 分钟',
  'Start':'开始', 'Pause':'暂停', 'Restart':'重新开始', 'Reset':'重置', 'Done':'完成', 'Started ✓':'已开始 ✓',
  'Earlier day':'上一天', 'Later day':'下一天', 'Previous conversation':'上一张对话', 'Next conversation':'下一张对话',
  'A fresh page.':'新的一页。', 'No activities yet':'暂无活动', 'Recently opened':'最近打开',
  'Suggested':'待开始', 'Active':'进行中', 'Paused':'已暂停', 'All entries':'全部日记',
  'Save to journal':'保存到日记', 'Create image':'生成图片', 'Make it smaller':'再小一步',
  'Journal':'日记', 'Another angle':'换个视角', 'Try it':'试一试', 'Explore →':'探索 →',
  'Your output':'你的成果', 'Write, paste code, or link your work.':'写下成果、粘贴代码或附上链接。',
  'Save a checkpoint':'保存进度', 'Where will you pick up?':'下次从哪里继续？',
  'Listen':'朗读', 'Stop':'停止', 'Remember':'记住', 'Confirmed memory':'确认的记忆',
  'A preference you want to remember':'你希望记住的偏好', 'Read':'查看',
  'Filter memories':'筛选记忆', 'Refresh':'刷新', 'Import ChatGPT':'导入 ChatGPT',
  'Import ChatGPT memories':'导入 ChatGPT 记忆', 'Paste saved memories, one per line. Review before importing.':'粘贴已保存的记忆，每行一条，预览后导入。',
  'Saved memories…':'已保存的记忆…', 'Saved memories':'已保存的记忆', 'Import selected':'导入所选',
  'Notes & journals':'笔记与日记', 'Search notes and journals':'检索笔记与日记',
  'Loading…':'加载中…', 'Searching…':'检索中…', 'Finding context…':'寻找关联…',
  'Creating…':'生成中…', 'Generating…':'生成中…', 'Creating image…':'生成图片中…',
  'Reflecting…':'回顾中…', 'Review summary':'回顾总结', 'Edit before saving':'保存前可以修改',
  'Review your summary':'请核对总结', 'Summary saved':'总结已保存', 'Reflection saved':'反省已保存',
  'Write a thought first':'先写下此刻的想法', 'Saved to today’s journal':'已保存到今天的日记',
  'Unable to load today.':'无法读取日记。', 'Language':'界面语言', 'Directions':'成长方向',
  'English, projects, rest…':'英语、项目、休息…', 'Profile':'个人画像', 'Who are you becoming?':'你想成为怎样的人？',
  'Endpoint':'接口', 'Model':'模型', 'API Key':'API 密钥', 'Configured':'已配置', 'Save key':'保存密钥',
  'Connection':'连接', 'Test':'测试', 'Step duration':'行动时长', 'Semantic search':'语义检索',
  'Node path':'Node 路径', 'Search index':'检索索引', 'Web search':'网络检索',
  'Pay-as-you-go API only. Token Plan shows search links.':'按量 API 支持原生搜索，Token Plan 提供搜索链接。',
  'Save outcomes to journal':'保存行动成果', 'Replies are always saved.':'对话回复始终自动保存。',
  'Recall memory':'召回记忆', 'Existing local Mem0':'复用本地 Mem0', 'Share note excerpts':'发送笔记片段',
  'Up to 5 excerpts':'最多 5 段', 'Share recalled memories':'发送关联记忆', 'Up to 5 memories':'最多 5 条',
  'Extract memory from outputs':'从成果提取记忆', 'Uses local Mem0':'使用本地 Mem0', 'Memory connection':'记忆服务连接',
  'Add memory':'添加记忆', 'Add':'添加', 'Images':'图片', 'Image endpoint':'图片接口', 'Image model':'图片模型',
  'Image key':'图片密钥', 'Separate image key':'单独的图片密钥', 'Journal cards':'日记卡片',
  'Sources':'来源', 'Stop listening':'停止朗读', 'Me':'我', 'AI':'AI',
  'Add your Xiaomi key in Settings':'在设置中添加 Xiaomi 密钥', 'Generation failed':'生成失败',
  'Wait for the current request':'请等待当前请求完成', 'No journal entries today':'今天还没有日记',
  'Select at least one memory':'至少选择一条记忆', 'Unable to render entry':'无法显示内容',
  'Confirm memory':'确认记忆', 'Save to local memory':'保存到本地记忆'
};
function uiText(language, text) {
  if(language==='en')return text;
  if(ZH[text])return ZH[text];
  return String(text).replace(/^(\d+) memories( · showing 100)?$/,(_,n,more)=>n+' 条记忆'+(more?' · 显示前 100 条':''))
    .replace(/^(\d+) results$/, '$1 条结果').replace(/^(\d+) imported · (\d+) duplicates skipped$/,'已导入 $1 条 · 跳过 $2 条重复记忆')
    .replace(/^Context · (\d+) notes · (\d+) memories$/,'关联 · $1 篇笔记 · $2 条记忆');
}
function localize(root, language) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node=walker.currentNode;
    if (node.parentElement?.closest('.aa-memo-body,.aa-material,.aa-stream-material,.aa-memory-item,.aa-excerpt,.aa-record,.aa-row strong,.aa-topics')) continue;
    const translated=uiText(language,node.nodeValue); if (translated!==node.nodeValue) node.nodeValue=translated;
  }
  for (const el of root.querySelectorAll('[placeholder],[aria-label],[title]')) for (const attr of ['placeholder','aria-label','title']) {
    const value=el.getAttribute(attr); if(value && uiText(language,value)!==value) el.setAttribute(attr,uiText(language,value));
  }
}
function watchLanguage(root, plugin) {
  let queued=false;
  const observer=new MutationObserver(()=>{
    if(queued)return;queued=true;
    queueMicrotask(()=>{queued=false;localize(root,plugin.settings.language);});
  });
  localize(root,plugin.settings.language);observer.observe(root,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['placeholder','aria-label','title']});
  return observer;
}
class LocalizedModal extends Modal {
  open() { super.open();this.languageObserver=watchLanguage(this.contentEl,this.app.plugins.plugins['attention-allocator'] || {settings:{language:'zh'}}); }
  close() { this.languageObserver?.disconnect();super.close(); }
}

function button(parent, label, action, primary = false) {
  const el = parent.createEl("button", { text: label, cls: primary ? "mod-cta" : "" });
  el.addEventListener("click", async () => {
    el.disabled = true;
    try { await action(); } catch (error) { new Notice(redact(error.message || "操作失败")); }
    finally { if (el.isConnected) el.disabled = false; }
  });
  return el;
}

class TextModal extends LocalizedModal {
  constructor(app, title, placeholder, submit, value = "") {
    super(app); this.titleText = title; this.placeholder = placeholder; this.submit = submit; this.value = value;
  }
  onOpen() {
    this.contentEl.createEl("h2", { text: this.titleText });
    const input = this.contentEl.createEl("textarea", { cls: "aa-modal-input", attr: { placeholder: this.placeholder } });
    input.value = this.value;
    button(this.contentEl, "Save", async () => {
      if (!input.value.trim()) throw new Error("请填写内容");
      await this.submit(input.value.trim()); this.close();
    }, true);
    input.focus();
  }
  onClose() { this.contentEl.empty(); }
}

class ReadModal extends LocalizedModal {
  constructor(app,title,text) { super(app); this.titleText=title; this.text=text; }
  onOpen() {
    this.contentEl.createEl('h2',{text:this.titleText});
    MarkdownRenderer.render(this.app,this.text,this.contentEl.createDiv({cls:'aa-memo-body'}),'',this).catch(()=>new Notice('Unable to render entry'));
  }
  onClose() { this.contentEl.empty(); }
}

class VoicePreviewModal extends LocalizedModal {
  constructor(app,plugin,refresh){super(app);this.plugin=plugin;this.refresh=refresh;}
  onOpen(){
    this.plugin.voicePreviewModal?.close();this.plugin.voicePreviewModal=this;
    this.contentEl.createEl('h2',{text:'Voice preview'});
    const voice=new Setting(this.contentEl).setName('Voice');
    this.voice=this.plugin.settings.audioVoice;
    voice.addDropdown(c=>{for(const name of ['mimo_default','冰糖','茉莉','苏打','白桦','Mia','Chloe','Milo','Dean'])c.addOption(name,name);c.setValue(this.voice).onChange(value=>{this.voice=value;});});
    const style=this.contentEl.createEl('textarea',{cls:'aa-modal-input',attr:{'aria-label':'Voice style',maxlength:'1000'}});style.value=this.plugin.settings.audioStyle;
    new Setting(this.contentEl).setName('Voice style').addDropdown(c=>c.addOption('custom','Custom').addOption('gentle','Gentle').addOption('curious','Curious').addOption('clear','Clear').addOption('story','Story').onChange(value=>{
      const styles={gentle:'温柔舒缓，语速偏慢，句间自然停顿，不说教。',curious:'轻快好奇，略带俏皮，语调有变化，不夸张。',clear:'清楚利落，语速适中，重点略加重音，行动邀请轻巧。',story:'像讲一段有画面的故事，情绪有层次，留出想象的停顿。'};if(styles[value])style.value=styles[value];
    }));
    this.audio=this.contentEl.createEl('audio',{attr:{controls:'',preload:'none','aria-label':'Voice preview'}});this.audio.style.width='100%';
    const tools=this.contentEl.createDiv({cls:'aa-tools'});
    this.previewButton=button(tools,'Preview',async()=>{
      this.controller=new AbortController();this.plugin.jobs.add(this.controller);
      try{
        const bytes=await this.plugin.previewVoice(this.voice,style.value,this.controller.signal);
        if(this.controller.signal.aborted||!this.audio.isConnected)return;
        this.audio.pause();if(this.url)URL.revokeObjectURL(this.url);
        this.url=URL.createObjectURL(new Blob([bytes],{type:'audio/wav'}));this.audio.src=this.url;this.audio.load();
        await this.audio.play().catch(()=>{});
      }catch(e){if(!this.controller.signal.aborted)throw e;}finally{this.plugin.jobs.delete(this.controller);}
    },true);
    button(tools,'Stop',()=>{this.controller?.abort();this.audio.pause();});
    button(tools,'Use this voice',async()=>{this.plugin.settings.audioVoice=this.voice;await this.plugin.saveSettings();this.close();this.refresh?.();});
  }
  onClose(){this.controller?.abort();this.audio?.pause();if(this.url)URL.revokeObjectURL(this.url);if(this.plugin.voicePreviewModal===this)this.plugin.voicePreviewModal=null;this.contentEl.empty();}
}

class MemoryImportModal extends LocalizedModal {
  constructor(app, plugin, refresh) { super(app); this.plugin = plugin; this.refresh = refresh; }
  onOpen() {
    this.contentEl.createEl('h2', { text: 'Import ChatGPT memories' });
    this.contentEl.createEl('p', { text: 'Paste saved memories, one per line. Review before importing.', cls: 'aa-caption' });
    const input = this.contentEl.createEl('textarea', { cls: 'aa-modal-input', attr: { placeholder: 'Saved memories…', 'aria-label': 'Saved memories', maxlength: '100000' } });
    const preview = this.contentEl.createDiv({ cls: 'aa-import-preview' });
    button(this.contentEl, 'Review', () => {
      const rows = memoryImportRows(input.value); preview.empty();
      const choices = rows.map(text => {
        const row = preview.createEl('label', { cls: 'aa-import-row' });
        const checkbox = row.createEl('input', { attr: { type: 'checkbox' } }); checkbox.checked = true;
        row.createEl('span', { text }); return { checkbox, text };
      });
      button(preview, 'Import selected', async () => {
        const selected = choices.filter(x => x.checkbox.checked).map(x => x.text);
        if (!selected.length) throw new Error('Select at least one memory');
        const result = await this.plugin.mem0.importMemories(selected.join('\n'));
        new Notice(`${result.added} imported · ${result.skipped} duplicates skipped`);
        await this.refresh(); this.close();
      }, true);
    });
  }
  onClose() { this.contentEl.empty(); }
}

class MemoryModal extends LocalizedModal {
  constructor(app, plugin) { super(app); this.plugin = plugin; this.rows = []; }
  onOpen() {
    this.contentEl.createEl('h2', { text: 'Memory' });
    const tools = this.contentEl.createDiv({ cls: 'aa-tools' });
    this.filter = tools.createEl('input', { attr: { type:'search', placeholder:'Filter memories', 'aria-label':'Filter memories' } });
    this.filter.addEventListener('input', () => this.renderRows());
    button(tools,'Refresh', () => this.load());
    button(tools,'Start service',async()=>{await this.plugin.mem0.ensure();await this.load();});
    const auto=tools.createEl('label');
    const checkbox=auto.createEl('input',{attr:{type:'checkbox'}});checkbox.checked=this.plugin.settings.captureMemory;
    auto.createEl('span',{text:'Auto learn'});
    checkbox.addEventListener('change',async()=>{
      try {if(checkbox.checked)await this.plugin.enableMemory();else {this.plugin.settings.captureMemory=false;await this.plugin.saveSettings();}await this.load();}
      catch(e){checkbox.checked=this.plugin.settings.captureMemory;this.status.setText(redact(e.message));}
    });
    button(tools,'Learn latest',async()=>{const latest=this.plugin.state.activities[0];if(!latest)throw new Error('No activities yet');await this.plugin.enableMemory();checkbox.checked=true;await this.plugin.queueMemory(latest);await this.load();});
    button(tools,'Import ChatGPT', () => this.plugin.openMemoryImport(() => this.load()));
    this.status = this.contentEl.createDiv({ cls: 'aa-caption', attr: { role:'status' } });
    this.listEl = this.contentEl.createDiv({ cls: 'aa-browser-list' });
    this.load().catch(e => this.status.setText(redact(e.message)));
  }
  async load() {
    this.status.setText('Loading…');this.health=await this.plugin.mem0.ensure(); this.rows = await this.plugin.mem0.list(); this.renderRows();
  }
  renderRows() {
    this.listEl.empty();
    const query = this.filter.value.toLocaleLowerCase();
    const rows = this.rows.filter(x => (x.text + ' ' + x.source).toLocaleLowerCase().includes(query));
    this.status.setText(this.plugin.settings.language==='en'?`${rows.length} memories · Service ready · ${this.health?.pending || 0} pending`:`${rows.length} 条记忆 · 服务就绪 · ${this.health?.pending || 0} 条待提取`);
    for (const row of rows.slice(0,100)) {
      const item = this.listEl.createDiv({ cls:'aa-memory-item' });
      item.createEl('p',{ text:row.text });
      if (row.source) item.createEl('span',{ text:row.source, cls:'aa-caption' });
    }
  }
  onClose() { this.contentEl.empty(); }
}

class SearchModal extends LocalizedModal {
  constructor(app, plugin) { super(app); this.plugin = plugin; }
  onOpen() {
    this.contentEl.createEl('h2', { text: 'Search' });
    const tools = this.contentEl.createDiv({ cls: 'aa-tools' });
    this.input = tools.createEl('input', { attr: { type:'search', placeholder:'Notes & journals', 'aria-label':'Search notes and journals' } });
    const scope=tools.createEl('select');for(const [value,text] of [['all','All notes'],['knowledge','Knowledge'],['journals','Journals']])scope.createEl('option',{value,text});
    const search = async () => {
      const query = this.input.value.trim(); if (!query) return;
      if (this.busy) return; this.busy = true; this.status.setText('Searching…'); this.results.empty();
      try {
        const notes = await this.plugin.qmd.search(query,this.plugin.settings.semantic,scope.value);
        this.status.setText(`${notes.length} results`);
        for (const note of notes) {
          const row = this.results.createDiv({ cls:'aa-search-result' });
          button(row,note.title, async () => { await this.plugin.openNote(note.path,note.line); this.close(); });
          row.createEl('span',{ text:`${note.path}:${note.line}`, cls:'aa-caption' });
          row.createEl('pre',{ text:note.content, cls:'aa-excerpt' });
        }
      } catch (e) { this.status.setText(redact(e.message)); }
      finally { this.busy = false; }
    };
    button(tools,'Search',search,true);
    this.input.addEventListener('keydown',e => { if (e.key === 'Enter') { e.preventDefault(); search(); } });
    this.status = this.contentEl.createDiv({ cls:'aa-caption', attr:{role:'status'} });
    this.results = this.contentEl.createDiv({ cls:'aa-browser-list' }); this.input.focus();
  }
  onClose() { this.contentEl.empty(); }
}

class AttentionPlugin extends Plugin {
  async onload() {
    this.root = this.app.vault.adapter.getBasePath?.();
    if (!this.root) { new Notice("注意力分配器需要桌面文件系统知识库"); return; }
    this.settings = Object.assign({}, DEFAULTS, await this.loadData());
    this.settings.language=this.settings.language==='en'?'en':'zh';
    this.settings.mode = 'auto';
    this.settings.maxMinutes = Math.min(15, Math.max(1, Number(this.settings.maxMinutes) || 5));
    this.state = { version: 1, activities: [], visits: [], draft: "" };
    this.saveTail = Promise.resolve(); this.disposed = false; this.jobs = new Set();
    if (await this.app.vault.adapter.exists(STATE)) {
      try {
        const saved = JSON.parse(await this.app.vault.adapter.read(STATE));
        if (saved.version !== 1 || !Array.isArray(saved.activities) || !Array.isArray(saved.visits) ||
          saved.activities.some(x => !x?.id || typeof x.input !== "string" || !x.plan || typeof x.plan.title !== "string" || !Array.isArray(x.plan.steps) || !Array.isArray(x.sources)) ||
          saved.visits.some(x => typeof x?.path !== "string")) throw new Error("状态格式异常");
        this.state = saved;
      } catch { new Notice("注意力状态文件无法读取；为避免覆盖，插件暂停。请备份并检查 " + STATE); return; }
    }
    this.qmd = new QmdClient(this.root, this.settings.nodePath);
    const timer = this.state.pomodoro;
    const phase = timer?.phase === 'break' ? 'break' : 'focus';
    const duration = (phase === 'break' ? 5 : 25) * 60 * 1000;
    this.state.pomodoro = {
      phase,
      remaining: Number.isFinite(timer?.remaining) ? Math.min(duration, Math.max(0, timer.remaining)) : duration,
      deadline: Number.isFinite(timer?.deadline) && timer.deadline > 0 ? timer.deadline : null
    };
    this.registerInterval(window.setInterval(() => this.tickPomodoro(), 1000));
    this.tickPomodoro();
    this.mem0 = new Mem0Client(this.root);
    this.app.workspace.onLayoutReady(()=>{
      if(!this.disposed && this.settings.captureMemory && this.settings.aiEnabled!==false)this.mem0.ensure().catch(e=>new Notice('记忆服务未启动：'+redact(e.message)));
    });
    this.generatePlan = generatePlan;
    this.generateSummary = generateSummary;
    this.generateImage = generateImage;
    this.registerObsidianProtocolHandler('attention-artifact',params=>this.openArtifact(params.path).catch(e=>new Notice(redact(e.message))));
    this.journalTail = Promise.resolve();
    const todayFile = this.app.vault.getAbstractFileByPath(`calendar/${shanghaiClock().day}.md`);
    if (todayFile instanceof TFile) {
      const content = await this.app.vault.cachedRead(todayFile);
      if (normalizeJournalCallouts(content) !== content) {
        await this.app.vault.process(todayFile,normalizeJournalCallouts);
        this.journalIndexTimer = setTimeout(() => this.maintain().catch(e=>new Notice(e.message)),2500);
      }
    }
    try {
      const electron = require("electron");
      this.secretStorage = electron.safeStorage || electron.remote?.safeStorage;
    } catch { this.secretStorage = null; }
    this.registerView(VIEW, leaf => new AttentionView(leaf, this));
    this.addRibbonIcon("focus", "Attention", () => this.openHome());
    this.addCommand({ id: "open", name: "Open Attention", callback: () => this.openHome() });
    this.addCommand({ id: "input", name: "New thought", callback: async () => {
      const view = await this.openHome(); view.input?.focus();
    } });
    this.addCommand({ id:'memories', name:'Browse memories', callback:() => this.openMemory() });
    this.addCommand({ id:'search', name:'Search notes & journals', callback:() => this.openSearch() });
    this.addCommand({ id: "index", name: "刷新 QMD 全文与语义索引", callback: () => this.maintain().catch(e => new Notice(e.message)) });
    this.addSettingTab(new AttentionSettings(this.app, this));
    this.registerEvent(this.app.workspace.on("file-open", file => {
      if (!(file instanceof TFile) || file.extension !== "md" || file.path.startsWith(".")) return;
      const latest = this.state.visits[0];
      if (latest?.path === file.path && Date.now() - Date.parse(latest.at) < 60000) return;
      this.state.visits.unshift({ path: file.path, at: new Date().toISOString() });
      this.state.visits = this.state.visits.slice(0, 30);
      this.persist().then(() => this.refresh()).catch(e => new Notice(e.message));
    }));
    for (const event of ['modify','create','delete']) this.registerEvent(this.app.vault.on(event,file => {
      if (/^calendar\/\d{4}-\d{2}-\d{2}\.md$/.test(file.path)) this.refresh();
    }));
  }
  onunload() {
    this.disposed = true;
    this.voicePreviewModal?.close();this.voicePreviewCache?.clear();
    this.timerModal?.close();this.timerAudio?.close().catch(()=>{});
    clearTimeout(this.journalIndexTimer);
    for (const job of this.jobs || []) job.abort();
    this.jobs?.clear();
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW)) leaf.detach();
  }
  async saveSettings() { await this.saveData(this.settings); }
  tickPomodoro() {
    const timer = this.state.pomodoro;
    if (timer.deadline && Date.now() >= timer.deadline) {
      timer.deadline = null; timer.remaining = 0;
      this.notifyTimer(timer.phase);
      this.persist().catch(e => new Notice(e.message));
    }
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW)) leaf.view.updatePomodoro?.();
  }
  async controlPomodoro(action) {
    if(action==='toggle')await this.prepareTimerSound();
    const timer = this.state.pomodoro;
    const duration = () => (timer.phase === 'break' ? 5 : 25) * 60 * 1000;
    if (action === 'toggle') {
      if (timer.deadline) {
        timer.remaining = Math.max(0, timer.deadline - Date.now()); timer.deadline = null;
      } else {
        if (timer.remaining <= 0) timer.remaining = duration();
        timer.deadline = Date.now() + timer.remaining;
      }
    } else if (action === 'reset') {
      timer.deadline = null; timer.remaining = duration();
    } else if (action === 'focus' || action === 'break') {
      timer.phase = action; timer.deadline = null; timer.remaining = duration();
    }
    this.tickPomodoro();
    await this.persist();
  }
  async prepareTimerSound() {
    try {
      const Context=window.AudioContext || window.webkitAudioContext;
      if(Context){this.timerAudio ||= new Context();await this.timerAudio.resume();}
    } catch {new Notice(this.settings.language==='en'?'Sound unavailable; popup is enabled':'声音不可用，到时仍会弹窗提醒');}
  }
  notifyTimer(phase) {
    const message=uiText(this.settings.language,phase==='focus'?'Focus complete. Take a break.':'Break complete.');
    new Notice(message,12000);
    this.timerModal?.close();const modal=this.timerModal=new LocalizedModal(this.app);
    modal.contentEl.createEl('h2',{text:'Timer complete'});modal.contentEl.createEl('p',{text:message});
    button(modal.contentEl,'OK',()=>modal.close(),true);modal.open();
    const context=this.timerAudio;
    if(context?.state==='running')for(let i=0;i<3;i++){
      const oscillator=context.createOscillator(),gain=context.createGain(),at=context.currentTime+i*.3;
      oscillator.type='sine';oscillator.frequency.value=i===1?784:659;
      gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.12,at+.02);gain.gain.exponentialRampToValueAtTime(.001,at+.2);
      oscillator.connect(gain);gain.connect(context.destination);oscillator.start(at);oscillator.stop(at+.22);
      oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
    }
  }
  async getKey() {
    if (this.sessionKey) return this.sessionKey;
    if (this.settings.encryptedKey) {
      if (!this.secretStorage?.isEncryptionAvailable()) throw new Error("当前系统无法解密已保存 Key，请重新输入");
      try { return this.secretStorage.decryptString(Buffer.from(this.settings.encryptedKey, "base64")); }
      catch { throw new Error("Key 解密失败，请重新输入"); }
    }
    return process.env.MIMO_API_KEY || "";
  }
  async setKey(value) {
    this.sessionKey = value.trim();
    this.settings.encryptedKey = "";
    if (this.sessionKey && this.secretStorage?.isEncryptionAvailable()) {
      this.settings.encryptedKey = this.secretStorage.encryptString(this.sessionKey).toString("base64");
    }
    await this.saveSettings();
    new Notice(this.sessionKey ? (this.settings.encryptedKey ? "Key 已用系统加密保存" : "Key 仅保留在本次 Obsidian 会话；也可使用 MIMO_API_KEY 环境变量") : "已清除插件保存的 Key");
  }
  async getImageKey() {
    if (this.sessionImageKey) return this.sessionImageKey;
    if (this.settings.encryptedImageKey) {
      if (!this.secretStorage?.isEncryptionAvailable()) throw new Error('图片 Key 无法解密，请重新输入');
      try { return this.secretStorage.decryptString(Buffer.from(this.settings.encryptedImageKey,'base64')); }
      catch { throw new Error('图片 Key 解密失败'); }
    }
    return process.env.ATTENTION_IMAGE_API_KEY || '';
  }
  async setImageKey(value) {
    this.sessionImageKey = value.trim(); this.settings.encryptedImageKey = '';
    if (this.sessionImageKey && this.secretStorage?.isEncryptionAvailable()) this.settings.encryptedImageKey = this.secretStorage.encryptString(this.sessionImageKey).toString('base64');
    await this.saveSettings(); new Notice(this.settings.encryptedImageKey ? '图片 Key 已加密保存' : '图片 Key 仅保留本次会话，或已清除');
  }
  async getAudioKey() { return this.getKey(); }
  async previewVoice(voice,style,signal){
    const settings={...this.settings,audioVoice:voice,audioAutoStyle:true},key=await this.getAudioKey();
    if(settings.aiEnabled===false)throw new Error('AI reading is off');
    const english=['Mia','Chloe','Milo','Dean'].includes(voice)||(voice==='mimo_default'&&settings.region!=='cn');
    const text=english?'Let us follow a small spark of curiosity. What would you like to discover next?':'先跟着一点好奇走。你想从哪个小小的发现开始？';
    const id=createHash('sha256').update(JSON.stringify([key,settings.region,settings.audioModel,voice,style,text])).digest('hex');
    this.voicePreviewCache||=new Map();
    if(this.voicePreviewCache.has(id)){const data=this.voicePreviewCache.get(id);this.voicePreviewCache.delete(id);this.voicePreviewCache.set(id,data);return data;}
    const data=await generateAudio({text,style,settings,key,signal});
    if(signal?.aborted)throw new Error('已取消');
    this.voicePreviewCache.set(id,data);
    while([...this.voicePreviewCache.values()].reduce((sum,item)=>sum+item.length,0)>8*1024*1024||this.voicePreviewCache.size>8)this.voicePreviewCache.delete(this.voicePreviewCache.keys().next().value);
    return data;
  }
  async openArtifact(relative) {
    within(this.root,relative);
    if(!relative.startsWith('calendar/assets/attention-'))throw new Error('无效作品路径');
    const file=this.app.vault.getAbstractFileByPath(relative);
    if(!(file instanceof TFile))throw new Error('作品文件不存在');
    if(file.extension!=='html')return this.openNote(relative);
    const browser=this.app.internalPlugins.getPluginById('webviewer');
    if(!browser?.enabled)throw new Error('请启用 Obsidian Web Viewer');
    // Web Viewer rejects file:// URLs; serve only explicitly opened artifacts on loopback.
    if(!this.artifactServer){
      const http=require('node:http');this.artifactRoutes=new Map();
      this.artifactServer=http.createServer(async(req,res)=>{
        const route=this.artifactRoutes.get(req.url);
        if(req.method!=='GET'||!route){res.writeHead(404);res.end();return;}
        try{
          const html=await this.app.vault.adapter.read(route);
          res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});res.end(html);
        }catch{res.writeHead(404);res.end();}
      });
      const server=this.artifactServer;
      try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});}
      catch(e){server.close();this.artifactServer=null;throw e;}
      server.on('error',()=>new Notice('作品预览服务异常'));this.register(()=>server.close());
    }
    let route=[...this.artifactRoutes].find(([,file])=>file===relative)?.[0];
    if(!route){route='/'+randomUUID();this.artifactRoutes.set(route,relative);}
    browser.instance.openUrl('http://127.0.0.1:'+this.artifactServer.address().port+route,'tab');
  }
  async createArtifacts(activity,signal,audioOnly=false) {
    this.artifactBusy||=new Set();if(this.artifactBusy.has(activity.id))throw new Error('Wait for the current request');
    this.artifactBusy.add(activity.id);
    try{return await this.saveArtifacts(activity,signal,audioOnly);}finally{this.artifactBusy.delete(activity.id);}
  }
  async saveArtifacts(activity,signal,audioOnly=false) {
    if(this.settings.aiEnabled===false)throw new Error('AI reading is off');
    if(!/^[\w-]+$/.test(activity.id))throw new Error('无效作品 ID');
    const specs=activity.plan.artifacts||[];activity.artifacts||=[];
    const folder='calendar/assets';if(!this.app.vault.getAbstractFileByPath(folder))await this.app.vault.createFolder(folder);
    for(let index=0;index<specs.length;index++){
      const spec=specs[index];if(audioOnly&&spec.type!=='audio')continue;
      let saved=activity.artifacts.find(x=>x.index===index);
      if(!saved){
        if(spec.type==='audio'&&!audioOnly)continue;
        if(signal?.aborted)throw new Error('已取消');
        const extension={html:'html',mermaid:'md',audio:'wav'}[spec.type];if(!extension)continue;
        const relative=`${folder}/attention-${activity.id}-${index}.${extension}`;
        const existing=this.app.vault.getAbstractFileByPath(relative);
        if(!existing){
          if(spec.type==='audio'){
            const data=await generateAudio({text:spec.content,style:spec.style,settings:this.settings,key:await this.getAudioKey(),signal});
            await this.app.vault.createBinary(relative,data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength));
          }else await this.app.vault.create(relative,spec.type==='html'?artifactHtml(spec.content):'```mermaid\n'+spec.content.replace(/^```(?:mermaid)?\s*|\s*```$/g,'')+'\n```\n');
        }
        saved={index,type:spec.type,title:spec.title,path:relative};activity.artifacts.push(saved);await this.persist();
      }
      if(activity.conversationSaved&&!saved.journalSaved){
        const link=spec.type==='html'?`[HTML · ${index+1}](obsidian://attention-artifact?path=${encodeURIComponent(saved.path)})\n[[${saved.path}]]`:`[[${saved.path}]]`;
        await this.writeJournal({id:activity.id+'-artifact-'+index,kind:'output',mode:'auto',title:activity.plan.title,text:journalCallout('tip','AI · '+spec.type,link+(spec.type==='audio'?'\n![['+saved.path+']]':''))});
        saved.journalSaved=true;await this.persist();
      }
    }
    const audio=activity.artifacts.find(x=>x.type==='audio');
    if(audio){const bytes=Buffer.from(await this.app.vault.adapter.readBinary(audio.path));for(const file of activity.artifacts.filter(x=>x.type==='html'))await this.app.vault.modify(this.app.vault.getAbstractFileByPath(file.path),artifactHtml(specs[file.index].content,bytes));}
  }
  async createActivityImage(activity, signal) {
    const image = await this.generateImage({ prompt: activity.plan.imagePrompt, settings: this.settings, key: await this.getImageKey(), signal });
    if (image.data) {
      const folder = 'calendar/assets';
      if (!this.app.vault.getAbstractFileByPath(folder)) await this.app.vault.createFolder(folder);
      const imagePath = `${folder}/attention-${activity.id}.${image.extension}`;
      await this.app.vault.createBinary(imagePath,image.data.buffer.slice(image.data.byteOffset,image.data.byteOffset + image.data.byteLength));
      activity.image = { path: imagePath };
    } else activity.image = { url: image.url };
    await this.persist();
    if (activity.conversationSaved) {
      const content = activity.image.path ? `![[${activity.image.path}]]` : `![Image](${activity.image.url})`;
      try { await this.writeJournal({ id:activity.id + '-image',kind:'output',mode:'auto',title:activity.plan.title,text:journalCallout('tip','AI · Image',content) }); }
      catch (e) { new Notice('Image saved; journal pending: ' + e.message); }
    }
    return activity.image;
  }
  persist() {
    const snapshot = JSON.stringify(this.state, null, 2);
    const next = this.saveTail.then(async () => {
      const folder = ".vault-meta/attention-allocator";
      if (!(await this.app.vault.adapter.exists(folder))) await this.app.vault.adapter.mkdir(folder);
      await this.app.vault.adapter.write(STATE, snapshot);
    });
    this.saveTail = next.catch(() => {});
    return next.catch(() => { throw new Error("本地活动保存失败，请检查磁盘与同步状态"); });
  }
  refresh() {
    if (this.disposed) return;
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW)) leaf.view.renderHistory();
  }
  async openHome() {
    let leaf = this.app.workspace.getLeavesOfType(VIEW)[0];
    if (!leaf) { leaf = this.app.workspace.getLeaf("tab"); await leaf.setViewState({ type: VIEW, active: true }); }
    await this.app.workspace.revealLeaf(leaf);
    return leaf.view;
  }
  openMemory() { const modal = new MemoryModal(this.app,this); modal.open(); return modal; }
  openSearch() { const modal = new SearchModal(this.app,this); modal.open(); return modal; }
  openMemoryImport(refresh = async () => {}) { const modal = new MemoryImportModal(this.app,this,refresh); modal.open(); return modal; }
  renderMarkdown(text,container,notePath='') { return MarkdownRenderer.render(this.app,text,container,notePath,this); }
  async maintain() {
    if (this.indexing) return this.indexing;
    new Notice("正在增量刷新 QMD；首次嵌入可能需要几分钟", 7000);
    this.indexing = this.qmd.maintenance().then(status => {
      new Notice("QMD 全文和语义索引已刷新；Pending: 0"); return status;
    }).finally(() => { this.indexing = null; });
    return this.indexing;
  }
  async openNote(notePath, line) {
    const file = this.app.vault.getAbstractFileByPath(notePath);
    if (!(file instanceof TFile)) throw new Error("笔记已移动或不存在");
    const targetLine=line ?? (/^calendar\/\d{4}-\d{2}-\d{2}\.md$/.test(notePath)?latestConversationLine(await this.app.vault.read(file)):1);
    await this.app.workspace.getLeaf(false).openFile(file, { eState: { line: Math.max(0, targetLine - 1) } });
  }
  async remember(text) {
    await this.mem0.add(text);
    new Notice("已保存到现有本地 Mem0");
  }
  async enableMemory() {
    const health=await this.mem0.ensure();this.settings.useMemory=true;this.settings.captureMemory=true;await this.saveSettings();return health;
  }
  async queueMemory(activity,phase='conversation') {
    if(this.settings.aiEnabled===false)throw new Error('AI reading is off');
    const key=phase==='conversation'?'memoryQueued':'feedbackQueued';
    const event=phase==='conversation'?'conversation':phase+'-'+createHash('sha256').update(activity.result||'').digest('hex').slice(0,8);
    if(activity[key]===event)return;
    await this.mem0.capture(activity,event);activity[key]=event;await this.persist();this.refresh();
  }
  async openToday() {
    const notePath = `calendar/${shanghaiClock().day}.md`;
    if (!this.app.vault.getAbstractFileByPath(notePath)) {
      if (!this.app.vault.getAbstractFileByPath('calendar')) await this.app.vault.createFolder('calendar');
      await this.app.vault.create(notePath,''); await this.updateCalendarNavigation();
      this.maintain().catch(e => new Notice('日记已创建，索引维护未完成：' + e.message));
    }
    await this.openNote(notePath);
  }
  writeJournal(data) {
    const task = this.journalTail.then(async () => {
      const record = journalEntry(data);
      const notePath = `calendar/${record.day}.md`;
      if (!this.app.vault.getAbstractFileByPath('calendar')) await this.app.vault.createFolder('calendar');
      let file = this.app.vault.getAbstractFileByPath(notePath);
      if (!file) {
        try { file = await this.app.vault.create(notePath, record.entry); }
        catch (error) { file = this.app.vault.getAbstractFileByPath(notePath); if (!(file instanceof TFile)) throw error; }
      }
      if (!(file instanceof TFile)) throw new Error('日记路径被文件夹占用');
      await this.app.vault.process(file, content => appendJournal(normalizeJournalCallouts(content), record));
      await this.updateCalendarNavigation();
      clearTimeout(this.journalIndexTimer);
      this.journalIndexTimer = setTimeout(() => {
        if (!this.disposed) this.maintain().catch(e => new Notice('日记已保存，索引维护未完成：' + e.message, 10000));
      }, 2500);
      this.refresh();
      return notePath;
    });
    this.journalTail = task.catch(() => {});
    return task;
  }
  async writeConversation(activity) {
    activity.journalPath = await this.writeJournal({ id:activity.id,kind:'conversation',mode:'auto',date:new Date(activity.at),text:conversationText(activity) });
    activity.conversationSaved = true;
    await this.persist();
    return activity.journalPath;
  }
  async updateCalendarNavigation() {
    const start = '<!-- attention-diary-nav:start -->'; const end = '<!-- attention-diary-nav:end -->';
    const days = this.app.vault.getMarkdownFiles().filter(x => /^calendar\/\d{4}-\d{2}-\d{2}\.md$/.test(x.path)).sort((a,b) => b.path.localeCompare(a.path));
    const block = start + '\n' + days.map(x => `- [[${x.path.slice(0,-3)}|${x.basename}]]`).join('\n') + '\n' + end;
    const notePath = 'calendar/README.md'; const file = this.app.vault.getAbstractFileByPath(notePath);
    if (file instanceof TFile) await this.app.vault.process(file, content => {
      const a = content.indexOf(start); const b = content.indexOf(end);
      return a >= 0 && b > a ? content.slice(0,a) + block + content.slice(b + end.length) : content + '\n\n' + block + '\n';
    });
    else if (!file) await this.app.vault.create(notePath, '# 日记与输出\n\n记录此刻想法、个人反省、实践成果和标注过的 AI 总结。长期偏好由现有 Mem0 保存。\n\n' + block + '\n');
    else throw new Error('日记目录页路径被文件夹占用');
  }
  async finish(activity, status, result) {
    const previous = { status: activity.status, result: activity.result, finishedAt: activity.finishedAt };
    Object.assign(activity, { status, result: redact(result).slice(0, 4000), finishedAt: new Date().toISOString() });
    try { await this.persist(); } catch (e) { Object.assign(activity, previous); throw e; }
    this.refresh();
    if (this.settings.journalOutputs) {
      try {
        activity.journalPath = await this.writeJournal({ id: activity.id + '-' + status + '-' + createHash('sha256').update(activity.result).digest('hex').slice(0,8), kind: 'output', mode: activity.mode || 'focus', title: activity.plan.title,
          allowAI:this.settings.aiEnabled!==false,text: journalCallout('quote',status === 'done' ? 'Me · Output' : 'Me · Checkpoint',activity.result) });
        await this.persist();
      } catch (e) { new Notice('活动已保存，日记写入未完成：' + e.message, 10000); }
    }
    if (this.settings.captureMemory && this.settings.aiEnabled!==false) {
      try { await this.queueMemory(activity,status); new Notice("活动已保存；记忆提取已交给本地 Mem0 队列"); }
      catch (e) { new Notice("活动已保存，但 Mem0 提取未提交：" + e.message, 8000); }
    } else new Notice(status === "done" ? "这一步完成了，成果已保存" : "已保存停下的位置，下次可以继续");
  }
}

class AttentionView extends ItemView {
  constructor(leaf, plugin) { super(leaf); this.plugin = plugin; this.alive = false; }
  getViewType() { return VIEW; }
  getDisplayText() { return "Attention"; }
  getIcon() { return "focus"; }
  async onOpen() { this.alive = true; this.render(); }
  async onClose() {
    this.alive = false; this.controller?.abort();
    this.languageObserver?.disconnect();
    this.dismissPopovers?.();
    clearTimeout(this.draftTimer);
    clearTimeout(this.dayTimer);
    if (this.input) { this.plugin.state.draft = redact(this.input.value).slice(0, 6000); await this.plugin.persist(); }
    window.speechSynthesis?.cancel();
  }
  render() {
    this.languageObserver?.disconnect();
    this.dismissPopovers?.();
    const root = this.contentEl; root.empty(); root.addClass("aa-home");
    const header = root.createDiv({ cls: "aa-header" });
    const identity = header.createDiv();
    identity.createEl("h1", { text: "Attention" });
    const headerTools=header.createDiv({cls:'aa-header-tools'});
    const language=headerTools.createEl('select',{cls:'aa-language',attr:{'aria-label':'Language'}});
    language.createEl('option',{text:'中文',value:'zh'});language.createEl('option',{text:'EN',value:'en'});
    language.value=this.plugin.settings.language === 'en' ? 'en':'zh';
    language.addEventListener('change',async()=>{
      if(this.busy){language.value=this.plugin.settings.language;return;}
      this.plugin.state.draft=this.input.value;const query=this.queryInput.value;
      this.plugin.settings.language=language.value;await this.plugin.saveSettings();
      this.render();this.queryInput.value=query;
    });
    this.languageSelect=language;
    this.aiSwitch=button(headerTools,'',async()=>{
      if(this.busy)return;
      this.plugin.settings.aiEnabled=this.plugin.settings.aiEnabled===false;
      await this.plugin.saveSettings();this.updateAiMode();await this.renderToday();
    });
    this.aiSwitch.addClass('aa-ai-switch');
    const menu=headerTools.createEl('details',{cls:'aa-menu'});
    menu.createEl('summary',{text:'···',attr:{'aria-label':'Menu'}});
    const navigation = menu.createDiv({ cls:'aa-menu-popover' });
    button(navigation,'Memory',() => this.plugin.openMemory());
    button(navigation,'Search',() => this.plugin.openSearch());
    button(navigation,'Recent',() => this.openCollection('recent'));
    button(navigation,'Library',() => this.openCollection('library'));
    button(navigation, "Settings", () => { this.app.setting.open(); this.app.setting.openTabById(this.plugin.manifest.id); });
    const layout = root.createDiv({ cls: 'aa-layout' });
    const main = layout.createDiv({ cls: 'aa-main' });
    const composer = main.createDiv({ cls: "aa-composer" });
    composer.createEl("label", { text: "What’s on your mind?", cls: 'aa-sr-only', attr: { for: "aa-thought" } });
    this.input = composer.createEl("textarea", { attr: { id: "aa-thought", placeholder: "What’s on your mind?", maxlength: "6000" } });
    this.input.value = this.plugin.state.draft || "";
    this.input.addEventListener("input", () => {
      clearTimeout(this.draftTimer);
      this.draftTimer = setTimeout(() => {
        this.plugin.state.draft = redact(this.input.value).slice(0, 6000);
        this.plugin.persist().catch(e => new Notice(e.message));
      }, 500);
    });
    this.input.addEventListener("keydown", event => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); this.submit(); }
    });
    const tools = composer.createDiv({ cls: "aa-tools aa-composer-tools" });
    const extras=tools.createEl('details',{cls:'aa-compose-extra'});
    extras.createEl('summary',{text:'+',attr:{'aria-label':'More'}});
    const extraPanel=extras.createDiv({cls:'aa-menu-popover'});
    const query = extraPanel.createEl('details', { cls: 'aa-query' });
    query.createEl('summary', { text: 'Context' });
    this.queryInput = query.createEl("input", { attr: { placeholder: "Search keywords (optional)", "aria-label": "Search keywords", maxlength: "300" } });
    button(extraPanel,'Save',() => this.recordThought());
    button(extraPanel,'Reflect',() => new TextModal(this.app,'Reflection','What did you notice?',async text => {
      const quoted=journalCallout('quote','Me · Reflection',text);
      await this.plugin.writeJournal({ id: randomUUID(), kind: 'reflection', mode:'auto', text:quoted,allowAI:this.plugin.settings.aiEnabled!==false }); new Notice('Reflection saved');
    }).open());
    this.startButton = button(tools, "Continue", () => this.submit(), true);
    this.cancelButton = button(tools, "Cancel", () => this.controller?.abort());
    this.cancelButton.hidden = true;
    this.replyLabel=tools.createEl('span',{cls:'aa-caption'});
    this.newChatButton=button(tools,'New conversation',()=>this.newConversation());
    this.updateConversation();
    this.updateAiMode();
    const timer=tools.createEl('details',{cls:'aa-timer-menu'});
    timer.createEl('summary',{text:'25:00',attr:{'aria-label':'Timer'}});
    this.timerSummary=timer.querySelector('summary');this.renderPomodoro(timer);
    this.status = main.createDiv({ cls: "aa-status", attr: { role: "status", "aria-live": "polite" } });
    this.resultEl = main.createDiv({ cls: "aa-result" });
    this.deck=main.createDiv({cls:'aa-diary-deck',attr:{tabindex:'0','aria-label':'Journal cards'}});
    this.backCards=this.deck.createDiv({cls:'aa-back-cards'});
    this.sideCards=this.deck.createDiv({cls:'aa-side-cards'});
    this.paper=this.deck.createDiv({cls:'aa-diary-card'});
    const paperHead = this.paper.createDiv({ cls:'aa-paper-heading' });
    this.todayDate = paperHead.createEl('span',{cls:'aa-date'});
    const paperTools=paperHead.createDiv({cls:'aa-paper-tools'});
    button(paperTools,'Open',()=>this.plugin.openNote(`calendar/${this.selectedDay || shanghaiClock().day}.md`));
    this.todayEl=this.paper.createDiv({cls:'aa-today-feed',attr:{'aria-live':'polite'}});
    this.cardFooter=this.paper.createDiv({cls:'aa-card-footer'});
    this.dayNavigation=main.createDiv({cls:'aa-day-navigation'});
    this.deck.addEventListener('keydown',event=>{
      if(event.target!==this.deck)return;
      const directions={ArrowLeft:['entry',-1],ArrowRight:['entry',1],ArrowUp:['day',-1],ArrowDown:['day',1]};
      if(directions[event.key]){event.preventDefault();this.navigateCard(...directions[event.key]);}
    });
    this.deck.addEventListener('pointerdown',event=>{
      if(event.target.closest('button,a,input,textarea,select,summary,pre'))return;
      this.gesture={x:event.clientX,y:event.clientY,target:event.target};
    });
    this.deck.addEventListener('pointerup',event=>{
      const start=this.gesture;this.gesture=null;if(!start)return;
      if(window.getSelection()?.toString())return;
      const x=event.clientX-start.x,y=event.clientY-start.y;
      if(Math.abs(x)>64 && Math.abs(x)>Math.abs(y)*1.5)this.navigateCard('entry',x<0?1:-1);
      else if(Math.abs(y)>90 && Math.abs(y)>Math.abs(x)*1.5 && !event.target.closest('.aa-today-feed'))this.navigateCard('day',y<0?1:-1);
    });
    this.deck.addEventListener('pointercancel',()=>{this.gesture=null;});
    this.deck.addEventListener('wheel',event=>this.onWheel(event),{passive:false});
    const dismiss=event=>{
      for(const panel of root.querySelectorAll('details[open]'))if(!panel.contains(event.target))panel.open=false;
    };
    const escape=event=>{if(event.key==='Escape')for(const panel of root.querySelectorAll('details[open]'))panel.open=false;};
    document.addEventListener('pointerdown',dismiss);document.addEventListener('keydown',escape);
    this.dismissPopovers=()=>{document.removeEventListener('pointerdown',dismiss);document.removeEventListener('keydown',escape);};
    this.renderHistory();
    this.languageObserver=watchLanguage(root,this.plugin);
    root.scrollTop=0;
    this.scheduleDayRefresh();
  }
  scheduleDayRefresh() {
    clearTimeout(this.dayTimer);
    const day = shanghaiClock().day;
    this.dayTimer = setTimeout(() => {
      if (!this.alive) return;
      if (day !== shanghaiClock().day) {
        if(this.selectedDay===day){this.selectedDay=shanghaiClock().day;this.selectedCardId=null;}
        this.renderHistory();
      }
      this.scheduleDayRefresh();
    },30000);
  }
  renderPomodoro(parent) {
    const bar = parent.createDiv({ cls: 'aa-pomodoro', attr: { 'aria-label': 'Timer' } });
    bar.createEl('span', { text: 'Timer', cls: 'aa-caption' });
    this.focusTimerButton = button(bar, 'Focus · 25m', () => this.plugin.controlPomodoro('focus'));
    this.breakTimerButton = button(bar, 'Break · 5m', () => this.plugin.controlPomodoro('break'));
    this.timerDisplay = bar.createEl('span', { cls: 'aa-timer-display', attr: { role: 'timer', 'aria-live': 'off' } });
    this.timerToggle = button(bar, 'Start', () => this.plugin.controlPomodoro('toggle'));
    button(bar, 'Reset', () => this.plugin.controlPomodoro('reset'));
    this.updatePomodoro();
  }
  updatePomodoro() {
    if (!this.timerDisplay) return;
    const timer = this.plugin.state.pomodoro;
    const seconds = Math.ceil(Math.max(0, timer.deadline ? timer.deadline - Date.now() : timer.remaining) / 1000);
    this.timerDisplay.setText(`${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`);
    this.timerSummary?.setText(this.timerDisplay.textContent);
    this.timerDisplay.setAttribute('aria-label', `${timer.phase === 'focus' ? 'Focus' : 'Break'}: ${Math.floor(seconds / 60)} minutes ${seconds % 60} seconds remaining`);
    this.timerToggle.setText(timer.deadline ? 'Pause' : timer.remaining <= 0 ? 'Restart' : 'Start');
    this.focusTimerButton.setAttribute('aria-pressed', String(timer.phase === 'focus'));
    this.breakTimerButton.setAttribute('aria-pressed', String(timer.phase === 'break'));
  }
  async recordThought() {
    if(this.savingThought)return;
    const submitted=this.input.value,text = submitted.trim(); if (!text) throw new Error('Write a thought first');
    const localOnly=this.plugin.settings.aiEnabled===false;
    const quoted=journalCallout('quote','Me',text);
    this.savingThought=true;
    try {
      const id=randomUUID();await this.plugin.writeJournal({ id, kind: 'thought', mode:'auto', text:quoted,allowAI:!localOnly });
      if(this.input.value===submitted){clearTimeout(this.draftTimer);this.input.value='';this.queryInput.value='';}
      this.plugin.state.draft=redact(this.input.value);await this.plugin.persist();
      this.selectedDay=shanghaiClock().day;this.selectedCardId=id;await this.renderToday();
    } finally {this.savingThought=false;}
    this.setStatus(localOnly?'Saved without AI reading':'Saved to today’s journal');
  }
  updateAiMode() {
    const enabled=this.plugin.settings.aiEnabled!==false;
    this.aiSwitch.setText(uiText(this.plugin.settings.language,enabled?'AI guidance':'Record only'));
    this.aiSwitch.setAttribute('aria-pressed',String(enabled));
    this.aiSwitch.setAttribute('title',uiText(this.plugin.settings.language,enabled?'AI guidance · on':'Record only · AI off'));
    this.startButton.setText(uiText(this.plugin.settings.language,enabled?'Continue':'Save'));
    this.queryInput.disabled=!enabled;
    this.contentEl.toggleClass('aa-local-only',!enabled);
  }
  onWheel(event) {
    if(event.ctrlKey || event.metaKey || event.target.closest('input,textarea,select,.aa-entry-more,pre'))return;
    const scale=event.deltaMode===1?16:event.deltaMode===2?this.deck.clientHeight:1;
    let x=event.deltaX*scale,y=event.deltaY*scale;
    if(event.shiftKey && Math.abs(x)<Math.abs(y)){x=y;y=0;}
    const axis=Math.abs(x)>Math.abs(y)?'entry':'day',value=axis==='entry'?x:y;
    if(!value)return;
    if(axis==='day' && event.target.closest('.aa-today-feed')) {
      const feed=this.todayEl,atStart=feed.scrollTop<=1,atEnd=feed.scrollTop+feed.clientHeight>=feed.scrollHeight-1;
      if((value<0 && !atStart)||(value>0 && !atEnd))return;
    }
    const delta=value>0?1:-1,index=axis==='day'?this.days?.indexOf(this.selectedDay):this.cards?.findIndex(x=>x.id===this.selectedCardId);
    const count=axis==='day'?this.days?.length:this.cards?.length;
    if(index==null || count==null || index+delta<0 || index+delta>=count)return;
    event.preventDefault();
    const now=performance.now();if(this.turning || now<(this.wheelUntil||0))return;
    if(!this.wheel || this.wheel.axis!==axis || this.wheel.direction!==delta || now-this.wheel.at>180)this.wheel={axis,direction:delta,total:0,at:now};
    this.wheel.total+=Math.abs(value);this.wheel.at=now;
    if(this.wheel.total<60)return;
    this.wheel=null;this.wheelUntil=now+650;
    this.navigateCard(axis,delta).catch(e=>this.setStatus(redact(e.message),true));
  }
  async summarizeToday() {
    if(this.plugin.settings.aiEnabled===false)return;
    if (this.busy) throw new Error('Wait for the current request');
    const notePath = `calendar/${shanghaiClock().day}.md`;
    const file = this.app.vault.getAbstractFileByPath(notePath);
    if (!(file instanceof TFile)) throw new Error('No journal entries today');
    const diary = (await this.app.vault.cachedRead(file)).split(/(?=^- \d{2}:\d{2})/m).filter(x => !/#注意力\/AI\s*总结/.test(x.split('\n')[0])).join('');
    this.setStatus('Reflecting…');
    const controller = new AbortController(); this.plugin.jobs.add(controller);
    try {
      const text = await this.plugin.generateSummary({ diary, settings: this.plugin.settings, key: await this.plugin.getKey(), signal: controller.signal });
      if (!this.alive || controller.signal.aborted) return;
      new TextModal(this.app,'Review summary','Edit before saving',async reviewed => {
        await this.plugin.writeJournal({ id: randomUUID(), kind: 'summary', mode:'auto', text:journalCallout('tip','AI · Review',reviewed) }); this.setStatus('Summary saved');
      },text).open();
      this.setStatus('Review your summary');
    } finally { this.plugin.jobs.delete(controller); }
  }
  setStatus(text, error = false) {
    if (!this.alive) return;
    this.status.setText(text); this.status.toggleClass("aa-error", error);
  }
  async submit(mode = "") {
    if (this.busy) return;
    if(this.plugin.settings.aiEnabled===false){
      this.busy=true;this.startButton.disabled=true;this.aiSwitch.disabled=true;
      try{await this.recordThought();}catch(error){this.setStatus(redact(error.message),true);}
      finally{this.busy=false;this.startButton.disabled=false;this.aiSwitch.disabled=false;}
      return;
    }
    const submittedValue = this.input.value;
    const parentId=this.replyTo || null;
    const input = submittedValue.trim();
    if (!input) { this.input.focus(); this.setStatus("Write a thought first"); return; }
    this.busy = true; this.startButton.disabled = true; this.cancelButton.hidden = false;
    this.languageSelect.disabled=true;
    this.aiSwitch.disabled=true;
    this.controller = new AbortController(); const controller = this.controller;
    this.plugin.jobs.add(controller);
    const active = () => { if (controller.signal.aborted || !this.alive || this.plugin.disposed) throw new Error("已取消"); };
    try {
      const key = await this.plugin.getKey();
      if (!key) throw new Error("Add your Xiaomi key in Settings");
      const settings = { ...this.plugin.settings, audioConfigured:Boolean(key) };
      this.setStatus("Finding context…");
      const query = this.queryInput.value.trim() || input;
      const settled = await Promise.allSettled([
        this.plugin.qmd.search(query, settings.semantic,'knowledge'),
        settings.useMemory ? this.plugin.mem0.search(input) : Promise.resolve([]),
      ]);
      active();
      const notes = settled[0].status === "fulfilled" ? settled[0].value : [];
      const memories = settled[1].status === "fulfilled" ? settled[1].value : [];
      const warnings = settled.flatMap((x, i) => x.status === "rejected" ? [`${i === 0 ? "检索" : "记忆"}不可用：${x.reason.message}`] : []);
      const diaryFiles = this.app.vault.getMarkdownFiles().filter(x => /^calendar\/\d{4}-\d{2}-\d{2}\.md$/.test(x.path)).sort((a,b) => b.path.localeCompare(a.path)).slice(0,2);
      for (const file of diaryFiles) {
        if (!notes.some(x => x.path === file.path)) {
          const content = aiReadable(await this.app.vault.cachedRead(file));
          const lines = content.split(/\r?\n/); const start = Math.max(0,lines.length - 40);
          notes.push({ path: file.path, title: file.basename, line: start + 1, content: lines.slice(start).join('\n').slice(0,2400) });
        }
      }
      // Reserve space for recent journals without discarding the best search hits.
      const overflow=Math.max(0,notes.length-5);
      if(overflow)notes.splice(5-overflow,overflow);
      this.setStatus('Creating…');
      this.resultEl.empty();
      const preview = this.resultEl.createDiv({ cls:'aa-action-card aa-stream-preview' });
      preview.createEl('span',{ text:'Generating…',cls:'aa-caption',attr:{role:'status'} });
      const previewTitle = preview.createEl('h2');
      const previewGreeting = preview.createEl('p',{ cls:'aa-acknowledgement' });
      const previewMaterial = preview.createEl('pre',{ cls:'aa-stream-material' });
      const context = { notes, memories, recent: this.plugin.state.activities,conversation:conversationHistory(this.plugin.state.activities,parentId) };
      const generated = await this.plugin.generatePlan({ input, settings, context, key, signal: controller.signal, mode,
        onPartial: partial => {
          if (!this.alive || controller.signal.aborted || !preview.isConnected) return;
          previewTitle.setText(partial.title); previewGreeting.setText(partial.acknowledgement); previewMaterial.setText(partial.material);
        } });
      if (generated.warning) warnings.push(generated.warning);
      active();
      const activity = { id: randomUUID(), parentId,at: new Date().toISOString(), input: redact(input), plan: generated.plan, mode: generated.plan.mode || 'focus',
        status: "suggested", result: "", usage: generated.usage,
        sources: notes.map(({ path, title, line }) => ({ path, title, line })),
        memoryCount: memories.length, warnings };
      this.plugin.state.activities.unshift(activity);
      this.plugin.state.activities = this.plugin.state.activities.slice(0, 100);
      this.plugin.state.draft = redact(this.input.value);
      await this.plugin.persist();
      active();
      try {
        await this.plugin.writeConversation(activity);
        if (this.input.value === submittedValue) {
          clearTimeout(this.draftTimer); this.input.value = ''; this.queryInput.value = '';
        }
        this.plugin.state.draft = redact(this.input.value); await this.plugin.persist();
        this.selectedDay=shanghaiClock().day;this.selectedCardId=activity.id;
        if(parentId){this.replyTo=activity.id;this.updateConversation();}
        this.resultEl.empty(); this.renderHistory();
      } catch (e) {
        warnings.push((activity.conversationSaved ? 'Journal saved; local state pending: ' : 'Reply saved locally; journal pending: ') + e.message);
        this.resultEl.empty(); this.renderHistory();
      }
      try {
        await this.plugin.createArtifacts(activity,controller.signal);
        if(activity.plan.artifacts?.some(x=>x.type==='audio') && settings.audioConfigured){
          this.setStatus('Creating audio…');await this.plugin.createArtifacts(activity,controller.signal,true);
        }
        active();this.renderHistory();
      } catch(e){if(controller.signal.aborted)throw e;warnings.push('作品生成未完成：'+e.message);}
      if(settings.captureMemory) {
        try {await this.plugin.queueMemory(activity);}
        catch(e){warnings.push('记忆提取未提交：'+e.message);}
      }
      if (activity.plan.imagePrompt && settings.imageBaseUrl && settings.imageModel) {
        try { this.setStatus('Creating image…'); await this.plugin.createActivityImage(activity,controller.signal); active(); this.renderHistory(); }
        catch (e) { if (controller.signal.aborted) throw e; warnings.push('图片生成未完成：' + e.message); }
      }
      this.setStatus(warnings.length ? warnings.join(" · ") : "", warnings.some(x => x !== generated.warning));
    } catch (error) {
      this.resultEl.querySelector('.aa-stream-preview')?.remove();
      this.setStatus(redact(error.message || "Generation failed"), true);
    }
    finally {
      this.plugin.jobs.delete(controller); this.busy = false;
      if (this.alive) { this.startButton.disabled = false; this.cancelButton.hidden = true;this.languageSelect.disabled=false;this.aiSwitch.disabled=false; }
    }
  }
  async showActivity(activity, target = this.resultEl, journal = false) {
    if (!this.alive) return;
    const region = target; if (!journal) region.empty();
    const card = region.createDiv({ cls: journal ? 'aa-entry-actions' : "aa-action-card",attr:{'data-activity-id':activity.id} });
    const divergent = activity.mode === 'diverge';
    if (!journal) {
    card.createEl("p", { text: activity.plan.acknowledgement, cls: "aa-acknowledgement" });
    card.createEl("h2", { text: activity.plan.title });
    if (activity.plan.bridge) card.createEl('p', { text: activity.plan.bridge, cls: 'aa-caption' });
    if (activity.image) card.createEl('img', { cls: 'aa-generated-image', attr: { src: activity.image.path ? this.app.vault.adapter.getResourcePath(activity.image.path) : activity.image.url, alt: activity.plan.title } });
    const material = card.createDiv({ cls: "aa-material" });
    if (activity.plan.material) await MarkdownRenderer.render(this.app, activity.plan.material, material, "", this);
    if (!this.alive || !card.isConnected) return;
    if (divergent) {
      const perspectives = card.createDiv({ cls: 'aa-perspectives' });
      for (const perspective of activity.plan.perspectives || []) {
        const item = perspectives.createDiv({ cls: 'aa-perspective' });
        item.createEl('strong', { text: perspective.title }); item.createEl('p', { text: perspective.question });
        button(item,'Explore →',async () => {
          this.input.value = activity.input; await this.submit(`我想试试这个视角：${perspective.title}。问题：${perspective.question}。请引导思考并给出一个可以实践的动作。`);
        });
      }
    }
      for (const resource of activity.plan.resources || []) {
        const row = card.createDiv({ cls: 'aa-resource' });
        row.createEl('a', { text: 'Search · ' + resource.title, attr: { href: 'https://www.bing.com/search?q=' + encodeURIComponent(resource.query), target: '_blank', rel: 'noopener noreferrer' } });
        if (resource.reason) row.createEl('p', { text: resource.reason, cls: 'aa-caption' });
      }
      for (const source of activity.plan.webSources || []) card.createEl('a', { cls: 'aa-web-source', text: 'Source · ' + source.title, attr: { href: source.url, target: '_blank', rel: 'noopener noreferrer' } });
    if (!divergent) { const steps = card.createEl("ol"); activity.plan.steps.forEach(text => steps.createEl("li", { text })); }
    card.createEl("p", { text: "" + activity.plan.doneWhen, cls: "aa-done" });
    }
    if (!this.alive || !card.isConnected) return;
    const redraw = async () => { if (journal) this.renderHistory(); else await this.showActivity(activity); };
    const actions = card.createDiv({ cls: "aa-tools" });
    const more = journal ? card.createEl('details',{cls:'aa-entry-more'}) : card;
    if (journal) more.createEl('summary',{text:'More'});
    const additional = journal ? more.createDiv({cls:'aa-tools'}) : actions;
    for(const file of activity.artifacts||[])button(additional,file.title||file.type,()=>this.plugin.openArtifact(file.path));
    if(activity.plan.artifacts?.some(x=>x.type!=='audio'&&!(activity.artifacts||[]).some(y=>y.index===activity.plan.artifacts.indexOf(x)&&y.journalSaved)))button(additional,'Export works',async()=>{await this.plugin.createArtifacts(activity);await redraw();});
    if(activity.plan.artifacts?.some(x=>x.type==='audio'&&!(activity.artifacts||[]).some(y=>y.type==='audio'&&y.journalSaved)))button(additional,'Generate audio',async()=>{
      const controller=new AbortController();this.plugin.jobs.add(controller);
      try{await this.plugin.createArtifacts(activity,controller.signal,true);await redraw();}finally{this.plugin.jobs.delete(controller);}
    });
    if (journal && divergent) for (const perspective of activity.plan.perspectives || []) button(additional,perspective.title,async()=>{
      this.input.value=activity.input; await this.submit(`我想试试这个视角：${perspective.title}。问题：${perspective.question}。请引导思考并给出一个可以实践的动作。`);
    });
    if (!activity.conversationSaved) button(actions,'Save to journal',async () => {
      await this.plugin.writeConversation(activity);
      if (this.input.value.trim() === activity.input) { clearTimeout(this.draftTimer); this.input.value=''; }
      this.plugin.state.draft=redact(this.input.value); await this.plugin.persist();
      this.resultEl.empty(); this.renderHistory();
    });
    if (activity.plan.imagePrompt && !activity.image) button(additional,'Create image',async () => {
      const controller = new AbortController(); this.plugin.jobs.add(controller);
      try { await this.plugin.createActivityImage(activity,controller.signal); await redraw(); }
      finally { this.plugin.jobs.delete(controller); }
    });
    if (!divergent && !["done", "paused"].includes(activity.status)) button(additional, activity.status === "started" ? "Started ✓" : "Start", async () => {
      const previous = { status: activity.status, startedAt: activity.startedAt };
      activity.status = "started"; activity.startedAt = new Date().toISOString();
      try { await this.plugin.persist(); } catch (e) { Object.assign(activity, previous); throw e; }
      await redraw(); this.renderHistory();
      this.setStatus("");
    }, true);
    button(actions,'Continue conversation',()=>{this.replyTo=activity.id;this.updateConversation();this.input.focus();this.contentEl.scrollTop=0;});
    button(actions,'New conversation',()=>{this.newConversation();this.contentEl.scrollTop=0;});
    button(additional, "Record outcome", () => new TextModal(this.app, "Your output", "Write, paste code, or link your work.", async result => {
      await this.plugin.finish(activity, "done", result); await redraw();
    }).open());
    button(additional, "Pause", () => new TextModal(this.app, "Save a checkpoint", "Where will you pick up?", async result => {
      await this.plugin.finish(activity, "paused", result); await redraw();
    }).open());
    if (!divergent) button(additional, "Make it smaller", async () => {
      this.input.value = activity.input;
      await this.submit(`上次建议为 ${activity.plan.title}。用户觉得太难。请将动作缩小到1分钟以内，只做一个步骤。`);
    });
    if (activity.journalPath) button(additional,'Journal',() => this.plugin.openNote(activity.journalPath));
    button(additional,divergent ? 'Try it' : 'Another angle',async () => {
      this.input.value = activity.input;
      await this.submit(divergent ? `不要继续展开，围绕刚才的${activity.plan.title}，请帮我开始一个足够小的实践动作。` : `刚才的${activity.plan.title}不合适，先换个角度；挑战当前假设，给出不同视角和一个推荐的探索入口。`);
    });
    if (window.speechSynthesis) button(additional, "Listen", () => {
      window.speechSynthesis.cancel();
      const speech = new SpeechSynthesisUtterance([activity.plan.acknowledgement, activity.plan.title, ...activity.plan.steps, activity.plan.doneWhen].join("。"));
      speech.lang = "zh-CN"; window.speechSynthesis.speak(speech);
    });
    if (window.speechSynthesis) button(additional, "Stop", () => window.speechSynthesis.cancel());
    if (activity.result && !journal) card.createEl("p", { text: `${activity.result}`, cls: "aa-record" });
    const sourceBox = more.createEl("details", { cls: "aa-context" });
    sourceBox.createEl("summary", { text: `Context · ${activity.sources.length} notes · ${activity.memoryCount} memories` });
    for(const [title,diary] of [['Knowledge',false],['Recent journals',true]]) {
      const sources=activity.sources.filter(x=>x.path.startsWith('calendar/')===diary);
      sourceBox.createEl('h3',{text:title});
      if(!sources.length)sourceBox.createEl('p',{text:'No matching notes',cls:'aa-caption'});
      for(const source of sources)button(sourceBox,`${source.title} · ${source.path}:${source.line}`,()=>this.plugin.openNote(source.path,source.line));
    }
    sourceBox.createEl('span',{cls:'aa-caption',text:activity.memoryQueued?'Memory extraction queued':'Memory extraction not queued'});
    button(sourceBox,'Learn this',async()=>{await this.plugin.enableMemory();await this.plugin.queueMemory(activity);await redraw();});
    if (activity.plan.memoryCandidate) {
      const memory = more.createDiv({ cls: "aa-memory" });
      memory.createEl("p", { text: "Memory: " + activity.plan.memoryCandidate });
      button(memory, "Remember", () => new TextModal(this.app, "Confirm memory", "Save to local memory", text => this.plugin.remember(text), activity.plan.memoryCandidate).open());
    }
  }
  renderHistory() {
    if (!this.alive || !this.todayEl) return;
    return this.renderToday().catch(error => { if(this.alive)this.setStatus(redact(error.message),true); });
  }
  updateConversation() {
    if(!this.replyLabel)return;
    this.replyLabel.hidden=!this.replyTo;this.newChatButton.hidden=!this.replyTo;
    this.replyLabel.setText(uiText(this.plugin.settings.language,'Continuing'));
    this.input.placeholder=uiText(this.plugin.settings.language,this.replyTo?'Reply here…':'What’s on your mind?');
  }
  newConversation() {
    this.replyTo=null;this.updateConversation();this.input.focus();
  }
  openCollection(kind) {
    const modal=new LocalizedModal(this.app);
    modal.contentEl.createEl('h2',{text:kind==='recent'?'Recent':'Library'});
    if(kind==='recent') {
      const names={suggested:'Suggested',started:'Active',done:'Done',paused:'Paused'};
      for(const item of this.plugin.state.activities.slice(0,30)) {
        const row=modal.contentEl.createDiv({cls:'aa-row'});const info=row.createDiv();
        info.createEl('strong',{text:item.plan.title});
        info.createEl('span',{text:uiText(this.plugin.settings.language,names[item.status]||item.status)+' · '+shanghaiClock(new Date(item.at)).day});
        button(row,'Read',async()=>{
          if(item.conversationSaved){this.selectedDay=shanghaiClock(new Date(item.at)).day;this.selectedCardId=item.id;this.explicitCard=true;await this.renderToday();modal.close();}
          else {modal.close();new ReadModal(this.app,item.plan.title,conversationText(item)).open();}
        });
      }
      if(!this.plugin.state.activities.length)modal.contentEl.createEl('p',{text:'No activities yet'});
    } else {
      const files=this.app.vault.getMarkdownFiles().filter(x=>!x.path.startsWith('.'));
      modal.contentEl.createEl('p',{text:this.plugin.settings.language==='en'?files.length+' notes':files.length+' 篇笔记',cls:'aa-caption'});
      button(modal.contentEl,'Search',()=>{modal.close();this.plugin.openSearch();});
      const groups=new Map();
      for(const file of files){const folder=file.path.includes('/')?file.path.split('/')[0]:' / ';groups.set(folder,(groups.get(folder)||0)+1);}
      const tags=modal.contentEl.createDiv({cls:'aa-topics'});
      for(const [folder,count] of [...groups].sort((a,b)=>b[1]-a[1]))tags.createEl('span',{text:folder+' · '+count,cls:'aa-chip'});
      for(const file of files.sort((a,b)=>b.stat.mtime-a.stat.mtime).slice(0,12))button(modal.contentEl,file.basename,()=>this.plugin.openNote(file.path));
    }
    modal.open();
  }
  async navigateCard(axis,delta) {
    if(this.turning || !this.days || !this.cards)return;
    if(axis==='day') {
      const index=this.days.indexOf(this.selectedDay),next=index+delta;
      if(next<0 || next>=this.days.length)return;
      this.selectedDay=this.days[next];this.selectedCardId=null;
    } else {
      const index=this.cards.findIndex(x=>x.id===this.selectedCardId),next=index+delta;
      if(next<0 || next>=this.cards.length)return;
      this.selectedCardId=this.cards[next].id;
      this.explicitCard=true;
    }
    this.turning=true;
    const direction=axis==='day'?'vertical':'horizontal';
    const motion=window.matchMedia('(prefers-reduced-motion: reduce)').matches?null:this.paper.animate([
      {opacity:1,transform:'translate(0,0) rotate(0)'},
      {opacity:0,transform:axis==='day'?'translateY('+(-delta*26)+'px) rotate('+(-delta*1.2)+'deg)':'translateX('+(-delta*42)+'px) rotate('+(-delta*2)+'deg)'}
    ],{duration:160,easing:'ease-in',fill:'forwards'});
    try {
      if(motion)await motion.finished;
      await this.renderToday();motion?.cancel();
      if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches)this.paper.animate([
        {opacity:0,transform:direction==='vertical'?'translateY('+(delta*24)+'px)':'translateX('+(delta*36)+'px)'},
        {opacity:1,transform:'translate(0,0)'}
      ],{duration:260,easing:'cubic-bezier(.2,.8,.2,1)'});
    } finally {motion?.cancel();this.turning=false;}
  }
  async renderToday() {
    const previousCard=this.todayEl.querySelector('[data-card-id]')?.dataset.cardId,previousScroll=this.todayEl.scrollTop;
    const revision=this.todayRevision=(this.todayRevision||0)+1;
    const today=shanghaiClock().day;
    this.days=[...new Set([today,...this.app.vault.getMarkdownFiles().filter(x=>/^calendar\/\d{4}-\d{2}-\d{2}\.md$/.test(x.path) && x.basename<=today).map(x=>x.basename)])].sort().reverse();
    if(!this.selectedDay && this.days.includes(this.plugin.state.lastReadingDay)){
      const todayFile=this.app.vault.getAbstractFileByPath('calendar/'+today+'.md');
      const newest=todayFile instanceof TFile?diaryCards(await this.app.vault.cachedRead(todayFile))[0]?.id:null;
      if(!this.alive || revision!==this.todayRevision)return;
      if(!newest || this.plugin.state.reading?.[today]?.latestId===newest)this.selectedDay=this.plugin.state.lastReadingDay;
    }
    if(!this.days.includes(this.selectedDay))this.selectedDay=today;
    const day=this.selectedDay,file=this.app.vault.getAbstractFileByPath('calendar/'+day+'.md');
    const text=file instanceof TFile?await this.app.vault.cachedRead(file):'';
    if(!this.alive || revision!==this.todayRevision)return;
    const cards=diaryCards(text);
    const pending=this.plugin.state.activities.filter(x=>!x.conversationSaved && Number.isFinite(Date.parse(x.at)) && shanghaiClock(new Date(x.at)).day===day && !text.includes('attention:'+x.id+':conversation'));
    for(const activity of pending.reverse())cards.unshift({id:activity.id,kind:'pending',time:shanghaiClock(new Date(activity.at)).time,body:conversationText(activity)});
    this.cards=cards;
    const bookmark=this.plugin.state.reading?.[day];
    this.selectedCardId=diarySelection(cards,this.forceLatest?null:bookmark,this.explicitCard?this.selectedCardId:null);
    this.forceLatest=false;
    this.explicitCard=false;
    const index=cards.findIndex(x=>x.id===this.selectedCardId),card=cards[index];
    this.todayDate.setText(day+(day===today?' · '+uiText(this.plugin.settings.language,'Today'):''));
    this.todayEl.empty();this.cardFooter.empty();this.backCards.empty();this.sideCards.empty();this.dayNavigation.empty();
    const memo=this.todayEl.createDiv({cls:'aa-today-entry',attr:{'data-card-id':card?.id || 'empty'}});
    if(card) {
      if(card.time)memo.createEl('span',{text:card.time,cls:'aa-entry-time'});
      await MarkdownRenderer.render(this.app,card.body,memo.createDiv({cls:'aa-memo-body'}),file?.path || '',this);
      if(!this.alive || revision!==this.todayRevision)return;
      if(this.plugin.settings.language!=='en')for(const title of memo.querySelectorAll('.callout-title-inner'))if(/^Me(?:$| · )/.test(title.textContent))title.setText(title.textContent.replace(/^Me/,'我').replace('Reflection','反省').replace('Output','成果').replace('Checkpoint','进度'));
      const activity=this.plugin.state.activities.find(x=>x.id===card.id);
      if(this.plugin.settings.aiEnabled!==false && activity)await this.showActivity(activity,memo,true);
    } else memo.createEl('p',{text:'A fresh page.',cls:'aa-empty-page'});
    if(!this.alive || revision!==this.todayRevision)return;
    const previous=button(this.cardFooter,'←',()=>this.navigateCard('entry',-1));previous.disabled=index<=0;previous.setAttribute('aria-label','Previous conversation');
    this.cardFooter.createEl('span',{text:cards.length?(index+1)+' / '+cards.length:'—',cls:'aa-card-count'});
    const next=button(this.cardFooter,'→',()=>this.navigateCard('entry',1));next.disabled=index<0 || index>=cards.length-1;next.setAttribute('aria-label','Next conversation');
    for(const delta of [-1,1])if(cards[index+delta]) {
      const adjacent=button(this.sideCards,'',()=>this.navigateCard('entry',delta));
      adjacent.createEl('span',{text:cards[index+delta].time || (index+delta+1)+''});
      adjacent.addClass('aa-side-card',delta<0?'aa-side-previous':'aa-side-next');
      adjacent.setAttribute('aria-label',delta<0?'Previous conversation':'Next conversation');
    }
    const dayIndex=this.days.indexOf(day);
    const below=this.days.slice(dayIndex+1,dayIndex+4);
    for(const [offset,date] of below.entries()) {
      const page=button(this.backCards,date,()=>this.navigateCard('day',this.days.indexOf(date)-this.days.indexOf(this.selectedDay)));
      page.addClass('aa-back-card');page.style.setProperty('--layer',String(offset+1));page.setAttribute('aria-label',date);
    }
    this.deck.style.setProperty('--layers',String(below.length));
    const newer=button(this.dayNavigation,'↑',()=>this.navigateCard('day',-1));newer.disabled=dayIndex<=0;newer.setAttribute('aria-label','Later day');
    const jump=button(this.dayNavigation,'Today',async()=>{this.selectedDay=today;this.selectedCardId=null;this.forceLatest=true;await this.renderToday();});jump.disabled=day===today;
    const older=button(this.dayNavigation,'↓',()=>this.navigateCard('day',1));older.disabled=dayIndex>=this.days.length-1;older.setAttribute('aria-label','Earlier day');
    if(day===today && this.plugin.settings.aiEnabled!==false)button(this.dayNavigation,'Review',()=>this.summarizeToday());
    this.todayEl.scrollTop=previousCard===card?.id?previousScroll:0;
    const latestId=cards[0]?.id || null;
    if(bookmark?.latestId!==latestId || bookmark?.cardId!==this.selectedCardId || this.plugin.state.lastReadingDay!==day){
      this.plugin.state.reading ||= {};this.plugin.state.reading[day]={latestId,cardId:this.selectedCardId};
      this.plugin.state.lastReadingDay=day;
      await this.plugin.persist();
    }
  }
}

class AttentionSettings extends PluginSettingTab {
  display() {
    const { containerEl } = this; const p = this.plugin;
    containerEl.empty(); containerEl.createEl("h2", { text: "Attention" });
    new Setting(containerEl).setName('Language').addDropdown(c=>c.addOptions({zh:'中文',en:'English'}).setValue(p.settings.language==='en'?'en':'zh').onChange(async value=>{
      p.settings.language=value;await p.saveSettings();this.display();
      for(const leaf of this.app.workspace.getLeavesOfType(VIEW))if(!leaf.view.busy){p.state.draft=leaf.view.input.value;leaf.view.render();}
    }));
    
    new Setting(containerEl).setName("Directions").addTextArea(c => c.setValue(p.settings.goals).setPlaceholder("English, projects, rest…").onChange(async value => { p.settings.goals = value; await p.saveSettings(); }));
    new Setting(containerEl).setName('Profile').addTextArea(c => c.setValue(p.settings.persona).setPlaceholder("Who are you becoming?").onChange(async value => { p.settings.persona = value; await p.saveSettings(); }));
    new Setting(containerEl).setName("Endpoint").addDropdown(c => c.addOptions({ cn: "Token Plan · China", sgp: "Token Plan · Singapore", ams: "Token Plan · Europe", api: "Pay-as-you-go API" }).setValue(p.settings.region).onChange(async value => { p.settings.region = value; await p.saveSettings(); }));
    new Setting(containerEl).setName("Model").addText(c => c.setValue(p.settings.model).onChange(async value => { p.settings.model = value.trim() || DEFAULTS.model; await p.saveSettings(); }));
    let keyInput;
    new Setting(containerEl).setName("API Key").addText(c => { keyInput = c; c.inputEl.type = "password"; c.setPlaceholder(p.settings.encryptedKey || p.sessionKey || process.env.MIMO_API_KEY ? "Configured" : "tp-…"); }).addButton(c => c.setButtonText("Save key").onClick(async () => { try { await p.setKey(keyInput.getValue()); keyInput.setValue(""); } catch (e) { new Notice(e.message); } }));
    new Setting(containerEl).setName("Connection").addButton(c => c.setButtonText("Test").onClick(async () => {
      c.setDisabled(true);
      try {
        await generatePlan({ input: "只给我一个喝水的小动作", settings: p.settings, context: { notes: [], memories: [], recent: [] }, key: await p.getKey() });
        new Notice("Connection verified");
      } catch (e) { new Notice(e.message, 8000); } finally { c.setDisabled(false); }
    }));
    new Setting(containerEl).setName("Step duration").addDropdown(c => c.addOptions({ 2: "2 min", 5: "5 min", 10: "10 min", 15: "15 min" }).setValue(String(p.settings.maxMinutes)).onChange(async value => { p.settings.maxMinutes = Number(value); await p.saveSettings(); }));
    new Setting(containerEl).setName("Semantic search").addToggle(c => c.setValue(p.settings.semantic).onChange(async value => { p.settings.semantic = value; await p.saveSettings(); }));
    new Setting(containerEl).setName("Node path").addText(c => c.setValue(p.settings.nodePath).onChange(async value => { p.settings.nodePath = value.trim(); p.qmd.nodePath = value.trim() || (process.platform === "win32" ? "C:\\Program Files\\nodejs\\node.exe" : "node"); await p.saveSettings(); }));
    new Setting(containerEl).setName("Search index").addButton(c => c.setButtonText("Refresh").onClick(async () => { c.setDisabled(true); try { await p.maintain(); } catch (e) { new Notice(e.message); } finally { c.setDisabled(false); } }));
    const toggle = (key, name, description) => new Setting(containerEl).setName(name).setDesc(description).addToggle(c => c.setValue(p.settings[key]).onChange(async value => { p.settings[key] = value; await p.saveSettings(); }));
    toggle('webSearch','Web search','Pay-as-you-go API only. Token Plan shows search links.');
    toggle('journalOutputs','Save outcomes to journal','Replies are always saved.');
    toggle("useMemory", "Recall memory", "Existing local Mem0");
    toggle("shareNotes", "Share note excerpts", "Up to 5 excerpts");
    toggle("shareMemory", "Share recalled memories", "Up to 5 memories");
    toggle("captureMemory", "Auto learn", "Conversation and feedback · local Mem0");
    new Setting(containerEl).setName("Memory connection").addButton(c => c.setButtonText("Test").onClick(async () => {
      c.setDisabled(true); try { const health = await p.mem0.ensure(); new Notice(`Mem0 正常 · 用户 ${health.user_id} · 提取队列 ${health.pending}`); } catch (e) { new Notice(e.message); } finally { c.setDisabled(false); }
    }));
    new Setting(containerEl).setName("Add memory").addButton(c => c.setButtonText("Add").onClick(() => new TextModal(this.app, "Confirmed memory", "A preference you want to remember", text => p.remember(text)).open()));
    containerEl.createEl('h3',{ text: 'Images' });
    
    new Setting(containerEl).setName('Image endpoint').addText(c => c.setValue(p.settings.imageBaseUrl).setPlaceholder('https://your-provider/v1').onChange(async value => { p.settings.imageBaseUrl = value.trim(); await p.saveSettings(); }));
    new Setting(containerEl).setName('Image model').addText(c => c.setValue(p.settings.imageModel).onChange(async value => { p.settings.imageModel = value.trim(); await p.saveSettings(); }));
    let imageKeyInput;
    new Setting(containerEl).setName('Image key').addText(c => { imageKeyInput=c; c.inputEl.type='password'; c.setPlaceholder(p.settings.encryptedImageKey || p.sessionImageKey ? 'Configured' : 'Separate image key'); }).addButton(c => c.setButtonText('Save').onClick(async()=>{ try { await p.setImageKey(imageKeyInput.getValue()); imageKeyInput.setValue(''); } catch(e) { new Notice(e.message); } }));
    containerEl.createEl('h3',{text:'Audio'});
    new Setting(containerEl).setName('Voice preview').addButton(c=>c.setButtonText('Preview').onClick(()=>new VoicePreviewModal(this.app,p,()=>this.display()).open()));
    new Setting(containerEl).setName('Automatic style').addToggle(c=>c.setValue(p.settings.audioAutoStyle!==false).onChange(async value=>{p.settings.audioAutoStyle=value;await p.saveSettings();}));
    new Setting(containerEl).setName('Audio model').addDropdown(c=>c.addOption('mimo-v2.5-tts','MiMo V2.5 TTS').setValue(p.settings.audioModel).onChange(async value=>{p.settings.audioModel=value;await p.saveSettings();}));
    new Setting(containerEl).setName('Voice').addDropdown(c=>{for(const voice of ['mimo_default','冰糖','茉莉','苏打','白桦','Mia','Chloe','Milo','Dean'])c.addOption(voice,voice);c.setValue(p.settings.audioVoice).onChange(async value=>{p.settings.audioVoice=value;await p.saveSettings();});});
    new Setting(containerEl).setName('Default style').addText(c=>c.setValue(p.settings.audioStyle).onChange(async value=>{p.settings.audioStyle=value.slice(0,1000);await p.saveSettings();}));
    new Setting(containerEl).setName('Connection').setDesc(p.settings.language==='en'?'Uses your current Xiaomi key and endpoint':'复用当前小米密钥与地区接口');
    localize(containerEl,p.settings.language);
  }
}

module.exports = AttentionPlugin;





(async () => {
  // Local developer check: real QMD / Mem0, simulated model output. No paid API calls.
  const p = app.plugins.plugins["attention-allocator"];
  if (!p) throw new Error("Plugin not loaded");
  const view = await p.openHome();
  const original = { generatePlan: p.generatePlan, getKey: p.getKey, writeConversation:p.writeConversation, capture: p.settings.captureMemory, outputs: p.settings.journalOutputs,
    draft: p.state.draft, input: view.input.value, query: view.queryInput.value };
  let id; let report;
  const testInput = '本地开发验证 ' + Date.now();
  try {
    p.getKey = async () => "";
    view.input.value = testInput;
    await view.submit();
    if (!/key/i.test(view.status.textContent)) throw new Error("Missing Key error not shown");
    p.getKey = async () => "tp-local-test-never-sent";
    // Never append simulated replies to the user's real daily note.
    p.writeConversation = async () => {};
    p.settings.captureMemory = false;
    p.settings.journalOutputs = false;
    p.generatePlan = async ({ context }) => {
      if (!context.notes.some(x => x.content && x.path)) throw new Error("Original-note retrieval missing");
      if (!Array.isArray(context.memories)) throw new Error("Mem0 context missing");
      return { plan: { acknowledgement: "本地开发验证", title: "验证一个小动作", minutes: 2, mode: 'focus', currentInterest: '此刻兴趣', targetActivity: '相近成长活动', bridge: '通过具体内容连接两者', contentType: 'code',
        steps: ["做一个小动作"], doneWhen: "留下实际结果", material: "这是本地测试材料。\n\n```js\nconst nextStep = 1;\n```", sources: context.notes.map(x => x.path), memoryCandidate: "" }, usage: null };
    };
    view.queryInput.value = "注意力";
    await view.submit();
    const activity = p.state.activities.find(x => x.input === testInput);
    if (!activity || activity.status !== "suggested") throw new Error("Suggestion failed: " + view.status.textContent);
    id = activity.id;
    if (view.contentEl.querySelector('.aa-mode-bar')) throw new Error('Mode selection should not be required');
    await view.renderToday();
    if (!view.todayEl.textContent.includes('通过具体内容连接两者')) throw new Error('Attention bridge not visible');
    const start = [...view.todayEl.querySelector(`[data-activity-id="${id}"]`).querySelectorAll("button")].find(x => x.textContent === "Start");
    if (!start) throw new Error("Start button missing");
    start.click();
    await new Promise(resolve => setTimeout(resolve, 120));
    await p.saveTail;
    if (activity.status !== "started") throw new Error("Start transition failed");
    await p.finish(activity, "paused", "下次继续验证");
    await view.showActivity(activity);
    if (!view.resultEl.textContent.includes("下次继续验证")) throw new Error("Resume record missing");
    await p.finish(activity, "done", "验证已完成");
    const disk = JSON.parse(await app.vault.adapter.read(".vault-meta/attention-allocator/state.json"));
    if (!disk.activities.some(x => x.id === id && x.status === "done" && x.result === "验证已完成")) throw new Error("Result not durable");
    report = { pluginLoaded: true, missingKeyShown: true, realOriginalNotes: activity.sources.length,
      realMem0Recall: activity.memoryCount, startPauseComplete: true, diskPersistence: true,
      model: "simulated; no paid API calls", attentionBridgeVisible: true, noModeSelection: true, warnings: activity.warnings };
    // Exercise the production diary writer against an in-memory Obsidian Vault.
    // Existing personal diaries, navigation and long-term memory are untouched.
    const sample = app.vault.getMarkdownFiles()[0]; const files = new Map();
    const makeFile = notePath => Object.assign(Object.create(Object.getPrototypeOf(sample)), { path: notePath, basename: notePath.split('/').pop().replace(/\.md$/,''), extension: 'md' });
    const dayPath = 'calendar/2099-12-31.md'; const diary = makeFile(dayPath); const nav = makeFile('calendar/README.md');
    files.set('calendar',{file:{path:'calendar'},text:''}); files.set(dayPath,{file:diary,text:'- 11:49 原有日记\n\t必须保留\n'});
    files.set(nav.path,{file:nav,text:'# 人工维护的目录\n\n保留这段说明。\n'});
    const fake = Object.create(p);
    fake.app = { vault: {
      getAbstractFileByPath: name => files.get(name)?.file,
      getMarkdownFiles: () => [...files.values()].map(x=>x.file).filter(x=>x.extension==='md'),
      createFolder: async name => files.set(name,{file:{path:name},text:''}),
      create: async(name,text)=>{const file=makeFile(name);files.set(name,{file,text});return file;},
      process: async(file,transform)=>{files.get(file.path).text=transform(files.get(file.path).text);},
    } };
    fake.journalTail=Promise.resolve();fake.refresh=()=>{};fake.maintain=async()=>{};
    try {
      const record={id:'live-check-diary',kind:'reflection',mode:'auto',text:'验证追加和去重',date:new Date('2099-12-31T02:00:00Z')};
      await fake.writeJournal(record);await fake.writeJournal(record);
      const saved=files.get(dayPath).text;
      if (!saved.startsWith('- 11:49 原有日记') || saved.split('attention:live-check-diary:reflection').length!==2) throw new Error('Diary preservation/deduplication failed');
      if (!files.get(nav.path).text.includes('保留这段说明。') || !files.get(nav.path).text.includes('calendar/2099-12-31')) throw new Error('Navigation preservation failed');
      report.diaryAppendDedupAndNavigation=true;
    } finally {clearTimeout(fake.journalIndexTimer);}
  } finally {
    p.generatePlan = original.generatePlan; p.getKey = original.getKey; p.writeConversation=original.writeConversation; p.settings.captureMemory = original.capture; p.settings.journalOutputs = original.outputs;
    if (id) p.state.activities = p.state.activities.filter(x => x.id !== id);
    p.state.draft = original.draft; await p.persist();
    view.render(); view.input.value = original.input; view.queryInput.value = original.query;
  }
  await app.vault.adapter.write(".vault-meta/attention-allocator/live-check.json", JSON.stringify(report, null, 2));
  return JSON.stringify(report);
})()

(async () => {
  // Exercise production journaling in memory; never add simulated conversations to real diaries.
  const p = app.plugins.plugins['attention-allocator'];
  const view = await p.openHome();
  if (view.busy) return { skipped:'User generation in progress' };
  const source = app.vault.getMarkdownFiles()[0];
  const makeFile = name => Object.assign(Object.create(Object.getPrototypeOf(source)), {path:name,basename:name.split('/').pop().replace(/\.md$/,''),extension:'md'});
  const day = '2099-12-31'; const diary = makeFile(`calendar/${day}.md`); const nav = makeFile('calendar/README.md');
  const files = new Map([['calendar',{file:{path:'calendar'},text:''}],[diary.path,{file:diary,text:'- 11:49 原有内容\n\t必须保留\n'}],[nav.path,{file:nav,text:'保留导航说明\n'}]]);
  const fake = Object.create(p);
  fake.app = {vault:{
    getAbstractFileByPath:name=>files.get(name)?.file,
    getMarkdownFiles:()=>[...files.values()].map(x=>x.file).filter(x=>x.extension==='md'),
    createFolder:async name=>files.set(name,{file:{path:name},text:''}),
    create:async(name,text)=>{const file=makeFile(name);files.set(name,{file,text});return file;},
    process:async(file,fn)=>{files.get(file.path).text=fn(files.get(file.path).text);}
  }};
  fake.journalTail=Promise.resolve();fake.persist=async()=>{};fake.refresh=()=>{};fake.maintain=async()=>{};
  const plan={title:'Diary check',acknowledgement:'Reply',currentInterest:'colors',targetActivity:'CSS',bridge:'Try a color',material:'```css\ncolor: green;\n```',steps:['Change color'],doneWhen:'See green',mode:'focus',perspectives:[],resources:[]};
  const sample={id:'diary-check',input:'My thought\nAnother line',at:'2099-12-31T02:00:00Z',mode:'focus',plan};
  const root=document.body.createDiv();root.hidden=true;
  const check=(ok,message)=>{if(!ok)throw new Error(message);};
  try {
    await fake.writeConversation(sample); await fake.writeConversation(sample);
    const saved=files.get(diary.path).text;
    check(saved.startsWith('- 11:49 原有内容'),'Existing diary changed');
    check(saved.split('attention:diary-check:conversation').length===2,'Conversation duplicated');
    await p.renderMarkdown(saved,root,diary.path);
    check(root.querySelectorAll('.callout[data-callout="quote"]').length===1,'Me callout missing');
    check(root.querySelectorAll('.callout[data-callout="tip"]').length===1,'AI callout missing');
    check(root.querySelector('pre code')?.textContent.includes('color: green'),'Code formatting broken');
  } finally {clearTimeout(fake.journalIndexTimer);root.remove();}
  const original={capture:p.settings.captureMemory,generatePlan:p.generatePlan,getKey:p.getKey,writeConversation:p.writeConversation,qmd:p.qmd.search,mem0:p.mem0.search,input:view.input.value,query:view.queryInput.value,draft:p.state.draft};
  const ids=[];let stored='';
  try {
    p.settings.captureMemory=false;
    p.qmd.search=async()=>[];p.mem0.search=async()=>[];p.getKey=async()=>'tp-local-test';
    p.generatePlan=async()=>({plan:{...plan},usage:null});
    p.writeConversation=async activity=>{ids.push(activity.id);stored=activity.input;activity.conversationSaved=true;return diary.path;};
    view.input.value='Submitted thought';await view.submit();
    check(stored==='Submitted thought','Submitted text not journaled');
    check(view.input.value===''&&p.state.draft==='','Submitted draft not cleared');
    p.generatePlan=async()=>{view.input.value='Next draft';return {plan:{...plan},usage:null};};
    view.input.value='Second thought';await view.submit();
    check(stored==='Second thought'&&view.input.value==='Next draft'&&p.state.draft==='Next draft','Next draft was overwritten');
    return {autoJournalOnReply:true,calloutsRendered:true,codeRendered:true,existingDiaryPreserved:true,deduplicated:true,inputCleared:true,nextDraftPreserved:true,realDiaryWrites:false};
  } finally {
    p.settings.captureMemory=original.capture;
    p.generatePlan=original.generatePlan;p.getKey=original.getKey;p.writeConversation=original.writeConversation;p.qmd.search=original.qmd;p.mem0.search=original.mem0;
    p.state.activities=p.state.activities.filter(x=>!ids.includes(x.id));p.state.draft=original.draft;await p.persist();
    view.input.value=original.input;view.queryInput.value=original.query;view.setStatus('');view.renderHistory();
  }
})()

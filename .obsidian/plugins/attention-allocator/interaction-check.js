(async()=>{
  const p=app.plugins.plugins['attention-allocator'];const v=await p.openHome();
  if(v.busy)return {skipped:'Generation in progress'};
  const old={ai:p.settings.aiEnabled,day:v.selectedDay,id:v.selectedCardId,input:v.input.value,query:v.queryInput.value,draft:p.state.draft,write:p.writeJournal,persist:p.persist,key:p.getKey,generate:p.generatePlan,search:p.qmd.search,memory:p.mem0.search,navigate:v.navigateCard};
  const check=(ok,message)=>{if(!ok)throw Error(message);};let saved,calls=0;
  const forbidden=async()=>{calls++;throw Error('AI invoked in record-only mode');};
  try {
    p.settings.aiEnabled=false;v.updateAiMode();
    p.writeJournal=async data=>{saved=data;return 'virtual-diary.md';};p.persist=async()=>{};
    p.getKey=forbidden;p.generatePlan=forbidden;p.qmd.search=forbidden;p.mem0.search=forbidden;
    v.input.value='Local-only check';await v.submit();
    check(calls===0 && saved.allowAI===false,'Record-only submitted to AI');check(v.input.value==='','Record-only input not cleared');
    p.writeJournal=async data=>{saved=data;v.input.value='New draft';return 'virtual-diary.md';};
    v.input.value='Second local check';await v.submit();check(v.input.value==='New draft','New draft lost');
    p.settings.aiEnabled=true;v.updateAiMode();v.selectedDay=v.days[0];v.selectedCardId=null;await v.renderToday();
    const menu=v.contentEl.querySelector('.aa-menu'),extras=v.contentEl.querySelector('.aa-compose-extra');
    menu.open=true;extras.open=true;v.contentEl.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
    check(!menu.open && !extras.open,'Blank click did not dismiss');
    menu.open=true;menu.querySelector('.aa-menu-popover').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));check(menu.open,'Click inside closed menu');menu.open=false;
    const turns=[];v.navigateCard=function(...args){const promise=old.navigate.apply(this,args);turns.push(promise);return promise;};
    const wheel=(target,options)=>{v.wheel=null;v.wheelUntil=0;target.dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,...options}));};
    let horizontal=false,vertical=false;
    if(v.cards.length>1){const id=v.selectedCardId;wheel(v.deck,{deltaX:100});await turns.at(-1);check(v.selectedCardId!==id,'Horizontal wheel failed');horizontal=true;}
    if(v.days.length>1){const day=v.selectedDay;wheel(v.deck,{deltaY:100});await turns.at(-1);check(v.selectedDay!==day,'Vertical wheel failed');vertical=true;}
    return {recordOnlyNoAI:calls===0,localReadProtection:saved.allowAI===false,draftPreserved:true,blankDismiss:true,insidePreserved:true,horizontalWheel:horizontal,verticalWheel:vertical,realDiaryWrites:false,paidCalls:false};
  } finally {
    p.writeJournal=old.write;p.persist=old.persist;p.getKey=old.key;p.generatePlan=old.generate;p.qmd.search=old.search;p.mem0.search=old.memory;v.navigateCard=old.navigate;
    p.settings.aiEnabled=old.ai;p.state.draft=old.draft;v.input.value=old.input;v.queryInput.value=old.query;v.selectedDay=old.day;v.selectedCardId=old.id;v.wheel=null;v.wheelUntil=0;v.updateAiMode();v.setStatus('');await v.renderToday();
  }
})()

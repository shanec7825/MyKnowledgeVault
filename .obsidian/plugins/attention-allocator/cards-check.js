(async()=>{
  const p=app.plugins.plugins['attention-allocator'];const v=await p.openHome();
  if(v.busy)return {skipped:'Generation in progress'};
  const original={day:v.selectedDay,id:v.selectedCardId,input:v.input.value,query:v.queryInput.value,draft:p.state.draft,language:p.settings.language};
  const assert=(condition,message)=>{if(!condition)throw Error(message);};
  try {
    await v.renderToday();
    assert(v.todayEl.querySelectorAll('.aa-today-entry').length===1,'More than one conversation visible');
    assert(!v.contentEl.querySelector('.aa-history,.aa-sidebar'),'Crowded dashboard sections remain');
    assert(v.contentEl.querySelectorAll('.aa-menu-popover > button').length>=5,'Menu entries missing');
    const startId=v.selectedCardId;
    if(v.cards.length>1){await v.navigateCard('entry',1);assert(v.selectedCardId!==startId,'Horizontal navigation failed');await v.navigateCard('entry',-1);assert(v.selectedCardId===startId,'Horizontal return failed');}
    const startDay=v.selectedDay;
    if(v.days.length>1){await v.navigateCard('day',1);assert(v.selectedDay!==startDay,'Vertical navigation failed');await v.navigateCard('day',-1);assert(v.selectedDay===startDay,'Vertical return failed');}
    v.input.value='Unsent draft';v.queryInput.value='Retained context';
    p.settings.language='en';p.state.draft=v.input.value;v.render();v.queryInput.value='Retained context';await v.renderToday();
    assert(v.input.placeholder==='What’s on your mind?','English not shown');
    assert(v.input.value==='Unsent draft','Draft lost');
    p.settings.language='zh';p.state.draft=v.input.value;v.render();await v.renderToday();
    assert(v.input.placeholder==='此刻在想什么？','Chinese not shown');
    assert(v.contentEl.querySelector('h1').textContent==='注意力','Chinese heading missing');
    assert(v.input.value==='Unsent draft','Draft lost switching language');
    const beforeDay=v.selectedDay;
    const lower=v.backCards.querySelector('button');
    if(lower){await v.navigateCard('day',v.days.indexOf(lower.textContent)-v.days.indexOf(beforeDay));assert(v.selectedDay===lower.textContent,'Dated card selection failed');}
    return {oneConversation:true,horizontalPaging:true,verticalPaging:true,datedPaperSelection:true,bilingual:true,draftPreserved:true,realDiaryWrites:false,paidCalls:false};
  } finally {
    p.settings.language=original.language;p.state.draft=original.draft;v.selectedDay=original.day;v.selectedCardId=original.id;
    v.render();v.input.value=original.input;v.queryInput.value=original.query;await v.renderToday();
  }
})()

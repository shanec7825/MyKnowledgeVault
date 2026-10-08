import {trainingTracks,trainingTrack,trackSources,methodSources,trainingActions} from './training-catalog.js';
import {readableReply} from './model-output.js';
import {textResponse} from './text-stream.js';
import {renderSpeech as formatSpeech} from './speech-format.js';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let topic='',debateId='',side='正方',level='入门',draft='',session=null,pending=false,error='',controller=null,loadVersion=0,retryHistoryId='';
let streamPreview='',track='general',action='question';
export function prepareCoach(value,debate){
  if(pending)return false;
  loadVersion++;retryHistoryId='';topic=value||'';debateId=debate?.id||'';session=null;draft='';error='';streamPreview='';action='question';return true;
}
function capture(){
  if($('#coach-topic'))topic=$('#coach-topic').value;
  if($('#coach-side'))side=$('#coach-side').value;
  if($('#coach-level'))level=$('#coach-level').value;
  if($('#coach-track'))track=$('#coach-track').value;
  if($('#coach-action'))action=$('#coach-action').value;
  if($('#coach-message'))draft=$('#coach-message').value;
}
function lesson(l,context){
  const speech=context?.messages.find(m=>m.id===l.messageId);
  return `<details class="lesson-card"><summary><span class="lesson-dimension">${esc(l.dimension)}</span><strong>${esc(l.title)}</strong><span class="lesson-expand">展开建议 ＋</span></summary><div class="lesson-detail"><div>${formatSpeech(readableReply(l.analysis)||'请重新生成这条建议。',[])}</div><div class="lesson-advice"><strong>如何改进</strong><div>${formatSpeech(readableReply(l.advice)||'请重新生成这条建议。',[])}</div></div>${l.example?`<blockquote>${esc(l.example)}<small>${esc(speech?.name||'')} · ${esc(speech?.stage||'')}</small></blockquote>`:''}${l.citationWarning?'<small class="hint">摘录未匹配原文，已忽略。</small>':''}</div></details>`;
}
function exerciseCard(exercise,latest,pending){
  if(!exercise)return '';
  return `<section class="exercise-card"><div class="practice-label">下一步 · 把建议用起来</div><h2>${esc(exercise.title)}</h2><p>${esc(exercise.instruction)}</p><details class="exercise-checklist"><summary>练习自查标准</summary><ul>${exercise.checklist.map(c=>`<li>${esc(c)}</li>`).join('')}</ul></details>${latest?`<button class="primary" id="practice-exercise" ${pending?'disabled':''}>提交练习答案 ↓</button>`:''}</section>`;
}
function trainingTurn(m,i,session,last,pending){
  if(m.role==='user')return `<article class="coach-message user"><span>你的问题 / 练习 · ${esc(trainingActions[m.action]||'提问')}</span><p>${esc(m.content)}</p></article>`;
  const report=m.report,latest=m===last;
  return `<details class="training-turn" ${latest?'open':''}><summary>${latest?'本次教练反馈':'查看以往反馈'} · ${Math.floor(i/2)+1}</summary><article class="coach-message assistant"><div class="coach-reply">${formatSpeech(readableReply(m.content)||'这条旧反馈格式不完整，请重新提交问题。',session.context?.sources||[])}</div>${m.mode==='demo'?'<small>规则教学示例，连接模型以获得个性化反馈。</small>':''}</article>${report?.unstructured?'<p class="notice">本次为文本反馈，未生成练习卡片。</p>':''}${exerciseCard(report?.exercise,latest,pending)}${report?.lessons?.length?`<div class="coach-section-heading"><h3>五个维度的具体建议</h3><span>按需展开查看</span></div><div class="lesson-grid">${report.lessons.map(l=>lesson(l,session.context)).join('')}</div>`:''}</details>`;
}
function welcome(debateId){
  const choices=[['拆解论题','澄清定义、范围与判断标准'],['复盘过程',debateId?'读取本场发言，找出交锋得失':'学习开篇、交锋与总结的推进'],['交锋技巧','练习反驳前提和有效追问'],['表达打磨','把自己的发言说得清楚有力'],['方法训练','建立可重复的论证练习']];
  return `<div class="coach-welcome"><h2>${debateId?'从这场辩论开始复盘':'今天想练哪一项？'}</h2><p>${debateId?'点击「生成本场复盘」，教练会结合发言和赛后评审给出建议与练习。':'左侧设置论题，选择专项训练；也可以在下方提交自己的发言。'}</p><div class="coach-quick">${choices.map(([name,description])=>`<button data-coach-quick="${name}"><strong>${name==='复盘过程'&&debateId?'生成本场复盘':name}</strong><small>${description}</small></button>`).join('')}</div></div>`;
}
export function coachPage(data){
  const last=session?.messages.filter(m=>m.role==='assistant').at(-1),report=last?.report;
  return `<div class="page-heading"><div><div class="eyebrow">DEBATE COACH</div><h1>辩论训练</h1><p>先完成一个小练习，再根据反馈改进立论、交锋与表达。</p></div>${session?`<button class="secondary" id="new-training" ${pending?'disabled':''}>新建训练 ＋</button>`:''}</div><div class="coach-layout"><aside class="coach-setup"><details class="coach-configuration" ${session?'':'open'}><summary><strong>训练设置</strong><span>${session?'展开查看':'设置论题与立场'}</span></summary><label>关联辩论<select id="coach-debate" ${pending||session?'disabled':''}><option value="">不关联 · 赛前训练</option>${data.debates.map(d=>`<option value="${d.id}" ${d.id===debateId?'selected':''}>${esc(d.topic)} · ${d.messages.length} 条发言</option>`).join('')}</select></label><label>训练专项<select id="coach-track" ${pending||session?'disabled':''}>${trainingTracks.map(t=>`<option value="${t.id}" ${t.id===track?'selected':''}>${esc(t.name)}</option>`).join('')}</select></label><p class="hint">${esc(trainingTrack(track).goal)}</p><label>训练论题<textarea id="coach-topic" maxlength="500" rows="3" ${pending||session||debateId?'disabled':''} placeholder="输入希望练习的论题…">${esc(topic)}</textarea></label><div class="coach-options"><label>训练立场<select id="coach-side" ${pending||session?'disabled':''}>${['正方','反方','中立'].map(s=>`<option ${s===side?'selected':''}>${s}</option>`).join('')}</select></label><label>难度<select id="coach-level" ${pending||session?'disabled':''}>${['入门','进阶'].map(s=>`<option ${s===level?'selected':''}>${s}</option>`).join('')}</select></label></div><p class="hint">关联记录会保存当前发言快照。教练分析已有内容，不参与胜负裁判。</p><div class="coach-agent"><span>✦</span><strong>辩论训练教练</strong><small>论题 · 过程 · 技巧 · 表达 · 方法</small></div></details>${methodCard(track)}<h4>训练记录</h4><div class="training-history">${(data.coachSessions||[]).map(s=>`<button data-training="${s.id}" ${pending?'disabled':''} class="${s.id===session?.id?'active':''}"><strong>${esc(s.topic)}</strong><small>${esc(s.side)} · ${esc(s.level)} · ${s.messageCount} 条消息</small></button>`).join('')||'<p class="hint">训练成功后自动保存到本机</p>'}</div></aside><section class="coach-workspace"><div class="training-context"><span class="training-mode">${debateId?'本场教练复盘':'赛前专项训练'}</span><strong>${esc(topic||'先选择一个想练习的论题')}</strong><small>${esc(side)} · ${esc(level)}${session?' · 已保存':''}</small></div><ol class="training-steps" aria-label="训练流程"><li class="${!session?'current':''}"><b>1</b>明确问题</li><li class="${pending?'current':''}"><b>2</b>教练反馈</li><li class="${report?.exercise?'current':''}"><b>3</b>完成练习</li><li><b>4</b>再次改进</li></ol><div class="coach-chat" aria-live="polite">${session?session.messages.map((m,i)=>trainingTurn(m,i,session,last,pending)).join(''):welcome(debateId)+`<section class="exercise-card"><h2>${esc(trainingTrack(track).name)}</h2><p>${esc(trainingTrack(track).instruction)}</p><button id="start-track" class="primary">领取本专项练习</button></section>`}${streamPreview?`<article class="coach-message assistant streaming-reply"><small>${pending?'正在输出':'未完成草稿'}</small><div>${formatSpeech(streamPreview,session?.context?.sources||[])}</div></article>`:''}${pending?'<div class="thinking">教练正在分析并设计练习…</div>':''}</div>${error?`<div class="chat-error" role="alert">${esc(error)}<button id="retry-training">重试</button></div>`:''}<form id="coach-form" class="chat-composer"><label class="composer-label" for="coach-message">${report?.exercise?'提交练习答案，或继续追问':'写下训练问题或你的发言'}</label><label>本次动作<select id="coach-action" ${pending?'disabled':''}>${Object.entries(trainingActions).map(([key,label])=>`<option value="${key}" ${key===action?'selected':''}>${esc(label)}</option>`).join('')}</select></label><textarea id="coach-message" maxlength="6000" rows="4" ${pending?'disabled':''} placeholder="提出训练问题，或把你的立论、反驳、练习答案写在这里…">${esc(draft)}</textarea><div><span>训练记录自动保存 · Enter 发送 · Shift + Enter 换行</span>${pending?'<button type="button" id="cancel-training" class="secondary">停止</button>':'<button class="primary" type="submit">'+(session?'发送给教练 ↑':'开始训练 ↑')+'</button>'}</div></form></section></div>`;
}
export function bindCoach(data,notify){
  if(!$('#coach-form'))return;
  
  for(const id of ['coach-topic','coach-side','coach-level','coach-message','coach-action'])$('#'+id).oninput=()=>{loadVersion++;retryHistoryId='';capture();};
  $('#coach-track').onchange=()=>{capture();loadVersion++;notify();};
  if($('#start-track'))$('#start-track').onclick=()=>{if(pending)return;capture();action='question';draft='请为我安排'+trainingTrack(track).name+'，先出题，不给完整答案。';void submit(data,notify);};
  $('#coach-debate').onchange=e=>{loadVersion++;retryHistoryId='';capture();debateId=e.target.value;const d=data.debates.find(d=>d.id===debateId);if(d)topic=d.topic;notify();};
  $('#coach-form').onsubmit=e=>{e.preventDefault();capture();if(!pending)void submit(data,notify);};
  $('#coach-message').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$('#coach-form').requestSubmit();}};
  document.querySelectorAll('[data-coach-quick]').forEach(b=>b.onclick=()=>{if(pending)return;capture();const prompts={'拆解论题':'请分析论题的关键词、范围、正反立场、举证责任和判断标准。','复盘过程':'请按开篇、交锋和总结分析本场过程，指出关键转折、遗漏回应和更好的推进方式。','交锋技巧':'请教我如何复述对方观点、寻找前提、有效反驳和提出追问，并安排一个练习。','表达打磨':'请分析发言是否清晰，教我使用短句、路标句和具体例子，并给我一个表达练习。','方法训练':'请教我如何建立主张、理由、证据与前提的论证链，再设计可以反复练习的方法。'};action='question';if(!session)track=({'拆解论题':'definition','复盘过程':'general','交锋技巧':'questioning','表达打磨':'precision','方法训练':'general'})[b.dataset.coachQuick]||'general';draft=prompts[b.dataset.coachQuick];if(!topic.trim()){notify();$('#coach-topic')?.focus();return;}void submit(data,notify);});
  if($('#practice-exercise'))$('#practice-exercise').onclick=()=>{action='answer';$('#coach-action').value=action;draft='练习答案：\n';$('#coach-message').value=draft;$('#coach-message').focus();$('#coach-message').scrollIntoView({behavior:'smooth',block:'center'});};
  if($('#new-training'))$('#new-training').onclick=()=>{capture();prepareCoach(topic);notify();};
  if($('#cancel-training'))$('#cancel-training').onclick=()=>controller?.abort();
  if($('#retry-training'))$('#retry-training').onclick=()=>{if(!pending){if(retryHistoryId)void loadTraining(retryHistoryId,notify);else void submit(data,notify);}};
  document.querySelectorAll('[data-training]').forEach(b=>b.onclick=()=>{if(!pending)void loadTraining(b.dataset.training,notify);});
}
async function loadTraining(id,notify){
  const version=++loadVersion;error='';retryHistoryId='';
  try{
    const response=await fetch('/api/coach/'+id),result=await response.json();
    if(version!==loadVersion)return;
    if(!response.ok)throw new Error(result.error||'训练记录加载失败');
    session=result;topic=result.topic;debateId=result.debateId||'';side=result.side;level=result.level;track=result.track||'general';action='question';draft='';streamPreview='';
  }catch(e){if(version!==loadVersion)return;error=e.message;retryHistoryId=id;}
  notify();
}

async function submit(data,notify){
  if(pending)return;
  if(!draft.trim()){error='请先写一个问题或练习答案。';notify();return;}
  if(!session&&topic.trim().length<4){error='请先填写至少 4 个字的训练论题。';notify();return;}
  loadVersion++;retryHistoryId='';pending=true;error='';streamPreview='';controller=new AbortController();
  const input=session?{sessionId:session.id,message:draft,action}:{topic,side,level,track,action,debateId:debateId||undefined,message:draft};
  notify();
  try{
    const r=await fetch('/api/coach',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...input,stream:true}),signal:controller.signal});
    const result=await textResponse(r,text=>{streamPreview=text;notify();});
    session=result;draft='';streamPreview='';action='question';
    const summary={id:result.id,topic:result.topic,side:result.side,level:result.level,debateId:result.debateId,updatedAt:result.updatedAt,messageCount:result.messages.length};
    data.coachSessions=[summary,...(data.coachSessions||[]).filter(s=>s.id!==result.id)];
  }catch(e){error=e.name==='AbortError'?'已停止生成，问题仍保留，可以重试。':e.message;}
  finally{pending=false;controller=null;notify();if(!error&&$('.coach-chat'))$('.coach-chat').scrollIntoView({behavior:'smooth',block:'start'});}
}

function methodCard(id){
  const links=sources=>sources.map(s=>`<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.author)} · ${esc(s.title)}</a><p>${esc(s.method)}</p><small>${esc(s.access)} · ${esc(s.locator)}</small></li>`).join('');
  return `<details class="training-methods"><summary>本专项的方法与出处</summary><p class="hint">方法摘要由编辑整理，不是名人原话或本题证据。</p><ul>${links(trackSources(id))}</ul></details><details class="training-methods"><summary>经典阅读库 · ${methodSources.length} 项</summary><ul>${links(methodSources)}</ul></details>`;
}

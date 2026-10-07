import {arenaPage} from './arena.js';
import {assistantPanel,bindAssistant,attachSpeech} from './arena-assistant.js';
import {icon} from './icons.js';
import {homePage} from './home.js';
import {coachPage,bindCoach,prepareCoach} from './coach.js';
import {characterStudio,bindCharacterStudio,resetCharacterFilters,characterOptions} from './character-studio.js';
import {bindTopicChat} from './topic-chat.js';
import {connectionSettings,connectionDefaults} from './connections.js';
import {renderSpeech} from './speech-format.js';
import {createObsidianBridge} from './obsidian-bridge.js';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons=Object.fromEntries(['home','arena','library','roles','history','coach','settings'].map(k=>[k,icon(k)]));
let state={page:'home',data:null,debate:null,selectedTopic:0,agents:[],autoVoice:false,filter:'全部',event:null,busy:false};
const obsidianBridge=createObsidianBridge(topic=>{
  captureDraft();state.draftTopic=topic;state.draftQuery='';state.selectedTopic=-1;navigate('home');
  toast('已从 Obsidian 笔记填入辩题');
},()=>state.debate?.id||null);
let sidebarCollapsed=false,rightCollapsed=false,rightTab='assistant';
try{const layout=JSON.parse(localStorage.getItem('debate-layout-v1')||'{}');sidebarCollapsed=layout.left===true;rightCollapsed=layout.right===true;}catch{}
function saveLayout(){try{localStorage.setItem('debate-layout-v1',JSON.stringify({left:sidebarCollapsed,right:rightCollapsed}));}catch{}}
let recognition=null,voices=[],toastTimer,neuralVoice=null,renderVoiceSettings=null;
const statusText={researching:'搜集资料中',running:'辩论进行中',judging:'评审点评中',completed:'已完成',cancelled:'已停止',failed:'运行失败',interrupted:'已中断'};
async function api(url,body){const r=await fetch(url,{...(body!==undefined?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});const data=await r.json();if(!r.ok)throw new Error(data.error||'请求失败');return data;}
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),4000);}
function modeName(){return {demo:'演示模式',ollama:'本地模型',compatible:'API 模型',mimo:'MiMo Token Plan'}[state.data?.settings.provider]||'';}
function navigate(page){const previous=state.page;state.page=page;render();if(previous!==page)window.scrollTo(0,0);}
function active(){return state.debate&&['researching','running','judging'].includes(state.debate.status);}
function shell(content){return `<aside class="sidebar ${sidebarCollapsed?'sidebar-collapsed':''}"><button class="sidebar-toggle" id="toggle-left-sidebar" aria-expanded="${!sidebarCollapsed}" aria-controls="main-navigation" aria-label="${sidebarCollapsed?'展开左侧导航':'收起左侧导航'}">${sidebarCollapsed?'☰':'‹ 收起导航'}</button><a class="brand" href="/" aria-label="论场首页"><span class="brand-mark">论</span><span>论场</span></a><nav id="main-navigation">${[['home','新建辩论'],['arena','辩论现场'],['library','共享资料库'],['roles','人物预设'],['coach','辩论训练'],['history','历史记录']].map(([k,t])=>`<button class="nav-item ${state.page===k?'active':''}" data-nav="${k}" title="${t}" aria-label="${t}" ${state.page===k?'aria-current="page"':''}><span>${icons[k]}</span>${t}${k==='library'?`<i>${state.data.library.length}</i>`:''}</button>`).join('')}</nav><div class="sidebar-bottom"><div class="local-badge"><span class="dot"></span>本地运行</div><button class="nav-item ${state.page==='settings'?'active':''}" data-nav="settings" title="模型设置" aria-label="模型设置"><span>${icon('settings')}</span>模型设置</button></div></aside><main class="${sidebarCollapsed?'nav-collapsed':''}"><header class="topbar"><span>${{home:'新建辩论',arena:'辩论现场',library:'共享资料库',roles:'人物预设',history:'历史记录',coach:'辩论训练',settings:'模型设置'}[state.page]}</span><button class="mode-pill" data-nav="settings"><span class="dot ${state.data.settings.provider==='demo'?'amber':''}"></span>${modeName()} <span>↗</span></button></header><div class="content">${content}</div></main>`;}
function heading(eyebrow,title,subtitle,extra=''){return `<div class="page-heading"><div><h1>${title}</h1><p>${subtitle}</p></div>${extra}</div>`;}
function home(){return homePage(state,team);}
function allPresets(){return [...state.data.presets,...state.data.customPresets];}
function team(side,title,sub,sign){const agents=state.agents.filter(a=>a.side===side);return `<div class="team ${side}"><div class="team-heading"><span class="side-mark">${sign}</span><h3>${title}<small>${sub}</small></h3><span class="count">${agents.length} 位辩手</span></div>${agents.map(a=>`<div class="agent-row"><div class="avatar ${side}">${esc(a.avatar||a.name.slice(0,1))}</div><div class="agent-info"><strong>${esc(a.name)}</strong><small>${esc(a.tag||'自定义角色')}</small><input class="agent-model" data-model="${esc(a.id)}" value="${esc(a.model||'')}" placeholder="模型：默认（可单独指定）" aria-label="${esc(a.name)} 的模型"></div><button class="remove" data-remove="${esc(a.id)}" title="移除辩手" aria-label="移除 ${esc(a.name)}">×</button></div>`).join('')}<select class="add-agent" data-add="${side}" aria-label="添加${title}辩手"><option value="">＋ 添加辩手</option>${characterOptions(allPresets().filter(p=>!state.agents.some(a=>a.name===p.name)))}</select></div>`;}
function arena(){const d=state.debate;if(!d)return `${heading('THE ARENA','辩论现场','选择辩题和角色后开始。')}<div class="empty"><span>◉</span><h2>暂无辩论</h2><button class="primary" data-nav="home">新建辩论 →</button></div>`;
return arenaPage(d,{active:active(),statusText,heading,formatSpeech,sourceCard,review,assistantPanel,rightCollapsed,rightTab,autoVoice:state.autoVoice});}

function formatSpeech(content,sources){return renderSpeech(content,sources);}
function sourceCard(s){return `<article class="source-card" id="${esc(s.id)}"><div><span class="source-id">${esc(s.id)}</span><small>${esc(s.provider)} · ${esc(s.contentType||'检索摘要')}</small></div><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)} ↗</a><p>${esc(s.content)}</p><small>${esc((s.contributors||[]).join('、'))} · ${new Date(s.retrievedAt).toLocaleDateString('zh-CN')}</small></article>`;}
function review(r){if(r.unstructured)return `<section class="review"><div class="eyebrow">THE VERDICT</div><h2>评审点评</h2><p class="preserve">${esc(r.summary)}</p></section>`;return `<section class="review"><div class="eyebrow">THE VERDICT</div><div class="section-heading"><h2>评审结果</h2><span class="winner">${esc(r.winner)}</span></div><p>${esc(r.summary)}</p><div class="score-table"><table><thead><tr><th>辩手</th><th>逻辑</th><th>证据</th><th>回应</th><th>表达</th></tr></thead><tbody>${(r.scores||[]).map(s=>`<tr><td>${esc(s.name)}</td>${['logic','evidence','response','clarity'].map(k=>`<td>${s[k]}<small>/10</small></td>`).join('')}</tr>`).join('')}</tbody></table></div><div class="review-grid"><div><h4>值得肯定</h4>${r.strengths.map(x=>`<p>＋ ${esc(x)}</p>`).join('')}</div><div><h4>仍可推进</h4>${r.weaknesses.map(x=>`<p>↗ ${esc(x)}</p>`).join('')}</div></div><div class="fact-check"><strong>证据与引用核查</strong><p>${esc(r.factCheck)}</p></div><h4>后续问题</h4>${r.questions.map(x=>`<p class="question">${esc(x)}</p>`).join('')}</section>`;}
function library(){return `${heading('SHARED KNOWLEDGE','资料库','每场辩论检索的资料汇聚于此。保留来源、检索时间和贡献角色。')}<div class="search-bar"><span>⌕</span><input id="library-search" placeholder="搜索标题、内容或角色…" aria-label="搜索共享资料"></div><div class="library-grid" id="library-results">${state.data.library.map(sourceCard).join('')||'<div class="empty"><span>▤</span><h2>暂无资料</h2><p>开启联网辩论后，检索结果会自动存入这里。</p></div>'}</div>`;}
function roles(){return characterStudio(allPresets());}
function history(){return `${heading('PAST CONVERSATIONS','历史记录','保存在本机的辩论与点评。')}<div class="history-list">${state.data.debates.map(d=>`<div class="history-entry"><button class="history-row" data-history="${d.id}"><span class="history-icon">◉</span><div><strong>${esc(d.topic)}</strong><small>${new Date(d.createdAt).toLocaleString('zh-CN')} · ${d.agents.length} 位辩手 · ${d.messages.length} 条发言 · ${d.mode==='demo'?'演示':esc(d.model)}</small></div><span class="status-label">${statusText[d.status]}</span><span>→</span></button><button class="secondary danger" data-delete-debate="${d.id}" aria-label="删除本场辩论">删除</button></div>`).join('')||'<div class="empty"><span>◷</span><h2>还没有辩论记录</h2><button class="primary" data-nav="home">开启第一场辩论 →</button></div>'}</div>`;}
function settings(){return connectionSettings(state.data.settings)+(renderVoiceSettings?renderVoiceSettings(state.data.voiceSettings,state.data.voiceNames,!!state.data.features?.voice):'');}
function saveSetup(){try{sessionStorage.setItem('debate-setup-v1',JSON.stringify({topic:state.draftTopic,query:state.draftQuery,rounds:state.rounds,research:state.research,language:state.language||'zh',impromptu:state.impromptu,impromptuPrompt:state.impromptuPrompt,agents:state.agents}));}catch{}}
function render(){if(!state.data)return;if(state.page==='home')saveSetup();const savedScroll=window.scrollY,focused=document.activeElement,focusId=focused?.id,selection=typeof focused?.selectionStart==='number'?[focused.selectionStart,focused.selectionEnd]:null;const assistantScroll=$('.assistant-messages')?.scrollTop;$('#app').innerHTML=shell(({home,arena,library,roles,history,settings,coach:()=>coachPage(state.data)}[state.page])());bind();if(focusId){const next=document.getElementById(focusId);if(next&&!next.disabled){next.focus({preventScroll:true});if(selection&&next.setSelectionRange)next.setSelectionRange(...selection);}}if(assistantScroll!==undefined&&$('.assistant-messages'))$('.assistant-messages').scrollTop=assistantScroll;if(state.page==='arena')window.scrollTo(0,savedScroll);}
function captureDraft(){if($('#topic')){state.draftTopic=$('#topic').value;state.rounds=Number($('#rounds').value);state.research=$('#research').checked;state.autoVoice=$('#autovoice').checked;state.language=$('#debate-language').value;state.impromptu=$('#impromptu').checked;state.impromptuPrompt=$('#impromptu-prompt').value;saveSetup();}}
function bind(){
  obsidianBridge?.report();
  $('#toggle-left-sidebar').onclick=()=>{captureDraft();sidebarCollapsed=!sidebarCollapsed;saveLayout();render();};
  if($('#toggle-arena-sidebar'))$('#toggle-arena-sidebar').onclick=()=>{rightCollapsed=!rightCollapsed;saveLayout();render();};
  document.querySelectorAll('[data-arena-side]').forEach(b=>b.onclick=()=>{rightTab=b.dataset.arenaSide;render();});
  if(state.page==='arena'&&state.debate){const id=state.debate.id;bindAssistant(state.debate,()=>{if(state.page==='arena'&&state.debate?.id===id){render();const pane=$('.assistant-messages');if(pane)pane.scrollTop=pane.scrollHeight;}});}
  document.querySelectorAll('[data-attach-speech]').forEach(b=>b.onclick=()=>{if(!attachSpeech(state.debate,b.dataset.attachSpeech)){toast('分析进行中或附件已满，请先停止分析或移除附件');return;}rightCollapsed=false;rightTab='assistant';saveLayout();render();$('#arena-assistant-message')?.focus();});
  document.querySelectorAll('.citation').forEach(a=>a.onclick=e=>{const target=a.getAttribute('href');if(target?.startsWith('#S-')){e.preventDefault();rightCollapsed=false;rightTab='sources';saveLayout();render();document.getElementById(target.slice(1))?.scrollIntoView({behavior:'smooth',block:'center'});}});
  document.querySelectorAll('[data-jump-review]').forEach(b=>b.onclick=()=>{$('#arena-verdict')?.scrollIntoView({behavior:'smooth',block:'start'});$('#arena-verdict')?.focus({preventScroll:true});});
  bindCharacterStudio(allPresets());
  bindCoach(state.data,()=>{if(state.page==='coach')render();});
  document.querySelectorAll('[data-open-coach]').forEach(b=>b.onclick=()=>{
    captureDraft();const debate=b.dataset.openCoach==='debate'?state.debate:null;
    if(!prepareCoach(debate?.topic||state.draftTopic||state.data.topics[state.selectedTopic]?.title,debate)){toast('教练正在生成，请先等待或停止本次训练');return;}
    navigate('coach');
  });
  bindTopicChat(suggestion=>{captureDraft();if(suggestion){state.draftTopic=suggestion.title;state.draftQuery=suggestion.query;state.selectedTopic=-1;}if(state.page==='home')render();});
  if($('#topic'))$('#topic').oninput=()=>{state.draftTopic=$('#topic').value;state.draftQuery='';saveSetup();document.querySelectorAll('[data-topic]').forEach(b=>{const selected=state.data.topics[Number(b.dataset.topic)].title===state.draftTopic;b.classList.toggle('selected',selected);b.querySelector('.check').textContent=selected?'✓':'↗';});};
  if($('#impromptu'))$('#impromptu').onchange=()=>{captureDraft();$('.impromptu-question').hidden=!state.impromptu;};
  if($('#impromptu-prompt'))$('#impromptu-prompt').oninput=captureDraft;
  document.querySelectorAll('[data-debate-language]').forEach(b=>b.onclick=()=>{captureDraft();state.language=b.dataset.debateLanguage;saveSetup();render();});
  for(const id of ['rounds','research','debate-language'])if($('#'+id))$('#'+id).onchange=captureDraft;
  document.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>{captureDraft();navigate(b.dataset.nav);});
  document.querySelectorAll('[data-topic]').forEach(b=>b.onclick=()=>{captureDraft();state.selectedTopic=Number(b.dataset.topic);state.draftTopic=state.data.topics[state.selectedTopic].title;state.draftQuery='';render();});
  document.querySelectorAll('[data-add]').forEach(b=>b.onchange=()=>{captureDraft();if(state.agents.length>=6){toast('每场最多 6 位辩手');b.value='';return;}const p=allPresets().find(p=>p.id===b.value);if(p)state.agents.push({...p,side:b.dataset.add});render();});
  document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{captureDraft();state.agents=state.agents.filter(a=>a.id!==b.dataset.remove);render();});
  document.querySelectorAll('[data-model]').forEach(b=>b.oninput=()=>{state.agents.find(a=>a.id===b.dataset.model).model=b.value;saveSetup();});
  if($('#start'))$('#start').onclick=start;
  if($('#dictate'))$('#dictate').onclick=dictate;
  if($('#cancel'))$('#cancel').onclick=async()=>{const button=$('#cancel');button.disabled=true;button.textContent='正在中止…';try{const d=await api(`/api/debates/${state.debate.id}/cancel`,{});stopPlayback();await openDebate(d);}catch(e){toast(e.message);button.disabled=false;button.textContent='中止辩论';}};
  if($('#resume-debate'))$('#resume-debate').onclick=async()=>{const button=$('#resume-debate');button.disabled=true;try{await openDebate(await api('/api/debates/'+state.debate.id+'/resume',{}));}catch(e){toast(e.message);button.disabled=false;}};
  document.querySelectorAll('[data-delete-debate]').forEach(b=>b.onclick=async()=>{
    const id=b.dataset.deleteDebate;if(!confirm('删除这场辩论及发言记录？进行中的生成将被中断，删除后无法恢复。'))return;
    b.disabled=true;try{const r=await fetch('/api/debates/'+id,{method:'DELETE'});const result=await r.json();if(!r.ok)throw new Error(result.error||'删除失败');
      state.data.debates=state.data.debates.filter(d=>d.id!==id);
      if(state.debate?.id===id){state.event?.close();state.debate=null;stopPlayback();try{sessionStorage.removeItem('debate-current-id');}catch{}}
      navigate('history');
    }catch(e){toast(e.message);b.disabled=false;}
  });
  if($('#again'))$('#again').onclick=()=>{state.draftTopic=state.debate.topic;state.draftQuery=state.debate.query;state.agents=state.debate.agents.map(a=>({...a}));state.rounds=state.debate.rounds;state.research=state.debate.research;state.language=state.debate.language||'zh';state.impromptu=state.debate.impromptu;state.impromptuPrompt=state.debate.impromptuPrompt;navigate('home');};
  if($('#stop-voice'))$('#stop-voice').onclick=stopPlayback;
  if($('#toggle-voice'))$('#toggle-voice').onclick=()=>{state.autoVoice=!state.autoVoice;if(!state.autoVoice)window.speechSynthesis?.cancel();render();};
  document.querySelectorAll('[data-read]').forEach(b=>b.onclick=()=>speak(state.debate.messages.find(m=>m.id===b.dataset.read),{replace:true}));
  document.querySelectorAll('[data-history]').forEach(b=>b.onclick=async()=>{try{await openDebate(await api(`/api/debates/${b.dataset.history}`));}catch(e){toast(e.message);}});
  if($('#library-search'))$('#library-search').oninput=e=>{const q=e.target.value.toLowerCase();$('#library-results').innerHTML=state.data.library.filter(s=>JSON.stringify(s).toLowerCase().includes(q)).map(sourceCard).join('')||'<p class="hint">没有匹配的资料。</p>';};
  if($('#role-form'))$('#role-form').onsubmit=async e=>{e.preventDefault();try{const p=await api('/api/presets',Object.fromEntries(new FormData(e.target)));state.data.customPresets.push(p);resetCharacterFilters();render();toast('角色已保存，可在配置辩手时选择');}catch(e){toast(e.message);}};
  if($('#settings-form'))$('#settings-form').onsubmit=async e=>{e.preventDefault();const b=Object.fromEntries(new FormData(e.target));for(const k of ['apiKey','tavilyKey']){if(!b[k])delete b[k];else if(b[k]==='-')b[k]='';}try{state.data.settings=await api('/api/settings',b);render();toast('连接已保存');}catch(e){toast(e.message);}};
  if($('#voice-form'))$('#voice-form').onsubmit=async e=>{e.preventDefault();const input=Object.fromEntries(new FormData(e.target));if(!input.apiKey)delete input.apiKey;try{state.data.voiceSettings=await api('/api/voice/settings',input);stopPlayback();render();toast('语音设置已保存');}catch(error){toast(error.message);}};
  document.querySelectorAll('[data-voice-preview]').forEach(b=>b.onclick=()=>speak({content:b.dataset.voicePreview.startsWith('en-')?'Welcome to Debate Room. Let us make a clear argument and respond thoughtfully.':'欢迎来到论场。让我们用清晰的理由，展开一场有质量的辩论。',language:b.dataset.voicePreview.startsWith('en-')?'en':'zh',side:b.dataset.voicePreview.replace(/^en-/,'')},{replace:true}));
  if($('#stop-preview'))$('#stop-preview').onclick=stopPlayback;
  if($('#test-search')){
    if(!state.data.features?.searchTest){$('#test-search').disabled=true;$('#search-test-results').textContent='新版搜索将在服务重启后启用。';}
    $('#test-search').onclick=async()=>{const button=$('#test-search'),out=$('#search-test-results');button.disabled=true;out.textContent='检索中…';try{const result=await api('/api/search/test',{query:$('#search-test-query').value});out.innerHTML=result.results.map(sourceCard).join('')+(result.warnings||[]).map(w=>'<p>'+esc(w)+'</p>').join('')||'未找到资料，请缩短关键词。';}catch(e){out.textContent=e.message;}finally{button.disabled=false;}};
  }
  if($('#provider'))$('#provider').onchange=e=>{
    const f=$('#settings-form'),value=e.target.value,defaults=connectionDefaults[value];
    f.elements.baseUrl.value=defaults.baseUrl;f.elements.model.value=defaults.model;f.elements.apiKey.value='';
    f.elements.apiKey.placeholder=value==='mimo'?'tp-… 或 ttp-…':'新连接请填写对应密钥';
    $('#mimo-help').hidden=value!=='mimo';$('#mimo-region-label').hidden=value!=='mimo';
    if(value==='mimo')$('#mimo-region').value='cn';
  };
  if($('#mimo-region'))$('#mimo-region').onchange=e=>{
    const f=$('#settings-form');f.elements.baseUrl.value='https://token-plan-'+e.target.value+'.xiaomimimo.com/v1';f.elements.apiKey.value='';f.elements.apiKey.placeholder='填写此集群的 Token Plan 密钥';
  };
  if($('#test-connection'))$('#test-connection').onclick=async()=>{const out=$('#connection-result'),button=$('#test-connection');button.disabled=true;out.textContent='连接测试中…';try{const r=await api('/api/settings/test',{});out.textContent=r.message;}catch(e){out.textContent='连接失败：'+e.message;}finally{button.disabled=false;}};
}
async function start(){captureDraft();state.busy=true;$('#start').disabled=true;try{const selected=state.data.topics.find(t=>t.title===state.draftTopic);const d=await api('/api/debates',{topic:state.draftTopic,query:selected?.query||state.draftQuery||state.draftTopic,agents:state.agents,rounds:state.rounds,research:state.research,language:state.language||'zh',impromptu:state.impromptu,impromptuPrompt:state.impromptuPrompt});state.data.debates.unshift(d);state.busy=false;await openDebate(d);}catch(e){state.busy=false;render();toast(e.message);}}
async function openDebate(d,{show=true}={}){
  window.speechSynthesis?.cancel();
  state.event?.close();state.debate=d;try{sessionStorage.setItem('debate-current-id',d.id);}catch{}if(show)navigate('arena');
  obsidianBridge?.report();
  if(!['running','researching','judging'].includes(d.status))return;
  let lastCount=d.messages.length;
  const event=new EventSource(`/api/debates/${d.id}/events`);state.event=event;
  event.onmessage=e=>{
    const next=JSON.parse(e.data);state.debate=next;
    const i=state.data.debates.findIndex(x=>x.id===next.id);
    if(i>=0)state.data.debates[i]=next;else state.data.debates.unshift(next);
    if(state.autoVoice)next.messages.slice(lastCount).forEach(speak);
    lastCount=next.messages.length;
    const byUrl=new Map([...state.data.library,...next.sources].map(s=>[s.url,s]));
    state.data.library=[...byUrl.values()];
    if(state.page==='arena')render();
    if(!['running','researching','judging'].includes(next.status))event.close();
  };
  event.onerror=()=>{toast('实时连接中断，正在尝试重新连接…');};
}
function stopPlayback(){if(neuralVoice)neuralVoice.stopVoice();else window.speechSynthesis?.cancel();}
function speak(message,options={}){if(neuralVoice){neuralVoice.speakVoice({...message,language:message.language||state.debate?.language||'zh'},state.data.voiceSettings,toast,options);return;}if(!('speechSynthesis' in window)){toast('当前浏览器不支持语音朗读');return;}const u=new SpeechSynthesisUtterance(message.content.replace(/\[S-[^\]]+\]/g,''));u.lang=state.debate?.language==='en'?'en-US':'zh-CN';u.rate=1.05;const zh=voices.filter(v=>v.lang.startsWith(state.debate?.language==='en'?'en':'zh'));if(zh.length)u.voice=zh[message.side==='con'?Math.min(1,zh.length-1):0];speechSynthesis.speak(u);}
function dictate(){
  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SpeechRecognition){toast('当前浏览器不支持语音输入，请使用 Chrome 或 Edge');return;}
  if(recognition){recognition.stop();return;}
  recognition=new SpeechRecognition();recognition.lang=state.language==='en'?'en-US':'zh-CN';recognition.interimResults=false;
  recognition.onresult=e=>{const text=e.results[0][0].transcript;state.draftTopic=text;state.draftQuery='';if($('#topic')){$('#topic').value=text;$('#topic').dispatchEvent(new Event('input'));}else saveSetup();};
  recognition.onerror=e=>toast('语音输入失败：'+e.error);
  recognition.onend=()=>{recognition=null;if($('#dictate'))$('#dictate').classList.remove('recording');};
  $('#dictate').classList.add('recording');
  try{recognition.start();toast('请说出你的辩题…');}catch(e){recognition=null;if($('#dictate'))$('#dictate').classList.remove('recording');toast(e.message);}
}
if('speechSynthesis' in window){voices=speechSynthesis.getVoices();speechSynthesis.onvoiceschanged=()=>voices=speechSynthesis.getVoices();}
try{
  state.data=await api('/api/bootstrap');if(state.data.features?.voice){neuralVoice=await import('./voice.js');renderVoiceSettings=(await import('./voice-controls.js')).voiceSettings;}state.agents=[{...state.data.presets[0],side:'pro'},{...state.data.presets[4],side:'con'}];
  try{
    const saved=JSON.parse(sessionStorage.getItem('debate-setup-v1')||'{}');
    if(typeof saved.topic==='string'&&saved.topic.length<=500)state.draftTopic=saved.topic;
    if(typeof saved.query==='string'&&saved.query.length<=500)state.draftQuery=saved.query;
    if(Number.isInteger(saved.rounds)&&saved.rounds>=1&&saved.rounds<=5)state.rounds=saved.rounds;
    if(typeof saved.research==='boolean')state.research=saved.research;
    state.language=saved.language==='en'?'en':'zh';state.impromptu=saved.impromptu===true;state.impromptuPrompt=typeof saved.impromptuPrompt==='string'?saved.impromptuPrompt.slice(0,500):'';
    if(Array.isArray(saved.agents)&&saved.agents.length<=6&&saved.agents.every(a=>a&&typeof a.id==='string'&&typeof a.name==='string'&&typeof a.prompt==='string'&&['pro','con'].includes(a.side)))state.agents=saved.agents;
  }catch{}
  render();
  let currentId;try{currentId=sessionStorage.getItem('debate-current-id');}catch{}
  const current=state.data.debates.find(d=>d.id===currentId)||state.data.debates.find(d=>['running','researching','judging'].includes(d.status));
  if(current)await openDebate(current,{show:false});
  obsidianBridge?.ready();
}catch(e){$('#app').innerHTML=`<div class="empty"><h1>无法连接本地服务</h1><p>${esc(e.message)}</p><p>请在项目目录运行 npm start，然后刷新页面。</p></div>`;}

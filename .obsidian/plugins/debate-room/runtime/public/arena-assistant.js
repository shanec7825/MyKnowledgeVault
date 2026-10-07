import {readableReply} from './model-output.js';
import {renderSpeech} from './speech-format.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sessions=new Map();
function session(id){
  if(!sessions.has(id)){
    let saved;try{saved=JSON.parse(sessionStorage.getItem('arena-assistant-'+id)||'null');}catch{}
    sessions.set(id,{messages:Array.isArray(saved?.messages)?saved.messages.filter(m=>m&&['user','assistant'].includes(m.role)&&typeof m.content==='string').slice(-16):[],selected:Array.isArray(saved?.selected)?saved.selected.slice(0,4):[],draft:typeof saved?.draft==='string'?saved.draft.slice(0,2000):'',pending:false,error:'',controller:null,speaker:'all'});
  }
  return sessions.get(id);
}
function save(id,s){try{sessionStorage.setItem('arena-assistant-'+id,JSON.stringify({messages:s.messages,selected:s.selected,draft:s.draft}));}catch{}}
export function attachSpeech(debate,id){
  const s=session(debate.id);if(s.pending||!debate.messages.some(m=>m.id===id))return false;
  if(!s.selected.includes(id)){if(s.selected.length>=4)return false;s.selected.push(id);}
  save(debate.id,s);return true;
}
export function assistantPanel(debate){
  const s=session(debate.id);s.selected=s.selected.filter(id=>debate.messages.some(m=>m.id===id));
  return `<section class="arena-assistant"><h2>现场分析助手</h2><p class="hint">把发言附在问题里，追问论证、证据或反驳方式。</p><label class="assistant-picker-label">选择辩手<select id="assistant-speaker" ${s.pending?'disabled':''}><option value="all">全部辩手</option>${debate.agents.map(a=>`<option value="${a.id}" ${s.speaker===a.id?'selected':''}>${esc(a.name)} · ${a.side==='pro'?'正方':'反方'}</option>`).join('')}</select></label><label class="assistant-picker-label">选择轮次发言<select id="assistant-speech" ${s.pending?'disabled':''}><option value="">＋ 添加发言附件</option>${debate.messages.filter(m=>s.speaker==='all'||m.agentId===s.speaker).map(m=>`<option value="${m.id}" ${s.selected.includes(m.id)?'disabled':''}>${esc(m.name)} · ${esc(m.stage)}${m.round?'第 '+m.round+' 轮':''}</option>`).join('')}</select></label><div class="speech-attachments">${s.selected.map(id=>{const m=debate.messages.find(m=>m.id===id);return `<div class="speech-attachment"><span>▤ <strong>${esc(m.name)}</strong><small>${esc(m.stage)}${m.round?' · 第 '+m.round+' 轮':''}</small></span><button type="button" data-remove-attachment="${id}" aria-label="移除 ${esc(m.name)} 的发言附件" ${s.pending?'disabled':''}>×</button></div>`;}).join('')||'<p class="hint">在发言上点「问分析助手」，或从上方选择。最多四条。</p>'}</div><div class="assistant-messages" aria-live="polite">${s.messages.map(m=>`<article class="assistant-message ${m.role}"><small>${m.role==='user'?'你':'分析助手'}</small>${m.role==='user'&&m.messageIds?.length?`<div class="past-attachments">附带 ${m.messageIds.length} 条发言</div>`:''}<div>${m.role==='assistant'?renderSpeech(readableReply(m.content)||'这条回复格式不完整，请重试。',debate.sources):esc(m.content)}</div></article>`).join('')}${s.pending?'<p class="thinking">正在阅读附件并分析…</p>':''}</div>${s.error?`<div class="chat-error" role="alert">${esc(s.error)}<button id="retry-arena-assistant" type="button">重试</button></div>`:''}<form id="arena-assistant-form"><label for="arena-assistant-message">向分析助手提问</label><textarea id="arena-assistant-message" rows="3" maxlength="2000" ${s.pending?'disabled':''} placeholder="例如：这段反驳是否回应了对方的核心理由？">${esc(s.draft)}</textarea><div class="assistant-actions"><button type="button" id="clear-arena-assistant" class="text-button" ${s.pending?'disabled':''}>新讨论</button>${s.pending?'<button type="button" class="secondary" id="stop-arena-assistant">停止分析</button>':'<button type="submit" class="primary">发送问题 ↑</button>'}</div></form></section>`;
}
export function bindAssistant(debate,notify){
  const form=document.querySelector('#arena-assistant-form');if(!form)return;
  const s=session(debate.id),textarea=document.querySelector('#arena-assistant-message');
  textarea.oninput=()=>{s.draft=textarea.value;save(debate.id,s);};
  document.querySelector('#assistant-speaker').onchange=e=>{s.speaker=e.target.value;notify();};
  document.querySelector('#assistant-speech').onchange=e=>{if(!attachSpeech(debate,e.target.value))s.error='每次最多附加四条发言，请先移除一个附件。';notify();};
  document.querySelectorAll('[data-remove-attachment]').forEach(b=>b.onclick=()=>{s.selected=s.selected.filter(id=>id!==b.dataset.removeAttachment);save(debate.id,s);notify();});
  form.onsubmit=e=>{e.preventDefault();s.draft=textarea.value;void submit(debate,s,notify);};
  textarea.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();form.requestSubmit();}};
  document.querySelector('#clear-arena-assistant').onclick=()=>{s.messages=[];s.selected=[];s.error='';save(debate.id,s);notify();};
  const stop=document.querySelector('#stop-arena-assistant');if(stop)stop.onclick=()=>s.controller?.abort();
  const retry=document.querySelector('#retry-arena-assistant');if(retry)retry.onclick=()=>void submit(debate,s,notify);
}
async function submit(debate,s,notify){
  if(s.pending)return;
  if(!s.draft.trim()){s.error='先写下你想问的问题。';notify();return;}
  const question={role:'user',content:s.draft.trim(),messageIds:[...s.selected]};
  const history=[...s.messages.slice(-14),question];
  while(history.length>1&&history.reduce((n,m)=>n+m.content.length,0)>26000)history.shift();
  s.pending=true;s.error='';s.controller=new AbortController();save(debate.id,s);notify();
  try{
    const response=await fetch('/api/debates/'+debate.id+'/assistant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:history}),signal:s.controller.signal});
    const result=await response.json();if(!response.ok)throw new Error(result.error||'分析失败');
    const reply=readableReply(result.reply);if(!reply)throw new Error('分析回复格式不完整，请重试。');
    s.messages=[...history,{role:'assistant',content:reply}].slice(-16);s.draft='';
  }catch(e){s.error=e.name==='AbortError'?'已停止分析，问题与附件已保留。':e.message;}
  finally{s.pending=false;s.controller=null;save(debate.id,s);notify();}
}

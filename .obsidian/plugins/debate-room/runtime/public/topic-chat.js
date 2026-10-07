import {readableReply} from './model-output.js';
import {renderSpeech as formatSpeech} from './speech-format.js';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const storageKey='debate-topic-chat-v1';
let messages=[],suggestions=[],draft='',pending=false,error='',controller=null;
try{
  const saved=JSON.parse(sessionStorage.getItem(storageKey)||'{}');
  if(Array.isArray(saved.messages))messages=saved.messages.filter(m=>m&&['user','assistant'].includes(m.role)&&typeof m.content==='string').slice(-40);
  if(Array.isArray(saved.suggestions))suggestions=saved.suggestions.filter(s=>s&&typeof s.title==='string'&&typeof s.query==='string'&&typeof s.reason==='string').slice(0,3);
  if(typeof saved.draft==='string')draft=saved.draft.slice(0,2000);
}catch{}
function save(){try{sessionStorage.setItem(storageKey,JSON.stringify({messages,suggestions,draft}));}catch{}}
export function topicChat(topic){
  return `<div class="topic-chat"><div class="chat-heading"><div><span class="chat-mark">✦</span><strong>讨论辩题</strong><small>描述研究方向，或继续追问。</small></div><button class="text-button" id="clear-topic-chat" ${pending?'disabled':''}>清空讨论</button></div><div class="topic-messages" id="topic-messages" aria-live="polite">${messages.length?messages.map(m=>`<div class="topic-message ${m.role}"><span class="message-label">${m.role==='user'?'你':'选题助手'}</span><div>${m.role==='assistant'?formatSpeech(readableReply(m.content)||'这条旧回复格式不完整，请重新提问。',[]):escape(m.content)}</div></div>`).join(''):'<div class="chat-welcome"><strong>想讨论什么？</strong><p>从一个方向开始，一起明确范围和争议。</p><div class="chat-prompts"><button type="button" data-chat-prompt="我想研究 AI 对教育的影响，但不知道从什么问题切入">AI 会怎样改变教育？</button><button type="button" data-chat-prompt="我想讨论年轻人的职业选择，帮我找一个有深度的辩题">聊聊职业与人生选择</button><button type="button" data-chat-prompt="帮我比较公共安全与个人隐私之间值得研究的争议">探索隐私与公共安全</button></div></div>'}${pending?'<div class="topic-message assistant"><span class="message-label">选题助手</span><div class="thinking-dots">正在思考…</div></div>':''}</div>${suggestions.length?`<div class="topic-suggestions"><span>候选辩题</span>${suggestions.map((s,i)=>`<button type="button" data-adopt-topic="${i}"><div><strong>${escape(s.title)}</strong><small>${escape(s.reason)}</small></div><span>采用 ↗</span></button>`).join('')}</div>`:''}${error?`<div class="chat-error" role="alert">${escape(error)}<button id="retry-topic-chat" type="button">重试</button></div>`:''}<form id="topic-chat-form" class="chat-composer"><label class="sr-only" for="topic-message">与 AI 讨论研究方向</label><textarea id="topic-message" rows="2" maxlength="2000" placeholder="告诉我你想研究什么，或继续追问…" ${pending?'disabled':''}>${escape(draft)}</textarea><div><span>Enter 发送 · Shift + Enter 换行</span>${pending?'<button class="secondary" type="button" id="cancel-topic-chat">停止</button>':'<button class="primary" type="submit" id="send-topic-chat">发送 ↑</button>'}</div></form><div class="topic-confirm"><div><label for="topic">本场辩题</label><small>采用候选辩题，或在此手动调整</small></div><div class="input-with-button"><input id="topic" maxlength="500" value="${escape(topic)}" placeholder="确定本场要交锋的问题…"><button id="dictate" class="icon-button" type="button" title="语音输入辩题" aria-label="语音输入辩题">♩</button></div></div></div>`;
}
export function bindTopicChat(notify){
  const textarea=document.querySelector('#topic-message');if(!textarea)return;
  textarea.oninput=()=>{draft=textarea.value;save();};
  textarea.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();document.querySelector('#topic-chat-form').requestSubmit();}};
  document.querySelector('#topic-chat-form').onsubmit=e=>{e.preventDefault();if(pending)return;const text=textarea.value.trim();if(!text)return;messages.push({role:'user',content:text});draft='';save();void requestReply(notify);};
  document.querySelectorAll('[data-chat-prompt]').forEach(b=>b.onclick=()=>{if(pending)return;messages.push({role:'user',content:b.dataset.chatPrompt});draft='';save();void requestReply(notify);});
  document.querySelectorAll('[data-adopt-topic]').forEach(b=>b.onclick=()=>notify(suggestions[Number(b.dataset.adoptTopic)]));
  document.querySelector('#clear-topic-chat').onclick=()=>{if(pending)return;messages=[];suggestions=[];draft='';error='';save();notify();};
  const retry=document.querySelector('#retry-topic-chat');if(retry)retry.onclick=()=>{if(!pending)void requestReply(notify);};
  const cancel=document.querySelector('#cancel-topic-chat');if(cancel)cancel.onclick=()=>controller?.abort();
  const pane=document.querySelector('#topic-messages');pane.scrollTop=pane.scrollHeight;
}
async function requestReply(notify){
  pending=true;error='';controller=new AbortController();notify();
  try{
    const history=messages.slice(-21).map(({role,content})=>({role,content:content.slice(0,6000)}));
    while(history.length>1 && history.reduce((size,m)=>size+m.content.length,0)>26000)history.shift();
    const response=await fetch('/api/topic-chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:history}),signal:controller.signal});
    const result=await response.json();if(!response.ok)throw new Error(result.error||'选题讨论失败');
    if(typeof result.reply!=='string'||!Array.isArray(result.suggestions))throw new Error('选题回复格式无效');
    messages.push({role:'assistant',content:result.reply});messages=messages.slice(-40);suggestions=result.suggestions;
  }catch(e){error=e.name==='AbortError'?'已停止生成，可以修改方向或重试。':e.message;}
  finally{pending=false;controller=null;save();notify();}
}

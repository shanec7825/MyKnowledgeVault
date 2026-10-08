import {researchMessages,topicGuidance} from './agent-methods.mjs';
import {buildDebateMessages} from './debate-context.mjs';
import {debateSchedule,briefMessages,parseBrief,flowMessages,parseFlow,recycledSpeech} from './debate-framework.mjs';
import {structuredReply} from './structured-output.mjs';
import {assistantMessages} from './arena-assistant.mjs';
import {voiceNames,mimoVoiceNames,voiceDefaults,validateVoiceSettings,synthesize,streamMimo} from './voice.mjs';
import {archiveDocuments,writeLocalArchive} from './exports.mjs';
import {reviewMessages} from './debate-review.mjs';
import {atomicWrite} from './atomic-file.mjs';
import {teamTemplate} from './team-templates.mjs';
import {generateStream} from './model-stream.mjs';
import {previewReply} from './public/text-stream.js';
import {canonicalSourceUrl} from './search.mjs';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import { presets,topics,providerDefaults,normalizeBaseUrl,validateTopicMessages,parseTopicReply,demoTopicReply,validateConfig,search,generate,demoSpeech,demoReview,parseReview } from './lib.mjs';
import {validateCoaching,coachingPrompt,trainingHistory,parseCoaching,demoCoaching} from './coaching.mjs';

const root=path.dirname(fileURLToPath(import.meta.url));
const dataDir=process.env.DATA_DIR || path.join(root,'data');
await mkdir(dataDir,{recursive:true});
const file=path.join(dataDir,'store.json');
let store={debates:[],library:[],customPresets:[]};
try {store=JSON.parse(await readFile(file,'utf8'));} catch(e) {if(e.code!=='ENOENT') throw e;}
store.coachSessions ??= [];
store.teamTemplates ??= [];
store.voiceSettings={...voiceDefaults,...store.voiceSettings};
for(const d of store.debates) if(['running','researching','judging'].includes(d.status)){d.status='interrupted';if(d.streamingSpeech)d.streamingSpeech.status='interrupted';d.error='服务重启中断了本场辩论，可重新开始。';}
for(const session of store.coachSessions)for(const attempt of session.attempts||[])if(attempt.status==='pending'){attempt.status='cancelled';attempt.error='服务重启中断了反馈，练习答案已保留。';}
const initialProvider=process.env.PROVIDER||'demo';
if(!Object.hasOwn(providerDefaults,initialProvider))throw new Error('PROVIDER 配置无效');
let settings={provider:initialProvider,baseUrl:process.env.MODEL_BASE_URL||providerDefaults[initialProvider].baseUrl,model:process.env.MODEL_NAME||providerDefaults[initialProvider].model,apiKey:process.env.MODEL_API_KEY||'',tavilyKey:process.env.TAVILY_API_KEY||''};
let voiceApiKey=process.env.MIMO_TTS_API_KEY||'';
const jobs=new Map(), subscribers=new Map();
const coachingJobs=new Set();
const assistantJobs=new Set();
let writes=Promise.resolve();
const archived=new Map();
function persist(){ const snapshot=JSON.stringify(store,null,2); const p=writes.then(async()=>{
  await atomicWrite(file,snapshot);
  const saved=JSON.parse(snapshot);
  for(const [type,records] of [['debate',saved.debates],['coach',saved.coachSessions]])for(const record of records||[]){
    const key=type+record.id,version=JSON.stringify(record);if(archived.get(key)===version)continue;
    try{
      const documents=archiveDocuments(record,type);await writeLocalArchive(documents,path.join(dataDir,'exports'));
      if(process.connected)process.send({type:'archive',documents},error=>{if(error)console.error('知识库归档通知失败');});
      archived.set(key,version);
    }catch(error){console.error('自动归档失败：',error.message);if(process.connected)process.send({type:'archive-error',error:'本地自动归档失败，请检查磁盘空间及权限'},()=>{});}
  }
}); writes=p.catch(()=>{}); return p; }
await persist();
function emit(d){for(const res of subscribers.get(d.id)||[]) {if(res.destroyed)continue;res.write(`data: ${JSON.stringify(d)}\n\n`);if(!['running','researching','judging'].includes(d.status))res.end();}}
async function changed(d){d.updatedAt=new Date().toISOString();await persist();emit(d);}
function publicSettings(){const {apiKey,tavilyKey,...rest}=settings;return {...rest,hasApiKey:!!apiKey,hasTavilyKey:!!tavilyKey};}
function publicVoiceSettings(){return {...store.voiceSettings,hasApiKey:!!voiceApiKey};}
async function research(d,s,signal){
  d.status='researching';const queryCache=new Map();d.researchLog=[];await changed(d);
  for(const a of d.agents){
    if(signal.aborted) throw signal.reason;
    let query=d.query;d.current={name:a.name,stage:'规划检索'};await changed(d);
    if(s.provider!=='demo'){
      try {query=(await generate(researchMessages(d,a),s,AbortSignal.any([signal,AbortSignal.timeout(15000)]),a.model)).trim().replace(/^['"“]|['"”]$/g,'').slice(0,150)||d.query;} catch(e){if(signal.aborted)throw e;d.warnings.push(`${a.name} 查询生成失败，使用辩题关键词。`);}
    }
    const entry={agent:a.name,query,status:'检索中',count:0};d.researchLog.push(entry);d.current={name:a.name,stage:'检索资料'};await changed(d);
    try {
      const key=query.trim().toLowerCase().replace(/\s+/g,' ');
      const reused=queryCache.has(key);
      const results=reused?queryCache.get(key):await search(query,s,signal);
      if(!reused)queryCache.set(key,results);
      entry.status=reused?'复用结果':'已完成';entry.count=results.length;
      if(!reused)for(const warning of results.warnings||[])d.warnings.push(warning);
      if(!results.length)d.warnings.push(`${a.name} 的检索没有返回资料：${query}`);
      for(const r of results){
        let item=store.library.find(x=>canonicalSourceUrl(x.url)===r.url);
        if(!item){item={...r,id:'S-'+randomUUID().slice(0,8),retrievedAt:new Date().toISOString(),queries:[query],contributors:[a.name]};store.library.push(item);}
        else {Object.assign(item,r);item.content=r.content;item.retrievedAt=new Date().toISOString();item.queries=[...new Set([...item.queries,query])];item.contributors=[...new Set([...item.contributors,a.name])];}
        const index=d.sources.findIndex(x=>x.id===item.id);
        if(index<0)d.sources.push({...item});else d.sources[index]={...item};
      }
    } catch(e){if(signal.aborted)throw e;entry.status='失败';entry.error=e.message;d.warnings.push(`${a.name} 联网检索失败：${e.message}。继续辩论，不伪造资料。`);}
    await changed(d);
  }
}
async function run(d,s,controller){
  const signal=controller.signal;
  d.streamingSpeech=null;d.reviewPreview=null;
  try{
    if(d.research&&!d.researchComplete&&!d.messages.length)await research(d,s,signal);
    d.researchComplete=true;
    d.status='running';await changed(d);
    if(d.frameworkVersion===2&&!d.briefAttempted){
      d.current={name:'共同审题',stage:'审题与举证责任'};await changed(d);
      if(s.provider!=='demo'){
        try{d.brief=await structuredReply(briefMessages(d),messages=>generate(messages,s,signal,undefined,{thinking:false}),parseBrief,signal);}
        catch(error){if(signal.aborted)throw error;d.warnings.push('共同审题未生成有效结果，直接依据原题辩论：'+error.message);}
      }
      d.briefAttempted=true;await changed(d);
    }
    const schedule=d.schedule||debateSchedule(d);d.schedule=schedule;
    for(let turnIndex=0;turnIndex<schedule.length;turnIndex++){
      const step=schedule[turnIndex],a=d.agents.find(a=>a.id===step.agentId);
      if(!a)throw new Error('辩论日程中的辩手不存在');
      if(signal.aborted)throw signal.reason;
      if(d.messages.some(m=>m.agentId===a.id&&m.stage===step.stage&&m.round===step.round))continue;
      d.current={...step,name:a.name};await changed(d);
      const turn=buildDebateMessages(d,a,step);
      if((turn.context.shortenedMessages||turn.context.shortenedSources)&&!d.warnings.some(w=>w.startsWith('上下文压缩：')))d.warnings.push('上下文压缩：本场内容超过长度预算，使用近期交锋和早期摘录，过长正文只保留首尾；完整原文仍保存在辩论记录中。');
      let content;
      if(s.provider==='demo'){await delay(300,undefined,{signal});content=demoSpeech(d,a,step.stage,step.round);}
      else {
        d.streamingSpeech={id:randomUUID(),agentId:a.id,name:a.name,side:a.side,...step,content:'',status:'streaming'};
        emit(d);let lastEmit=0;
        content=await generateStream(turn.messages,s,signal,a.model,(_delta,text)=>{
          d.streamingSpeech.content=text;
          if(Date.now()-lastEmit>=80){lastEmit=Date.now();emit(d);}
        });
      }
      if(signal.aborted)throw signal.reason;
      if(d.frameworkVersion===2&&s.provider!=='demo'&&recycledSpeech(content,d.messages.filter(m=>m.side===a.side))){
        d.current={...step,name:a.name,detail:'重写重复论证'};d.streamingSpeech.content='';emit(d);let lastEmit=0;
        content=await generateStream([...turn.messages,{role:'assistant',content},{role:'user',content:'这段发言与本方已有发言几乎逐字重复。请重写本次发言：选择一个尚未补上的推理、证据或反例，解释它为何改变原题判断。总结阶段只重新比较已讨论理由，不补新论点。只输出发言正文。'}],s,signal,a.model,(_delta,text)=>{d.streamingSpeech.content=text;if(Date.now()-lastEmit>=80){lastEmit=Date.now();emit(d);}});
        if(recycledSpeech(content,d.messages.filter(m=>m.side===a.side)))d.warnings.push(`${a.name} 重写后仍存在高度重复，请结合原文评估。`);
      }
      if(signal.aborted)throw signal.reason;
      content=content.replace(/\(\s*(S-[a-f0-9]{8})\s*\)/g,'[$1]');
      const citations=[...new Set(content.match(/\[S-[a-f0-9]{8}\]/g)||[])];
      const unknown=citations.filter(c=>!d.sources.some(x=>`[${x.id}]`===c));
      if(unknown.length)d.warnings.push(`${a.name} 使用了未入库的引用：${unknown.join('、')}`);
      d.messages.push({id:randomUUID(),agentId:a.id,name:a.name,side:a.side,stage:step.stage,round:step.round,content,context:turn.context,citations:citations.filter(c=>!unknown.includes(c)),createdAt:new Date().toISOString()});
      d.streamingSpeech=null;
      await changed(d);
      const next=schedule[turnIndex+1],endOfPhase=!next||next.stage!==step.stage||next.round!==step.round;
      if(d.frameworkVersion===2&&endOfPhase&&step.stage!=='总结'&&s.provider!=='demo'){
        d.current={name:'争点记录',stage:'梳理争点'};await changed(d);
        try{
          const flow=await structuredReply(flowMessages(d),messages=>generate(messages,s,signal,undefined,{thinking:false}),text=>parseFlow(text,d.messages),signal);
          d.flow=flow;d.flowHistory=[...(d.flowHistory||[]),flow];
        }catch(error){if(signal.aborted)throw error;d.warnings.push('本阶段争点记录未通过原文校验，保留已有记录：'+error.message);}
        await changed(d);
      }
    }
    if(signal.aborted)throw signal.reason;
    d.status='judging';d.current={stage:'点评',name:'独立评审'};await changed(d);
    if(s.provider==='demo')d.review=demoReview(d);
    else{
      // Review is structured JSON; preview only its summary, never raw JSON.
      let lastEmit=0;
      const text=await generateStream(reviewMessages(d),s,signal,undefined,(_delta,text)=>{d.reviewPreview=previewReply(text,'summary');if(Date.now()-lastEmit>=80){lastEmit=Date.now();emit(d);}},{thinking:false});
      try {d.review=parseReview(text,d.agents);}catch(e){d.review={summary:text,unstructured:true};d.warnings.push('评审未返回有效结构化评分，已保留原始点评。');}
    }
    if(signal.aborted)throw signal.reason;
    d.reviewPreview=null;d.status='completed';d.current=null;await changed(d);
  }catch(e){d.status=signal.aborted?'cancelled':'failed';if(d.streamingSpeech)d.streamingSpeech.status='interrupted';d.error=signal.aborted?'本场已停止，已生成内容已保留。':e.message;d.current=null;await changed(d).catch(err=>console.error('保存失败',err.message));}
  finally{jobs.delete(d.id);}
}
function send(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
function packet(res,value){if(!res.destroyed&&!res.writableEnded)res.write(`data: ${JSON.stringify(value)}\n\n`);}
function streamHeader(res){res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache','Connection':'keep-alive'});}
function replyGenerator(res,settings,signal,streaming){
  return async messages=>{
    if(!streaming)return generate(messages,settings,signal);
    packet(res,{type:'preview',content:''});let lastEmit=0;
    const text=await generateStream(messages,settings,signal,undefined,(_delta,text)=>{if(Date.now()-lastEmit>=80){lastEmit=Date.now();packet(res,{type:'preview',content:previewReply(text)});}});
    packet(res,{type:'preview',content:previewReply(text)});return text;
  };
}
async function body(req){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>100000)throw new Error('请求体过大');chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');}
const server=http.createServer(async(req,res)=>{
  try{
    const host=req.headers.host;
    if(!host || !/^((localhost|127\.0\.0\.1)(:\d+)?)$/.test(host))return send(res,403,{error:'仅允许本机访问'});
    if(req.headers.origin && ![`http://${host}`].includes(req.headers.origin))return send(res,403,{error:'禁止跨站请求'});
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
    const ancestors=process.env.OBSIDIAN_EMBED==='1'?'app://obsidian.md':"'none'";
    res.setHeader('Content-Security-Policy',`default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; media-src 'self' blob:; frame-ancestors ${ancestors}; base-uri 'none'`);
    const u=new URL(req.url,`http://${host}`), p=u.pathname;
    if(p==='/api/bootstrap' && req.method==='GET')return send(res,200,{features:{impromptu:true,searchTest:true,voice:true,english:true,autoArchive:true,mimoVoice:true},teamTemplates:store.teamTemplates,voiceSettings:publicVoiceSettings(),voiceNames,mimoVoiceNames,presets,topics,settings:publicSettings(),customPresets:store.customPresets,library:store.library,debates:store.debates,coachSessions:store.coachSessions.map(({id,topic,side,level,debateId,updatedAt,messages})=>({id,topic,side,level,debateId,updatedAt,messageCount:messages.length}))});
    if(p==='/api/team-templates'&&req.method==='POST'){
      const item=teamTemplate(await body(req));
      if(store.teamTemplates.some(t=>t.name===item.name))throw new Error('组合名称已存在，请使用不同名称');
      if(store.teamTemplates.length>=100)throw new Error('最多保存 100 个组合');
      store.teamTemplates.push(item);await persist();return send(res,201,item);
    }
    if(p.startsWith('/api/team-templates/')&&req.method==='DELETE'){
      const id=p.slice('/api/team-templates/'.length),index=store.teamTemplates.findIndex(t=>t.id===id);
      if(index<0)return send(res,404,{error:'组合不存在'});
      store.teamTemplates.splice(index,1);await persist();return send(res,200,{ok:true});
    }
    const coachingMatch=p.match(/^\/api\/coach\/([a-f0-9-]{36})$/);
    if(coachingMatch&&req.method==='GET'){
      const session=store.coachSessions.find(s=>s.id===coachingMatch[1]);
      return send(res,session?200:404,session||{error:'找不到训练记录'});
    }
    if(p==='/api/coach'&&req.method==='POST'){
      const raw=await body(req),input=validateCoaching(raw),streaming=raw.stream===true;
      let session;
      if(input.sessionId){session=store.coachSessions.find(s=>s.id===input.sessionId);if(!session)return send(res,404,{error:'找不到训练记录'});}
      else{
        const debate=input.debateId?store.debates.find(d=>d.id===input.debateId):null;
        if(input.debateId&&!debate)return send(res,404,{error:'关联的辩论不存在'});
        if(debate&&debate.topic!==input.topic)throw new Error('关联辩论与训练论题不一致，请重新选择记录');
        session={id:randomUUID(),topic:input.topic,side:input.side,level:input.level,track:input.track,trainingVersion:1,debateId:input.debateId,context:debate?structuredClone({status:debate.status,messages:debate.messages,sources:debate.sources,review:debate.review,brief:debate.brief,flow:debate.flow,capturedAt:new Date().toISOString()}):null,messages:[],createdAt:new Date().toISOString()};
      }
      if(coachingJobs.has(session.id))return send(res,409,{error:'教练正在回复本次训练，请稍后再提交'});
      if(coachingJobs.size>=3)return send(res,429,{error:'教练同时最多处理三次训练'});
      coachingJobs.add(session.id);
      const controller=new AbortController(),snapshot={...settings};
      const disconnected=()=>controller.abort(new Error('客户端已断开'));res.on('close',disconnected);
      const attempt={id:randomUUID(),content:input.message,action:input.action,status:'pending',createdAt:new Date().toISOString()};
      session.attempts=[...(session.attempts||[]),attempt];session.updatedAt=attempt.createdAt;
      if(!store.coachSessions.some(s=>s.id===session.id))store.coachSessions.unshift(session);
      try{
        await persist();
        if(streaming)streamHeader(res);
        const user={id:randomUUID(),role:'user',content:input.message,action:input.action,createdAt:new Date().toISOString()};
        const history=[...session.messages,user];
        let report;
        if(snapshot.provider==='demo')report=demoCoaching(session,input.message,input.action);
        else report=await structuredReply([...coachingPrompt(session,input.action),...trainingHistory(history)],replyGenerator(res,snapshot,controller.signal,streaming),text=>parseCoaching(text,session.context),controller.signal);
        if(controller.signal.aborted||res.destroyed)return;
        attempt.status='replied';
        const updated={...session,messages:[...history,{id:randomUUID(),role:'assistant',content:report.reply,report,mode:snapshot.provider,model:snapshot.model,createdAt:new Date().toISOString()}],updatedAt:new Date().toISOString()};
        const index=store.coachSessions.findIndex(s=>s.id===session.id);
        if(index<0)store.coachSessions.unshift(updated);else store.coachSessions[index]=updated;
        try{await persist();}catch(e){if(index<0)store.coachSessions=store.coachSessions.filter(s=>s.id!==session.id);else store.coachSessions[index]=session;throw e;}
        if(streaming){packet(res,{type:'done',result:updated});res.end();return;}return send(res,200,updated);
      }catch(error){attempt.status='failed';attempt.error=error.message;session.updatedAt=new Date().toISOString();await persist();throw error;}
      finally{
        try{if(attempt.status==='pending'){attempt.status='cancelled';session.updatedAt=new Date().toISOString();await persist();}}
        finally{coachingJobs.delete(session.id);res.off('close',disconnected);}
      }
    }
    if(p==='/api/settings' && req.method==='POST'){
      const b=await body(req);
      if(!Object.hasOwn(providerDefaults,b.provider))throw new Error('模型模式无效');
      const baseUrl=normalizeBaseUrl(b.baseUrl,b.provider);
      if(typeof b.model!=='string'||!b.model.trim()||b.model.length>100)throw new Error('请输入模型名称');
      for(const k of ['apiKey','tavilyKey'])if(b[k]!==undefined&&(typeof b[k]!=='string'||b[k].length>500))throw new Error('密钥格式无效');
      const sameConnection=settings.provider===b.provider&&normalizeBaseUrl(settings.baseUrl,settings.provider)===baseUrl;
      settings={...settings,provider:b.provider,baseUrl,model:b.model.trim(),apiKey:b.apiKey!==undefined?b.apiKey.trim():(sameConnection?settings.apiKey:''),...(b.tavilyKey!==undefined?{tavilyKey:b.tavilyKey.trim()}:{})};
      return send(res,200,publicSettings());
    }
    if(p==='/api/voice/settings' && req.method==='POST'){
      const input=await body(req),validated=validateVoiceSettings({...store.voiceSettings,...input});
      if(input.apiKey!==undefined&&(typeof input.apiKey!=='string'||input.apiKey.length>500))throw new Error('语音密钥格式无效');
      if(validated.mimoBaseUrl!==store.voiceSettings.mimoBaseUrl)voiceApiKey='';
      if(input.apiKey!==undefined)voiceApiKey=input.apiKey==='-'?'':input.apiKey.trim();
      store.voiceSettings=validated;await persist();return send(res,200,publicVoiceSettings());
    }
    if(['/api/voice/speech','/api/voice/stream'].includes(p) && req.method==='POST'){
      const input=await body(req),controller=new AbortController(),disconnect=()=>controller.abort(new Error('客户端已断开'));
      if(!['mimo','edge'].includes(store.voiceSettings.provider))throw new Error('请先选择小米或 Edge 神经语音');
      res.on('close',disconnect);
      const voiceSettings={...store.voiceSettings};
      if(voiceSettings.provider==='mimo'&&voiceSettings.reuseModelConnection&&settings.provider!=='mimo')throw new Error('请先在模型设置选择 MiMo Token Plan 并配置共用密钥与集群地址');
      const connection=voiceSettings.reuseModelConnection&&settings.provider==='mimo'?{baseUrl:settings.baseUrl,apiKey:settings.apiKey}:{baseUrl:voiceSettings.mimoBaseUrl,apiKey:voiceApiKey};
      if(p==='/api/voice/stream'){
        if(voiceSettings.provider!=='mimo')throw new Error('流式朗读需要小米预置音色');
        res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-store','X-Accel-Buffering':'no'});res.flushHeaders();
        try{
          for await(const audio of streamMimo(input,voiceSettings,connection,controller.signal)){
            if(res.destroyed)break;
            if(!res.write(`data: ${JSON.stringify({type:'audio',data:audio,sampleRate:24000})}\n\n`))await new Promise(resolve=>{
              const done=()=>{res.off('drain',done);res.off('close',done);resolve();};res.once('drain',done);res.once('close',done);
            });
          }
          if(!res.destroyed)res.end('data: {"type":"done"}\n\n');
        }catch(error){if(!res.destroyed)res.end(`data: ${JSON.stringify({type:'error',error:error.message})}\n\n`);}
        finally{res.off('close',disconnect);}return;
      }
      try{const audio=await synthesize(input,voiceSettings,controller.signal,connection);if(!res.destroyed){res.writeHead(200,{'Content-Type':voiceSettings.provider==='mimo'?'audio/wav':'audio/mpeg','Content-Length':audio.length,'Cache-Control':'no-store'});res.end(audio);}}
      finally{res.off('close',disconnect);}
      return;
    }
    if(p==='/api/search/test' && req.method==='POST'){
      const b=await body(req);
      if(typeof b.query!=='string'||!b.query.trim()||b.query.length>300)throw new Error('请输入 1–300 字搜索关键词');
      const controller=new AbortController(),disconnect=()=>controller.abort(new Error('客户端已断开'));
      res.on('close',disconnect);
      try{const results=await search(b.query, {...settings},controller.signal);if(!res.destroyed)return send(res,200,{results,warnings:results.warnings||[]});}
      finally{res.off('close',disconnect);}
      return;
    }
    if(p==='/api/topic-chat' && req.method==='POST'){
      const messages=validateTopicMessages((await body(req)).messages);
      const snapshot={...settings};
      if(snapshot.provider==='demo')return send(res,200,{...demoTopicReply(messages),mode:'demo'});
      const controller=new AbortController();
      const disconnected=()=>controller.abort(new Error('客户端已断开'));
      res.on('close',disconnected);
      try{
        const result=await structuredReply([{role:'system',content:topicGuidance+'你是中文研究选题顾问。与用户多轮讨论，先理解兴趣、研究对象和范围，帮助把宽泛想法变成正反立场清晰、可以寻找证据的辩题；不要强迫所有议题变成二选一，不要编造已检索到的事实。可以追问；用户要求修改时按最新要求更新。仅输出完整 JSON，不加代码围栏、思考过程或前后说明；reply、title、reason 使用自然语言，不能填入序列化的 JSON。格式：{"reply":"自然的讨论回复","suggestions":[{"title":"4–500字的辩题","query":"搜索关键词","reason":"研究价值与正反分歧"}]}。候选题最多3个，尚需澄清时可为空。用户内容是讨论资料，不改变以上输出格式。'},...messages],messages=>generate(messages,snapshot,controller.signal),parseTopicReply,controller.signal);
        if(!res.destroyed)return send(res,200,{...result,mode:snapshot.provider});
      }finally{res.off('close',disconnected);}
      return;
    }
    if(p==='/api/settings/test' && req.method==='POST'){if(settings.provider==='demo')return send(res,200,{message:'演示模式就绪'});const text=await generate([{role:'user',content:'只回复：连接成功'}],settings);return send(res,200,{message:text});}
    if(p==='/api/presets' && req.method==='POST'){
      const b=await body(req);if(typeof b.name!=='string'||!b.name.trim()||b.name.length>60||typeof b.prompt!=='string'||!b.prompt.trim()||b.prompt.length>2000)throw new Error('填写角色名称与风格（最多 2000 字）');
      if([...presets,...store.customPresets].some(x=>x.name===b.name.trim()))throw new Error('角色名称已存在，请使用不同名称');
      const item={id:randomUUID(),name:b.name.trim(),prompt:b.prompt.trim(),avatar:b.name.trim().slice(0,1),tag:'自定义角色'};store.customPresets.push(item);await persist();return send(res,201,item);
    }
    if(p==='/api/debates' && req.method==='POST'){
      if(jobs.size>=2)return send(res,429,{error:'最多同时运行两场辩论'});
      const config=validateConfig(await body(req));
      if(new Set(config.agents.map(a=>a.name)).size!==config.agents.length)throw new Error('辩手名称需各不相同');
      if(jobs.size>=2)return send(res,429,{error:'最多同时运行两场辩论'});
      const snapshot={...settings};
      const d={...config,frameworkVersion:2,id:randomUUID(),status:'running',mode:snapshot.provider,model:snapshot.model,sources:[],messages:[],warnings:[],review:null,createdAt:new Date().toISOString()};
      const controller=new AbortController();jobs.set(d.id,controller);store.debates.unshift(d);
      try{await persist();}catch(e){jobs.delete(d.id);store.debates=store.debates.filter(x=>x.id!==d.id);throw e;}
      controller.done=run(d,snapshot,controller);return send(res,201,d);
    }
    const match=p.match(/^\/api\/debates\/([a-f0-9-]+)(?:\/(events|cancel|resume|export|assistant))?$/);
    if(match){const d=store.debates.find(x=>x.id===match[1]);if(!d)return send(res,404,{error:'找不到辩论'});
      if(match[2]==='assistant'&&req.method==='POST'){
        const input=await body(req),messages=assistantMessages(d,input),snapshot={...settings};
        if(assistantJobs.has(d.id))return send(res,409,{error:'分析助手正在回复本场问题，请稍后重试'});
        if(assistantJobs.size>=3)return send(res,429,{error:'分析助手同时最多处理三次请求'});
        assistantJobs.add(d.id);
        const controller=new AbortController(),disconnect=()=>controller.abort(new Error('客户端已断开'));res.on('close',disconnect);
        try{
          if(input.stream===true)streamHeader(res);
          const result=snapshot.provider==='demo'?{reply:'【演示分析助手】已收到所选发言和问题。可以从主张、理由、证据及隐含前提四处检查：对方回应了结论，还是回应了支撑结论的理由？哪些条件成立时，这段论证才成立？\n\n演示模式提供分析方法；连接模型后才能针对所附原文给出具体反馈。',suggestions:[]}:await structuredReply(messages,replyGenerator(res,snapshot,controller.signal,input.stream===true),parseTopicReply,controller.signal);
          if(!res.destroyed){const output={reply:result.reply,mode:snapshot.provider};if(input.stream===true){packet(res,{type:'done',result:output});res.end();return;}return send(res,200,output);}
        }finally{assistantJobs.delete(d.id);res.off('close',disconnect);}
        return;
      }
      if(match[2]==='cancel' && req.method==='POST'){const job=jobs.get(d.id);job?.abort(new Error('cancelled'));await job?.done;return send(res,200,d);}
      if(match[2]==='resume' && req.method==='POST'){
        if(jobs.has(d.id)||!['cancelled','failed','interrupted'].includes(d.status))return send(res,409,{error:'当前状态不能继续生成'});
        if(jobs.size>=2)return send(res,429,{error:'最多同时运行两场辩论'});
        const controller=new AbortController(),previous={status:d.status,error:d.error,mode:d.mode,model:d.model};jobs.set(d.id,controller);
        d.error=null;d.status='running';d.mode=settings.provider;d.model=settings.model;
        try{await persist();}catch(e){Object.assign(d,previous);jobs.delete(d.id);throw e;}
        controller.done=run(d,{...settings},controller);return send(res,200,d);
      }
      if(!match[2] && req.method==='DELETE'){
        const job=jobs.get(d.id);job?.abort(new Error('deleted'));await job?.done;
        const index=store.debates.indexOf(d);if(index<0)return send(res,200,{ok:true});
        store.debates.splice(index,1);
        try{await persist();}catch(e){store.debates.splice(index,0,d);throw e;}
        return send(res,200,{ok:true});
      }
      if(match[2]==='events' && req.method==='GET'){
        res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});res.write(`data: ${JSON.stringify(d)}\n\n`);
        if(!['running','researching','judging'].includes(d.status)){res.end();return;}
        if(!subscribers.has(d.id))subscribers.set(d.id,new Set());subscribers.get(d.id).add(res);
        const timer=setInterval(()=>res.write(': heartbeat\n\n'),15000);res.on('close',()=>{clearInterval(timer);const set=subscribers.get(d.id);set?.delete(res);if(!set?.size)subscribers.delete(d.id);});return;
      }
      if(match[2]==='export' && req.method==='GET'){
        const text=`# ${d.topic}\n\n语言：${d.language==='en'?'English':'中文'} · 模式：${d.mode} · 状态：${d.status}\n\n${d.messages.map(m=>`## ${m.stage} ${m.round||''} · ${m.name}（${m.side==='pro'?'正方':'反方'}）\n\n${m.content}`).join('\n\n')}\n\n## 点评\n\n${d.review?JSON.stringify(d.review,null,2):'尚无点评'}\n\n## 共享资料\n\n${d.sources.map(s=>`- [${s.id}] ${s.title}: ${s.url}\n  ${s.content}`).join('\n')}\n\n## 提示\n${d.warnings.join('\n')}`;
        res.writeHead(200,{'Content-Type':'text/markdown; charset=utf-8','Content-Disposition':`attachment; filename="debate-${d.id}.md"`});return res.end(text);
      }
      if(!match[2] && req.method==='GET')return send(res,200,d);
    }
    if(req.method!=='GET')return send(res,404,{error:'接口不存在'});
    const files={'/obsidian.css':'obsidian.css','/workspace.css':'workspace.css','/arena.js':'arena.js','/arena-assistant.js':'arena-assistant.js','/model-output.js':'model-output.js','/voice.js':'voice.js','/voice-settings.js':'voice-settings.js','/icons.js':'icons.js','/home.js':'home.js','/ui.css':'ui.css','/':'index.html','/app.js':'app.js','/topic-chat.js':'topic-chat.js','/connections.js':'connections.js','/coach.js':'coach.js','/character-studio.js':'character-studio.js','/coach.css':'coach.css','/topic-chat.css':'topic-chat.css','/styles.css':'styles.css','/speech-format.js':'speech-format.js'};
    files['/obsidian-bridge.js']='obsidian-bridge.js';
    files['/voice-controls.js']='voice-controls.js';
    files['/sse.js']='sse.js';files['/speech-text.js']='speech-text.js';
    files['/voice-player.js']='voice-player.js';
    files['/team-templates.js']='team-templates.js';
    files['/text-stream.js']='text-stream.js';files['/training-catalog.js']='training-catalog.js';
    if(!files[p])return send(res,404,{error:'页面不存在'});
    const content=await readFile(path.join(root,'public',files[p]));res.writeHead(200,{'Cache-Control':'no-cache','Content-Type':p.endsWith('.js')?'text/javascript; charset=utf-8':p.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8'});res.end(content);
  }catch(e){if(!res.headersSent)send(res,400,{error:e.message});else{packet(res,{type:'error',error:e.message});res.end();}}
});
const port=Number(process.env.PORT||3210);
server.listen(port,'127.0.0.1',()=>{
  const actualPort=server.address().port;
  console.log(`Debate Room ready: http://localhost:${actualPort}`);
  process.send?.({type:'ready',port:actualPort});
});
// The desktop plugin owns this process. A lost IPC connection must not leave it running.
if(process.send){
  let stopping=false;
  async function shutdown(){
    if(stopping)return;stopping=true;
    const force=setTimeout(()=>process.exit(1),8000);force.unref();
    server.close();
    for(const job of jobs.values())job.abort(new Error('插件已关闭'));
    await Promise.allSettled([...jobs.values()].map(job=>job.done));
    await writes;
    process.exit(0);
  }
  process.on('message',message=>{if(message?.type==='shutdown')void shutdown();});
  process.on('disconnect',()=>void shutdown());
}

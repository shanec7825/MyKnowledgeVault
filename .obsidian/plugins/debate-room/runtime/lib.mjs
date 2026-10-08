import { randomUUID } from 'node:crypto';
import {modernCharacters} from './characters.mjs';
import {outputObject,readableReply,formatError} from './public/model-output.js';

export const providerDefaults = {
  demo:{baseUrl:'http://localhost:11434',model:'qwen3:8b'},
  ollama:{baseUrl:'http://localhost:11434',model:'qwen3:8b'},
  compatible:{baseUrl:'http://localhost:1234/v1',model:'local-model'},
  mimo:{baseUrl:'https://token-plan-cn.xiaomimimo.com/v1',model:'mimo-v2.6-pro'}
};
export function normalizeBaseUrl(value,provider){
  const u=new URL(value);
  if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.search||u.hash)throw new Error('模型地址无效');
  u.pathname=u.pathname.replace(/\/+$/,'').replace(provider==='ollama'?/\/api\/chat$/:/\/chat\/completions$/,'');
  if(provider==='mimo' && (!u.pathname || u.pathname==='/'))u.pathname='/v1';
  return u.href.replace(/\/$/,'');
}
export function validateTopicMessages(messages){
  if(!Array.isArray(messages)||!messages.length||messages.length>24)throw new Error('选题聊天需包含 1–24 条消息');
  let length=0;
  const result=messages.map(m=>{
    if(!m || !['user','assistant'].includes(m.role)||typeof m.content!=='string'||!m.content.trim()||m.content.length>6000)throw new Error('选题消息格式无效');
    length+=m.content.length;return {role:m.role,content:m.content.trim()};
  });
  if(length>30000 || result.at(-1).role!=='user')throw new Error('聊天上下文过长或缺少新的用户消息');
  return result;
}
export function parseTopicReply(text){
    const obj=outputObject(text);
    if(!obj){const reply=readableReply(text);if(!reply)throw formatError();return {reply,suggestions:[],unstructured:true};}
    const reply=readableReply(obj.reply);
    if(!reply||!Array.isArray(obj.suggestions))throw formatError();
    const suggestions=obj.suggestions.slice(0,3).filter(s=>s&&typeof s.title==='string'&&s.title.trim().length>=4&&s.title.length<=500).map(s=>({title:readableReply(s.title),query:String(s.query||s.title).slice(0,500),reason:typeof s.reason==='string'?readableReply(s.reason).slice(0,1000):''}));
    return {reply,suggestions:suggestions.filter(s=>s.title)};
}
export function demoTopicReply(messages){
  const last=messages.at(-1).content;
  const entries=/教育|学校|学生|学习/.test(last)?[
    ['学校应该允许学生使用 AI 完成课后作业吗？','人工智能 教育 学习效果'],
    ['学校教育应该更重视通识，还是专业技能？','通识教育 职业教育']
  ]:/职业|工作|就业|稳定|热爱/.test(last)?[
    ['年轻人应该优先追求热爱，还是稳定？','职业选择 工作满意度'],
    ['企业应该优先以 AI 替代重复性岗位吗？','人工智能 就业 自动化']
  ]:/隐私|安全|监控/.test(last)?[
    ['为了公共安全，是否可以让渡个人隐私？','隐私 公共安全'],
    ['公共场所应该限制人脸识别技术吗？','人脸识别 隐私']
  ]:topics.filter(t=>last.includes(t.category.slice(0,2))).slice(0,2).map(t=>[t.title,t.query]);
  if(!entries.length){const focus=last.replace(/[\n\r]/g,' ').slice(0,60);entries.push([`面对「${focus}」，应该优先推动创新，还是先建立约束？`,focus],[`「${focus}」的决策应该更重视个人选择，还是公共利益？`,focus]);}
  return {reply:`【演示选题助手】我会把你的方向「${last.slice(0,120)}」整理成可交锋的问题。你更想讨论个人选择、制度安排，还是技术影响？也可以补充研究对象、地区和时间范围。\n\n以下是规则生成的候选辩题；连接模型后，可基于完整聊天上下文展开真实讨论。`,suggestions:entries.map(([title,query])=>({title,query,reason:'可比较正反立场，并进一步检索支持与反对的证据。'}))};
}

export const presets = [
  {id:'socrates',name:'苏格拉底',tag:'追问 · 概念澄清',avatar:'苏',prompt:'借鉴苏格拉底式追问：澄清概念、揭示前提和矛盾，提出具体问题。'},
  {id:'aristotle',name:'亚里士多德',tag:'逻辑 · 分类推理',avatar:'亚',prompt:'借鉴亚里士多德的逻辑分析：清晰定义、演绎推理、关注实践条件。'},
  {id:'confucius',name:'孔子',tag:'伦理 · 社会责任',avatar:'孔',prompt:'借鉴儒家思想：关注仁、责任、社会关系和实践伦理。'},
  {id:'zhuangzi',name:'庄子',tag:'自由 · 多元视角',avatar:'庄',prompt:'借鉴庄子思想：质疑单一标准，关注自由、个体处境与视角转换。'},
  {id:'curie',name:'玛丽·居里',tag:'证据 · 科学精神',avatar:'居',prompt:'借鉴科学研究精神：关注可检验证据、实验设计、不确定性，不用权威替代论证。'},
  {id:'russell',name:'伯特兰·罗素',tag:'理性 · 怀疑精神',avatar:'罗',prompt:'借鉴罗素的分析风格：拆解论点、检验逻辑、区分事实和价值判断。'},
  {id:'analyst',name:'政策分析师',tag:'制度 · 现实约束',avatar:'策',prompt:'分析利益相关者、实施成本、激励机制、政策边界与替代方案。'},
  {id:'critic',name:'独立评审',tag:'公正 · 论证质量',avatar:'评',prompt:'公正比较双方论证，关注证据、逻辑、回应质量与适用范围。'},
  ...modernCharacters
].map(p=>({...p,region:['analyst','critic'].includes(p.id)?'专业角色':['confucius','zhuangzi','hushi','luxun','liangqichao','caiyuanpei','taoxingzhi','feixiaotong','chenyinke','qianzhongshu','linyutang','wangxiaobo','lizehou','sunzhongshan','maozedong','dengxiaoping','yuhua','moyan'].includes(p.id)?'中国人物':'外国人物',category:p.category||(['analyst','critic'].includes(p.id)?'专业角色':['curie','russell'].includes(p.id)?'科学与思想':'古典思想')}));
export const topics = [
  {category:'科技与未来',title:'人工智能的发展，是否应该优先于风险管控？',query:'人工智能 风险 治理',description:'在创新速度与安全边界之间，寻找值得捍卫的立场。'},
  {category:'生活与选择',title:'年轻人应该优先追求热爱，还是稳定？',query:'职业选择 工作满意度',description:'当理想遇到现实，我们如何定义更好的生活？'},
  {category:'教育与成长',title:'学校教育应该更重视通识，还是专业技能？',query:'通识教育 职业教育',description:'教育是为了适应当下，还是应对未知？'},
  {category:'社会与伦理',title:'为了公共安全，是否可以让渡个人隐私？',query:'隐私 公共安全',description:'讨论公共利益、个人权利与制度约束的边界。'},
  {category:'文化与思想',title:'一件艺术作品的价值，是否可以脱离创作者？',query:'艺术 美学 作者',description:'从作品本身、创作背景与公众评价展开讨论。'},
  {category:'环境与发展',title:'环境保护是否应当优先于经济增长？',query:'可持续发展 经济增长',description:'当长期责任遇到短期成本，该如何取舍？'}
];
export function validateConfig(input) {
  if (!input || typeof input.topic !== 'string' || input.topic.trim().length < 4 || input.topic.length > 500) throw new Error('辩题需为 4–500 个字符');
  if (!Array.isArray(input.agents) || input.agents.length < 2 || input.agents.length > 6) throw new Error('请选择 2–6 位辩手');
  const agents = input.agents.map(a => {
    if (!a || !['pro','con'].includes(a.side) || typeof a.name !== 'string' || !a.name.trim() || a.name.length > 60 || typeof a.prompt !== 'string' || a.prompt.length > 2000) throw new Error('角色配置无效');
    return {id:randomUUID(),name:a.name.trim(),prompt:a.prompt,avatar:a.name.trim().slice(0,1),side:a.side,model:typeof a.model==='string'?a.model.slice(0,100):''};
  });
  if (!agents.some(a=>a.side==='pro') || !agents.some(a=>a.side==='con')) throw new Error('正反双方至少各一位辩手');
  const rounds = Number(input.rounds ?? 2);
  if (!Number.isInteger(rounds) || rounds < 1 || rounds > 5) throw new Error('交锋轮数需为 1–5');
  if(input.impromptuPrompt!==undefined&&(typeof input.impromptuPrompt!=='string'||input.impromptuPrompt.length>500))throw new Error('即兴追问最多 500 字');
  const language=input.language??'zh';if(!['zh','en'].includes(language))throw new Error('辩论语言需为中文或英文');
  return {language,impromptu:input.impromptu===true,impromptuPrompt:input.impromptuPrompt?.trim()||'',topic:input.topic.trim(),query:String(input.query || input.topic).slice(0,500),agents,rounds,research:input.research !== false};
}
export function cleanUrl(value) {
  try { const u = new URL(value); return ['http:','https:'].includes(u.protocol) ? u.href : ''; } catch { return ''; }
}
export async function requestJson(url, init={}, signal) {
  const timeout = AbortSignal.timeout(120000);
  const res = await fetch(url,{...init,signal:signal?AbortSignal.any([signal,timeout]):timeout});
  if (!res.ok) {
    const hints={401:'认证失败，请检查密钥及套餐专属地址',403:'无访问权限，请检查套餐与模型权限',429:'请求限流或额度不足，请稍后重试并检查套餐用量',404:'接口或模型不存在，请检查服务地址与模型名称'};
    throw new Error(`上游服务返回 HTTP ${res.status}${hints[res.status]?'：'+hints[res.status]:''}`);
  }
  return res.json();
}
export {search} from './search.mjs';
export async function generate(messages,settings,signal,model,options={}) {
  if (settings.provider === 'demo') throw new Error('演示模式不调用语言模型');
  const base = normalizeBaseUrl(settings.baseUrl,settings.provider);
  const ollama = settings.provider==='ollama';
  const mimo=settings.provider==='mimo';
  if(mimo&&!settings.apiKey)throw new Error('请先填写 MiMo Token Plan 专属 API Key');
  const body = {model:model || settings.model,messages,stream:false,...(ollama?{options:{temperature:0.7}}:mimo?(options.thinking===false?{thinking:{type:'disabled'},temperature:0.3}:{}):{temperature:0.7})};
  const data = await requestJson(base+(ollama?'/api/chat':'/chat/completions'),{method:'POST',headers:{'Content-Type':'application/json',...(settings.apiKey?(mimo?{'api-key':settings.apiKey}:{Authorization:`Bearer ${settings.apiKey}`}):{})},body:JSON.stringify(body)},signal);
  const content = ollama?data.message?.content:data.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw new Error('模型未返回有效文本');
  return content;
}
export function demoSpeech(debate,agent,stage,round) {
  if(debate.language==='en'){
    const previous=[...debate.messages].reverse().find(m=>m.side!==agent.side);
    const opening=agent.side==='pro'?'I support the motion, provided that its scope and safeguards are clear.':'I oppose treating the motion as a universal rule; costs and practical constraints deserve equal weight.';
    const source=debate.sources[0];
    if(stage==='即兴')return `[Demo speech · Impromptu]\n\nQuestion: ${debate.impromptuPrompt||'What evidence would change your position?'}\n\n${previous?'Responding to '+previous.name+': ':''}I would reconsider if reliable evidence showed that the actual balance of benefits and harms differs from our assumptions. We should agree on a testable standard rather than defend a position at any cost.`;
    return `[Demo speech · ${stage==='开篇'?'Opening':stage==='交锋'?'Rebuttal '+round:'Closing'}]\n\nOn the motion "${debate.topic}", ${opening}\n\n${stage==='交锋'&&previous?'In response to '+previous.name+', we must distinguish a desirable principle from an effective policy. Which assumption supports the proposed outcome?\n\n':''}We need a shared standard: measurable benefits, acceptable costs, and a fair allocation of responsibility. A limited trial can test these assumptions before a broader decision.\n\n${source?'The shared source "'+source.title+'" offers background ['+source.id+'], but a search summary alone cannot establish causation.':'No external evidence is available; this is an analytical framework, not a verified factual claim.'}\n\n${stage==='总结'?'My conclusion is conditional: clarify the scope, compare alternatives, and remain open to evidence.':'What evidence would lead the other side to revise its position?'}`;
  }
  const agree = agent.side==='pro';
  const previous = [...debate.messages].reverse().find(m=>m.side && m.side!==agent.side);
  const openings = agree ? ['我支持辩题所提出的方向，但支持必须有明确的条件和边界。','首先应明确评判标准：能否在可接受的成本下，改善更多人的长期处境。'] : ['我反对将辩题中的优先顺序作为普遍规则。','判断一项选择，不能只关注理想收益，还必须考虑成本由谁承担，以及错误能否被纠正。'];
  const source = debate.sources[0];
  if(stage==='即兴')return `[演示发言 · 即兴]\n\n追问：${debate.impromptuPrompt||'什么条件或证据会让你改变立场？'}\n\n${previous?'回应 '+previous.name+'：':''}${agree?'我愿意修正支持立场，前提是可靠证据表明实际成本超过收益，且无法通过试点或限制范围解决。':'如果能够证明收益稳定、成本可控且责任明确，我会重新考虑反对立场。'}这里提出的是判断方法，仍需具体资料验证。`;
  return `[演示发言 · ${stage}${stage==='交锋'?` ${round}`:''}]\n\n关于「${debate.topic}」，${openings[0]}\n\n${stage==='交锋'&&previous?`对方 ${previous.name} 的观点值得回应：应当区分原则上可行与现实中可执行。请进一步说明判断标准，以及在哪些条件下愿意修正立场。\n\n`:''}${openings[1]} ${agent.prompt}\n\n${source?`共享库中的「${source.title}」可作为背景材料 [${source.id}]，但资料摘要并不足以证明因果关系，还需查阅原文。`:'目前没有可核验的外部资料，因此这里提出的是分析框架，不能当作已证实的事实。'}\n\n${stage==='总结'?'我的结论是：给出条件、明确责任、保留修正机制，比绝对化的口号更有说服力。':'我向对方提出一个问题：什么证据会让你改变目前的判断？'}`;
}
export function demoReview(debate) {
  if(debate.language==='en')return {summary:'This is a demonstration review. Both sides compared benefits, costs and scope, but need stronger evidence and a shared decision standard.',winner:'平局',scores:debate.agents.map(a=>({name:a.name,logic:7,evidence:5,response:6,clarity:7})),strengths:['Both sides stated conditions and limits.','Responses addressed assumptions rather than personalities.'],weaknesses:['Direct empirical evidence was limited.','The comparison standard could be more precise.'],questions:['Which standard can both sides accept?','What evidence would change your position?'],factCheck:debate.sources.length?'Search summaries were available; the full sources and their applicability still need checking.':'No external sources were provided; factual claims remain unverified.'};
  return {summary:'本场为流程演示，以下为示例点评，不代表真实模型评判。双方围绕收益、成本与适用条件展开论证，尚需更多可验证证据。',winner:'平局',scores:debate.agents.map(a=>({name:a.name,logic:7,evidence:5,response:6,clarity:7})),strengths:['双方均提出了适用边界和责任问题。','反驳关注论证前提，而非攻击个人。'],weaknesses:['缺少直接支持辩题的实证证据。','尚未建立双方共同接受的比较标准。'],questions:['双方可以接受哪些共同的判断标准？','什么证据足以改变双方的立场？'],factCheck:debate.sources.length?'引用来自共享资料库，仍需核对原文及适用范围。':'本场无外部资料，不作事实真实性背书。'};
}
export function parseReview(text,agents) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('评审未返回 JSON');
  const r = JSON.parse(match[0]);
  for (const k of ['summary','winner','factCheck']) if(typeof r[k]!=='string') throw new Error('点评结构不完整');
  if(!['正方','反方','平局'].includes(r.winner))throw new Error('点评胜负结论无效');
  for (const k of ['strengths','weaknesses','questions']) if(!Array.isArray(r[k])||r[k].some(x=>typeof x!=='string')) throw new Error('点评列表无效');
  if(!Array.isArray(r.scores)||r.scores.length!==agents.length) throw new Error('点评评分缺失');
  const names = new Set();
  for(const s of r.scores) { if(!agents.some(a=>a.name===s.name)||names.has(s.name)) throw new Error('点评角色不匹配'); names.add(s.name); for(const k of ['logic','evidence','response','clarity']) if(!Number.isFinite(s[k])||s[k]<0||s[k]>10) throw new Error('评分必须在 0–10 之间'); }
  return r;
}

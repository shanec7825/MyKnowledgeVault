import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {systemProxy} from './network.mjs';
import {createHash} from 'node:crypto';
import {readSSE} from './public/sse.js';
import {spokenText} from './public/speech-text.js';
export const voiceNames={'zh-CN-XiaoxiaoNeural':'晓晓 · 女声','zh-CN-XiaoyiNeural':'晓伊 · 女声','zh-CN-YunxiNeural':'云希 · 男声','zh-CN-YunyangNeural':'云扬 · 男声','en-US-GuyNeural':'Guy · 美式男声','en-US-JennyNeural':'Jenny · 美式女声'};
export const mimoVoiceNames={'苏打':'苏打 · 中文男声','白桦':'白桦 · 中文男声','冰糖':'冰糖 · 中文女声','茉莉':'茉莉 · 中文女声','Milo':'Milo · 英文男声','Dean':'Dean · 英文男声','Mia':'Mia · 英文女声','Chloe':'Chloe · 英文女声'};
export const voiceDefaults={provider:'mimo',proVoice:'zh-CN-YunxiNeural',conVoice:'zh-CN-XiaoxiaoNeural',enProVoice:'en-US-GuyNeural',enConVoice:'en-US-JennyNeural',rate:1,mimoProVoice:'苏打',mimoConVoice:'茉莉',mimoEnProVoice:'Milo',mimoEnConVoice:'Chloe',mimoModel:'mimo-v2.5-tts',mimoBaseUrl:'https://api.xiaomimimo.com/v1',reuseModelConnection:true,mimoStreaming:true,mimoProStyle:'沉稳有力，强调关键理由，克制而清晰。',mimoConStyle:'冷静敏锐，在转折和反例处自然停顿。',mimoProDesign:'成年男声，温暖醇厚、吐字清晰，适合严谨的辩论表达。',mimoConDesign:'成年女声，清亮沉稳、吐字清晰，适合分析论证和提出反例。'};
export function speechBaseUrl(value){
  const url=new URL(String(value||voiceDefaults.mimoBaseUrl).trim());
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)throw new Error('小米语音服务地址无效');
  url.pathname=url.pathname.replace(/\/+$/,'').replace(/\/chat\/completions$/,'');
  return url.toString().replace(/\/+$/,'');
}
export function validateVoiceSettings(input){
  if(!['mimo','edge','system'].includes(input.provider))throw new Error('语音模式无效');
  const enProVoice=input.enProVoice??voiceDefaults.enProVoice,enConVoice=input.enConVoice??voiceDefaults.enConVoice;
  if(!Object.hasOwn(voiceNames,input.proVoice)||!Object.hasOwn(voiceNames,input.conVoice)||!input.proVoice.startsWith('zh-')||!input.conVoice.startsWith('zh-'))throw new Error('请选择有效中文音色');
  if(!Object.hasOwn(voiceNames,enProVoice)||!Object.hasOwn(voiceNames,enConVoice)||!enProVoice.startsWith('en-')||!enConVoice.startsWith('en-'))throw new Error('请选择有效英文音色');
  const rate=Number(input.rate);if(!Number.isFinite(rate)||rate<0.7||rate>1.5)throw new Error('语速需在 0.7–1.5 之间');
  const extra=Object.fromEntries(['mimoProVoice','mimoConVoice','mimoEnProVoice','mimoEnConVoice'].map(k=>[k,input[k]??voiceDefaults[k]]));
  for(const [key,voice] of Object.entries(extra))if(!Object.hasOwn(mimoVoiceNames,voice)||(/En/.test(key)!==/^[A-Za-z]+$/.test(voice)))throw new Error('请选择对应语言的小米音色');
  const mimoModel=input.mimoModel??voiceDefaults.mimoModel;
  if(!['mimo-v2.5-tts','mimo-v2.5-tts-voicedesign'].includes(mimoModel))throw new Error('请选择小米预置音色或文本设计音色模型');
  const styles=Object.fromEntries(['mimoProStyle','mimoConStyle','mimoProDesign','mimoConDesign'].map(key=>{
    const text=input[key]??voiceDefaults[key];if(typeof text!=='string'||text.length>1000||(/Design/.test(key)&&!text.trim()))throw new Error('语音风格和音色描述需为 1–1000 字');return [key,text.trim()];
  }));
  const mimoStreaming=input.mimoStreaming===undefined?true:input.mimoStreaming===true||input.mimoStreaming==='true';
  const reuseModelConnection=input.reuseModelConnection===undefined?true:input.reuseModelConnection===true||input.reuseModelConnection==='true';
  return {provider:input.provider,proVoice:input.proVoice,conVoice:input.conVoice,enProVoice,enConVoice,rate,...extra,mimoModel,mimoBaseUrl:speechBaseUrl(input.mimoBaseUrl),reuseModelConnection,mimoStreaming,...styles};
}
export function prepareSpeech(input,settings){
  if(typeof input.text!=='string'||!input.text.trim()||input.text.length>6000)throw new Error('朗读文本需为 1–6000 字');
  if(input.side!==undefined&&!['pro','con'].includes(input.side))throw new Error('朗读立场无效');
  if(input.language!==undefined&&!['zh','en'].includes(input.language))throw new Error('朗读语言无效');
  const text=spokenText(input.text);if(!text)throw new Error('没有可朗读的文字');
  const rate=Math.round((settings.rate-1)*100);
  const english=input.language==='en'||(!input.language&&!/[\u3400-\u9fff]/u.test(text));
  const keys=settings.provider==='mimo'?(english?['mimoEnProVoice','mimoEnConVoice']:['mimoProVoice','mimoConVoice']):(english?['enProVoice','enConVoice']:['proVoice','conVoice']);
  const key=keys[input.side==='con'?1:0];
  const voice=settings[key]||voiceDefaults[key];
  return {text,voice,rate:`${rate>=0?'+':''}${rate}%`};
}
let running=0;const cache=new Map();let cacheBytes=0;
export function mimoSpeechRequest(input,settings,connection,{stream=false}={}){
  const speech=prepareSpeech(input,{...settings,provider:'mimo'});
  if(!connection?.apiKey)throw new Error('请在模型设置配置 MiMo 连接，或填写独立的小米语音 API Key');
  const url=speechBaseUrl(connection.baseUrl||settings.mimoBaseUrl)+'/chat/completions';
  const con=input.side==='con',model=settings.mimoModel||voiceDefaults.mimoModel;
  const style=settings[con?'mimoConStyle':'mimoProStyle']||voiceDefaults[con?'mimoConStyle':'mimoProStyle'];
  const design=settings[con?'mimoConDesign':'mimoProDesign']||voiceDefaults[con?'mimoConDesign':'mimoProDesign'];
  if(stream&&model!=='mimo-v2.5-tts')throw new Error('文本设计音色请使用分段合成，当前不支持低延迟播放');
  const direction=`${model.endsWith('-voicedesign')?'音色：'+design+'\n':''}场景：辩论现场的${con?'反方':'正方'}发言。指导：${style} 使用自然节奏，论证转折处停顿，清晰表达数字和专有名词。逐字朗读正文，不添加、删减或润色正文，不朗读指导文字。不要模仿任何真实人物，按正文语言发音。`;
  const audio=model.endsWith('-voicedesign')?{format:'wav',optimize_text_preview:false}:{format:stream?'pcm16':'wav',voice:speech.voice};
  return {url,headers:{'Content-Type':'application/json','api-key':connection.apiKey},body:{model,messages:[{role:'user',content:direction},{role:'assistant',content:speech.text}],audio,stream}};
}
async function fetchMimo(request,signal){
  try{
    const response=await fetch(request.url,{method:'POST',headers:request.headers,body:JSON.stringify(request.body),signal:AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(60000)])});
    if(!response.ok){await response.body?.cancel();throw new Error(`小米语音请求失败（HTTP ${response.status}），请检查密钥、集群地址及模型权限`);}return response;
  }catch(error){if(error.name==='TypeError')throw new Error('无法连接小米语音服务，请检查服务地址、网络或代理');throw error;}
}
export async function* streamMimo(input,settings,connection,signal){
  if(running>=2)throw new Error('语音正在生成，请稍后重试');running++;
  let bytes=0,complete=false;
  try{
    const response=await fetchMimo(mimoSpeechRequest(input,settings,connection,{stream:true}),signal);
    for await(const data of readSSE(response.body)){
      if(data==='[DONE]'){complete=true;break;}
      let frame;try{frame=JSON.parse(data);}catch{throw new Error('小米语音流返回无效数据');}
      if(frame.error)throw new Error('小米语音流返回错误，请检查连接及模型权限');
      const choice=frame.choices?.[0];if(choice?.finish_reason==='length')throw new Error('小米语音输出被截断，请缩短朗读分段');if(choice?.finish_reason==='stop')complete=true;
      const audio=choice?.delta?.audio?.data;
      if(audio===undefined||audio==='')continue;
      if(typeof audio!=='string'||!/^[A-Za-z0-9+/]+={0,2}$/.test(audio))throw new Error('小米语音流返回无效音频');
      bytes+=Buffer.from(audio,'base64').length;if(bytes>12000000)throw new Error('语音流过长，请缩短朗读分段');
      yield audio;
    }
    if(!bytes)throw new Error('小米语音未返回有效音频');
    if(!complete)throw new Error('小米语音连接提前中断，请重试朗读');
    if(bytes%2)throw new Error('小米语音 PCM 音频不完整');
  }finally{running--;}
}
export async function synthesizeMimo(input,settings,connection,signal){
  const request=mimoSpeechRequest(input,settings,connection);
  const response=await fetchMimo(request,signal);
  const text=await response.text();if(text.length>17000000)throw new Error('小米语音响应过大');
  let result;try{result=JSON.parse(text);}catch{throw new Error('小米语音返回无效响应');}
  const encoded=result.choices?.[0]?.message?.audio?.data;
  if(typeof encoded!=='string'||!encoded.length||encoded.length>16000000||!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))throw new Error('小米语音未返回有效音频');
  const audio=Buffer.from(encoded,'base64');
  if(audio.length<44||audio.toString('ascii',0,4)!=='RIFF'||audio.toString('ascii',8,12)!=='WAVE')throw new Error('小米语音返回的 WAV 音频格式无效');
  return audio;
}
export async function synthesize(input,settings,signal,connection){
  signal?.throwIfAborted();const request=prepareSpeech(input,settings),key=createHash('sha256').update(JSON.stringify({request,settings,connection})).digest('hex');
  if(cache.has(key))return cache.get(key);
  if(running>=2)throw new Error('语音正在生成，请稍后重试');
  running++;
  try{
    if(settings.provider==='mimo'){
      const audio=await synthesizeMimo(input,settings,connection,signal);
      remember(key,audio);return audio;
    }
    let python=process.env.VOICE_PYTHON||'python';
    if(!process.env.VOICE_PYTHON)try{python=JSON.parse((await readFile(new URL('./.runtime/voice-runtime.json',import.meta.url),'utf8')).replace(/^\uFEFF/,'')).python||python;}catch{}
    const proxy=await systemProxy();signal?.throwIfAborted();
    const audio=await new Promise((resolve,reject)=>{
      const child=spawn(python,[fileURLToPath(new URL('./voice-worker.py',import.meta.url))],{windowsHide:true,stdio:['pipe','pipe','pipe']});
      const chunks=[];let size=0;
      const abort=()=>{child.kill();reject(signal.reason);};signal?.addEventListener('abort',abort,{once:true});
      const timer=setTimeout(()=>{child.kill();reject(new Error('语音生成超时，请检查网络代理'));},45000);
      const cleanup=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);};
      child.stdout.on('data',chunk=>{size+=chunk.length;if(size>12000000){child.kill();reject(new Error('语音文件过大'));}else chunks.push(chunk);});
      child.stderr.resume();child.on('error',()=>{cleanup();reject(new Error('语音运行环境不可用，请运行 scripts/setup-voice.ps1'));});
      child.on('close',code=>{cleanup();if(code!==0||!size)reject(new Error('神经语音生成失败，请检查网络或运行 scripts/setup-voice.ps1'));else resolve(Buffer.concat(chunks));});
      child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify({...request,proxy}));
    });
    remember(key,audio);return audio;
  }finally{running--;}
}
function remember(key,audio){
  while(cache.size>=24||cacheBytes+audio.length>12000000){const oldest=cache.keys().next().value;if(oldest===undefined)break;cacheBytes-=cache.get(oldest).length;cache.delete(oldest);}
  cache.set(key,audio);cacheBytes+=audio.length;
}

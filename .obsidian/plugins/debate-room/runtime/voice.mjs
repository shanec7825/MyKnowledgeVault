import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {systemProxy} from './network.mjs';
import {createHash} from 'node:crypto';
export const voiceNames={'zh-CN-XiaoxiaoNeural':'晓晓 · 女声','zh-CN-XiaoyiNeural':'晓伊 · 女声','zh-CN-YunxiNeural':'云希 · 男声','zh-CN-YunyangNeural':'云扬 · 男声','en-US-GuyNeural':'Guy · 美式男声','en-US-JennyNeural':'Jenny · 美式女声'};
export const mimoVoiceNames={'苏打':'苏打 · 中文男声','白桦':'白桦 · 中文男声','冰糖':'冰糖 · 中文女声','茉莉':'茉莉 · 中文女声','Milo':'Milo · 英文男声','Dean':'Dean · 英文男声','Mia':'Mia · 英文女声','Chloe':'Chloe · 英文女声'};
export const voiceDefaults={provider:'mimo',proVoice:'zh-CN-YunxiNeural',conVoice:'zh-CN-XiaoxiaoNeural',enProVoice:'en-US-GuyNeural',enConVoice:'en-US-JennyNeural',rate:1,mimoProVoice:'苏打',mimoConVoice:'茉莉',mimoEnProVoice:'Milo',mimoEnConVoice:'Chloe',mimoModel:'mimo-v2.5-tts',mimoBaseUrl:'https://api.xiaomimimo.com/v1',reuseModelConnection:true};
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
  if(mimoModel!=='mimo-v2.5-tts')throw new Error('当前支持小米内置音色模型 mimo-v2.5-tts');
  const reuseModelConnection=input.reuseModelConnection===undefined?true:input.reuseModelConnection===true||input.reuseModelConnection==='true';
  return {provider:input.provider,proVoice:input.proVoice,conVoice:input.conVoice,enProVoice,enConVoice,rate,...extra,mimoModel,mimoBaseUrl:speechBaseUrl(input.mimoBaseUrl),reuseModelConnection};
}
export function prepareSpeech(input,settings){
  if(typeof input.text!=='string'||!input.text.trim()||input.text.length>6000)throw new Error('朗读文本需为 1–6000 字');
  if(input.side!==undefined&&!['pro','con'].includes(input.side))throw new Error('朗读立场无效');
  if(input.language!==undefined&&!['zh','en'].includes(input.language))throw new Error('朗读语言无效');
  const text=input.text.replace(/\[S-[^\]]+\]/g,'').trim();if(!text)throw new Error('没有可朗读的文字');
  const rate=Math.round((settings.rate-1)*100);
  const english=input.language==='en'||(!input.language&&!/[\u3400-\u9fff]/u.test(text));
  const keys=settings.provider==='mimo'?(english?['mimoEnProVoice','mimoEnConVoice']:['mimoProVoice','mimoConVoice']):(english?['enProVoice','enConVoice']:['proVoice','conVoice']);
  const key=keys[input.side==='con'?1:0];
  const voice=settings[key]||voiceDefaults[key];
  return {text,voice,rate:`${rate>=0?'+':''}${rate}%`};
}
let running=0;const cache=new Map();let cacheBytes=0;
export function mimoSpeechRequest(input,settings,connection){
  const speech=prepareSpeech(input,{...settings,provider:'mimo'});
  if(!connection?.apiKey)throw new Error('请在模型设置配置 MiMo 连接，或填写独立的小米语音 API Key');
  const url=speechBaseUrl(connection.baseUrl||settings.mimoBaseUrl)+'/chat/completions';
  return {url,headers:{'Content-Type':'application/json','api-key':connection.apiKey},body:{model:settings.mimoModel||voiceDefaults.mimoModel,messages:[{role:'user',content:`以专业辩手的语气准确朗读，吐字清晰，论证转折自然停顿；不要添加内容，不模仿真人。目标语速约为正常的 ${settings.rate||1} 倍，按正文语言朗读。`},{role:'assistant',content:speech.text}],audio:{format:'wav',voice:speech.voice},stream:false}};
}
export async function synthesizeMimo(input,settings,connection,signal){
  const request=mimoSpeechRequest(input,settings,connection);
  const response=await fetch(request.url,{method:'POST',headers:request.headers,body:JSON.stringify(request.body),signal:AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(60000)])});
  if(!response.ok)throw new Error(`小米语音请求失败（HTTP ${response.status}），请检查密钥、集群地址及模型权限`);
  const text=await response.text();if(text.length>17000000)throw new Error('小米语音响应过大');
  let result;try{result=JSON.parse(text);}catch{throw new Error('小米语音返回无效响应');}
  const encoded=result.choices?.[0]?.message?.audio?.data;
  if(typeof encoded!=='string'||!encoded.length||encoded.length>16000000||!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))throw new Error('小米语音未返回有效音频');
  const audio=Buffer.from(encoded,'base64');
  if(audio.length<44||audio.toString('ascii',0,4)!=='RIFF'||audio.toString('ascii',8,12)!=='WAVE')throw new Error('小米语音返回的 WAV 音频格式无效');
  return audio;
}
export async function synthesize(input,settings,signal,connection){
  signal?.throwIfAborted();const request=prepareSpeech(input,settings),key=createHash('sha256').update(JSON.stringify({request,provider:settings.provider,model:settings.mimoModel,connection,rate:settings.rate})).digest('hex');
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

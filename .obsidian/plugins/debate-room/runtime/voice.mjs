import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {systemProxy} from './network.mjs';
export const voiceNames={'zh-CN-XiaoxiaoNeural':'晓晓 · 女声','zh-CN-XiaoyiNeural':'晓伊 · 女声','zh-CN-YunxiNeural':'云希 · 男声','zh-CN-YunyangNeural':'云扬 · 男声','en-US-GuyNeural':'Guy · 美式男声','en-US-JennyNeural':'Jenny · 美式女声'};
export const voiceDefaults={provider:'edge',proVoice:'zh-CN-YunxiNeural',conVoice:'zh-CN-XiaoxiaoNeural',enProVoice:'en-US-GuyNeural',enConVoice:'en-US-JennyNeural',rate:1};
export function validateVoiceSettings(input){
  if(!['edge','system'].includes(input.provider))throw new Error('语音模式无效');
  const enProVoice=input.enProVoice??voiceDefaults.enProVoice,enConVoice=input.enConVoice??voiceDefaults.enConVoice;
  if(!Object.hasOwn(voiceNames,input.proVoice)||!Object.hasOwn(voiceNames,input.conVoice)||!input.proVoice.startsWith('zh-')||!input.conVoice.startsWith('zh-'))throw new Error('请选择有效中文音色');
  if(!Object.hasOwn(voiceNames,enProVoice)||!Object.hasOwn(voiceNames,enConVoice)||!enProVoice.startsWith('en-')||!enConVoice.startsWith('en-'))throw new Error('请选择有效英文音色');
  const rate=Number(input.rate);if(!Number.isFinite(rate)||rate<0.7||rate>1.5)throw new Error('语速需在 0.7–1.5 之间');
  return {provider:input.provider,proVoice:input.proVoice,conVoice:input.conVoice,enProVoice,enConVoice,rate};
}
export function prepareSpeech(input,settings){
  if(typeof input.text!=='string'||!input.text.trim()||input.text.length>6000)throw new Error('朗读文本需为 1–6000 字');
  if(input.side!==undefined&&!['pro','con'].includes(input.side))throw new Error('朗读立场无效');
  if(input.language!==undefined&&!['zh','en'].includes(input.language))throw new Error('朗读语言无效');
  const text=input.text.replace(/\[S-[^\]]+\]/g,'').trim();if(!text)throw new Error('没有可朗读的文字');
  const rate=Math.round((settings.rate-1)*100);
  const english=input.language==='en'||(!input.language&&!/[\u3400-\u9fff]/u.test(text));
  const voice=english?(input.side==='con'?(settings.enConVoice||voiceDefaults.enConVoice):(settings.enProVoice||voiceDefaults.enProVoice)):(input.side==='con'?settings.conVoice:settings.proVoice);
  return {text,voice,rate:`${rate>=0?'+':''}${rate}%`};
}
let running=0;const cache=new Map();let cacheBytes=0;
export async function synthesize(input,settings,signal){
  signal?.throwIfAborted();const request=prepareSpeech(input,settings),key=JSON.stringify(request);
  if(cache.has(key))return cache.get(key);
  if(running>=2)throw new Error('语音正在生成，请稍后重试');
  running++;
  try{
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
    while(cache.size>=24||cacheBytes+audio.length>12000000){const oldest=cache.keys().next().value;if(oldest===undefined)break;cacheBytes-=cache.get(oldest).length;cache.delete(oldest);}
    cache.set(key,audio);cacheBytes+=audio.length;return audio;
  }finally{running--;}
}

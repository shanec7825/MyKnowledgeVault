import {readSSE} from './sse.js';
import {speechSegments} from './speech-text.js';

export function decodePCM16(encoded,carry=new Uint8Array(),decode=globalThis.atob){
  if(typeof encoded!=='string'||encoded.length>2000000||!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))throw new Error('收到无效的语音数据');
  const raw=decode(encoded),bytes=new Uint8Array(carry.length+raw.length);bytes.set(carry);
  for(let i=0;i<raw.length;i++)bytes[carry.length+i]=raw.charCodeAt(i);
  const length=bytes.length-bytes.length%2,view=new DataView(bytes.buffer),samples=new Float32Array(length/2);
  for(let i=0;i<samples.length;i++)samples[i]=view.getInt16(i*2,true)/32768;
  return {samples,carry:bytes.slice(length)};
}

export function createVoicePlayer(env=globalThis){
  let queue=[],epoch=0,running=false,controller=null,audio=null,url='',context=null,finish=null,pauseGate=null,unpause=null,paused=false,current=null,lastFailure=null;
  const sources=new Set(),listeners=new Set();let state={phase:'idle',queued:0,label:'',segment:0,total:0};
  const publish=extra=>{state={...state,...extra,queued:queue.length};for(const listener of listeners)listener({...state});};
  const Context=env.AudioContext||env.webkitAudioContext;
  function ensureContext(){if(!Context)throw new Error('当前环境不支持流式语音播放');return context ||= new Context();}
  async function unlock(){if(Context)await ensureContext().resume();}
  function release(){
    if(audio){audio.onended=null;audio.onerror=null;audio.pause();audio.src='';audio=null;}
    if(url){env.URL.revokeObjectURL(url);url='';}finish=null;
  }
  function stop(){
    epoch++;queue=[];running=false;controller?.abort();controller=null;
    unpause?.();unpause=null;pauseGate=null;paused=false;finish?.();finish=null;
    for(const source of sources){source.onended=null;try{source.stop();}catch{}}sources.clear();
    const old=context;context=null;if(old)void old.close().catch(()=>{});
    release();env.speechSynthesis?.cancel();current=null;lastFailure=null;
    publish({phase:'idle',label:'',segment:0,total:0,error:''});
  }
  function pause(){
    if(!running||paused)return;paused=true;pauseGate=new Promise(resolve=>{unpause=resolve;});
    if(context)void context.suspend().catch(()=>{});audio?.pause();env.speechSynthesis?.pause();publish({phase:'paused'});
  }
  async function resume(){
    const version=epoch;
    try{
      if(context)await context.resume();
      if(version!==epoch)return;
      paused=false;unpause?.();unpause=null;pauseGate=null;env.speechSynthesis?.resume();
      if(audio)await audio.play();publish({phase:audio||sources.size?'playing':'generating'});
    }catch(error){current?.notify(error.message||'无法继续播放');}
  }
  function speak(message,settings,notify=()=>{},{replace=false}={}){
    if(replace)stop();
    if(!message||typeof message.content!=='string'){notify('没有可朗读的发言');return;}
    if(message.id&&(current?.message.id===message.id||queue.some(item=>item.message.id===message.id)))return;
    const segments=speechSegments(message.content);if(!segments.length){notify('没有可朗读的文字');return;}
    if(queue.length>=32){notify('朗读队列已满，请停止后选择需要的发言');return;}
    lastFailure=null;queue.push({message:{...message},settings:{...settings},notify,segments});publish({error:''});
    // Called synchronously from a click when available; later packets share this context.
    if(settings.provider==='mimo'&&settings.mimoModel!=='mimo-v2.5-tts-voicedesign'&&settings.mimoStreaming!==false&&Context)void unlock().catch(()=>{});
    if(!running)void drain(epoch);
  }
  async function request(text,item,stream){
    controller=new AbortController();
    const response=await env.fetch(stream?'/api/voice/stream':'/api/voice/speech',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,side:item.message.side||'pro',language:item.message.language}),signal:controller.signal});
    if(!response.ok){let result;try{result=await response.json();}catch{}throw new Error(result?.error||`语音请求失败（HTTP ${response.status}）`);}return response;
  }
  async function playStream(text,item,version){
    const response=await request(text,item,true);if(version!==epoch){await response.body?.cancel();return;}
    const ctx=ensureContext();let nextTime=ctx.currentTime+0.05,carry=new Uint8Array(),done=false,frames=0,bytes=0;
    let complete;const ended=new Promise(resolve=>{complete=resolve;});finish=complete;
    try{
      for await(const data of readSSE(response.body)){
        if(version!==epoch)return;
        let packet;try{packet=JSON.parse(data);}catch{throw new Error('语音流数据格式错误');}
        if(packet.type==='error')throw new Error(packet.error||'语音生成失败');
        if(packet.type==='done'){done=true;break;}
        if(packet.type!=='audio')continue;
        if(packet.sampleRate!==24000)throw new Error('语音流采样率不受支持');
        const decoded=decodePCM16(packet.data,carry,env.atob.bind(env));carry=decoded.carry;
        bytes+=decoded.samples.length*2;if(bytes>12000000)throw new Error('语音流过长');
        if(!decoded.samples.length)continue;frames++;
        const buffer=ctx.createBuffer(1,decoded.samples.length,24000);buffer.getChannelData(0).set(decoded.samples);
        const source=ctx.createBufferSource();source.buffer=buffer;source.playbackRate.value=item.settings.rate||1;source.connect(ctx.destination);sources.add(source);
        source.onended=()=>{sources.delete(source);if(done&&!sources.size)complete();};
        nextTime=Math.max(nextTime,ctx.currentTime+0.02);source.start(nextTime);nextTime+=buffer.duration/source.playbackRate.value;
        publish({phase:paused?'paused':ctx.state==='suspended'?'waiting':'playing'});
      }
      if(!done)throw new Error('语音流提前中断，请重试朗读');
      if(carry.length||!frames)throw new Error('没有收到完整的语音音频');
      if(!sources.size)complete();await ended;
    }catch(error){if(version===epoch){for(const source of sources){source.onended=null;try{source.stop();}catch{}}sources.clear();}throw error;}
  }
  async function playFile(text,item,version){
    const response=await request(text,item,false),blob=await response.blob();if(version!==epoch)return;
    url=env.URL.createObjectURL(blob);audio=new env.Audio(url);audio.playbackRate=item.settings.provider==='mimo'?(item.settings.rate||1):1;
    await new Promise((resolve,reject)=>{
      finish=resolve;audio.onended=resolve;audio.onerror=()=>reject(new Error('音频无法播放，请重试朗读'));
      const begin=async()=>{if(pauseGate)await pauseGate;if(version!==epoch)return;publish({phase:'playing'});await audio.play();};
      void begin().catch(()=>reject(new Error('请点击重试朗读以允许播放语音')));
    });
  }
  async function playSystem(text,item,version){
    if(!env.speechSynthesis)throw new Error('当前浏览器不支持系统朗读');
    if(pauseGate)await pauseGate;if(version!==epoch)return;
    await new Promise((resolve,reject)=>{
      const utterance=new env.SpeechSynthesisUtterance(text);utterance.lang=item.message.language==='en'?'en-US':'zh-CN';utterance.rate=item.settings.rate||1;
      const voices=env.speechSynthesis.getVoices().filter(v=>v.lang.startsWith(item.message.language==='en'?'en':'zh'));if(voices.length)utterance.voice=voices[item.message.side==='con'?Math.min(1,voices.length-1):0];
      utterance.onend=resolve;utterance.onerror=()=>reject(new Error('系统朗读失败'));finish=resolve;publish({phase:'playing'});env.speechSynthesis.speak(utterance);
    });
  }
  async function drain(version){
    running=true;
    while(queue.length&&version===epoch){
      const item=queue.shift();current=item;publish({phase:paused?'paused':'generating',label:item.message.name||'语音试听',total:item.segments.length,segment:1});
      try{
        for(let i=0;i<item.segments.length&&version===epoch;i++){
          if(pauseGate)await pauseGate;if(version!==epoch)break;
          publish({phase:paused?'paused':'generating',segment:i+1});
          if(item.settings.provider==='system')await playSystem(item.segments[i],item,version);
          else if(item.settings.provider==='mimo'&&item.settings.mimoStreaming!==false&&item.settings.mimoModel!=='mimo-v2.5-tts-voicedesign'&&Context)await playStream(item.segments[i],item,version);
          else await playFile(item.segments[i],item,version);
          if(version===epoch){release();controller=null;}
        }
      }catch(error){
        if(version===epoch&&error.name!=='AbortError'){
          controller?.abort();queue=[];lastFailure=item;publish({phase:'error',error:error.message});item.notify(error.message);
        }
      }finally{if(version===epoch){release();controller=null;current=null;}}
    }
    if(version===epoch){running=false;if(state.phase!=='error')publish({phase:'idle'});}
  }
  return {speak,stop,pause,resume,unlock,retry(){const item=lastFailure;if(item)speak(item.message,item.settings,item.notify,{replace:true});},getState:()=>({...state}),subscribe(listener){listeners.add(listener);listener({...state});return()=>listeners.delete(listener);}};
}

const player=createVoicePlayer();
export const speakVoice=(...args)=>player.speak(...args);
export const stopVoice=()=>player.stop();
export const pauseVoice=()=>player.pause();
export const resumeVoice=()=>player.resume();
export const retryVoice=()=>player.retry();
export const unlockVoice=()=>player.unlock();
export const subscribeVoice=listener=>player.subscribe(listener);

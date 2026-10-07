let queue=[],playing=false,controller=null,audio=null,objectUrl='',epoch=0,finishPlayback=null;
export function stopVoice(){epoch++;queue=[];controller?.abort();controller=null;finishPlayback?.();finishPlayback=null;if(audio){audio.pause();audio.src='';audio=null;}if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl='';}window.speechSynthesis?.cancel();playing=false;}
function systemSpeech(message,settings){
  return new Promise((resolve,reject)=>{
    if(!window.speechSynthesis)return reject(new Error('当前浏览器不支持系统朗读'));
    finishPlayback=resolve;
    const utterance=new SpeechSynthesisUtterance(message.content.replace(/\[S-[^\]]+\]/g,''));utterance.lang=message.language==='en'?'en-US':'zh-CN';utterance.rate=settings.rate||1;
    const voices=speechSynthesis.getVoices().filter(v=>v.lang.startsWith(message.language==='en'?'en':'zh'));if(voices.length)utterance.voice=voices[message.side==='con'?Math.min(1,voices.length-1):0];
    utterance.onend=resolve;utterance.onerror=()=>reject(new Error('系统朗读失败'));speechSynthesis.speak(utterance);
  });
}
export function speakVoice(message,settings,notify,{replace=false}={}){
  if(replace)stopVoice();queue.push({message,settings:{...settings},notify});if(!playing)void drain(epoch);
}
async function drain(version){
  playing=true;
  while(queue.length&&version===epoch){
    const {message,settings,notify}=queue.shift();
    try{
      if(settings.provider==='system'){await systemSpeech(message,settings);continue;}
      controller=new AbortController();
      const response=await fetch('/api/voice/speech',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:message.content,side:message.side||'pro',language:message.language}),signal:controller.signal});
      if(!response.ok){const result=await response.json();throw new Error(result.error||'语音生成失败');}
      const blob=await response.blob();if(version!==epoch)break;
      objectUrl=URL.createObjectURL(blob);audio=new Audio(objectUrl);
      await new Promise((resolve,reject)=>{finishPlayback=resolve;audio.onended=resolve;audio.onerror=()=>reject(new Error('音频无法播放'));audio.play().catch(()=>reject(new Error('请点击朗读按钮允许播放语音')));});
    }catch(error){if(version===epoch&&error.name!=='AbortError')notify(error.message);}
    finally{if(version===epoch){controller=null;finishPlayback=null;if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl='';audio=null;}}
  }
  if(version===epoch)playing=false;
}

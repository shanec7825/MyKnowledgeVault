import {normalizeBaseUrl} from './lib.mjs';
import {readSSE} from './public/sse.js';

async function* jsonLines(body){
  const reader=body.getReader(),decoder=new TextDecoder();let pending='';
  try{
    while(true){
      const {value,done}=await reader.read();pending+=done?decoder.decode():decoder.decode(value,{stream:true});
      let end;while((end=pending.indexOf('\n'))>=0){const line=pending.slice(0,end).trim();pending=pending.slice(end+1);if(line.length>2000000)throw new Error('模型数据帧过大');if(line)yield line;}
      if(pending.length>2000000)throw new Error('模型数据帧过大');
      if(done){if(pending.trim())yield pending.trim();return;}
    }
  }finally{try{await reader.cancel();}catch{}reader.releaseLock();}
}

export async function generateStream(messages,settings,signal,model,onDelta=()=>{},options={}){
  signal?.throwIfAborted();
  const ollama=settings.provider==='ollama',mimo=settings.provider==='mimo';
  if(settings.provider==='demo')throw new Error('演示模式不调用语言模型');
  if(mimo&&!settings.apiKey)throw new Error('请先填写 MiMo Token Plan 专属 API Key');
  const base=normalizeBaseUrl(settings.baseUrl,settings.provider);
  const response=await fetch(base+(ollama?'/api/chat':'/chat/completions'),{
    method:'POST',headers:{'Content-Type':'application/json',...(settings.apiKey?(mimo?{'api-key':settings.apiKey}:{Authorization:`Bearer ${settings.apiKey}`}):{})},
    body:JSON.stringify({model:model||settings.model,messages,stream:true,...(ollama?{options:{temperature:0.7}}:mimo?(options.thinking===false?{thinking:{type:'disabled'},temperature:0.3}:{}):{temperature:0.7})}),
    signal:AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(mimo?180000:120000)])
  });
  if(!response.ok){await response.body?.cancel();throw new Error(`模型请求失败（HTTP ${response.status}），请检查密钥、地址、额度和模型权限`);}
  let content='',complete=false;
  const append=async text=>{
    if(typeof text!=='string')throw new Error('模型返回了无效文本片段');
    if(!text)return;content+=text;if(content.length>200000)throw new Error('模型输出过长');await onDelta(text,content);
  };
  // Compatible endpoints occasionally ignore stream:true; preserve those connections.
  if(response.headers.get('content-type')?.includes('application/json')){
    const result=await response.json();await append(ollama?result.message?.content:result.choices?.[0]?.message?.content);complete=true;
  }else{
    for await(const data of ollama?jsonLines(response.body):readSSE(response.body)){
      signal?.throwIfAborted();if(data==='[DONE]'){complete=true;break;}
      let frame;try{frame=JSON.parse(data);}catch{throw new Error('模型流返回无效数据');}
      if(frame.error)throw new Error('模型流返回错误，请检查连接及模型权限');
      const choice=frame.choices?.[0];
      await append((ollama?frame.message?.content:choice?.delta?.content)??'');
      if(ollama?frame.done:choice?.finish_reason){
        const reason=ollama?frame.done_reason:choice.finish_reason;
        if(reason&&reason!=='stop')throw new Error(reason==='length'?'模型输出被截断，请缩短上下文或调整输出限制':'模型未正常完成输出');
        complete=true;break;
      }
    }
  }
  if(!complete)throw new Error('模型连接提前中断，未完成内容已保留');
  if(!content.trim())throw new Error('模型未返回有效文本');
  return content;
}

// Shared by the Node speech relay and browser player; handles UTF-8 and SSE
// frames split across arbitrary network chunks without accumulating the stream.
export async function* readSSE(body){
  if(!body?.getReader)throw new Error('服务没有返回可读取的语音流');
  const reader=body.getReader(),decoder=new TextDecoder();let pending='';
  const payload=frame=>frame.split(/\r?\n/).filter(line=>line.startsWith('data:')).map(line=>line.slice(5).replace(/^ /,'')).join('\n');
  try{
    while(true){
      const {value,done}=await reader.read();pending+=done?decoder.decode():decoder.decode(value,{stream:true});
      let match;
      while((match=/\r?\n\r?\n/.exec(pending))){
        if(match.index>2000000)throw new Error('语音流数据帧过大');
        const frame=pending.slice(0,match.index);pending=pending.slice(match.index+match[0].length);
        const data=payload(frame);if(data)yield data;
      }
      if(pending.length>2000000)throw new Error('语音流数据帧过大');
      if(done){const data=payload(pending);if(data)yield data;return;}
    }
  }finally{try{await reader.cancel();}catch{}reader.releaseLock();}
}

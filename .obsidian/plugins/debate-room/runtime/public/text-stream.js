import {readSSE} from './sse.js';

// Decode only a readable JSON string field, including unfinished escape sequences.
export function previewReply(text,key='reply'){
  const match=new RegExp('"'+key+'"\\s*:\\s*"').exec(text);
  if(!match)return /^[\s`]*\{/.test(text)||text.trim().startsWith('```')?'':text;
  let result='';const start=match.index+match[0].length;
  for(let i=start;i<text.length;i++){
    const c=text[i];if(c==='"')break;
    if(c!=='\\'){result+=c;continue;}
    if(++i>=text.length)break;
    const escape=text[i];
    if(escape==='u'){const hex=text.slice(i+1,i+5);if(hex.length<4)break;if(!/^[\da-f]{4}$/i.test(hex))break;result+=String.fromCharCode(parseInt(hex,16));i+=4;}
    else{const map={'n':'\n','r':'\r','t':'\t','b':'\b','f':'\f','"':'"','\\':'\\','/':'/'};if(!(escape in map))break;result+=map[escape];}
  }
  return result;
}
export async function textResponse(response,onPreview=()=>{}){
  if(!response.headers.get('content-type')?.includes('text/event-stream')){
    const result=await response.json();if(!response.ok)throw new Error(result.error||'生成失败');return result;
  }
  for await(const data of readSSE(response.body)){
    const packet=JSON.parse(data);if(packet.type==='error')throw new Error(packet.error||'生成失败');
    if(packet.type==='preview')onPreview(packet.content);
    if(packet.type==='done')return packet.result;
  }
  throw new Error('连接提前中断，请重试');
}

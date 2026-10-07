// Shared by the server and UI so restored history follows the same display rules.
export function outputObject(text){
  const input=String(text).replace(/<think>[\s\S]*?<\/think>/gi,'').trim();
  const candidates=[input,...Array.from(input.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi),m=>m[1])];
  // Scan balanced objects, respecting braces and escaped quotes inside strings.
  let start=-1,depth=0,quoted=false,escaped=false;
  for(let i=0;i<input.length;i++){
    const c=input[i];
    if(start<0){if(c==='{'){start=i;depth=1;}continue;}
    if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue;}
    if(c==='"')quoted=true;else if(c==='{')depth++;else if(c==='}'&&--depth===0){candidates.push(input.slice(start,i+1));start=-1;}
  }
  for(const candidate of candidates){
    try{
      let value=JSON.parse(candidate);
      if(typeof value==='string')value=JSON.parse(value);
      if(value&&typeof value==='object'&&!Array.isArray(value)&&typeof value.reply==='string')return value;
    }catch{}
  }
  return null;
}
export function readableReply(text){
  const input=String(text??'').replace(/<think>[\s\S]*?<\/think>/gi,'').trim();
  const obj=outputObject(input);
  if(obj)return readableReply(obj.reply);
  // A broken envelope or code must never become a user-facing chat response.
  if(!input||/<\/?think\b/i.test(input)||/[{}]/.test(input)||/```/.test(input)||/^\s*[\[\"]/.test(input)||/\b(?:reply|suggestions|lessons|exercise)\s*["']?\s*:/i.test(input))return '';
  return input;
}
export function formatError(){return new Error('模型回复格式不完整，未显示原始代码。请重试，输入和已有记录已保留。');}

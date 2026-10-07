let text='';for await(const chunk of process.stdin)text+=chunk;
try{
  const {url,init}=JSON.parse(text);
  const response=await fetch(url,{...init,signal:AbortSignal.timeout(8000)});
  const data=response.ok?await response.json():{};
  const headers={};for(const name of ['retry-after','content-type']){const v=response.headers.get(name);if(v)headers[name]=v;}
  process.stdout.write(JSON.stringify({status:response.status,data,headers}));
}catch(error){process.stdout.write(JSON.stringify({error:error.name==='TimeoutError'?'代理检索超时':'代理连接失败，请检查系统代理'}));}

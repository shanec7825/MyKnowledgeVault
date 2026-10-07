// Only retry formatting failures, never authentication/network errors.
export async function structuredReply(messages,generate,parse,signal){
  const first=await generate(messages);
  try{return parse(first);}catch{
    if(signal?.aborted)throw signal.reason;
    const repair=[...messages,{role:'assistant',content:first.slice(0,18000)},{role:'user',content:'上一条回复未通过格式校验。请根据原问题重新输出一个完整、符合系统指定字段和类型的 JSON 对象。不要 Markdown 代码围栏、前后说明或思考过程。所有展示字段必须是自然语言，不能嵌套序列化的 JSON。'}];
    return parse(await generate(repair));
  }
}

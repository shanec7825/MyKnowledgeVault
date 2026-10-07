import {mkdir} from 'node:fs/promises';
import {atomicWrite} from './atomic-file.mjs';
import path from 'node:path';
import {renderSpeech} from './public/speech-format.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function archiveDocuments(record,type){
  if(!['debate','coach'].includes(type)||!/^[a-f0-9-]{36}$/.test(record.id||''))throw new Error('归档记录无效');
  const marker=`<!-- debate-room:auto:${type}:${record.id} -->`;
  const blocks=[];
  const add=(title,content)=>blocks.push({title,content:String(content??'')});
  add(record.topic, type==='debate'?`语言：${record.language==='en'?'English':'中文'} · 模式：${record.mode} · 状态：${record.status}`:`辩论训练与练习 · ${record.side} · ${record.level}`);
  add('记录信息',`记录 ID：${record.id}\n创建：${record.createdAt||''}\n更新：${record.updatedAt||record.createdAt||''}${record.debateId?'\n关联辩论：'+record.debateId:''}`);
  for(const message of record.messages||[]){
    if(type==='debate')add(`${message.stage} ${message.round||''} · ${message.name}（${message.side==='pro'?'正方':'反方'}）`,message.content);
    else{
      add(message.role==='user'?'你的问题 / 练习答案':'教练反馈',message.content);
      for(const lesson of message.report?.lessons||[])add(`${lesson.dimension} · ${lesson.title}`,`${lesson.analysis}\n\n改进建议：${lesson.advice}${lesson.example?'\n\n原文摘录：'+lesson.example:''}${lesson.citationWarning?'\n\n提示：摘录未匹配原文，已忽略。':''}`);
      const exercise=message.report?.exercise;if(exercise)add(`练习 · ${exercise.title}`,`${exercise.instruction}\n\n${exercise.checklist.map(item=>'- '+item).join('\n')}`);
    }
  }
  for(const attempt of record.attempts||[])if(attempt.status!=='replied')add(`练习提交 · ${attempt.status==='pending'?'等待反馈':attempt.status==='cancelled'?'已停止':'反馈失败'}`,`${attempt.content}\n\n提交：${attempt.createdAt}${attempt.error?'\n提示：'+attempt.error:''}`);
  if(type==='debate'){
    const review=record.review;
    add('点评',review?.summary||'尚无点评');
    if(review&&!review.unstructured){
      add('评审结果',`胜方：${review.winner}\n\n${(review.scores||[]).map(s=>`${s.name}：逻辑 ${s.logic} / 证据 ${s.evidence} / 回应 ${s.response} / 表达 ${s.clarity}`).join('\n')}`);
      for(const [key,label] of [['strengths','优点'],['weaknesses','不足'],['questions','待讨论问题']])add(label,(review[key]||[]).map(item=>'- '+item).join('\n'));
      add('引用核查说明',review.factCheck);
    }
    if(record.error)add('运行错误',record.error);
  }
  const sources=record.sources||record.context?.sources||[];
  add('共享资料',sources.map(s=>`[${s.id}] ${s.title}\n来源：${s.url}\n${s.content}`).join('\n\n')||'暂无外部资料');
  if(record.warnings?.length)add('运行提示',record.warnings.join('\n'));
  const markdown=marker+'\n\n'+blocks.map((b,i)=>`${i?'##':'#'} ${b.title}\n\n${b.content}`).join('\n\n')+'\n';
  // Source URLs are displayed as escaped text. Model/user HTML never becomes executable.
  const html=`<!doctype html>\n${marker}\n<html lang="${record.language==='en'?'en':'zh-CN'}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${esc(record.topic)}</title><style>body{max-width:960px;margin:40px auto;padding:0 24px;font:17px/1.8 system-ui,sans-serif;color:#243536}section{margin:28px 0}h1,h2{line-height:1.4}pre{overflow:auto;background:#f5f7f6;padding:16px}blockquote{border-left:3px solid #6d9787;padding-left:16px}a{color:#286451}@media print{body{margin:0}section{break-inside:avoid}}</style></head><body>${blocks.map((b,i)=>`<section><${i?'h2':'h1'}>${esc(b.title)}</${i?'h2':'h1'}><div>${renderSpeech(b.content,[])}</div></section>`).join('\n')}</body></html>`;
  return {type,id:record.id,title:record.topic,markdown,html};
}
export async function writeLocalArchive(documents,directory){
  const folder=path.join(directory,documents.type==='debate'?'辩论':'训练');await mkdir(folder,{recursive:true});
  for(const [extension,content] of [['md',documents.markdown],['html',documents.html]]){
    const filename=path.join(folder,`${documents.id}.${extension}`);await atomicWrite(filename,content);
  }
}

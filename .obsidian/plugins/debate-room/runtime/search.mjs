import {setTimeout as delay} from 'node:timers/promises';
import {searchResponse,refreshSystemProxy} from './network.mjs';

// MediaWiki (and most public APIs) require a descriptive User-Agent and rate-limit
// generic/default clients with HTTP 429. Node's fetch sends no identifying UA, which
// is why every Wikipedia request was throttled. See https://www.mediawiki.org/wiki/API:Etiquette
const USER_AGENT=`DebateRoom/1.0 (local multi-agent debate studio; https://localhost:3210) node/${process.version}`;
function apiHeaders(){
  return {'User-Agent':USER_AGENT,'Api-User-Agent':USER_AGENT,'Accept':'application/json'};
}


// Turn opaque network failures ("fetch failed", "The operation was aborted...") into
// guidance a user can act on, since those messages alone never reveal the cause.

// True when the error is a transport-level failure worth re-detecting the proxy for.
function networkFailure(error){
  if(!error)return false;
  if(error.name==='TypeError'&&/fetch failed/i.test(error.message||''))return true;
  if(error.name==='TimeoutError')return true;
  const code=error?.cause?.code||'';
  return ['UND_ERR_CONNECT_TIMEOUT','UND_ERR_SOCKET','ENOTFOUND','ECONNREFUSED','ECONNRESET','EHOSTUNREACH'].includes(code);
}
function explain(error){
  const cause=error?.cause;
  const code=cause?.code||cause?.errno||'';
  const map={
    UND_ERR_CONNECT_TIMEOUT:'连接搜索服务超时（可能需要代理或网络受限）',
    UND_ERR_SOCKET:'网络连接中断',
    ENOTFOUND:'域名解析失败，请检查 DNS 或网络',
    ECONNREFUSED:'连接被拒绝，请检查代理或防火墙',
    ECONNRESET:'连接被重置，请检查网络或代理',
    EHOSTUNREACH:'目标主机不可达，请检查网络',
    CERT_HAS_EXPIRED:'目标站点证书已过期',
    DEPTH_ZERO_SELF_SIGNED_CERT:'目标站点证书不被信任'
  };
  const hint=map[code]||map[error?.cause?.code]||'';
  const base=error?.message||'未知网络错误';
  if(error?.name==='TypeError'&&/fetch failed/i.test(base))return `检索请求失败（${hint||'网络无法访问搜索服务'}）`;
  return hint?`${base}（${hint}）`:base;
}
export function canonicalSourceUrl(value){
  try{
    const url=new URL(value);
    if(!['http:','https:'].includes(url.protocol)||url.username||url.password)return '';
    url.hash='';
    for(const key of [...url.searchParams.keys()])if(/^utm_/i.test(key)||['fbclid','gclid'].includes(key))url.searchParams.delete(key);
    url.searchParams.sort();return url.href;
  }catch{return '';}
}
function cleanText(value){return String(value??'').replace(/<[^>]*>/g,'').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+/g,' ').trim();}
// The research agent emits long multi-topic queries. Wiki search treats terms
// AND-like, so several topics at once usually match nothing; collapse to the
// leading keyword so research still yields usable sources.
// Generic academic filler that matches nothing topical; never pick these as the
// fallback keyword.
const FILLER=/^(研究证据|证据|实证研究|实证|研究|综述|分析|文本|比较|关联|文本比较证据|心理学|日常经验|认知转变证据|研究及日常经验中的认知转变证据)$/;
function simplifyQuery(query){
  const parts=String(query).split(/[\s\u3000，、：:；;。．,]+/).map(s=>s.trim()).filter(Boolean);
  if(parts.length<2)return String(query).slice(0,16).trim();
  // Prefer a short topical term (2-8 chars) over a long preamble sentence.
  for(const part of parts){
    const t=part.replace(/^(研究证据|证据)[：:]/,'').trim();
    if(t.length>=2&&t.length<=8&&!FILLER.test(t))return t;
  }
  return parts[0].slice(0,24);
}
function normalize(rows,provider){
  const seen=new Set();
  return rows.flatMap(row=>{
    const url=canonicalSourceUrl(row.url),title=cleanText(row.title).slice(0,300),content=cleanText(row.content).slice(0,3500);
    if(!url||!title||!content||seen.has(url))return [];
    seen.add(url);return [{url,title,content,provider,contentType:'检索摘要'}];
  }).slice(0,6);
}
// Retry-After may be seconds or an HTTP date; never wait past the caller's budget.
function retryAfterMs(response){
  const raw=response?.headers?.get?.('retry-after');
  if(!raw)return 0;
  const seconds=Number(raw);
  if(Number.isFinite(seconds))return Math.max(0,seconds*1000);
  const when=Date.parse(raw);
  return Number.isFinite(when)?Math.max(0,when-Date.now()):0;
}
async function fetchSearch(url,init,signal){
  for(let attempt=0;attempt<2;attempt++){
    signal?.throwIfAborted();
    let retry=false,wait=300;
    try{
      const response=await searchResponse(url,init,AbortSignal.any([signal,AbortSignal.timeout(8000)].filter(Boolean)));
      if(response.ok){const data=await response.json();if(data.error)throw new Error('搜索服务返回错误');return data;}
      if(response.status===429){
        // Rate limiting: obey Retry-After. A long cooldown must not be retried into,
        // so fail fast with a clear message instead of hammering the API.
        const waitMs=retryAfterMs(response);
        if(waitMs>5000||attempt)throw new Error(`搜索服务限流（HTTP 429），请约 ${Math.max(1,Math.round(waitMs/1000))} 秒后再试`);
        wait=Math.max(500,waitMs);
        retry=true;
      }else{
        retry=[502,503,504].includes(response.status);
      }
      const error=new Error(`搜索服务 HTTP ${response.status}${response.status===401||response.status===403?'，请检查搜索密钥与权限':''}`);
      if(!retry||attempt)throw error;
    }catch(error){
      signal?.throwIfAborted();
      if(attempt||(!retry&&error.name!=='TypeError'&&error.name!=='TimeoutError'))throw error;
    }
    await delay(wait,undefined,{signal});
  }
}
async function wikipedia(query,language,signal){
  const url=new URL(`https://${language}.wikipedia.org/w/api.php`);
  url.search=new URLSearchParams({action:'query',list:'search',srsearch:query,srlimit:'6',format:'json',utf8:'1'}).toString();
  const data=await fetchSearch(url,{headers:apiHeaders()},signal);
  return normalize((data.query?.search||[]).filter(r=>Number.isInteger(r.pageid)&&r.pageid>0).map(r=>({...r,url:`https://${language}.wikipedia.org/?curid=${r.pageid}`,content:r.snippet})),'Wikipedia');
}
async function executeSearch(query,settings={},signal){
  query=String(query??'').trim().slice(0,300);
  if(!query)throw new Error('搜索关键词不能为空');
  const parent=signal;
  signal=AbortSignal.any([signal,AbortSignal.timeout(25000)].filter(Boolean));
  const warnings=[];
  if(settings.tavilyKey){
    try{
      const data=await fetchSearch('https://api.tavily.com/search',{method:'POST',headers:{'Content-Type':'application/json','User-Agent':USER_AGENT,Authorization:`Bearer ${settings.tavilyKey}`},body:JSON.stringify({query,max_results:6,search_depth:'basic',include_answer:false})},signal);
      const results=normalize(data.results||[],'Tavily');
      if(results.length)return Object.assign(results,{warnings});
      warnings.push('全网搜索无有效结果，改用百科检索。');
    }catch(e){parent?.throwIfAborted();signal.throwIfAborted();warnings.push(`${explain(e)}；改用百科检索。`);}
  }
  let lastError;
  const languages=/[\u3400-\u9fff]/u.test(query)?['zh','en']:['en','zh'];
  let refreshed=false;
  const candidates=[query];
  const simplified=simplifyQuery(query);
  if(simplified&&simplified!==query)candidates.push(simplified);
  for(let ci=0;ci<candidates.length;ci++){
    const current=candidates[ci];
    for(const language of languages){
    try{
      const results=await wikipedia(current,language,signal);
      if(results.length)return Object.assign(results,{warnings});
      warnings.push(`${language==='zh'?'中文':'英文'}百科未找到资料。`);
    }catch(e){parent?.throwIfAborted();signal.throwIfAborted();lastError=e;warnings.push(`${language==='zh'?'中文':'英文'}百科检索失败：${explain(e)}`);
      // A stale cached proxy answer is the usual cause of a first-attempt failure:
      // re-detect once and retry the same language before giving up on it.
      if(!refreshed&&networkFailure(e)){refreshed=true;try{await refreshSystemProxy();const retry=await wikipedia(current,language,signal);if(retry.length)return Object.assign(retry,{warnings});}catch(retryError){parent?.throwIfAborted();signal.throwIfAborted();lastError=retryError;warnings.push(`${language==='zh'?'中文':'英文'}百科重试仍失败：${explain(retryError)}`);}}
    }
    }
    // Only widen the query when requests worked but matched nothing; never mask a failure.
    if(lastError)break;
    if(ci<candidates.length-1)warnings.push('原查询关键词过多，已用简化关键词重试。');
  }
  if(lastError)throw new Error(warnings.join('；'));
  return Object.assign([],{warnings});
}
export async function search(query,settings={},signal){
  try{return await executeSearch(query,settings,signal);}
  catch(error){
    signal?.throwIfAborted();
    if(error.name==='TimeoutError')throw new Error('检索超时（25 秒预算），请检查网络能否访问搜索服务');
    throw error;
  }
}

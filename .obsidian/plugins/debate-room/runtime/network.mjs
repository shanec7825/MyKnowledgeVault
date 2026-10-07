import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
const execute=promisify(execFile);
let proxyPromise;

// A proxy value is only usable when it has a scheme; PowerShell returns bare host:port.
function normalizeProxy(value){
  const raw=String(value||'').trim();
  if(!raw)return '';
  return raw.includes('://')?raw:'http://'+raw;
}
function fromProxyServer(value){
  const raw=String(value||'').trim();
  if(!raw)return '';
  // Explicit scheme/proxy string such as "http=127.0.0.1:7890;https=127.0.0.1:7890"
  const named=raw.match(/(?:^|;)\s*https?=([^;]+)/i);
  if(named)return normalizeProxy(named[1]);
  // Bare "host:port" or "http://host:port"
  return /[=]/.test(raw)?'':normalizeProxy(raw);
}
async function proxyAddress(){
  const explicit=process.env.HTTPS_PROXY||process.env.https_proxy||process.env.HTTP_PROXY||process.env.http_proxy;
  if(explicit)return normalizeProxy(explicit);
  if(process.platform!=='win32'||process.env.NODE_TEST_CONTEXT||process.env.SEARCH_SYSTEM_PROXY==='0')return '';
  // 1. Explicit registry read is the authoritative source.
  try{
    const {stdout}=await execute('powershell.exe',['-NoProfile','-NonInteractive','-Command',"$p=Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings';if($p.ProxyEnable -eq 1){$p.ProxyServer}"],{windowsHide:true,timeout:8000});
    const value=fromProxyServer(stdout);
    if(value)return value;
  }catch{/* fall through to the netsh probe */}
  // 2. Some environments (sandboxed or slow shells) cannot run PowerShell; probe the
  //    conventional local proxy ports instead of silently degrading to a direct fetch.
  return await probeLocalProxy();
}
// Probe well-known local proxy ports so networking keeps working when the
// registry read is unavailable or the shell is too slow to answer.
async function probeLocalProxy(){
  const net=await import('node:net');
  const hosts=['127.0.0.1','localhost'];
  const ports=[7890,7897,10808,10809,1080,8080,8888];
  for(const host of hosts)for(const port of ports){
    const open=await new Promise(resolve=>{
      const socket=net.connect({host,port,timeout:350});
      const done=v=>{socket.destroy();resolve(v);};
      socket.once('connect',()=>done(true));
      socket.once('error',()=>done(false));
      socket.once('timeout',()=>done(false));
    });
    if(open)return `http://${host}:${port}`;
  }
  return '';
}
export async function systemProxy(){return proxyPromise??=proxyAddress();}
// Force a fresh detection pass (used after a search failure to avoid caching a bad answer).
export async function refreshSystemProxy(){proxyPromise=undefined;return proxyPromise=proxyAddress();}
export async function searchResponse(url,init,signal){
  const proxy=await (proxyPromise??=proxyAddress());
  signal?.throwIfAborted();
  if(!proxy||process.env.NODE_TEST_CONTEXT)return fetch(url, {...init,signal});
  // Search uses a separate process so proxy configuration cannot disrupt local model requests.
  const result=await new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,['--use-env-proxy',fileURLToPath(new URL('./search-worker.mjs',import.meta.url))],{windowsHide:true,env:{...process.env,HTTPS_PROXY:proxy,HTTP_PROXY:proxy,https_proxy:proxy,http_proxy:proxy,NO_PROXY:'localhost,127.0.0.1,::1',no_proxy:'localhost,127.0.0.1,::1'},stdio:['pipe','pipe','ignore']});
    let output='';const abort=()=>{child.kill();reject(signal.reason);};
    signal?.addEventListener('abort',abort,{once:true});
    child.stdout.on('data',chunk=>{output+=chunk;if(output.length>2000000){child.kill();reject(new Error('搜索响应过大'));}});
    child.on('error',reject);child.on('close',()=>{signal?.removeEventListener('abort',abort);try{const value=JSON.parse(output);if(value.error)reject(new Error(value.error));else resolve(value);}catch{reject(new Error('代理检索未返回有效响应，请检查代理与 Node 版本'));}});
    child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify({url:String(url),init}));
  });
  const headers=result.headers||{};
  return {ok:result.status>=200&&result.status<300,status:result.status,headers:{get:name=>headers[String(name).toLowerCase()]??null},json:async()=>result.data};
}

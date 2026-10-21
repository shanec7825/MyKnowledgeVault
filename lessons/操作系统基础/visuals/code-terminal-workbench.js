const LABS=[{"id":0,"sources":[{"file":"hello.c","code":"#include <stdio.h>\nint main(void) {\n    puts(\"Hello, system!\");\n    return 0;\n}"}],"runner":"gcc hello.c -o hello && ./hello","task":"让输出换成你自己的话；不重新编译先运行旧文件，看看会不会变。","keyword":"Hello, system!","reference":"Hello, system!","hint":"一次只修改 puts 里的字符串；改了 .c 以后需要再次运行 gcc。","type":"c"},{"id":1,"sources":[{"file":"bits.c","code":"#include <stdint.h>\n#include <stdio.h>\nint main(void) {\n    uint8_t bits = 0xFF;\n    int unsigned_value = bits;\n    int signed_value = (bits & 0x80) ? (int)bits - 256 : (int)bits;\n    printf(\"hex=0x%02X unsigned=%d signed8=%d\\n\",\n           (unsigned)bits, unsigned_value, signed_value);\n}"}],"runner":"gcc -std=c11 -Wall -Wextra bits.c -o bits && ./bits","task":"把 0xFF 改成 0x80，预测 unsigned 和 signed8。","keyword":"unsigned=255 signed8=-1","reference":"unsigned=255 signed8=-1","hint":"8 位补码：无符号数 u≥128 时，计算 u−256。","type":"c"},{"id":2,"sources":[{"file":"add.c","code":"#include <stdio.h>\nlong add(long a, long b) {\n    return a + b;\n}\nint main(void) {\n    printf(\"%ld\\n\", add(2, 3));\n    return 0;\n}"}],"runner":"gcc -O0 -g add.c -o add && ./add","task":"把 add(2, 3) 改成 add(8, 4)，猜输出。","keyword":"5","reference":"5","hint":"可以加上 gcc -O0 -g，再用 gdb 在 add 入口看参数。","type":"c"},{"id":3,"sources":[{"file":"demo.c","code":"#include <stdio.h>\nint main(void) {\n    int r0 = 0, program[] = {3, 5, -2};\n    for (int pc = 0; pc < 3; ++pc) {\n        r0 += program[pc];\n        printf(\"pc=%d r0=%d\\n\", pc, r0);\n    }\n}"}],"runner":"gcc demo.c -o demo && ./demo","task":"把 program[] 中第二个加数 5 改成 10，自己计算 PC 和 r0。","keyword":"pc=2 r0=6","reference":"pc=0 r0=3\npc=1 r0=8\npc=2 r0=6","hint":"该代码是 C 写的简化指令执行器，不是真正的 CPU 微码。","type":"c"},{"id":4,"sources":[{"file":"main.c","code":"#include <stdio.h>\nint add(int x, int y);\nint main(void) {\n    printf(\"%d\\n\", add(2, 3));\n    return 0;\n}"},{"file":"add.c","code":"int add(int x, int y) { return x + y; }"}],"runner":"gcc main.c add.c -o joined && ./joined","task":"在构建命令中删掉 add.c，观察在哪一阶段报 undefined reference。","keyword":"5","reference":"5","hint":"先编译 main.c，链接时才发现缺少 add 的定义；恢复 add.c 可修复。","type":"c"},{"id":5,"sources":[{"file":"demo.c","code":"#include <stdio.h>\nint main(void) {\n    int a[8]={0,1,2,3,4,5,6,7};\n    for (int i=0;i<8;i++) printf(\"%d \",a[i]);\n    puts(\"\");\n    for (int start=0;start<2;start++)\n        for (int i=start;i<8;i+=2) printf(\"%d \",a[i]);\n    puts(\"\");\n}"}],"runner":"gcc demo.c -o demo && ./demo","task":"把顺序访问和先偶数后奇数访问的输出对比；暂时不要声称测出了 Cache 速度。","keyword":"0 2 4 6 1 3 5 7","reference":"0 1 2 3 4 5 6 7\n0 2 4 6 1 3 5 7","hint":"这些数据只证明访问顺序，不会直接证明真实 Cache hit/miss。","type":"c"},{"id":6,"sources":[{"file":"demo.c","code":"#include <stdio.h>\n#include <unistd.h>\n#include <sys/wait.h>\nint main(void) {\n    pid_t p = fork();\n    if (p == 0) { puts(\"child\"); return 0; }\n    if (p > 0) { waitpid(p, NULL, 0); puts(\"parent\"); }\n    else perror(\"fork\");\n    return 0;\n}"}],"runner":"gcc demo.c -o demo && ./demo","task":"思考 waitpid 是否保证 child 与 parent 的输出次序；可以修改打印的内容。","keyword":"child\nparent","reference":"child\nparent","hint":"移除 waitpid 后不能保证顺序；一次运行的结果不代表确定调度。","type":"c"},{"id":7,"sources":[{"file":"demo.c","code":"#include <stdio.h>\n#include <stdlib.h>\nint main(void) {\n    int x = 7;\n    int *p = malloc(sizeof *p);\n    if (!p) return 1;\n    *p = 9;\n    printf(\"local=%p heap=%p\\n\", (void*)&x, (void*)p);\n    free(p);\n}"}],"runner":"gcc demo.c -o demo && ./demo","task":"运行两次，观察 local 和 heap 地址是否变化，不要猜真实物理地址。","keyword":"local=0x","reference":"local=0x... heap=0x...","hint":"地址采用平台运行时分配的虚拟地址，不能用固定数字作为成功判断。","type":"c"},{"id":8,"sources":[{"file":"demo.c","code":"#include <stdio.h>\nint main(void) {\n    FILE *f = fopen(\"note.txt\", \"w\");\n    if (!f) { perror(\"fopen\"); return 1; }\n    if (fputs(\"hello file\\n\", f) == EOF) { perror(\"fputs\"); fclose(f); return 1; }\n    if (fclose(f) == EOF) { perror(\"fclose\"); return 1; }\n    puts(\"saved\");\n}"}],"runner":"gcc demo.c -o demo && ./demo && cat note.txt","task":"先运行程序，再执行 cat note.txt 看保存的内容；换一个字符串再做一次。","keyword":"saved","reference":"saved\nhello file","hint":"fputs 可能先写入用户缓冲区。fclose 刷新成功后才能从文件读取到该内容。","type":"c"},{"id":9,"sources":[{"file":"index.html","code":"<h1>Hello HTTP</h1>\n"}],"runner":"python3 -m http.server 8765 --bind 127.0.0.1","task":"终端 A 开启服务器，终端 B 用 curl 请求 / 和 /missing；看 HTTP 状态码。","keyword":"HTTP/1.0 200","reference":"HTTP/1.0 200 OK","hint":"http.server 会保持运行，不会自动退出。请在另一终端执行 curl；最后在服务端按 Ctrl+C。","type":"server"},{"id":10,"sources":[{"file":"demo.c","code":"#include <pthread.h>\n#include <stdio.h>\nvoid *work(void *arg) {\n    (void)arg; puts(\"worker\"); return NULL;\n}\nint main(void) {\n    pthread_t t;\n    if (pthread_create(&t,NULL,work,NULL) != 0) return 1;\n    if (pthread_join(t,NULL) != 0) return 1;\n    puts(\"main done\");\n}"}],"runner":"gcc -pthread demo.c -o demo && ./demo","task":"改变主线程打印与 join 的相对位置，比较先后顺序的保证。","keyword":"worker\nmain done","reference":"worker\nmain done","hint":"join 保证工作线程已结束；它不会自动保护多个线程共享的数据。","type":"c"}];

(function(){
"use strict";
const scripts=document.querySelectorAll(".code-workbench");
if(!scripts.length)return;
const root=scripts[0],isAdvanced=root.getAttribute("data-scope")==="advanced",labMin=isAdvanced?3:0,labMax=isAdvanced?10:2;
const model=LABS;
const byId=id=>root.querySelector("#"+id);
let id=-1,answer=Object.create(null);
function escapeSafe(str){return String(str).replace(/[&<>"]/g,s=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[s]))}
function projectKey(n){return "csapp-workbench-v3-"+n}
function readSaved(n){try{const item=JSON.parse(localStorage.getItem(projectKey(n))||"{}");return item&&typeof item==="object"?item:{}}catch(e){return {}}}
function save(){if(id<0)return;const current={};root.querySelectorAll("[data-source]").forEach(t=>current[t.dataset.source]=t.value);current.runner=byId("cw-runner").value;current.prediction=byId("cw-prediction").value;try{localStorage.setItem(projectKey(id),JSON.stringify(current))}catch(e){}}
function getLab(){if(isAdvanced){const raw=document.getElementById("breadcrumb")?.textContent;const n=Number(raw);return Number.isInteger(n)&&n>=3&&n<=10?n:3}const selected=document.querySelector(".tab[aria-selected=true]");return selected?Number(selected.dataset.go):0}
function setInfo(text){byId("cw-info").textContent=text}
function markText(m){
 let result=root.querySelector("#cw-visual-diff");result.textContent=m;
}
function countChanges(){
 if(id<0)return;const l=model[id];
 const changed=l.sources.reduce((sum,src)=>{const box=root.querySelector('[data-source="'+src.file+'"]');return sum+Number(box&&box.value.replace(/\r\n/g,"\n")!==src.code.replace(/\r\n/g,"\n"))},0);
 const runnerChanged=byId("cw-runner").value!==l.runner;
 markText(changed===0&&!runnerChanged?"还没有改代码。试着完成上方的小任务。":"你修改了 "+changed+" 个文件"+(runnerChanged?"，也修改了构建命令":"")+"。复制并到 Ubuntu 中执行，观察变化。");
}
function bashMarker(source){let marker="CSAPP_CODE_END";while(source.split("\n").some(l=>l===marker))marker+="_X";return marker}
function makeCommands(includeRunner=true){
 if(id<0)return null;const l=model[id];
 let lines=["mkdir -p ~/cs-system/tiny"+id+" && cd ~/cs-system/tiny"+id];
 root.querySelectorAll("[data-source]").forEach(box=>{
  const name=box.dataset.source,code=box.value.replace(/\r\n/g,"\n").replace(/\r/g,"\n");
  const marker=bashMarker(code);
  lines.push("cat > "+name+" <<'"+marker+"'\n"+code.replace(/\n$/,"")+"\n"+marker);
 });
 if(includeRunner)lines.push(byId("cw-runner").value);
 return lines.join("\n");
}
function splitBuildRun(){
 const command=byId("cw-runner").value,parts=command.split(/\s*&&\s*/);
 if(model[id].type==="server"||parts.length<2)return null;
 const folder="cd ~/cs-system/tiny"+id+" && ";
 return {compile:folder+parts[0],run:folder+parts.slice(1).join(" && ")};
}
function renderCommands(){
 const str=makeCommands();byId("cw-command").textContent=str||"";countChanges();
 const l=model[id];
 const split=splitBuildRun();byId("cw-split").hidden=!split;
 byId("cw-second").hidden=l.type!=="server";
 if(l.type==="server"){byId("cw-second-command").textContent="curl -i http://127.0.0.1:8765/\ncurl -i http://127.0.0.1:8765/missing";}
}
function setLab(n){
 if(!Number.isInteger(n)||n<labMin||n>labMax||id===n)return;
 id=n;const l=model[n],saved=readSaved(n);
 byId("cw-lab-name").textContent=String(n).padStart(2,"0")+" · 写代码与终端";
 byId("cw-task").textContent=l.task;
 const editors=byId("cw-editors");editors.replaceChildren();
 l.sources.forEach((src,j)=>{
  const group=document.createElement("div");group.className="cw-file";
  const label=document.createElement("label");label.textContent="文件 "+(j+1)+" / "+src.file;
  const textarea=document.createElement("textarea");textarea.className="cw-source";textarea.dataset.source=src.file;textarea.id="cw-source-"+j;
  textarea.spellcheck=false;textarea.setAttribute("aria-label","编辑 "+src.file+" 的源代码");
  textarea.value=typeof saved[src.file]==="string"?saved[src.file]:src.code;
  label.htmlFor=textarea.id;group.append(label,textarea);editors.append(group);
  textarea.addEventListener("input",()=>{save();renderCommands();});
 });
 byId("cw-runner").value=typeof saved.runner==="string"?saved.runner:l.runner;
 byId("cw-prediction").value=typeof saved.prediction==="string"?saved.prediction:"";
 byId("cw-actual").value="";
 byId("cw-reference").textContent=l.reference;
 byId("cw-reference-wrap").hidden=true;
 byId("cw-hint").textContent=l.hint;
 byId("cw-hint-wrap").open=false;
 byId("cw-actual-status").textContent="粘贴 Ubuntu 里真实得到的输出，再点击「对照观察」。不会自动执行任何代码。";
 byId("cw-local").textContent="编辑自动保存在此浏览器；不会同步到知识库。";
 const details=byId("cw-details");details.hidden=false;
 renderCommands();
}
async function copy(text,target){
 try{
  if(navigator.clipboard&&navigator.clipboard.writeText)await navigator.clipboard.writeText(text);
  else{
   const input=document.createElement("textarea");input.value=text;input.style.position="fixed";input.style.left="-9999px";document.body.append(input);input.select();
   const success=document.execCommand("copy");input.remove();if(!success)throw Error("copy fallback failed");
  }
  target.textContent="已复制，粘贴到 Ubuntu 终端执行。";
 }catch(e){target.textContent="未能自动复制。请手动选择下方命令。";}
}
function compare(){
 const value=byId("cw-actual").value;
 if(!value.trim()){byId("cw-actual-status").textContent="请先在真实 Ubuntu 运行，再粘贴输出或错误信息。";return}
 const l=model[id],text=value.replace(/\r\n/g,"\n");
 if(id===4&&/undefined reference to ['`]?add/i.test(text)){
  byId("cw-actual-status").textContent="你观察到了链接阶段的 undefined reference：main.c 中调用了 add，但最终链接命令缺少它的定义。把 add.c 加回构建命令并重新链接，观察能否恢复。";return
 }
 if(id===9&&/HTTP\/1\.[01] 404/i.test(text)&&!/HTTP\/1\.[01] 200/i.test(text)){
  byId("cw-actual-status").textContent="这份响应显示 404：如果你请求的是 /missing，这正是有意义的观察。再请求 / 看看 200 响应，并比较请求路径。";return
 }
 if(/command not found|No such file or directory|undefined reference|error:|Permission denied|Traceback|Address already in use/i.test(text)){
  byId("cw-actual-status").textContent="检测到可能的命令、编译或运行错误。先看错误信息对应的行：确认 gcc/python3 是否安装、工作目录是否正确，或缺少了哪个 .c 文件。这里不自动修复你的代码。";
  return;
 }
 const matches=id===7?/local=0x[0-9a-f]+\s+heap=0x[0-9a-f]+/i.test(text):
  id===9?/HTTP\/1\.[01] 200/i.test(text):
  id===8?/saved[\s\S]*hello file/i.test(text):
  id===6?/child[\s\S]*parent/.test(text):
  id===10?/worker[\s\S]*main done/.test(text):
  text.includes(l.keyword);
 const changed=l.sources.some(src=>{
  const elem=root.querySelector('[data-source="'+src.file+'"]');return elem&&elem.value!==src.code
 })||byId("cw-runner").value!==l.runner;
 byId("cw-actual-status").textContent=matches?(changed?
  "输出包含原示例中的关键特征；但你已改过代码，请根据自己的预测逐行核对，不能据此认定修改后的程序正确。":
  "你粘贴的文本与原示例的关键特征一致。它来自你的粘贴，页面无法证实是否真实执行；请再改一个输入观察差异。"
 ):("目前没有匹配原示例的关键特征。"+(changed?"你改动了代码，因此结果不同可能正是预期；请对照预测检查。":"检查是否粘贴了程序 stdout，或者编译/运行命令有没有失败。"));
}
byId("cw-copy").addEventListener("click",()=>copy(makeCommands(),byId("cw-copy-status")));
byId("cw-save-source").addEventListener("click",()=>copy(makeCommands(false),byId("cw-copy-status")));
byId("cw-compile-only").addEventListener("click",()=>{const x=splitBuildRun();if(x)copy(x.compile,byId("cw-copy-status"))});
byId("cw-run-only").addEventListener("click",()=>{const x=splitBuildRun();if(x)copy(x.run,byId("cw-copy-status"))});

byId("cw-copy-second").addEventListener("click",()=>copy(byId("cw-second-command").textContent,byId("cw-copy-status")));
byId("cw-compare").addEventListener("click",compare);
byId("cw-reference-toggle").addEventListener("click",()=>{byId("cw-reference-wrap").hidden=!byId("cw-reference-wrap").hidden});
byId("cw-reset").addEventListener("click",()=>{if(id<0)return;try{localStorage.removeItem(projectKey(id))}catch(e){}const n=id;id=-1;setLab(n);setInfo("已恢复课程原始代码。")});
byId("cw-runner").addEventListener("input",()=>{save();renderCommands()});
byId("cw-prediction").addEventListener("input",save);
const observer=new MutationObserver(muts=>{
 if(muts.some(m=>m.type==="attributes"&&(m.attributeName==="aria-selected"||m.attributeName==="aria-current")&&m.target.matches?.(".tab,.railbutton")||
 (m.type==="childList"&&m.target.id==="breadcrumb")))setLab(getLab());
});
observer.observe(document.body,{attributes:true,subtree:true,attributeFilter:["aria-selected","aria-current"],childList:true});
window.addEventListener("hashchange",()=>queueMicrotask(()=>setLab(getLab())));
setLab(getLab());
})();
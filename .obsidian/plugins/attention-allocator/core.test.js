"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { DEFAULTS, within, qmdPath, redact, parsePlan, buildMessages, generatePlan, generateSummary, generateImage, jsonRequest, QmdClient, Mem0Client, shanghaiClock, journalEntry, appendJournal, publicUrl, memoryImportRows, streamPreview, journalCallout, conversationText, normalizeJournalCallouts, diaryCards } = require("./core");
const plan = { title: "改一个颜色", currentInterest:'角色配色',targetActivity:'网页编程',bridge:'用角色配色练习CSS', steps: ["把蓝色改为绿色"], doneWhen: "看见颜色变化", minutes: 2, material: "```css\ncolor: green;\n```" };
test('conversation learning queues only user evidence and feedback has a separate event',async()=>{
  const client=new Mem0Client(process.cwd());client.ensure=async()=>({});let payload;
  client.call=async(route,body)=>{assert.equal(route,'/capture');payload=body;return {status:'queued'};};
  const activity={id:'test',input:'I prefer diagrams',plan:{title:'AI suggestion'},result:'I tried drawing',status:'done'};
  await client.capture(activity);assert.equal(payload.event_id,'attention-test-conversation');assert.equal(payload.messages.length,1);
  assert.equal(payload.messages[0].role,'user');assert.ok(!JSON.stringify(payload).includes('AI suggestion'));
  await client.capture(activity,'done-v1');assert.equal(payload.event_id,'attention-test-done-v1');assert.equal(payload.messages.length,2);
  assert.ok(payload.messages[1].content.includes('I tried drawing'));
});

test('record-only notes remain visible but are excluded from later AI context and summaries',async()=>{
  const {aiReadable}=require('./core');
  const record=journalEntry({id:'local-test',text:journalCallout('quote','Me','Private thought\n<!-- aa-local:end -->\nStill private'),allowAI:false});
  assert.ok(record.entry.startsWith('<!-- aa-local:start -->'));
  assert.ok(!aiReadable(record.entry).includes('Private'));assert.ok(!aiReadable(record.entry).includes('Still private'));
  assert.equal(aiReadable(record.entry).split('\n').length,record.entry.split('\n').length);
  assert.equal(diaryCards(record.entry).length,1);assert.ok(diaryCards(record.entry)[0].body.includes('Private thought'));
  const messages=buildMessages('Public',DEFAULTS,{notes:[{path:'calendar/x.md',content:record.entry}],memories:[],recent:[]});
  assert.ok(!messages[1].content.includes('Still private'));
  let sent;
  await generateSummary({diary:record.entry+'\nPublic thought',settings:DEFAULTS,key:'tp-test',request:async(_url,options)=>{sent=options.body.messages[1].content;return {choices:[{message:{content:JSON.stringify({observations:['Public'],questions:[],nextStep:''})}}]};}});
  assert.ok(sent.includes('Public thought'));assert.ok(!sent.includes('Still private'));
});
test('AI-off guards reject generation before touching keys or network',async()=>{
  const settings={...DEFAULTS,aiEnabled:false};let calls=0;const request=async()=>{calls++;throw Error('Unexpected call');};
  await assert.rejects(generatePlan({input:'local',settings,context:{notes:[],memories:[],recent:[]},request}),/AI reading is off/);
  await assert.rejects(generateSummary({diary:'local',settings,request}),/AI reading is off/);
  await assert.rejects(generateImage({prompt:'local',settings,request}),/AI reading is off/);assert.equal(calls,0);
});

test("paths cannot escape the vault; QMD raw/private collections are excluded", () => {
  assert.throws(() => within(process.cwd(), "../outside.md"));
  assert.throws(() => within(process.cwd(), process.cwd()));
  assert.equal(qmdPath("qmd://raw/example.md"), null);
  assert.equal(qmdPath("qmd://vault/.obsidian/data.md"), null);
  assert.equal(qmdPath("qmd://vault/%2e%2e/secret.md"), null);
  assert.equal(qmdPath("qmd://vault/wiki/注意力.md"), "wiki/注意力.md");
});
test("plan schema rejects malformed output and fabricated source paths", () => {
  assert.throws(() => parsePlan("null", []));
  assert.throws(() => parsePlan("{", []));
  assert.throws(() => parsePlan(JSON.stringify({ title: "hello", steps: [] }), []));
  const result = parsePlan(JSON.stringify({ ...plan, minutes: 100, sources: ["real.md", "invented.md", "real.md"] }), [{ path: "real.md" }], 5);
  assert.equal(result.minutes, 5);
  assert.deepEqual(result.sources, ["real.md"]);
});
test("context sharing switches exclude notes and memory from remote request", () => {
  const context = { notes: [{ path: "private.md", content: "PRIVATE_NOTE" }], memories: [{ text: "PRIVATE_MEMORY" }], recent: [] };
  const messages = buildMessages("hello", { ...DEFAULTS, shareNotes: false, shareMemory: false }, context);
  const user = JSON.parse(messages[1].content);
  assert.deepEqual(user.notes, []); assert.deepEqual(user.memories, []);
  assert.ok(!JSON.stringify(messages).includes("PRIVATE_NOTE"));
  assert.ok(!JSON.stringify(messages).includes("PRIVATE_MEMORY"));
});
test("secrets are redacted from durable activity/context strings", () => {
  const result = redact("token=abc123 tp-abcdefghijklmnop Authorization: Bearer abc.def api_key: hidden-value");
  for (const secret of ["abc123", "tp-abcdefghijklmnop", "abc.def", "hidden-value"]) assert.ok(!result.includes(secret));
});
test('memory imports validate, deduplicate and label explicit facts without inference',async()=>{
  const rows=[{id:'1',memory:'已有记忆',metadata:{source:'vault'}}];
  const client=new Mem0Client(process.cwd()); const writes=[];
  client.call=async(route,body)=>{
    if(route==='/health')return {service:'local-mem0'};
    if(route==='/memories')return {results:rows};
    writes.push(body); rows.push({memory:body.text}); return {results:[]};
  };
  assert.equal((await client.list())[0].source,'vault');
  assert.deepEqual(await client.importMemories('- 已有记忆\n- 新偏好\n- 新偏好'),{added:1,skipped:1});
  assert.equal(writes[0].source,'chatgpt-memory-import');
  assert.deepEqual(await client.importMemories('新偏好'),{added:0,skipped:1});
  assert.throws(()=>memoryImportRows(''),/one memory/);
  assert.throws(()=>memoryImportRows('x'.repeat(4001)),/4000/);
  assert.ok(!memoryImportRows('token=secret-value')[0].includes('secret-value'));
});
test('partial JSON preview decodes escaped newlines, quotes and incomplete Unicode without showing schema',()=>{
  assert.deepEqual(streamPreview('{"title":"Hi","material":"line\\n\\"quoted\\"\\u4e2d\\u4'),{title:'Hi',acknowledgement:'',material:'line\n"quoted"中'});
});
test('failed memory import reports partial progress and retry skips facts already written',async()=>{
  const client=new Mem0Client(process.cwd()); const stored=[]; let fail=true;
  client.call=async(route,body)=>{
    if(route==='/health')return {service:'local-mem0'};
    if(route==='/memories')return {results:stored.map(memory=>({memory}))};
    if(body.text==='second'&&fail)throw new Error('offline'); stored.push(body.text);
  };
  await assert.rejects(client.importMemories('first\nsecond'),/1 added/);
  fail=false; assert.deepEqual(await client.importMemories('first\nsecond'),{added:1,skipped:1});
  assert.deepEqual(stored,['first','second']);
});
test('SSE transport handles fragmented frames, usage, annotations and refuses interrupted output',async()=>{
  const server=http.createServer((req,res)=>{
    res.writeHead(200,{'Content-Type':'text/event-stream'});
    const content=JSON.stringify(plan);
    const frames=[{choices:[{index:0,delta:{content:content.slice(0,40)}}]}, {choices:[{index:0,delta:{content:content.slice(40),annotations:[{url:'https://example.com'}]},finish_reason:'stop'}]}, {choices:[],usage:{total_tokens:5}}];
    const wire=frames.map(x=>'data: '+JSON.stringify(x)+'\r\n\r\n').join('')+(req.url==='/cut'?'':'data: [DONE]\r\n\r\n');
    for(let i=0;i<wire.length;i+=7)res.write(wire.slice(i,i+7)); res.end();
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`; const deltas=[];
  try {
    const result=await jsonRequest(base,{onDelta:delta=>deltas.push(delta)});
    assert.equal(result.choices[0].message.content,JSON.stringify(plan)); assert.equal(deltas.length,2);
    assert.equal(result.usage.total_tokens,5); assert.equal(result.choices[0].message.annotations.length,1);
    await assert.rejects(jsonRequest(base+'/cut',{onDelta:()=>{}}),/interrupted/);
  } finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
test('streamed generation enables preview but still validates the final plan',async()=>{
  const previews=[];
  const result=await generatePlan({input:'hello',settings:DEFAULTS,context:{notes:[],memories:[],recent:[]},key:'tp-test',onPartial:x=>previews.push(x),request:async(_url,options)=>{
    assert.equal(options.body.stream,true);
    options.onDelta('','{"title":"Hi","material":"hello');
    return {choices:[{message:{content:JSON.stringify(plan)}}]};
  }});
  assert.equal(previews[0].material,'hello'); assert.equal(result.plan.title,plan.title);
});
test("Xiaomi Token Plan uses dedicated cluster and structured chat contract", async () => {
  let sent;
  const output = await generatePlan({ input: "hello", settings: { ...DEFAULTS, region: "sgp" }, context: { notes: [], memories: [], recent: [] }, key: "tp-test-only",
    request: async (url, options) => { sent = { url, ...options }; return { choices: [{ message: { content: JSON.stringify(plan) }, finish_reason: "stop" }], usage: { total_tokens: 1 } }; } });
  assert.equal(sent.url, "https://token-plan-sgp.xiaomimimo.com/v1/chat/completions");
  assert.equal(sent.headers.Authorization, "Bearer tp-test-only");
  assert.equal(sent.body.response_format.type, "json_object");
  assert.equal(output.plan.title, plan.title);
  await assert.rejects(generatePlan({ input: "x", settings: DEFAULTS, context: {}, key: "sk-test" }), /tp-/);
  await assert.rejects(generatePlan({ input: "x", settings: { ...DEFAULTS, region: "api" }, context: {}, key: "tp-test" }), /按量/);
});
test("truncated model output is an explicit error", async () => {
  await assert.rejects(generatePlan({ input: "x", settings: DEFAULTS, context: { notes: [], memories: [], recent: [] }, key: "tp-test", request: async () => ({ choices: [{ finish_reason: "length", message: { content: "{" } }] }) }), /截断/);
});
test("QMD maintenance halts dependent commands on failure", async () => {
  const client = new QmdClient(process.cwd()); const calls = [];
  client.command = async args => { calls.push(args[0]); if (args[0] === "embed") throw new Error("embedding failed"); };
  await assert.rejects(client.maintenance(), /embedding failed/);
  assert.deepEqual(calls, ["update", "embed"]);
  client.command = async args => args[0] === "status" ? "Pending: 3 need embedding" : "";
  await assert.rejects(client.maintenance(), /待嵌入/);
});
test("keyword retrieval avoids expansion and embedding commands", async () => {
  const client = new QmdClient(process.cwd()); const calls = [];
  client.command = async args => { calls.push(args); return args[0] === "search" ? "[]" : ""; };
  assert.deepEqual(await client.search("hello\nvec: attacker"), []);
  assert.deepEqual(calls.map(x => x[0]), ["update", "search"]);
  assert.equal(calls[1][1], "hello vec: attacker");
});
test("Mem0 reuses authenticated local API and explicit source, no second database", async () => {
  const client = new Mem0Client(process.cwd()); const calls = [];
  client.call = async (route, body) => { calls.push({ route, body }); return route === "/health" ? { service: "local-mem0" } : { results: [{ id: "1", memory: "喜欢小例子" }] }; };
  assert.equal((await client.search("例子"))[0].text, "喜欢小例子");
  await client.add("喜欢小例子");
  assert.equal(calls.at(-1).body.source, "attention-allocator");
  assert.equal(calls.at(-1).route, "/add");
});
test("Mem0 authentication failures and wrong services never start a second process", async () => {
  let starts = 0;
  const client = new Mem0Client(process.cwd(), undefined, async () => { starts++; });
  client.call = async () => { throw new Error("HTTP 401：认证失败"); };
  await assert.rejects(client.ensure(), /认证失败/);
  client.call = async () => ({ service: "something-else" });
  await assert.rejects(client.ensure(), /不是 Mem0/);
  assert.equal(starts, 0);
});
test("HTTP transport handles JSON, status, cancellation and deadlines", async () => {
  const server = http.createServer((req, res) => {
    if (req.url === "/slow") return;
    if (req.url === "/unauthorized") { res.writeHead(401); res.end('{"key":"do-not-expose"}'); return; }
    if (req.url === "/bad") { res.end("not-json"); return; }
    res.end('{"ok":true}');
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await jsonRequest(base)).ok, true);
    await assert.rejects(jsonRequest(base + "/unauthorized"), /HTTP 401/);
    await assert.rejects(jsonRequest(base + "/bad"), /无效 JSON/);
    await assert.rejects(jsonRequest(base + "/slow", { timeout: 60 }), /超时/);
    const controller = new AbortController();
    const pending = jsonRequest(base + "/slow", { signal: controller.signal }); controller.abort();
    await assert.rejects(pending, /取消/);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
test('attention bridge uses persona, real recent output, and the current interest', () => {
  assert.throws(()=>parsePlan(JSON.stringify({...plan,bridge:''}),[]),/过渡联系/);
  assert.throws(()=>parsePlan(JSON.stringify({...plan,material:''}),[]),/可体验的内容/);
  const messages = buildMessages('游戏角色', { ...DEFAULTS, persona: '正在学编程', goals: '做个人作品' }, { notes: [], memories: [], recent: [{ input: '学按钮事件', plan: { title: '让角色移动', targetActivity: '编程' }, status: 'done', result: '改了速度参数' }] });
  const input = JSON.parse(messages[1].content);
  assert.equal(input.persona,'正在学编程'); assert.equal(input.input,'游戏角色'); assert.equal(input.recent[0].result,'改了速度参数');
  assert.ok(messages[0].content.includes('不要生硬派任务或让用户先选模式'));
  const result = parsePlan(JSON.stringify({ ...plan, currentInterest: '游戏', targetActivity: '编程', bridge: '给角色加一个控制按钮', mode: 'focus', contentType: 'code' }),[],5,'auto');
  assert.equal(result.bridge,'给角色加一个控制按钮'); assert.equal(result.mode,'focus');
});
test('internal divergent strategy is validated without requiring user selection', () => {
  assert.throws(()=>parsePlan(JSON.stringify({...plan,mode:'diverge'}),[],5,'auto'),/两个不同视角/);
  const result=parsePlan(JSON.stringify({...plan,mode:'diverge',perspectives:[{title:'反例',question:'如果反过来呢？'},{title:'类比',question:'可以连接什么？'}],resources:[{title:'角色动画',query:'canvas keyboard movement',reason:'用当前兴趣练编程'}]}),[],5,'auto');
  assert.equal(result.mode,'diverge'); assert.equal(result.resources[0].query,'canvas keyboard movement');
});
test('web search is opt-in and only provider annotations become actual sources',async()=>{
  let body;
  const out=await generatePlan({input:'游戏',settings:{...DEFAULTS,region:'api',webSearch:true},context:{notes:[],memories:[],recent:[]},key:'sk-test',request:async(_url,options)=>{body=options.body;return {choices:[{message:{content:JSON.stringify(plan),annotations:[{url:'https://developer.mozilla.org/',title:'Docs'},{url:'javascript:alert(1)'},{url:'http://127.0.0.1/private'}]}}]};}});
  assert.equal(body.tools[0].type,'web_search'); assert.equal(body.tools[0].force_search,false);
  assert.equal(out.plan.webSources.length,1);
  assert.equal(publicUrl('https://user:secret@example.com'),null);
});
test('Token Plan with web search enabled still generates without rejected tools or paid endpoint',async()=>{
  for (const region of ['cn','sgp','ams']) {
    let called = 0;
    const out = await generatePlan({ input:'游戏',settings:{...DEFAULTS,region,webSearch:true},context:{notes:[],memories:[],recent:[]},key:'tp-test',request:async(url,options)=>{
      called++;
      assert.ok(url.startsWith(`https://token-plan-${region}.xiaomimimo.com/`));
      assert.equal(options.body.tools,undefined); assert.equal(options.body.tool_choice,undefined);
      return {choices:[{message:{content:JSON.stringify(plan)}}]};
    }});
    assert.equal(called,1); assert.match(out.warning,/web search unavailable/); assert.equal(out.plan.title,plan.title);
  }
});
test('calendar follows Shanghai day, preserves existing Thino text and deduplicates',()=>{
  assert.equal(shanghaiClock(new Date('2026-10-06T18:30:00Z')).day,'2026-10-07');
  const original='---\ntitle: 日记\n---\n\n- 11:49 已有记录\n\t不要覆盖\n';
  const record=journalEntry({id:'test-1',kind:'reflection',mode:'auto',text:'一个反省\n- 新的一行\n```js\nconst x=1;\n```',date:new Date('2026-10-06T18:30:00Z')});
  const next=appendJournal(original,record);
  assert.ok(next.startsWith(original)); assert.ok(next.includes('\t- 新的一行')); assert.ok(next.includes('- 02:30 #注意力/记录'));
  assert.equal(appendJournal(next,record),next);
  assert.throws(()=>journalEntry({id:'x -->',text:'bad'}),/ID/);
});
test('a received reply stores user and AI separately with working Markdown code and deduplication',()=>{
  const activity={input:'我的想法\n第二行',mode:'focus',plan:{...plan,acknowledgement:'回应',resources:[{title:'CSS',query:'css color',reason:'练习'}]}};
  const text=conversationText(activity);
  assert.ok(text.includes('> [!quote] Me\n> 我的想法\n> 第二行'));
  assert.ok(text.includes('> [!tip] AI')); assert.ok(text.includes('> ```css\n> color: green;\n> ```'));
  assert.ok(text.includes('https://www.bing.com/search?q=css%20color'));
  const record=journalEntry({id:'reply-1',kind:'conversation',mode:'auto',text,date:new Date('2026-10-06T18:00:00Z')});
  assert.equal(record.day,'2026-10-07'); assert.ok(record.entry.includes('\n\n> [!quote] Me'));
  const saved=appendJournal('original\n',record); assert.ok(saved.startsWith('original\n'));
  assert.equal(appendJournal(saved,record),saved);
});
test('callout quoting keeps blank lines and headings inside the speaker block and redacts keys',()=>{
  const value=journalCallout('quote','Me','first\n\n# heading\ntp-abcdefghijklmnop');
  assert.ok(value.includes('> first\n> \n> # heading')); assert.ok(!value.includes('tp-abcdefghijklmnop'));
});
test('callout indentation repair touches only plugin-owned blocks and is idempotent',()=>{
  const manual='- 11:00 manual\n\t> [!quote] Me\n\tUser content\n';
  const owned='- 11:01 #注意力/对话\n\t> [!quote] Me\n\t> Original thought\n\t\n\t> [!tip] AI\n\t> Reply\n\t<!-- attention:a:conversation -->\n';
  const fixed=normalizeJournalCallouts(manual+owned);
  assert.ok(fixed.startsWith(manual)); assert.ok(fixed.includes('\n\n> [!quote] Me'));
  assert.ok(fixed.includes('> Original thought')); assert.ok(fixed.includes('> Reply'));
  assert.equal(normalizeJournalCallouts(fixed),fixed);
});
test('diary cards isolate one conversation and retain manual entries in chronological order',()=>{
  const diary='---\ntags: [diary]\n---\n# Today\n- 12:00 manual idea\n\tsecond line\n- 11:00 #注意力/对话\n\n> [!quote] Me\n> First\n\n> [!tip] AI\n> Answer\n<!-- attention:a:conversation -->\n';
  const cards=diaryCards(diary);
  assert.equal(cards.length,2);assert.equal(cards[0].body,'manual idea\nsecond line');
  assert.equal(cards[1].id,'a');assert.ok(cards[1].body.includes('> Answer'));assert.ok(!cards[1].body.includes('attention:'));
});
test('an image appended later remains inside its originating conversation card',()=>{
  const diary='- 11:00 #注意力/对话\n\n> [!quote] Me\n> First\n<!-- attention:a:conversation -->\n- 12:00 unrelated\n- 13:00 #注意力/输出\n\n> [!tip] AI · Image\n> ![[images/a.png]]\n<!-- attention:a-image:output -->\n';
  const cards=diaryCards(diary);
  assert.equal(cards.length,2);assert.equal(cards[0].time,'12:00');assert.equal(cards[1].id,'a');
  assert.ok(cards[1].body.includes('![[images/a.png]]'));assert.equal(cards[1].time,'11:00');
});
test('empty diaries and prose without timestamps are safe to browse',()=>{
  assert.deepEqual(diaryCards(''),[]);assert.deepEqual(diaryCards('---\ntype: diary\n---\n# Diary'),[]);
  assert.equal(diaryCards('An untimed journal paragraph')[0].body,'An untimed journal paragraph');
});
test('AI summary is marked as interpretation and malformed responses fail',async()=>{
  const result=await generateSummary({diary:'今天做了按钮',settings:DEFAULTS,key:'tp-test',request:async()=>({choices:[{message:{content:JSON.stringify({observations:['完成了按钮'],questions:['什么帮助了开始？'],nextStep:'改一个颜色'})}}]})});
  assert.ok(result.startsWith('AI 总结（待核对）')); assert.ok(result.includes('什么帮助了开始？'));
  await assert.rejects(generateSummary({diary:'x',settings:DEFAULTS,key:'tp-test',request:async()=>({choices:[{message:{content:'null'}}]})}),/有效观察/);
});
test('image generation uses an independent credential and validates actual image bytes',async()=>{
  const settings={...DEFAULTS,imageBaseUrl:'https://images.example.com/v1',imageModel:'example-image'};let called;
  const image=await generateImage({prompt:'一个角色',settings,key:'image-test',request:async(url,options)=>{called={url,...options};return {data:[{b64_json:Buffer.from([137,80,78,71,13,10,26,10,1,2]).toString('base64')}]};}});
  assert.equal(image.extension,'png'); assert.equal(called.url,'https://images.example.com/v1/images/generations');
  await assert.rejects(generateImage({prompt:'x',settings,key:'tp-never-leak'}),/不能发送/);
  await assert.rejects(generateImage({prompt:'x',settings,key:'image-test',request:async()=>({data:[{b64_json:Buffer.from('<script>').toString('base64')}]})}),/不支持|不是支持/);
});

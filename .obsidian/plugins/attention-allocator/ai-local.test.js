'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {aiReadable,journalEntry,journalCallout,diaryCards,buildMessages,DEFAULTS}=require('./core');

test('local-only records remain visible but are excluded from AI context with line offsets preserved',()=>{
  const record=journalEntry({id:'local-check',kind:'thought',mode:'auto',allowAI:false,text:journalCallout('quote','Me','Private output'),date:new Date('2026-10-07T01:00:00Z')});
  const original='Public text\n'+record.entry+'Public after\n';
  const readable=aiReadable(original);
  assert.ok(!readable.includes('Private output'));assert.ok(readable.includes('Public after'));
  assert.equal(readable.split('\n').length,original.split('\n').length);
  assert.ok(diaryCards(record.entry)[0].body.includes('Private output'));
  const messages=buildMessages('Hello',DEFAULTS,{recent:[],memories:[],notes:[{path:'calendar/x.md',content:original}]});
  assert.ok(!messages[1].content.includes('Private output'));
});

test('record-only submit bypasses keys, models, retrieval and memory, while preserving a newer draft',async()=>{
  const module={exports:{}};
  vm.runInNewContext(fs.readFileSync(require.resolve('./plugin'),'utf8')+'\nmodule.exports.TestView=AttentionView;',{
    module,require:name=>name==='obsidian'?{Plugin:class{},ItemView:class{},PluginSettingTab:class{},Modal:class{}}:require(name),
    clearTimeout,setTimeout,console,
  });
  const view=Object.create(module.exports.TestView.prototype);
  const unexpected=()=>{throw Error('AI service called during local-only submission');};
  let saved;
  view.plugin={settings:{aiEnabled:false},state:{draft:'Original'},persist:async()=>{},
    getKey:unexpected,generatePlan:unexpected,qmd:{search:unexpected},mem0:{search:unexpected},
    writeJournal:async value=>{saved=journalEntry(value);view.input.value='Next draft';}};
  view.input={value:'Original'};view.startButton={};view.aiSwitch={};view.renderToday=async()=>{};view.setStatus=()=>{};
  await view.submit();
  assert.ok(saved.entry.includes('Original'));assert.ok(!aiReadable(saved.entry).includes('Original'));
  assert.equal(view.input.value,'Next draft');assert.equal(view.plugin.state.draft,'Next draft');
  assert.equal(view.busy,false);assert.equal(view.startButton.disabled,false);
});

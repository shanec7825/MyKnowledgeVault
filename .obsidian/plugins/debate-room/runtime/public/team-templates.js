const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function teamPanel(state){
  return `<section class="team-templates"><label>已保存的辩手组合<select id="team-template"><option value="">选择组合…</option>${(state.data.teamTemplates||[]).map(t=>`<option value="${esc(t.id)}" ${state.selectedTeam===t.id?'selected':''}>${esc(t.name)} · ${t.agents.length} 人</option>`).join('')}</select></label><div class="form-actions"><button class="secondary" id="apply-team" type="button">使用组合</button><button class="secondary" id="swap-team" type="button">交换正反方</button><button class="secondary" id="delete-team" type="button">删除组合</button></div><label>保存当前搭配<input id="team-name" maxlength="60" placeholder="例如：逻辑与证据 · 4 人组合"></label><button class="secondary" id="save-team" type="button">保存为新组合</button><p class="hint">保存角色、立场和各自模型；选择后仍可增删角色、切换立场。密钥共用模型连接。</p></section>`;
}
export function bindTeams(state,{capture,render,toast,api}){
  const get=id=>document.getElementById(id);
  if(!get('team-template'))return;
  get('team-template').onchange=e=>{state.selectedTeam=e.target.value;};
  get('apply-team').onclick=()=>{
    const template=(state.data.teamTemplates||[]).find(t=>t.id===get('team-template').value);
    if(!template){toast('请先选择组合');return;}
    capture();state.selectedTeam=template.id;state.agents=template.agents.map(a=>({...a}));render();toast('已载入组合：'+template.name);
  };
  get('swap-team').onclick=()=>{capture();state.agents=state.agents.map(a=>({...a,side:a.side==='pro'?'con':'pro'}));render();};
  get('save-team').onclick=async()=>{
    const button=get('save-team'),name=get('team-name').value;capture();button.disabled=true;
    try{const template=await api('/api/team-templates',{name,agents:state.agents});state.data.teamTemplates??=[];state.data.teamTemplates.push(template);state.selectedTeam=template.id;render();toast('组合已保存');}
    catch(error){toast(error.message);button.disabled=false;}
  };
  get('delete-team').onclick=async()=>{
    const id=get('team-template').value;if(!id){toast('请先选择组合');return;}
    const button=get('delete-team');button.disabled=true;
    try{const response=await fetch('/api/team-templates/'+encodeURIComponent(id),{method:'DELETE'});const data=await response.json();if(!response.ok)throw new Error(data.error);capture();state.data.teamTemplates=state.data.teamTemplates.filter(t=>t.id!==id);state.selectedTeam='';render();toast('已删除保存的组合，当前搭配保留');}
    catch(error){toast(error.message);button.disabled=false;}
  };
}

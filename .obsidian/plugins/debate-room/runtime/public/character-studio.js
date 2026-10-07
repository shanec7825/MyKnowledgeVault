const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let query='',category='全部',region='全部';
export function resetCharacterFilters(){query='';category='全部';region='全部';}
export function characterOptions(list){
  return ['中国人物','外国人物','专业角色','自定义'].map(group=>{
    const members=list.filter(p=>(p.region||'自定义')===group);
    return members.length?`<optgroup label="${group}">${members.map(p=>`<option value="${esc(p.id)}">${esc(p.name)} · ${esc(p.tag||'自定义角色')}</option>`).join('')}</optgroup>`:'';
  }).join('');
}
function arranged(list){const chinese=list.filter(p=>p.region==='中国人物'),foreign=list.filter(p=>p.region==='外国人物'),out=[];for(let i=0;i<Math.max(chinese.length,foreign.length);i++){if(chinese[i])out.push(chinese[i]);if(foreign[i])out.push(foreign[i]);}return [...out,...list.filter(p=>!['中国人物','外国人物'].includes(p.region))];}
function cards(list){return arranged(list).filter(p=>(region==='全部'||(p.region||'自定义')===region)&&(category==='全部'||(p.category||'自定义角色')===category)&&`${p.name} ${p.tag} ${p.prompt}`.toLowerCase().includes(query.trim().toLowerCase())).map(p=>`<article class="role-card"><div class="role-card-head"><div class="avatar large">${esc(p.avatar)}</div><div><h3>${esc(p.name)}</h3><span class="role-origin">${esc(p.region||'自定义')} · ${esc(p.category||'角色')}</span></div></div><span class="role-tag">${esc(p.tag)}</span><p>${esc(p.prompt.replace(/^思想风格模拟：/,'').replace(/ 不冒充本人.*$/,''))}</p><details><summary>完整设定</summary><p>${esc(p.prompt)}</p></details></article>`).join('')||'<div class="empty"><h2>没有匹配的角色</h2><p>更换筛选条件或清空搜索。</p></div>';}
export function characterStudio(list){
  const categories=['全部',...new Set(list.map(p=>p.category||'自定义角色'))];
  return `<div class="page-heading"><div><h1>人物预设</h1><p>${list.length} 个角色。人物为思想风格模拟，不代表本人观点。</p></div><button class="secondary" data-nav="coach">辩论训练</button></div><div class="region-tabs" role="group" aria-label="人物范围">${['全部','中国人物','外国人物','专业角色','自定义'].map(r=>`<button data-region="${r}" aria-pressed="${r===region}" class="${r===region?'active':''}">${r}<small>${r==='全部'?list.length:list.filter(p=>(p.region||'自定义')===r).length}</small></button>`).join('')}</div><div class="role-tools"><div class="search-bar"><input id="character-search" aria-label="搜索人物角色" value="${esc(query)}" placeholder="搜索姓名或思想风格"></div><select id="character-category" aria-label="筛选人物类别">${categories.map(c=>`<option ${c===category?'selected':''}>${esc(c)}</option>`).join('')}</select></div><div class="roles-grid" id="role-cards">${cards(list)}</div><section class="form-card"><h2>自定义角色</h2><form id="role-form"><div class="form-grid"><label>名称<input name="name" required maxlength="60" placeholder="角色名称"></label><label>思考方式与表达风格<textarea name="prompt" required maxlength="2000" rows="3" placeholder="关注的问题、论证方法和表达风格"></textarea></label></div><button class="primary" type="submit">保存角色 ＋</button></form></section>`;
}
export function bindCharacterStudio(list){
  const search=document.querySelector('#character-search'),select=document.querySelector('#character-category');
  if(!search)return;
  document.querySelectorAll('[data-region]').forEach(b=>b.onclick=()=>{region=b.dataset.region;category='全部';select.value='全部';document.querySelectorAll('[data-region]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));});document.querySelector('#role-cards').innerHTML=cards(list);});
  search.oninput=()=>{query=search.value;document.querySelector('#role-cards').innerHTML=cards(list);};
  select.onchange=()=>{category=select.value;document.querySelector('#role-cards').innerHTML=cards(list);};
}

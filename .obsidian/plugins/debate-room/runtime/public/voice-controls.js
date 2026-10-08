const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mimoVoices={'苏打':'苏打 · 男声','白桦':'白桦 · 男声','冰糖':'冰糖 · 女声','茉莉':'茉莉 · 女声','Milo':'Milo · 男声','Dean':'Dean · 男声','Mia':'Mia · 女声','Chloe':'Chloe · 女声'};
export function voiceSettings(settings,names,enabled){
  const s=settings||{};
  const options=(voices,value,english,mimo=false)=>Object.entries(voices||{}).filter(([id])=>mimo?(/^[A-Za-z]+$/.test(id)===english):id.startsWith(english?'en-':'zh-')).map(([id,name])=>`<option value="${esc(id)}" ${id===value?'selected':''}>${esc(name)}</option>`).join('');
  const selector=(name,label,voices,value,english,mimo)=>`<label>${label}<select name="${name}">${options(voices,value,english,mimo)}</select></label>`;
  const select=(name,label,choices,value)=>`<label>${label}<select name="${name}">${choices.map(([id,title])=>`<option value="${id}" ${id===String(value)?'selected':''}>${title}</option>`).join('')}</select></label>`;
  const textarea=(name,label,fallback)=>`<label>${label}<textarea name="${name}" maxlength="1000" rows="3">${esc(s[name]??fallback)}</textarea></label>`;
  return `<section class="form-card settings-card voice-settings"><h2>语音朗读</h2>
    <p class="hint">小米预置音色支持边生成边播放。长发言按句分段，跳过 Markdown 标记、代码块和引用编号。暂停、继续、停止和重试可在浮动播放器操作。</p>
    <form id="voice-form"><fieldset ${enabled?'':'disabled'}><div class="form-grid">
      ${select('provider','语音模式',[['mimo','小米 MiMo 语音'],['edge','Edge 神经语音'],['system','系统朗读']],s.provider||'mimo')}
      ${select('rate','播放倍速 / 系统语速',[0.7,0.8,0.9,1,1.1,1.2,1.3,1.5].map(n=>[String(n),n+' 倍']),s.rate||1)}
    </div><h3>小米连接</h3><div class="form-grid">
      <input type="hidden" name="reuseModelConnection" value="true">
      ${select('mimoModel','音色模式',[['mimo-v2.5-tts','预置音色 · 支持低延迟'],['mimo-v2.5-tts-voicedesign','文本设计音色 · 分段合成']],s.mimoModel||'mimo-v2.5-tts')}
      ${select('mimoStreaming','预置音色播放方式',[['true','流式 · 边生成边播放'],['false','分段 · 每段完成后播放']],s.mimoStreaming!==false)}
    </div><p class="hint">辩手与语音共用模型设置中的 MiMo Token Plan 密钥和套餐集群地址，只需填写一次。密钥仅在服务内存，重启需重新填写。朗读正文发送到该小米服务。</p>
    <h3>双方音色与表达</h3><div class="form-grid">
      ${selector('mimoProVoice','预置中文正方',mimoVoices,s.mimoProVoice||'苏打',false,true)}
      ${selector('mimoConVoice','预置中文反方',mimoVoices,s.mimoConVoice||'茉莉',false,true)}
      ${selector('mimoEnProVoice','预置英文正方',mimoVoices,s.mimoEnProVoice||'Milo',true,true)}
      ${selector('mimoEnConVoice','预置英文反方',mimoVoices,s.mimoEnConVoice||'Chloe',true,true)}
      ${textarea('mimoProStyle','正方表达风格','沉稳有力，强调关键理由，克制而清晰。')}
      ${textarea('mimoConStyle','反方表达风格','冷静敏锐，在转折和反例处自然停顿。')}
    </div><details id="mimo-voice-design" ${s.mimoModel==='mimo-v2.5-tts-voicedesign'?'open':''}><summary>文本设计音色描述（仅设计模式使用）</summary><div class="form-grid">
      ${textarea('mimoProDesign','正方设计音色','成年男声，温暖醇厚、吐字清晰，适合严谨的辩论表达。')}
      ${textarea('mimoConDesign','反方设计音色','成年女声，清亮沉稳、吐字清晰，适合分析论证和提出反例。')}
    </div><p class="hint">描述性别、质感和表达特点，建议 1–4 句。设计模式不会使用预置音色，按段等待合成完成后播放。保持正文不润色，不提供真人音色克隆。</p></details>
    <details><summary>Edge 音色（仅 Edge 模式使用）</summary><div class="form-grid">
      ${selector('proVoice','Edge 中文正方',names,s.proVoice,false)}${selector('conVoice','Edge 中文反方',names,s.conVoice,false)}
      ${selector('enProVoice','Edge 英文正方',names,s.enProVoice,true)}${selector('enConVoice','Edge 英文反方',names,s.enConVoice,true)}
    </div><p class="hint">Edge 需要 Python 与 edge-tts，正文发送给微软。小米倍速在本地播放器执行，Edge 与系统语速由对应引擎控制。</p></details>
    <div class="form-actions"><button class="primary" type="submit">保存语音</button>${[['pro','试听中文正方'],['con','试听中文反方'],['en-pro','试听英文正方'],['en-con','试听英文反方']].map(([v,label])=>`<button class="secondary" type="button" data-voice-preview="${v}">${label}</button>`).join('')}<button class="secondary" type="button" id="stop-preview">停止</button></div><p class="hint">试听使用已保存的设置；倍速与风格更改后保存，再重试朗读。</p></fieldset></form></section>`;
}

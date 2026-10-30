/* Shared lesson enhancements. React nav when React is available; accessible DOM fallback offline. */
(function(){
"use strict";
var labels=[["listening","Listening"],["reading","Reading"],["active","Language"],["speaking","Speaking"],["writing","Writing"],["review","Review"]];
var icons={
 listening:'<path d="M3 14v-3a9 9 0 0 1 18 0v3"/><rect x="2" y="13" width="4" height="8" rx="2"/><rect x="18" y="13" width="4" height="8" rx="2"/>',
 reading:'<path d="M12 7c-3-2-7-2-10-1v14c4-1 8-.5 10 1 2-1.5 6-2 10-1V6c-3-1-7-1-10 1z"/><path d="M12 7v14"/>',
 active:'<path d="m13 2-3 8 8 3-8 3 3 8"/><path d="M2 12h9M19 3l3 3m-3 0 3-3"/>',
 speaking:'<path d="M21 11.5a8 8 0 0 1-8 8H7l-4 3v-7a8 8 0 1 1 18-4z"/><path d="M8 11h8m-8 4h5"/>',
 writing:'<path d="m16 4 4 4-12 12-5 1 1-5z"/><path d="m14 6 4 4M3 3h8"/>',
 review:'<path d="M20 11a8 8 0 1 1-2.1-5.4"/><path d="M20 3v6h-6"/><path d="M9 12l2 2 4-4"/>'
};
function svg(k){return '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+icons[k]+'</svg>'}
function keyOf(t){t=(t||"").toLowerCase();if(t.includes("listening"))return"listening";if(t.includes("reading"))return"reading";if(t.includes("active")||t.includes("expression"))return"active";if(t.includes("speaking"))return"speaking";if(t.includes("writing"))return"writing";if(t.includes("review")||t.includes("retrieval"))return"review";return null}
function start(){var main=document.querySelector("main");if(!main||main.dataset.lessonEnhanced)return;main.dataset.lessonEnhanced="1";
var targets={};main.querySelectorAll("h2").forEach(function(h){var k=keyOf(h.textContent);if(!k)return;var s=h.closest("section")||h.parentElement;if(!s.id)s.id=k;if(!targets[k])targets[k]=s.id;var ico=document.createElement("span");ico.className="lesson-section-icon";ico.innerHTML=svg(k);h.insertBefore(ico,h.firstChild)});
var available=labels.filter(function(pair){return targets[pair[0]]});if(!available.length)return;
var mount=document.createElement("nav");mount.className="lesson-icon-nav";mount.setAttribute("aria-label","Lesson sections");var anchor=main.querySelector(".lesson-art")||main.querySelector("header")||main.querySelector("h1");if(anchor)anchor.insertAdjacentElement("afterend",mount);else main.prepend(mount);
function jump(k){var el=document.getElementById(targets[k]);if(el)el.scrollIntoView({behavior:"smooth",block:"start"})}
function fallback(){mount.innerHTML=available.map(function(p){return '<button type="button" data-go="'+p[0]+'" aria-label="'+p[1]+'" title="'+p[1]+'">'+svg(p[0])+'<span>'+p[1]+'</span></button>'}).join("");mount.addEventListener("click",function(e){var b=e.target.closest("button[data-go]");if(b)jump(b.dataset.go)})}
if(window.React&&window.ReactDOM&&window.ReactDOM.createRoot){try{
var R=window.React;var Nav=function(){return R.createElement(R.Fragment,null,available.map(function(p){return R.createElement("button",{key:p[0],type:"button",title:p[1],"aria-label":p[1],onClick:function(){jump(p[0])}},R.createElement("span",{dangerouslySetInnerHTML:{__html:svg(p[0])}}),R.createElement("span",null,p[1]))}))};window.ReactDOM.createRoot(mount).render(R.createElement(Nav));
}catch(err){fallback()}}else fallback();
var w=main.querySelector("#writing")||available.some(function(x){return x[0]==="writing"})&&document.getElementById(targets.writing);if(w){var t=w.querySelector("textarea");if(t&&!w.querySelector(".lesson-retrieval")){var wrap=document.createElement("div");wrap.className="lesson-retrieval";var count=document.createElement("span");count.className="lesson-note";wrap.appendChild(count);t.insertAdjacentElement("afterend",wrap);var key="lesson-draft:"+location.pathname;var exists=t.value.trim();if(!exists){try{t.value=localStorage.getItem(key)||""}catch(e){}}function update(){var n=(t.value.trim().match(/\b[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*\b/gu)||[]).length;count.textContent=n+" / 80–120 words"+(n>=80&&n<=120?" ✓":"");try{localStorage.setItem(key,t.value)}catch(e){}}t.addEventListener("input",update);update()}}
var r=main.querySelector("#reading")||document.getElementById(targets.reading);if(r&&r.querySelector(".flow,.concept,.diagram,.nodes")){var d=r.querySelector(".flow,.concept,.diagram,.nodes");if(d&&!d.dataset.hideControl){d.dataset.hideControl="yes";var b=document.createElement("button");b.type="button";b.textContent="Hide / reveal concept map";b.setAttribute("aria-pressed","false");b.addEventListener("click",function(){var hidden=d.classList.toggle("lesson-hidden-cue");b.setAttribute("aria-pressed",String(hidden))});d.insertAdjacentElement("afterend",b)}}
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();
export function spokenText(value){
  return String(value??'')
    .replace(/```[^\n]*\n?[\s\S]*?```/g,'\n（代码略）\n')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>/gi,'')
    .replace(/<\/?[a-z][^>]*>/gi,'')
    .replace(/\[S-[^\]]+\]/g,'')
    .replace(/!\[[^\]]*\]\([^)]*\)/g,'')
    .replace(/\[([^\]]+)\]\([^)]*\)/g,'$1')
    .replace(/https?:\/\/[^\s<>。，！？；]+/g,'')
    .replace(/^\s*(?:#{1,6}\s+|>\s*|[-*+]\s+|\d+[.)]\s+)/gm,'')
    .replace(/[`*_~]/g,'')
    .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'")
    .replace(/\r\n?/g,'\n').replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim();
}
export function speechSegments(value,maximum=700){
  if(!Number.isInteger(maximum)||maximum<40||maximum>6000)throw new Error('朗读分段长度无效');
  let remaining=spokenText(value);const segments=[];
  while(remaining.length>maximum){
    const window=remaining.slice(0,maximum);let cut=0;
    for(const match of window.matchAll(/[。！？!?；;\n]|[.](?=\s)|\s/g))if(match.index>=maximum/3)cut=match.index+1;
    if(!cut)cut=maximum;
    if(/[\uD800-\uDBFF]/.test(remaining[cut-1]))cut--;
    const segment=remaining.slice(0,cut).trim();if(segment)segments.push(segment);
    remaining=remaining.slice(cut).trim();
  }
  if(remaining)segments.push(remaining);return segments;
}

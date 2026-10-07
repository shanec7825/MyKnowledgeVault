// Tiny shared markdown-ish renderer for agent speech bodies.
// Escapes HTML first, then applies a narrow, safe subset of formatting.
// The result is inserted with innerHTML, so nothing here may emit raw user text.


// Neutralize dangerous URI schemes in ANY text we emit. Model output can contain
// raw "javascript:" or "data:" strings; they must never reach the DOM verbatim.
function sanitize(text){
  return String(text).replace(/(javascript|vbscript|data)\s*:/gi, (m, scheme) => scheme.toLowerCase() + ' :');
}
const esc = s => sanitize(String(s ?? '')).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Citation tokens are replaced after escaping, so the link markup is the only
// HTML we generate. Unknown ids stay as plain text.
function linkCitations(text, sources) {
  return text.replace(/\[S-[a-f0-9]{8}\]/gi, token => {
    const s = (sources || []).find(x => `[${x.id}]`.toLowerCase() === token.toLowerCase());
    return s ? `<a class="citation" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${token}</a>` : token;
  });
}

function inline(text) {
  return esc(text)
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/~~([^~\n]+)~~/g, '<del>$1</del>');
}

// Detect whether a body actually uses markdown, so plain prose keeps its
// existing single-paragraph look and markdown output becomes blocks.
export function looksLikeMarkdown(text) {
  return /^#{1,6}\s|\n#{1,6}\s|\n\s*[-*+]\s|\n\s*\d+\.\s|\n>\s|\n```|\n---\s*$|\n\|.+\|/m.test(String(text ?? ''));
}

export function renderSpeech(content, sources) {
  const raw = String(content ?? '');
  if (!looksLikeMarkdown(raw)) {
    return linkCitations(inline(raw), sources).replace(/\n/g, '<br>');
  }
  const lines = raw.replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let para = [], list = null, code = null;

  const flushPara = () => {
    if (!para.length) return;
    out.push(`<p>${linkCitations(inline(para.join('\n')).replace(/\n/g, '<br>'), sources)}</p>`);
    para = [];
  };
  const flushList = () => {
    if (!list) return;
    out.push(`<${list.tag}>${list.items.map(i => `<li>${linkCitations(inline(i), sources)}</li>`).join('')}</${list.tag}>`);
    list = null;
  };
  const flush = () => { flushPara(); flushList(); };

  for (const line of lines) {
    if (code !== null) {
      if (/^```/.test(line)) { out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`); code = null; }
      else code.push(line);
      continue;
    }
    if (/^```/.test(line)) { flush(); code = []; continue; }

    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { flush(); const n = h[1].length; out.push(`<h${n + 3}>${linkCitations(inline(h[2]), sources)}</h${n + 3}>`); continue; }

    if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) { flush(); out.push('<hr>'); continue; }

    const bq = line.match(/^\s*>\s?(.*)$/);
    if (bq) {
      flushPara();
      if (list) flushList();
      out.push(`<blockquote><p>${linkCitations(inline(bq[1]), sources)}</p></blockquote>`);
      continue;
    }

    const li = line.match(/^\s*([-*+]|\d+[.)])\s+(.*)$/);
    if (li) {
      flushPara();
      const tag = /\d/.test(li[1]) ? 'ol' : 'ul';
      if (list && list.tag !== tag) flushList();
      if (!list) list = { tag, items: [] };
      list.items.push(li[2]);
      continue;
    }

    if (!line.trim()) { flush(); continue; }
    para.push(line);
  }
  if (code !== null) out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`);
  flush();
  return out.join('');
}

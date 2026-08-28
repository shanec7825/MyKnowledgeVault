#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""为每个领域生成同名 HTML 科普手册：wiki/areas/<领域>.html

内容 = 领域概览 + 学习进度（已知/未知）+ 进行中项目 + 已完结项目 + 相关图示。
数据源：wiki/areas/*.md、wiki/projects/、wiki/archives/、Excalidraw/ 的 frontmatter
与目录扫描。可重复运行。每领域一套主题色与图形母题。

用法：python scripts/gen-area-html.py
"""
import io
import os
import re
import glob
import datetime
import html as H

VAULT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
AREAS = os.path.join(VAULT, "wiki", "areas")
PROJECTS = os.path.join(VAULT, "wiki", "projects")
ARCHIVES = os.path.join(VAULT, "wiki", "archives")
DRAWINGS = os.path.join(VAULT, "Excalidraw")
IMG_EXT = (".svg", ".png", ".jpg", ".jpeg", ".webp")

THEMES = {
    "后端": {"accent": "#185FA5", "soft": "#E6F1FB", "ink": "#0C447C", "motif": "network"},
    "人工智能": {"accent": "#534AB7", "soft": "#EEEDFE", "ink": "#3C3489", "motif": "neural"},
    "神经与认知科学": {"accent": "#0F6E56", "soft": "#E1F5EE", "ink": "#085041", "motif": "neuron"},
}
DEFAULT_THEME = {"accent": "#5F5E5A", "soft": "#F1EFE8", "ink": "#2C2C2A", "motif": "nodes"}


def read(path):
    return io.open(path, "r", encoding="utf-8").read()


def parse_fm(path):
    text = read(path)
    meta, body = {}, text
    if text.startswith("---\n"):
        e = text.find("\n---\n", 4)
        if e != -1:
            lines = text[4:e].split("\n")
            i = 0
            while i < len(lines):
                m = re.match(r"^([\w\-]+):\s*(.*)$", lines[i])
                if not m:
                    i += 1
                    continue
                key, val = m.group(1), m.group(2).strip()
                items = []
                j = i + 1
                while j < len(lines) and lines[j].startswith("  - "):
                    items.append(lines[j][4:].strip().strip('"'))
                    j += 1
                meta[key] = items if items else val.strip('"')
                i = j if items else i + 1
            body = text[e + 5:]
    return meta, body


def section(body, title, level=2):
    marker = "#" * level + " " + title
    start = body.find(marker)
    if start == -1:
        return ""
    start += len(marker)
    rest = body[start:]
    nxt = re.search(r"\n#{1,%d} " % level, rest)
    return rest[: nxt.start()] if nxt else rest


def sub_section(body, title, level=3):
    return section(body, title, level)


def esc(s):
    return H.escape(s or "", quote=True)


def inline(s):
    s = re.sub(r"\[\[([^\]|]+)\|([^\]]+)\]\]", r"\2", s)
    s = re.sub(r"\[\[([^\]]+)\]\]", r"\1", s)
    s = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"`([^`]+)`", r"<code>\1</code>", s)
    return s


def parse_overview(body):
    """领域概览 → [(label, text)]，保持原文顺序。"""
    sec = section(body, "领域概览").strip()
    out, cur_label, cur_buf = [], None, []
    for line in sec.split("\n"):
        m = re.match(r"^\*\*(.+?)\*\*[：:]\s*(.*)$", line.strip())
        if m:
            if cur_label:
                out.append((cur_label, " ".join(x.strip() for x in cur_buf if x.strip())))
            cur_label, cur_buf = m.group(1), [m.group(2)]
        elif cur_label:
            cur_buf.append(line)
    if cur_label:
        out.append((cur_label, " ".join(x.strip() for x in cur_buf if x.strip())))
    return out


def parse_known_unknown(body):
    """进展概览 → (known[(term, desc)], unknown[str])"""
    prog = section(body, "进展概览")
    known_sec = sub_section(prog, "已知")
    unknown_sec = sub_section(prog, "未知")
    known = []
    for line in known_sec.split("\n"):
        s = line.strip()
        m = re.match(r"^-\s+\*\*(.+?)\*\*\s*[—-]\s*(.*)$", s)
        if m:
            known.append((m.group(1), m.group(2)))
            continue
        m = re.match(r"^-\s+(.+)$", s)
        if m and not m.group(1).startswith("["):
            known.append(("", m.group(1)))
    unknown = []
    for line in unknown_sec.split("\n"):
        s = line.strip()
        m = re.match(r"^-\s+\[.\]\s*(.*)$", s)
        if m:
            unknown.append(m.group(1))
    return known, unknown


def collect_projects(area):
    out = []
    for p in glob.glob(os.path.join(PROJECTS, "*.md")):
        meta, _ = parse_fm(p)
        if meta.get("type") != "project" or meta.get("area") != area:
            continue
        if meta.get("status") == "completed":
            continue
        out.append({
            "title": meta.get("title", os.path.basename(p)[:-3]),
            "goal": meta.get("goal") or meta.get("description", ""),
            "status": meta.get("status", "active"),
            "updated": meta.get("updated", ""),
            "complexity": meta.get("complexity", ""),
            "code": meta.get("code", []) if isinstance(meta.get("code"), list) else [],
        })
    out.sort(key=lambda x: x["updated"], reverse=True)
    return out


def collect_archived(area):
    out = []
    for p in glob.glob(os.path.join(ARCHIVES, "**", "*.md"), recursive=True):
        meta, body = parse_fm(p)
        if meta.get("type") != "project" or meta.get("area") != area:
            continue
        summary = section(body, "归档小结").strip()
        out.append({
            "title": meta.get("title", os.path.basename(p)[:-3]),
            "goal": meta.get("goal") or meta.get("description", ""),
            "updated": meta.get("updated", ""),
            "code": meta.get("code", []) if isinstance(meta.get("code"), list) else [],
            "summary": md_html(summary) if summary else "",
        })
    out.sort(key=lambda x: x["updated"], reverse=True)
    return out


def collect_drawings():
    out = []
    for p in sorted(glob.glob(os.path.join(DRAWINGS, "*.excalidraw.md"))):
        stem = p[: -len(".excalidraw.md")]
        name = os.path.basename(stem)
        img = next((stem + e for e in IMG_EXT if os.path.exists(stem + e)), None)
        out.append({
            "name": name,
            "img": ("../../" + os.path.relpath(img, VAULT).replace("\\", "/")) if img else None,
        })
    return out


def md_html(text):
    text = re.sub(r"\[\[([^\]|]+)\|([^\]]+)\]\]", r"\2", text)
    text = re.sub(r"\[\[([^\]]+)\]\]", r"\1", text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", text)
    lines = text.split("\n")
    out, mode, buf = [], None, []
    for line in lines:
        s = line.strip()
        if not s:
            if buf:
                out.append((mode, list(buf)))
                buf = []
            mode = None
            continue
        m = re.match(r"^-\s+\[.\]\s*(.*)$", s)
        n = re.match(r"^-\s+(.*)$", s)
        want = "check" if m else ("ul" if n else "p")
        if want != mode and buf:
            out.append((mode, list(buf)))
            buf = []
        mode = want
        buf.append(m.group(1) if m else n.group(1) if n else s)
    if buf:
        out.append((mode, buf))
    html = []
    for mode, items in out:
        if mode == "ul":
            html.append("<ul>" + "".join("<li>%s</li>" % inline(x) for x in items) + "</ul>")
        elif mode == "check":
            html.append('<ul class="checks">' + "".join(
                '<li><span class="box"></span>%s</li>' % inline(x) for x in items) + "</ul>")
        else:
            html.append("<p>%s</p>" % "<br>".join(inline(x) for x in items))
    return "\n".join(html)


def motif_svg(kind, color):
    c = color
    if kind == "network":
        return """<svg viewBox="0 0 200 140" fill="none" stroke="%s" stroke-width="1.6">
<circle cx="28" cy="34" r="9"/><circle cx="28" cy="106" r="9"/>
<rect x="88" y="52" width="46" height="36" rx="6"/>
<ellipse cx="164" cy="52" rx="22" ry="7"/>
<path d="M164 59v34a22 7 0 0 0 44 0" stroke-width="1.2"/>
<path d="M164 93v14M164 107c0 4 44 4 44 0"/>
<path d="M37 34h26v36h25M37 106h26V70h25"/>
<path d="M134 70h8" stroke-dasharray="3 3"/>
<circle cx="28" cy="70" r="4" stroke-dasharray="2 2"/>
</svg>""" % c
    if kind == "neural":
        nodes = ""
        cols = [(30, [20, 50, 80, 110]), (100, [14, 42, 70, 98, 126]), (170, [35, 70, 105])]
        for cx, ys in cols:
            for cy in ys:
                nodes += '<circle cx="%d" cy="%d" r="5"/>' % (cx, cy)
        links = ""
        for y1 in cols[0][1]:
            for y2 in cols[1][1]:
                links += '<path d="M35 %d L95 %d" stroke-width="0.7" opacity="0.45"/>' % (y1, y2)
        for y2 in cols[1][1]:
            for y3 in cols[2][1]:
                links += '<path d="M105 %d L165 %d" stroke-width="0.7" opacity="0.45"/>' % (y2, y3)
        return '<svg viewBox="0 0 200 140" fill="none" stroke="%s">%s%s</svg>' % (c, links, nodes)
    if kind == "neuron":
        return """<svg viewBox="0 0 200 140" fill="none" stroke="%s" stroke-width="1.6">
<circle cx="70" cy="70" r="16"/>
<path d="M58 58 C40 40 30 34 14 30M58 82 C40 96 28 104 12 108M70 54 C70 38 66 26 58 14M82 56 C92 40 104 32 118 28"/>
<path d="M86 70 H126 C140 70 142 62 154 62 C168 62 168 78 154 78 C146 78 142 74 134 74"/>
<circle cx="120" cy="46" r="3" stroke-dasharray="2 2"/>
<circle cx="112" cy="98" r="3" stroke-dasharray="2 2"/>
</svg>""" % c
    return """<svg viewBox="0 0 200 140" fill="none" stroke="%s" stroke-width="1.6">
<circle cx="40" cy="40" r="10"/><circle cx="160" cy="100" r="10"/>
<rect x="90" y="60" width="34" height="34" rx="6"/>
<path d="M50 44 L90 66M124 66 L152 96" stroke-dasharray="4 3"/>
</svg>""" % c


CSS_TMPL = """
:root{--accent:%(accent)s;--soft:%(soft)s;--ink:%(accent-ink)s;
  --text:#2c2c2a;--muted:#6b6a65;--line:#e6e4dc;--bg:#faf9f5;--card:#ffffff}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font:15px/1.75 system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif}
main{max-width:960px;margin:0 auto;padding:0 28px 80px}
.hero{position:relative;padding:56px 0 30px;border-bottom:1px solid var(--line)}
.hero .grid-bg{position:absolute;inset:0;pointer-events:none;
  background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);
  background-size:44px 44px;opacity:.35;mask-image:linear-gradient(#000 55%%,transparent)}
.hero-inner{position:relative;display:flex;justify-content:space-between;align-items:flex-end;gap:24px}
.kicker{font-size:12px;letter-spacing:.28em;color:var(--accent);font-weight:600;margin-bottom:14px}
h1{font-family:"Noto Serif SC","Source Han Serif SC",Georgia,serif;font-size:46px;line-height:1.15;
  font-weight:600;color:var(--text);margin-bottom:12px}
h1 .dot{color:var(--accent)}
.tagline{max-width:560px;color:var(--muted);font-size:15px}
.stats{display:flex;gap:10px;margin-top:20px;flex-wrap:wrap}
.stat{background:var(--card);border:1px solid var(--line);border-radius:999px;padding:5px 14px;font-size:12.5px;color:var(--muted)}
.stat b{color:var(--accent);font-weight:600}
.motif{width:190px;flex:none;opacity:.9}
.motif svg{width:100%%;height:auto;display:block}
section{margin-top:44px}
.sec-head{display:flex;align-items:baseline;gap:14px;margin-bottom:18px}
.sec-no{font-family:Georgia,serif;font-size:30px;color:var(--accent);font-weight:600;opacity:.9}
.sec-title{font-family:"Noto Serif SC","Source Han Serif SC",Georgia,serif;font-size:21px;font-weight:600}
.sec-rule{flex:1;border-bottom:1px solid var(--line);transform:translateY(-6px)}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:22px 26px}
.ov-item{display:grid;grid-template-columns:88px 1fr;gap:16px;padding:13px 0;border-bottom:1px dashed var(--line)}
.ov-item:last-child{border-bottom:none}
.ov-label{color:var(--accent);font-weight:600;font-size:14px}
.ov-body{font-size:14.5px}
.ov-body p+p{margin-top:8px}
.bar-wrap{margin:6px 0 22px}
.bar-cap{display:flex;justify-content:space-between;font-size:13px;color:var(--muted);margin-bottom:8px}
.bar{height:14px;border-radius:999px;background:var(--soft);overflow:hidden;display:flex}
.bar .known{background:var(--accent);height:100%%}
.duo{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media (max-width:720px){.duo{grid-template-columns:1fr}.hero-inner{flex-direction:column;align-items:flex-start}}
.panel{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px 22px}
.panel h3{font-size:13px;letter-spacing:.18em;color:var(--accent);font-weight:600;margin-bottom:12px}
.panel ul{list-style:none}
.panel li{padding:9px 0;border-bottom:1px dashed var(--line);font-size:14px}
.panel li:last-child{border-bottom:none}
.panel li b{color:var(--text)}
.panel li .d{color:var(--muted)}
.panel li .term{color:var(--accent-ink,var(--ink));}
.checks .box{display:inline-block;width:13px;height:13px;border:1.6px solid var(--accent);
  border-radius:4px;margin-right:9px;vertical-align:-2px;opacity:.85}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px}
.pcard{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--accent);
  border-radius:12px;padding:18px 20px;display:flex;flex-direction:column;gap:10px}
.pcard h4{font-size:16px;font-weight:600}
.pcard .goal{font-size:13.5px;color:var(--muted)}
.pcard .meta{display:flex;gap:8px;flex-wrap:wrap;margin-top:auto}
.pill{font-size:11.5px;padding:2px 10px;border-radius:999px;background:var(--soft);color:var(--ink)}
.pill.done{background:#EAF3DE;color:#3B6D11}
.pcard code{background:var(--bg);padding:1px 7px;border-radius:5px;font-size:12px}
.empty{border:1.5px dashed var(--line);border-radius:14px;padding:26px;text-align:center;color:var(--muted);font-size:14px}
.arch{margin-bottom:14px}
.arch .sum{margin-top:10px;padding-top:10px;border-top:1px dashed var(--line);font-size:13.5px;color:var(--muted)}
.gal{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px}
.fig{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px;text-align:center}
.fig img{width:100%%;border-radius:8px}
.fig .ph{height:90px;display:flex;align-items:center;justify-content:center;color:var(--accent);opacity:.5}
.fig .ph svg{width:54px;height:54px}
.fig .n{font-size:12.5px;color:var(--muted);margin-top:8px;word-break:break-all}
footer{margin-top:56px;padding-top:18px;border-top:1px solid var(--line);color:var(--muted);font-size:12px}
code{font-family:ui-monospace,Consolas,monospace}
"""


def build(area, meta, body, active, archived, drawings):
    th = THEMES.get(area, DEFAULT_THEME)
    overview = parse_overview(body)
    known, unknown = parse_known_unknown(body)
    kn, un = len(known), len(unknown)
    pct = int(kn * 100 / (kn + un)) if (kn + un) else 0

    ov_html = "".join(
        '<div class="ov-item"><div class="ov-label">%s</div><div class="ov-body">%s</div></div>'
        % (esc(label), md_html(txt) or "—")
        for label, txt in overview
    ) or '<div class="ov-item"><div class="ov-body">（源 md 缺少「## 领域概览」）</div></div>'

    bar = ('<div class="bar-wrap"><div class="bar-cap"><span>已掌握 <b>%d</b> 项 · 待探索 <b>%d</b> 项</span>'
           '<span>%d%%</span></div><div class="bar"><div class="known" style="width:%d%%"></div></div></div>'
           % (kn, un, pct, pct))
    known_html = "".join(
        "<li>%s%s</li>" % (('<span class="term">%s</span> — ' % esc(t)) if t else "",
                           '<span class="d">%s</span>' % inline(d))
        for t, d in known) or "<li>—</li>"
    unknown_html = "".join('<li><span class="box"></span>%s</li>' % inline(u) for u in unknown) or "<li>—</li>"

    if active:
        acards = "".join(
            '<div class="pcard"><h4>%s</h4><div class="goal">%s</div><div class="meta">'
            '<span class="pill">%s</span>%s<span class="pill">%s</span></div></div>'
            % (esc(a["title"]), esc(a["goal"]), esc(a["status"]),
               ("<span class='pill'>%s</span>" % esc(a["complexity"])) if a["complexity"] else "",
               esc(a["updated"]))
            for a in active)
    else:
        acards = '<div class="empty">该领域暂无进行中的项目。</div>'

    if archived:
        acards_done = "".join(
            '<div class="pcard arch"><h4>%s</h4><div class="goal">%s</div>'
            '<div class="meta"><span class="pill done">completed</span><span class="pill">%s</span>%s</div>%s</div>'
            % (esc(a["title"]), esc(a["goal"]), esc(a["updated"]),
               ("".join("<span class='pill'><code>%s</code></span>" % esc(c) for c in a["code"])),
               ('<div class="sum">%s</div>' % a["summary"]) if a["summary"] else "")
            for a in archived)
    else:
        acards_done = ('<div class="empty">暂无已完结项目。完成第一个项目并归档后，'
                       '它会以「成果」的身份出现在这里。</div>')

    if drawings:
        figs = []
        for d in drawings:
            if d["img"]:
                inner = '<img src="%s" alt="%s">' % (d["img"], esc(d["name"]))
            else:
                inner = ('<div class="ph"><svg viewBox="0 0 24 24" fill="none" stroke="%s" stroke-width="1.5">'
                         '<rect x="3" y="3" width="18" height="18" rx="3"/>'
                         '<path d="M3 15l5-5 4 4 3-3 6 6"/><circle cx="9" cy="8" r="1.6"/></svg></div>' % th["accent"])
            figs.append('<div class="fig">%s<div class="n">%s</div></div>' % (inner, esc(d["name"])))
        fig_html = ('<div class="gal">%s</div><p style="margin-top:12px;font-size:12.5px;color:var(--muted)">'
                    '把 Excalidraw 绘图导出为 PNG / SVG 并放在同目录同名文件，刷新本页即可自动嵌入。</p>' % "".join(figs))
    else:
        fig_html = '<div class="empty">Excalidraw 目录暂无绘图。</div>'

    tagline = ""
    for label, txt in overview:
        if label == "特征":
            tagline = re.sub(r"\*\*", "", txt.split("。")[0]) + "。"
            break

    return """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>%(name)s · 领域手册</title>
<style>%(css)s</style>
</head>
<body>
<main>
  <header class="hero"><div class="grid-bg"></div>
    <div class="hero-inner">
      <div>
        <p class="kicker">KNOWLEDGE VAULT · 领域手册</p>
        <h1>%(name)s<span class="dot">.</span></h1>
        <p class="tagline">%(tagline)s</p>
        <div class="stats">
          <span class="stat">进行中 <b>%(na)d</b></span>
          <span class="stat">已完结 <b>%(nd)d</b></span>
          <span class="stat">已掌握 <b>%(kn)d</b> 项</span>
          <span class="stat">待探索 <b>%(un)d</b> 项</span>
        </div>
      </div>
      <div class="motif">%(motif)s</div>
    </div>
  </header>

  <section>
    <div class="sec-head"><span class="sec-no">01</span><span class="sec-title">领域概览</span><span class="sec-rule"></span></div>
    <div class="card">%(ov)s</div>
  </section>

  <section>
    <div class="sec-head"><span class="sec-no">02</span><span class="sec-title">学习进度</span><span class="sec-rule"></span></div>
    %(bar)s
    <div class="duo">
      <div class="panel"><h3>KNOWN · 已经掌握</h3><ul>%(known)s</ul></div>
      <div class="panel"><h3>UNKNOWN · 待探索</h3><ul class="checks">%(unknown)s</ul></div>
    </div>
  </section>

  <section>
    <div class="sec-head"><span class="sec-no">03</span><span class="sec-title">进行中的项目</span><span class="sec-rule"></span></div>
    <div class="cards">%(active)s</div>
  </section>

  <section>
    <div class="sec-head"><span class="sec-no">04</span><span class="sec-title">已完结项目</span><span class="sec-rule"></span></div>
    %(archived)s
  </section>

  <section>
    <div class="sec-head"><span class="sec-no">05</span><span class="sec-title">相关图示</span><span class="sec-rule"></span></div>
    %(figs)s
  </section>

  <footer>由 <code>scripts/gen-area-html.py</code> 自动生成于 %(now)s · 源文件 <code>wiki/areas/%(name)s.md</code> · 请勿手工编辑，改源后重跑脚本</footer>
</main>
</body>
</html>
""" % {
        "css": CSS_TMPL % {"accent": th["accent"], "soft": th["soft"], "accent-ink": th["ink"]},
        "name": area, "tagline": esc(tagline), "motif": motif_svg(th["motif"], th["accent"]),
        "na": len(active), "nd": len(archived), "kn": kn, "un": un,
        "ov": ov_html, "bar": bar, "known": known_html, "unknown": unknown_html,
        "active": acards, "archived": acards_done, "figs": fig_html,
        "now": datetime.date.today().isoformat(),
    }


def main():
    made = []
    for p in sorted(glob.glob(os.path.join(AREAS, "*.md"))):
        name = os.path.splitext(os.path.basename(p))[0]
        if name == "README":
            continue
        meta, body = parse_fm(p)
        if meta.get("type") != "area":
            continue
        active = collect_projects(name)
        archived = collect_archived(name)
        drawings = collect_drawings()
        out = os.path.join(AREAS, name + ".html")
        with io.open(out, "w", encoding="utf-8", newline="\n") as f:
            f.write(build(name, meta, body, active, archived, drawings))
        made.append("%s.html（进行中 %d · 已完结 %d）" % (name, len(active), len(archived)))
    print("已生成 %d 个领域手册：" % len(made))
    for m in made:
        print("  -", m)


if __name__ == "__main__":
    main()

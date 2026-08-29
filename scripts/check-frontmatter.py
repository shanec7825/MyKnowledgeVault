# -*- coding: utf-8 -*-
"""知识库 frontmatter 体检脚本。

用途：Dataview 检索为空 / 页面不被索引时，先跑这个脚本排除 frontmatter 层面的问题
（YAML 不可解析、隐蔽字符、CRLF、缺字段）。对应 CLAUDE.md 第 4 节的排查清单第 3 条。

用法：
    python scripts/check-frontmatter.py            # 只报告问题
    python scripts/check-frontmatter.py --all      # 列出全部文件的解析结果
"""
import os
import re
import sys

import yaml

VAULT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCAN_DIRS = ["wiki", "inbox", "templates"]

FM_RE = re.compile(r"^---\n(.*?)\n---\n", re.S)

# 会让 Obsidian / js-yaml 静默丢弃整个 frontmatter 的隐蔽字符
HIDDEN = {
    "\t": "TAB（缩进必须用空格）",
    "\u00a0": "NBSP 不换行空格",
    "\u3000": "全角空格",
    "\u201c": "中文左引号（YAML 值需用英文引号）",
    "\u201d": "中文右引号（YAML 值需用英文引号）",
    "\ufeff": "BOM",
    "\u200b": "零宽空格",
}

# 各层必需字段（按目录判定）
REQUIRED = {
    os.path.join("wiki", "projects"): ["type", "title", "status", "area", "goal"],
    os.path.join("wiki", "areas"): ["type", "title", "status"],
    os.path.join("wiki", "resources"): ["type", "title", "status"],
}


def iter_md():
    for d in SCAN_DIRS:
        root = os.path.join(VAULT, d)
        if not os.path.isdir(root):
            continue
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = [x for x in dirnames if not x.startswith(".")]
            for fn in filenames:
                if fn.endswith(".md"):
                    yield os.path.join(dirpath, fn)


def rel(path):
    return os.path.relpath(path, VAULT).replace("\\", "/")


def main():
    show_all = "--all" in sys.argv
    problems = []
    seen = 0

    for path in sorted(iter_md()):
        r = rel(path)
        with open(path, "rb") as f:
            raw = f.read()

        if b"\r\n" in raw:
            problems.append((r, "CRLF 换行（本库统一 LF）"))

        text = raw.decode("utf-8")
        m = FM_RE.match(text)
        if not m:
            problems.append((r, "无 frontmatter 或分隔符格式不符"))
            continue

        block = m.group(1)
        for ch, desc in HIDDEN.items():
            if ch in block:
                problems.append((r, "frontmatter 含 " + desc))

        try:
            data = yaml.safe_load(block)
        except yaml.YAMLError as e:
            mark = getattr(e, "problem_mark", None)
            where = " 第 %d 行" % (mark.line + 1) if mark else ""
            problems.append((r, "YAML 解析失败%s：%s" % (where, getattr(e, "problem", str(e)))))
            continue

        if not isinstance(data, dict):
            problems.append((r, "frontmatter 解析结果不是映射"))
            continue

        seen += 1
        if show_all:
            print("OK  %-58s type=%-8s address=%s" % (r, data.get("type"), data.get("address")))

        for prefix, fields in REQUIRED.items():
            if r.startswith(prefix.replace("\\", "/")):
                for fld in fields:
                    if data.get(fld) in (None, "", []):
                        problems.append((r, "缺必需字段 `%s`" % fld))
                break

    print("\n已解析 frontmatter：%d 个文件" % seen)
    if problems:
        print("发现问题 %d 处：" % len(problems))
        for r, msg in problems:
            print("  - %s :: %s" % (r, msg))
        return 1
    print("无问题。")
    return 0


if __name__ == "__main__":
    sys.exit(main())

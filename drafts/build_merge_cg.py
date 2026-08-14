# -*- coding: utf-8 -*-
"""Canonical merge: backfill 认知表征与泛化 + 学习方法的认知科学验证 conclusions into 认知迁移能力."""
import hashlib
import json
import os
import sys

sys.path.insert(0, r'C:\Users\Lenovo\.claude\plugins\cache\agricidaniel-claude-obsidian\claude-obsidian\2.1.0')
from claude_obsidian.ledgers import stable_source_id

VAULT = r'C:\Users\Lenovo\Documents\MyKnowledgeVault'
DRAFTS = os.path.join(VAULT, 'drafts')
TODAY = '2026-08-13'


def sha256_file(path):
    return hashlib.sha256(open(path, 'rb').read()).hexdigest()


def read(p):
    return open(p, 'r', encoding='utf-8').read()


def write(p, text):
    open(p, 'w', encoding='utf-8').write(text)


# ---------------------------------------------------------------------------
# 1. Update 认知迁移能力.md
# ---------------------------------------------------------------------------
t = read(os.path.join(VAULT, 'wiki/resources/认知迁移能力.md'))

# (a) frontmatter: updated date
old_updated = 'updated: 2026-08-06'
assert t.count(old_updated) == 1
t = t.replace(old_updated, 'updated: 2026-08-13', 1)

# (b) frontmatter: add related links after 成人脑可塑性
old_rel = '  - "[[成人脑可塑性]]"'
assert t.count(old_rel) == 1
new_rel = ('  - "[[成人脑可塑性]]"\n'
           '  - "[[认知表征与泛化]]"\n'
           '  - "[[图式与理解力]]"\n'
           '  - "[[具身认知与概念隐喻]]"\n'
           '  - "[[元认知与迁移的可训练性]]"\n'
           '  - "[[泛化表征的多种格式]]"\n'
           '  - "[[学习方法的认知科学验证]]"')
t = t.replace(old_rel, new_rel, 1)

# (c) body: add 图式与具身表征 section before "## 提升迁移的实践方法"
anchor_section = '## 提升迁移的实践方法'
assert t.count(anchor_section) == 1
new_section = '''### 图式、具身表征与理解力（canonical merge 补充）

迁移的深层来源——为什么某些知识容易"搬"到新情境——可追溯到学习者的**图式结构与表征格式**（autoresearch「[[认知表征与泛化]]」结论反哺，检索 2026-08-13）：

- **理解力 = 图式的组织**：Rumelhart 图式理论主张「我们的图式就是我们的知识」——迁移的成败根本上依赖学习者已有图式的质与量（[[图式理论]]；见 [[图式与理解力]]）。
- **图式是经验的动态组织而非先天概念**：Piaget 的同化/顺应解释图式如何被新经验修改——这解释了"图式质量决定迁移成功率"（优良图式者 91% vs 差图式者 30%，[[Schema Induction and Analogical Transfer]]）。
- **具身表征是图式的重要来源**：概念隐喻理论（[[Metaphors We Live By]]）与感知符号系统（[[Perceptual Symbol Systems]]）表明抽象概念大量经由空间/身体经验建构；心理数字线（[[SNARC 与心理数字线]]）证明数字也映射到空间。这为"先具体案例、后抽象原理"（[[DL 类比：记忆与表征]]）提供了表征层面的理由。
- **但具身表征充分而非必要**：具身认知复制危机（[[具身认知的复制危机]]）显示感觉运动模拟在高阶认知中"既不必要也不自动"；抽象泛化还可由符号-组合（[[思想语言假说（LoT）]]）与关系结构（[[结构映射与关系范畴]]）承载——见 [[泛化表征的多种格式]]。
- **图式/元认知可训练**：SRL 与元认知训练元分析显示可练习（g≈0.38–0.48），但效果取决于嵌入学科内容、反馈与理论框架（[[自我调节学习训练元分析]]；见 [[元认知与迁移的可训练性]]）。

## 提升迁移的实践方法'''
t = t.replace(anchor_section, new_section, 1)

# (d) sources: append new source links before the "未建来源页" line
anchor_src = '- [[Supporting Learning of Variable Control Effects of Prompting]]（Lin & Lehman 1999）'
assert t.count(anchor_src) == 1
new_src = anchor_src + '\n' + '\n'.join([
    '- [[认知表征与泛化]]（autoresearch dossier，2026-08-13）',
    '- [[图式理论]]（Rumelhart 1980 / Bartlett 1932）',
    '- [[Metaphors We Live By]]（Lakoff & Johnson 1980）',
    '- [[Perceptual Symbol Systems]]（Barsalou 1999）',
    '- [[SNARC 与心理数字线]]（Dehaene 等 1993）',
    '- [[结构映射与关系范畴]]（Gentner 1983）',
    '- [[思想语言假说（LoT）]]（Quilty-Dunn 等 2023）',
    '- [[具身认知的复制危机]]（Montero-Melis 等 2022）',
    '- [[自我调节学习训练元分析]]（Theobald 2021）',
    '- [[元认知与迁移的可训练性]]（概念）',
    '- [[学习方法的认知科学验证]]（autoresearch dossier，2026-08-13）',
])
t = t.replace(anchor_src, new_src, 1)

write(os.path.join(DRAFTS, 'transfer-merged.md'), t)

# ---------------------------------------------------------------------------
# 2. Update index.md
# ---------------------------------------------------------------------------
idx = read(os.path.join(VAULT, 'wiki/index.md'))
old_idx = '- [[认知迁移能力]] — 学习迁移的表现/理论/机制/提升方法（中文讲解）'
assert idx.count(old_idx) == 1
new_idx = '- [[认知迁移能力]] — 学习迁移的表现/理论/机制/提升方法（中文讲解，含图式/具身表征补充）'
idx = idx.replace(old_idx, new_idx, 1)
write(os.path.join(DRAFTS, 'merge-index-updated.md'), idx)

# ---------------------------------------------------------------------------
# 3. Update log.md
# ---------------------------------------------------------------------------
log = read(os.path.join(VAULT, 'wiki/log.md'))
log_entry = (
    '## 2026-08-13 — Canonical merge 认知迁移能力 ← 认知表征与泛化 (merge-cg-transfer-20260813)\n\n'
    '- 反哺 [[认知表征与泛化]] / [[学习方法的认知科学验证]] 结论到 [[认知迁移能力]]：新增「图式、具身表征与理解力」小节（图式即知识 / 具身充分非必要 / 元认知可训练）；related 与来源补充\n'
    '- 更新 index / log / hot\n'
    '- Ledgers: 无新增（复用已有 source/claim 记录）\n'
)
anchor_log = '## 2026-08-13 — Autoresearch 认知表征与泛化 (autoresearch-cg-20260813)'
assert log.count(anchor_log) == 1
log = log.replace(anchor_log, log_entry + '\n' + anchor_log, 1)
write(os.path.join(DRAFTS, 'merge-log-updated.md'), log)

# ---------------------------------------------------------------------------
# 4. Update hot.md
# ---------------------------------------------------------------------------
hot = read(os.path.join(VAULT, 'wiki/hot.md'))
hot_last = '2026-08-13 — Canonical merge：[[认知表征与泛化]]/[[学习方法的认知科学验证]] 结论反哺 [[认知迁移能力]]（新增「图式、具身表征与理解力」小节；ledgers 无新增）。'
hot = hot.replace('## Last Updated\n\n', '## Last Updated\n\n' + hot_last + '\n', 1)
hot_change = '- Canonical merge：[[认知迁移能力]] 补充图式/具身表征小节（反哺 [[认知表征与泛化]]）'
hot = hot.replace('## Recent Changes\n\n', '## Recent Changes\n\n' + hot_change + '\n', 1)
write(os.path.join(DRAFTS, 'merge-hot-updated.md'), hot)

# ---------------------------------------------------------------------------
# 5. Build bundle (operation_type: save, canonical merge)
# ---------------------------------------------------------------------------
targets = [
    ('wiki/resources/认知迁移能力.md', 'transfer-merged.md'),
    ('wiki/index.md', 'merge-index-updated.md'),
    ('wiki/log.md', 'merge-log-updated.md'),
    ('wiki/hot.md', 'merge-hot-updated.md'),
]
expected_hashes = {}
writes = []
for path, draft in targets:
    expected_hashes[path] = sha256_file(os.path.join(VAULT, path))
    writes.append({'path': path, 'mode': 'replace', 'content_file': draft,
                   'sha256': sha256_file(os.path.join(DRAFTS, draft))})

bundle = {
    'schema': 'claude-obsidian.transaction.v1',
    'operation_id': 'merge-cg-transfer-20260813',
    'operation_type': 'save',
    'expected_hashes': expected_hashes,
    'writes': writes,
    'address_requests': [],
    'source_manifest_updates': {},
}
bundle_path = os.path.join(DRAFTS, 'merge-cg-transfer-20260813.json')
write(bundle_path, json.dumps(bundle, indent=2, ensure_ascii=False))
print('writes:', len(writes))
for path, draft in targets:
    print('  ', path)
print('bundle:', bundle_path)

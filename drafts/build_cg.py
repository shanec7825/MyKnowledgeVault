# -*- coding: utf-8 -*-
"""Build autoresearch transaction bundle for 认知表征与泛化."""
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
# 1. Page inventory
# ---------------------------------------------------------------------------
PAGES = [
    ('cg-project.md', 'wiki/projects/认知表征与泛化/认知表征与泛化.md', 'c-000096'),
    ('cg-con-1-schema.md', 'wiki/resources/图式与理解力.md', 'c-000097'),
    ('cg-con-2-embodied.md', 'wiki/resources/具身认知与概念隐喻.md', 'c-000098'),
    ('cg-con-3-metacog.md', 'wiki/resources/元认知与迁移的可训练性.md', 'c-000099'),
    ('cg-con-4-formats.md', 'wiki/resources/泛化表征的多种格式.md', 'c-000100'),
    ('cg-src-1-metaphors.md', 'wiki/resources/Metaphors We Live By.md', 'c-000101'),
    ('cg-src-2-barsalou.md', 'wiki/resources/Perceptual Symbol Systems.md', 'c-000102'),
    ('cg-src-3-lakoff-nunez.md', 'wiki/resources/Where Mathematics Comes From.md', 'c-000103'),
    ('cg-src-4-snarc.md', 'wiki/resources/SNARC 与心理数字线.md', 'c-000104'),
    ('cg-src-5-schema.md', 'wiki/resources/图式理论.md', 'c-000105'),
    ('cg-src-6-lot.md', 'wiki/resources/思想语言假说（LoT）.md', 'c-000106'),
    ('cg-src-7-gentner.md', 'wiki/resources/结构映射与关系范畴.md', 'c-000107'),
    ('cg-src-8-srl.md', 'wiki/resources/自我调节学习训练元分析.md', 'c-000108'),
    ('cg-src-9-repl.md', 'wiki/resources/具身认知的复制危机.md', 'c-000109'),
    ('cg-src-10-mahon.md', 'wiki/resources/具身认知假说的批判审视.md', 'c-000110'),
]

# ---------------------------------------------------------------------------
# 2. Sources
# ---------------------------------------------------------------------------
SOURCES = {
    'metaphors': dict(title='Metaphors We Live By',
                      url='https://press.uchicago.edu/ucp/books/book/chicago/M/bo3637992.html',
                      independence='lakoff-metaphors-1980'),
    'barsalou': dict(title='Perceptual Symbol Systems',
                     url='https://doi.org/10.1017/S0140525X99002149',
                     independence='barsalou-pss-1999'),
    'lakoffnunez': dict(title='Where Mathematics Comes From',
                        url='https://www.basicbooks.com/titles/george-lakoff/where-mathematics-comes-from/9780465037704/',
                        independence='lakoff-nunez-math-2000'),
    'snarc': dict(title='SNARC 与心理数字线',
                  url='https://doi.org/10.1037/0096-3445.122.3.371',
                  independence='dehaene-snarc-1993'),
    'schema': dict(title='图式理论',
                   url='https://doi.org/10.4324/9781315107493-4',
                   independence='rumelhart-schema-1980'),
    'lot': dict(title='思想语言假说（LoT）',
                url='https://doi.org/10.1017/S0140525X22002699',
                independence='quilty-dunn-lot-2023'),
    'gentner': dict(title='结构映射与关系范畴',
                    url='https://doi.org/10.1207/s15516709cog0702_1',
                    independence='gentner-structure-mapping-1983'),
    'srl': dict(title='自我调节学习训练元分析',
                url='https://doi.org/10.1016/j.cedpsych.2021.101976',
                independence='theobald-srl-2021'),
    'repl': dict(title='具身认知的复制危机',
                 url='https://pubmed.ncbi.nlm.nih.gov/35381469/',
                 independence='montero-melis-embodiment-2022'),
    'mahon': dict(title='具身认知假说的批判审视',
                  url='https://doi.org/10.1016/j.jphysparis.2008.03.004',
                  independence='mahon-caramazza-2008'),
}

SRC_PAGE = {
    'metaphors': 'wiki/resources/Metaphors We Live By.md',
    'barsalou': 'wiki/resources/Perceptual Symbol Systems.md',
    'lakoffnunez': 'wiki/resources/Where Mathematics Comes From.md',
    'snarc': 'wiki/resources/SNARC 与心理数字线.md',
    'schema': 'wiki/resources/图式理论.md',
    'lot': 'wiki/resources/思想语言假说（LoT）.md',
    'gentner': 'wiki/resources/结构映射与关系范畴.md',
    'srl': 'wiki/resources/自我调节学习训练元分析.md',
    'repl': 'wiki/resources/具身认知的复制危机.md',
    'mahon': 'wiki/resources/具身认知假说的批判审视.md',
}

# ---------------------------------------------------------------------------
# 3. Claims (anchors must exactly match page headings, casefolded)
# ---------------------------------------------------------------------------
def C(src, locator, anchor, path, text, assessment='accepted', confidence='high', risk='normal'):
    return dict(assessment=assessment, confidence=confidence,
                evidence=[{'locator': locator, 'relation': 'supports', 'source_id': src}],
                location={'anchor': anchor, 'path': path},
                notes=None, reviewed_at=TODAY, risk=risk, supersedes=None, text=text)

P1 = 'wiki/resources/图式与理解力.md'
P2 = 'wiki/resources/具身认知与概念隐喻.md'
P3 = 'wiki/resources/元认知与迁移的可训练性.md'
P4 = 'wiki/resources/泛化表征的多种格式.md'
PP = 'wiki/projects/认知表征与泛化/认知表征与泛化.md'

CLAIMS = {
    'clm-cg-schema-knowledge': C('schema', '核心主张', '图式：理解力的载体', P1,
                                 'Rumelhart（1980）：图式可表征从意识形态到词义的一切层次知识，「我们的图式就是我们的知识」，所有一般知识都嵌在图式中。'),
    'clm-cg-schema-comprehension': C('schema', '核心主张', '图式：理解力的载体', P1,
                                     '理解依赖读者已有图式（内容/形式/语言图式）；文本与读者图式共同构成意义，图式缺失导致理解失败。'),
    'clm-cg-schema-assimilation': C('schema', '核心主张', '图式：理解力的载体', P1,
                                    'Piaget：同化（新信息纳入已有图式）与顺应（修改图式整合新信息）是图式变化的机制。',
                                    confidence='medium'),
    'clm-cg-schema-transfer': C('schema', '对「理解力」的操作化', '证据状态', P1,
                                '图式质量直接决定迁移成功率（优良图式者 91% 无提示解决 vs 差图式者 30%，Gick & Holyoak 1983）。'),
    'clm-cg-cmt-abstract': C('metaphors', '核心主张', '1. 概念隐喻理论：抽象由具体建构', P2,
                             'Lakoff & Johnson（1980）：日常概念系统本质上是隐喻性的；抽象概念由具体身体经验（空间方位/容器/路径）结构化。'),
    'clm-cg-cmt-orientational': C('metaphors', '核心主张', '1. 概念隐喻理论：抽象由具体建构', P2,
                                  'UP-DOWN、IN-OUT、NEAR-FAR 等空间方位图式来自身体经验，作为「非隐喻」基础组织抽象概念。',
                                  confidence='medium'),
    'clm-cg-pss-simulation': C('barsalou', '核心主张', '2. 感知符号系统：概念 = 感觉运动模拟', P2,
                               'Barsalou（1999）：概念经由感知-运动经验的再激活（模拟）实现，由注意选择抽取成分、组织成模拟器。',
                               assessment='contested'),
    'clm-cg-math-embodied': C('lakoffnunez', '核心主张', '3. 数学概念也是具身的', P2,
                              'Lakoff & Núñez（2000）：数学概念（数轴/区间/集合/无穷）大多通过概念隐喻从身体经验建构。',
                              assessment='contested'),
    'clm-cg-snarc': C('snarc', '核心发现', '4. 空间-数字关联的实证', P2,
                      'SNARC 效应：数字被表征在心理数字线上，小数在左、大数在右；忽视病人对数字区间等分偏误与物理线条偏误相似。'),
    'clm-cg-snarc-cultural': C('snarc', '挑战', '证据状态', P2,
                               '空间-数字联结是情境/文化依赖的（受书写方向影响、可被启动反转）；Chen & Verguts（2010）认为其是文化建立的涌现性质而非数字固有属性。',
                               confidence='medium'),
    'clm-cg-embodied-null': C('repl', '核心发现', '5. 反证与边界（必须保留）', P2,
                              '高功效复制（N=77）得到强空结果（BF01=91）：运动系统对动作词工作记忆非必需；感觉运动模拟在高阶认知中既不必要也不自动。'),
    'clm-cg-embodied-boundary': C('mahon', '核心主张', '5. 反证与边界（必须保留）', P2,
                                  'Mahon & Caramazza（2008）提出「通过交互接地」中间立场：词义同时受益于抽象内容与感觉运动系统；弱具身立场难以证伪。',
                                  confidence='medium'),
    'clm-cg-srl-trainable': C('srl', '核心发现', '1. 元认知 / 自我调节学习（SRL）的可训练性', P3,
                              'SRL 训练元分析：大学生 g=0.38（元认知策略 g=0.40、学业 g=0.37）；儿童元认知干预即时 g=0.48、追踪 g=0.29。'),
    'clm-cg-srl-moderators': C('srl', '核心发现', '1. 元认知 / 自我调节学习（SRL）的可训练性', P3,
                               '训练效果受反馈、合作学习、基于元认知理论、教师/嵌入材料交付等调节。'),
    'clm-cg-transfer-trainable': C('gentner', '核心主张', '3. 练习机制：图式构建与关系范畴', P3,
                                   '迁移可通过图式构建与关系范畴训练实现：多例比较诱导图式抽象、渐进对齐、关系标签促进统一关系编码。'),
    'clm-cg-transfer-boundary': C('srl', '核心发现', '4. 反证与边界', P3,
                                  '远迁移仍稀缺；训练提升的是近迁移与「学会如何学习」，跨领域远迁移缺乏证据（Sala & Gobet 2020）。',
                                  assessment='contested', confidence='medium'),
    'clm-cg-lot': C('lot', '核心主张', '2. 符号-组合式表征：思想语言假说（LoT）', P4,
                    'LoT 假说：思维中存在类语言的组合式符号结构，具六属性（离散成分/角色-填充者独立/谓词-论元/逻辑算子/推理多产/抽象内容），支持系统性与组合性思维。'),
    'clm-cg-relational': C('gentner', '核心主张', '3. 关系-结构式表征：结构映射与关系范畴', P4,
                           '结构映射理论：类比依赖关系结构而非表面特征；关系范畴成员共享关系角色，跨表面差异支撑远迁移。'),
    'clm-cg-retrieval-surface': C('gentner', '核心主张', '3. 关系-结构式表征：结构映射与关系范畴', P4,
                                  '检索 vs 映射分离：自发检索常被表面相似主导，但映射依赖结构相似。',
                                  confidence='medium'),
    'clm-cg-multiformat': C('lot', '核心主张', '4. 其它格式（补充）', P4,
                            '大脑容纳多种表征格式（空间-意象、符号-组合、关系-结构、分布式网络、规则），不同任务选择不同格式。'),
}

# ---------------------------------------------------------------------------
# 4. Compute source ids + hashes
# ---------------------------------------------------------------------------
page_sha = {path: sha256_file(os.path.join(DRAFTS, draft)) for draft, path, addr in PAGES}
source_ids = {k: stable_source_id('url', v['url'], page_sha[SRC_PAGE[k]]) for k, v in SOURCES.items()}

ledger_sources = {}
manifest_sources = {}
for key, meta in SOURCES.items():
    sid = source_ids[key]
    page = SRC_PAGE[key]
    h = page_sha[page]
    ledger_sources[sid] = {
        'authority': 'primary', 'content_kind': 'webpage', 'content_sha256': h,
        'independence_key': meta['independence'], 'ingested_at': TODAY,
        'origin': {'kind': 'url', 'locator': meta['url']}, 'pages': [page],
        'refresh_due': '2027-08-13', 'retrieved_at': TODAY,
        'review_status': 'active', 'supersedes': None, 'title': meta['title'],
    }
    manifest_sources[sid] = {
        'authority': 'primary', 'content_kind': 'webpage',
        'independence_key': meta['independence'], 'ingested_at': TODAY,
        'locator': meta['url'], 'pages_created': [page],
        'review_status': 'active', 'sha256': h, 'title': meta['title'],
    }

for cid, c in CLAIMS.items():
    for ev in c['evidence']:
        ev['source_id'] = source_ids[ev['source_id']]
    if c['assessment'] == 'contested' and not c.get('notes'):
        c['notes'] = '存在相反证据/争议：见同一概念页反证部分与相关来源。'

# ---------------------------------------------------------------------------
# 5. Update index.md
# ---------------------------------------------------------------------------
index_md = read(os.path.join(VAULT, 'wiki/index.md'))

sources_block = '\n'.join([
    '- [[Metaphors We Live By]] — 概念隐喻理论奠基（Lakoff & Johnson，1980）',
    '- [[Perceptual Symbol Systems]] — 感知符号系统/具身认知（Barsalou，BBS，1999）',
    '- [[Where Mathematics Comes From]] — 数学概念的具身隐喻（Lakoff & Núñez，2000）',
    '- [[SNARC 与心理数字线]] — 空间-数字关联（Dehaene 等，1993）',
    '- [[图式理论]] — 图式即知识（Rumelhart，1980；Bartlett，1932）',
    '- [[思想语言假说（LoT）]] — 类语言组合式思维（Quilty-Dunn 等，BBS，2023）',
    '- [[结构映射与关系范畴]] — 类比的结构映射理论（Gentner，1983）',
    '- [[自我调节学习训练元分析]] — 元认知可训练性（Theobald，2021）',
    '- [[具身认知的复制危机]] — 具身效应复制失败（Montero-Melis 等，2022）',
    '- [[具身认知假说的批判审视]] — 接地中间立场（Mahon & Caramazza，2008）',
])
concepts_block = '\n'.join([
    '- [[图式与理解力]] — 图式作为理解力载体（中文讲解）',
    '- [[具身认知与概念隐喻]] — 空间/语言作为思维形式 + 复制危机（中文讲解）',
    '- [[元认知与迁移的可训练性]] — 元认知/迁移能否练习（中文讲解）',
    '- [[泛化表征的多种格式]] — 空间/符号/关系/网络四格式（中文讲解）',
])
project_bullet = '- [[认知表征与泛化]] — 理解力的表征基础与泛化建模研究项目（图式 / 具身 / 元认知可训练性 / 多格式）'

index_md = index_md.replace('## Concepts\n', sources_block + '\n\n## Concepts\n', 1)
index_md = index_md.replace('## Projects\n', concepts_block + '\n\n## Projects\n', 1)
index_md = index_md.replace('## Entities\n', project_bullet + '\n\n## Entities\n', 1)
index_md = index_md.replace('updated: 2026-08-13', 'updated: 2026-08-13', 1)
write(os.path.join(DRAFTS, 'cg-index-updated.md'), index_md)

# ---------------------------------------------------------------------------
# 6. Update log.md
# ---------------------------------------------------------------------------
log_md = read(os.path.join(VAULT, 'wiki/log.md'))
log_entry = (
    '## 2026-08-13 — Autoresearch 认知表征与泛化 (autoresearch-cg-20260813)\n\n'
    '- 研究：理解力的表征基础——图式是否构成理解力、具身认知与概念隐喻（空间/颜色/语言作为思维形式）、元认知与迁移的可训练性、非空间泛化表征格式（公开网络，摘要级检索，10 来源）\n'
    '- 创建：[[认知表征与泛化]]（项目）+ [[图式与理解力]] / [[具身认知与概念隐喻]] / [[元认知与迁移的可训练性]] / [[泛化表征的多种格式]]（概念）+ 10 个来源页\n'
    '- 关联：[[学习方法的认知科学验证]]、[[认知迁移能力]]、[[类比于强化学习和深度学习的学习理论]]、[[加工流畅性与建构水平]]\n'
    '- Ledgers: 新增 10 条 source 记录、20 条 claim 记录\n'
)
anchor_log = '## 2026-08-13 — Autoresearch 学习方法的认知科学验证 (autoresearch-lm-20260813)'
assert log_md.count(anchor_log) == 1
log_md = log_md.replace(anchor_log, log_entry + '\n' + anchor_log, 1)
write(os.path.join(DRAFTS, 'cg-log-updated.md'), log_md)

# ---------------------------------------------------------------------------
# 7. Update hot.md
# ---------------------------------------------------------------------------
hot_md = read(os.path.join(VAULT, 'wiki/hot.md'))
hot_last = '2026-08-13 — autoresearch「认知表征与泛化」创建项目页 [[认知表征与泛化]] + 4 概念页（图式与理解力 / 具身认知与概念隐喻 / 元认知与迁移的可训练性 / 泛化表征的多种格式）+ 10 来源页，论证日记 [[2026-08-13]] 的「理解力/区间图式」疑问（公开网络，摘要级检索）。'
hot_md = hot_md.replace('## Last Updated\n\n', '## Last Updated\n\n' + hot_last + '\n', 1)
hot_fact = '- 认知表征与泛化：理解力 = 图式/概念结构（部分成立）；「区间」等词根植于具身经验（概念隐喻 + 心理数字线）；具身认知有复制危机（模拟非必要）；元认知/迁移可训练（SRL g≈0.38-0.48）；泛化不只有空间格式（LoT/关系范畴）。'
hot_md = hot_md.replace('## Key Recent Facts\n\n', '## Key Recent Facts\n\n' + hot_fact + '\n', 1)
hot_change = '- Autoresearch：创建 [[认知表征与泛化]] 项目页 + 4 概念页 + 10 来源页；更新 index / hot / overview；ledgers +10 sources / +20 claims'
hot_md = hot_md.replace('## Recent Changes\n\n', '## Recent Changes\n\n' + hot_change + '\n', 1)
write(os.path.join(DRAFTS, 'cg-hot-updated.md'), hot_md)

# ---------------------------------------------------------------------------
# 8. Update overview.md
# ---------------------------------------------------------------------------
overview_md = read(os.path.join(VAULT, 'wiki/overview.md'))
anchor_ov = '- 学习方法认知科学验证 — 2026-08-13 autoresearch 建立 [[学习方法的认知科学验证]] 项目页与 3 个概念页'
assert overview_md.count(anchor_ov) == 1
bullet_ov = ('- 认知表征与泛化 — 2026-08-13 autoresearch 建立 [[认知表征与泛化]] 项目页与 4 个概念页'
             '（图式与理解力 / 具身认知与概念隐喻 / 元认知与迁移的可训练性 / 泛化表征的多种格式），'
             '论证日记 2026-08-13 的「理解力 / 区间图式 / 具身思维」疑问。')
overview_md = overview_md.replace(anchor_ov, bullet_ov + '\n' + anchor_ov, 1)
write(os.path.join(DRAFTS, 'cg-overview-updated.md'), overview_md)

# ---------------------------------------------------------------------------
# 9. Update ledgers
# ---------------------------------------------------------------------------
src_ledger = json.loads(read(os.path.join(VAULT, 'wiki/meta/ledgers/source-ledger.json')))
for sid, rec in ledger_sources.items():
    assert sid not in src_ledger['sources']
    src_ledger['sources'][sid] = rec
write(os.path.join(DRAFTS, 'cg-source-ledger-updated.json'), json.dumps(src_ledger, indent=2, ensure_ascii=False))

clm_ledger = json.loads(read(os.path.join(VAULT, 'wiki/meta/ledgers/claim-ledger.json')))
for cid, rec in CLAIMS.items():
    assert cid not in clm_ledger['claims']
    clm_ledger['claims'][cid] = rec
write(os.path.join(DRAFTS, 'cg-claim-ledger-updated.json'), json.dumps(clm_ledger, indent=2, ensure_ascii=False))

# ---------------------------------------------------------------------------
# 10. Build bundle
# ---------------------------------------------------------------------------
expected_hashes = {}
writes = []
for draft, path, addr in PAGES:
    expected_hashes[path] = None
    writes.append({'path': path, 'mode': 'create', 'content_file': draft, 'sha256': page_sha[path]})

meta_replaces = [
    ('wiki/index.md', 'cg-index-updated.md'),
    ('wiki/log.md', 'cg-log-updated.md'),
    ('wiki/hot.md', 'cg-hot-updated.md'),
    ('wiki/overview.md', 'cg-overview-updated.md'),
    ('wiki/meta/ledgers/source-ledger.json', 'cg-source-ledger-updated.json'),
    ('wiki/meta/ledgers/claim-ledger.json', 'cg-claim-ledger-updated.json'),
]
for path, draft in meta_replaces:
    expected_hashes[path] = sha256_file(os.path.join(VAULT, path))
    writes.append({'path': path, 'mode': 'replace', 'content_file': draft,
                   'sha256': sha256_file(os.path.join(DRAFTS, draft))})

bundle = {
    'schema': 'claude-obsidian.transaction.v1',
    'operation_id': 'autoresearch-cg-20260813',
    'operation_type': 'autoresearch',
    'expected_hashes': expected_hashes,
    'writes': writes,
    'address_requests': [{'path': v[1]} for v in PAGES],
    'source_manifest_updates': {
        'sources': manifest_sources,
        'address_map': {v[1]: v[2] for v in PAGES},
    },
}
bundle_path = os.path.join(DRAFTS, 'autoresearch-cg-20260813.json')
write(bundle_path, json.dumps(bundle, indent=2, ensure_ascii=False))

print('pages:', len(PAGES), 'sources:', len(ledger_sources), 'claims:', len(CLAIMS))
print('writes:', len(writes), 'address_requests:', len(PAGES))
for sid, meta in SOURCES.items():
    print('  ', source_ids[sid], meta['title'][:45])
print('bundle:', bundle_path)

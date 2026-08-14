# -*- coding: utf-8 -*-
"""Build the autoresearch transaction bundle for 学习方法的认知科学验证."""
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
    with open(path, 'rb') as f:
        return hashlib.sha256(f.read()).hexdigest()


def sha256_text(text):
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def read(p):
    with open(p, 'r', encoding='utf-8') as f:
        return f.read()


def write(p, text):
    with open(p, 'w', encoding='utf-8') as f:
        f.write(text)


# ---------------------------------------------------------------------------
# 1. Page inventory: (draft_file, vault_path, address)
# ---------------------------------------------------------------------------
PAGES = [
    ('p1-project.md', 'wiki/projects/学习方法的认知科学验证/学习方法的认知科学验证.md', 'c-000080'),
    ('p2-concept-85pct.md', 'wiki/resources/适度困难与最优误差率.md', 'c-000081'),
    ('p3-concept-rate.md', 'wiki/resources/学习率与巩固：间隔·睡眠·运动.md', 'c-000082'),
    ('p4-concept-wm.md', 'wiki/resources/工作记忆、封装与遗忘.md', 'c-000083'),
    ('s1-wilson.md', 'wiki/resources/The Eighty Five Percent Rule for Optimal Learning.md', 'c-000084'),
    ('s2-metcalfe.md', 'wiki/resources/A Region of Proximal Learning Model of Study Time Allocation.md', 'c-000085'),
    ('s3-bjork-dd.md', 'wiki/resources/Desirable Difficulties (Bjork 1994).md', 'c-000086'),
    ('s4-cepeda.md', 'wiki/resources/Distributed Practice in Verbal Recall Tasks.md', 'c-000087'),
    ('s5-rasch.md', 'wiki/resources/About Sleep\'s Role in Memory.md', 'c-000088'),
    ('s6-mcclelland.md', 'wiki/resources/Why There Are Complementary Learning Systems in the Hippocampus and Neocortex.md', 'c-000089'),
    ('s7-hillman.md', 'wiki/resources/Be Smart Exercise Your Heart.md', 'c-000090'),
    ('s8-cowan.md', 'wiki/resources/The Magical Number 4 in Short-Term Memory.md', 'c-000091'),
    ('s9-bjork-disuse.md', 'wiki/resources/A New Theory of Disuse and an Old Theory of Stimulus Fluctuation.md', 'c-000092'),
    ('s10-schmidt.md', 'wiki/resources/On Acquiring Expertise in Medicine.md', 'c-000093'),
    ("s11-murre.md", "wiki/resources/Replication and Analysis of Ebbinghaus' Forgetting Curve.md", 'c-000094'),
    ('s12-ausubel.md', 'wiki/resources/The Use of Advance Organizers in the Learning and Retention of Meaningful Verbal Material.md', 'c-000095'),
]

# ---------------------------------------------------------------------------
# 2. Source definitions (key -> metadata). content_sha256 = hash of source page draft.
# ---------------------------------------------------------------------------
SOURCES = {
    'wilson': dict(title='The Eighty Five Percent Rule for Optimal Learning',
                   url='https://doi.org/10.1038/s41467-019-12552-4',
                   independence='wilson-85pct-2019'),
    'metcalfe': dict(title='A Region of Proximal Learning Model of Study Time Allocation',
                     url='https://doi.org/10.1016/j.jml.2004.12.001',
                     independence='metcalfe-rpl-2005'),
    'bjork-dd': dict(title='Desirable Difficulties (Bjork 1994)',
                     url='https://bjorklab.psych.ucla.edu/research/',
                     independence='bjork-desirable-difficulties-1994'),
    'cepeda': dict(title='Distributed Practice in Verbal Recall Tasks',
                   url='https://doi.org/10.1037/0033-2909.132.3.354',
                   independence='cepeda-spacing-2006'),
    'rasch': dict(title="About Sleep's Role in Memory",
                  url='https://doi.org/10.1152/physrev.00032.2012',
                  independence='rasch-sleep-2013'),
    'mcclelland': dict(title='Why There Are Complementary Learning Systems in the Hippocampus and Neocortex',
                       url='https://doi.org/10.1037/0033-295X.102.3.419',
                       independence='mcclelland-cls-1995'),
    'hillman': dict(title='Be Smart Exercise Your Heart',
                    url='https://doi.org/10.1038/nrn2298',
                    independence='hillman-exercise-2008'),
    'cowan': dict(title='The Magical Number 4 in Short-Term Memory',
                  url='https://pubmed.ncbi.nlm.nih.gov/11515286/',
                  independence='cowan-wm4-2001'),
    'bjork-disuse': dict(title='A New Theory of Disuse and an Old Theory of Stimulus Fluctuation',
                         url='https://bjorklab.psych.ucla.edu/research/',
                         independence='bjork-disuse-1992'),
    'schmidt': dict(title='On Acquiring Expertise in Medicine',
                    url='https://doi.org/10.1007/BF01323044',
                    independence='schmidt-encapsulation-1993'),
    'murre': dict(title="Replication and Analysis of Ebbinghaus' Forgetting Curve",
                  url='https://doi.org/10.1371/journal.pone.0120644',
                  independence='murre-ebbinghaus-2015'),
    'ausubel': dict(title='The Use of Advance Organizers in the Learning and Retention of Meaningful Verbal Material',
                    url='https://doi.org/10.1037/h0046669',
                    independence='ausubel-advance-1960'),
}

# source key -> vault page path (must match PAGES)
SRC_PAGE = {
    'wilson': 'wiki/resources/The Eighty Five Percent Rule for Optimal Learning.md',
    'metcalfe': 'wiki/resources/A Region of Proximal Learning Model of Study Time Allocation.md',
    'bjork-dd': 'wiki/resources/Desirable Difficulties (Bjork 1994).md',
    'cepeda': 'wiki/resources/Distributed Practice in Verbal Recall Tasks.md',
    'rasch': "wiki/resources/About Sleep's Role in Memory.md",
    'mcclelland': 'wiki/resources/Why There Are Complementary Learning Systems in the Hippocampus and Neocortex.md',
    'hillman': 'wiki/resources/Be Smart Exercise Your Heart.md',
    'cowan': 'wiki/resources/The Magical Number 4 in Short-Term Memory.md',
    'bjork-disuse': 'wiki/resources/A New Theory of Disuse and an Old Theory of Stimulus Fluctuation.md',
    'schmidt': 'wiki/resources/On Acquiring Expertise in Medicine.md',
    'murre': "wiki/resources/Replication and Analysis of Ebbinghaus' Forgetting Curve.md",
    'ausubel': 'wiki/resources/The Use of Advance Organizers in the Learning and Retention of Meaningful Verbal Material.md',
}

# ---------------------------------------------------------------------------
# 3. Claim definitions
# ---------------------------------------------------------------------------
def C(src, locator, anchor, path, text, assessment='accepted', confidence='high', risk='normal'):
    return dict(assessment=assessment, confidence=confidence,
                evidence=[{'locator': locator, 'relation': 'supports', 'source_id': src}],
                location={'anchor': anchor, 'path': path},
                notes=None, reviewed_at=TODAY, risk=risk, supersedes=None, text=text)

P_CONCEPT1 = 'wiki/resources/适度困难与最优误差率.md'
P_CONCEPT2 = 'wiki/resources/学习率与巩固：间隔·睡眠·运动.md'
P_CONCEPT3 = 'wiki/resources/工作记忆、封装与遗忘.md'
P_PROJECT = 'wiki/projects/学习方法的认知科学验证/学习方法的认知科学验证.md'

CLAIMS = {
    'clm-lm-85pct': C('wilson', '核心发现', '2. 85% 法则：最优误差率的量化', P_CONCEPT1,
                      '对一类基于梯度下降的二分类学习算法，训练时存在最优误差率≈15.87%（最优正确率≈85%）；过易或过难均降低学习速度。'),

    'clm-lm-85pct-scope': C('wilson', '边界', '证据状态', P_CONCEPT1,
                            '85% 法则在「二分类+梯度下降」设定下导出，不是人类学习的普适常数，但支持「存在非零最优误差率」的质性命论。',
                            confidence='medium'),
    'clm-lm-rpl-medium': C('metcalfe', '核心发现', '3. 最近发展区（region of proximal learning）：学习者的元认知也遵循这一甜区', P_CONCEPT1,
                           '自由分配学习时间时，人们优先把时间投向中等难度项目（最近发展区），而非最难项目；把时间给中等难度项目最优。'),
    'clm-lm-learning-performance': C('bjork-dd', '核心论点', '1. desirable difficulty：困难可以是有益的', P_CONCEPT1,
                                     '练习时的表现是不可靠的学习指示器（学习≠表现）；练习流畅性会造成系统性误判。'),
    'clm-lm-desirable-difficulty': C('bjork-dd', '核心论点', '1. desirable difficulty：困难可以是有益的', P_CONCEPT1,
                                     '间隔、交错、提取、生成、变化练习条件等「合意困难」会降低练习表现、却增强长期保持与迁移。'),
    'clm-lm-dd-ceiling': C('bjork-dd', '关键边界', '1. desirable difficulty：困难可以是有益的', P_CONCEPT1,
                           '并非所有困难都有益；困难必须可被克服且调用目标加工，超出资源的困难会阻塞学习。'),
    'clm-lm-spacing': C('cepeda', '核心发现', '1. 集中学习 vs 间隔学习：间隔效应', P_CONCEPT2,
                        '分布式（间隔）练习优于集中练习；最优间隔随所需保持时长增长（839 项评估/317 实验/184 文章的元分析）。'),
    'clm-lm-ridgeline': C('cepeda', '后续', '1. 集中学习 vs 间隔学习：间隔效应', P_CONCEPT2,
                          '最优复习间隔约为保持间隔的 10–40%，且随保持间隔增长而按比例下降（1 周≈20–40%，1 年≈5–10%）。'),
    'clm-lm-cls-interference': C('mcclelland', '核心论点', '2. 「参数更新混乱」= 灾难性干扰', P_CONCEPT2,
                                 '以高学习率/集中学习非代表性样本会导致灾难性干扰（覆盖已有结构化知识）；海马（快速）与新皮层（慢速交错）互补学习系统 + 离线重演是其解法。'),
    'clm-lm-cls-schema': C('mcclelland', '细化', '2. 「参数更新混乱」= 灾难性干扰', P_CONCEPT2,
                           '与既有图式一致的新信息可快速学习而不引起干扰；干扰主要来自快速吸收不一致的新知识（McClelland 2013 细化）。',
                           confidence='medium'),
    'clm-lm-sleep-sws': C('rasch', '核心发现', '3. 睡眠：离线巩固的主场', P_CONCEPT2,
                          '睡眠主动巩固记忆：慢波睡眠期间重演刚编码的表征并整合进长时记忆；REM 起稳定作用。'),
    'clm-lm-sleep-encoding': C('rasch', '核心发现', '3. 睡眠：离线巩固的主场', P_CONCEPT2,
                               '清醒状态优化编码，睡眠状态优化巩固。'),
    'clm-lm-exercise': C('hillman', '核心发现', '4. 运动：温和的认知增强因子', P_CONCEPT2,
                         '有氧运动对认知与脑有温和的有益影响（BDNF/神经发生/血管新生机制）；属叙述性综述，效应量温和。',
                         confidence='medium'),
    'clm-lm-wm4': C('cowan', '核心论点', '1. 容量有限：≈4 个组块', P_CONCEPT3,
                    '工作记忆中央容量上限约为 4 个组块，而非 7±2 个项目（7±2 是组块数）。'),
    'clm-lm-chunking': C('cowan', '核心论点', '1. 容量有限：≈4 个组块', P_CONCEPT3,
                         '组块化（chunking）通过重编码扩大有效记忆容量，从而绕开约 4 组块的限制。'),
    'clm-lm-storage-retrieval': C('bjork-disuse', '核心论点', '2. 遗忘 ≠ 丢失：存储强度 vs 提取强度', P_CONCEPT3,
                                  '记忆项有存储强度（单调累积、不丢失）与提取强度（可及性）两个独立强度。'),
    'clm-lm-forgetting-access': C('bjork-disuse', '关键推论', '2. 遗忘 ≠ 丢失：存储强度 vs 提取强度', P_CONCEPT3,
                                  '遗忘=提取强度下降（由竞争造成），不是时间抹除；高存储低提取的项仍可通过节省效应快速重学。'),
    'clm-lm-learning-depends-forgetting': C('bjork-disuse', '关键推论', '2. 遗忘 ≠ 丢失：存储强度 vs 提取强度', P_CONCEPT3,
                                            '提取强度越低时成功检索，存储增益越大（「学习依赖遗忘」）。',
                                            confidence='medium'),
    'clm-lm-encapsulation': C('schmidt', '核心理论', '3. 知识封装：细节被压缩，但可再激活', P_CONCEPT3,
                              '专长发展中，精细生物医学知识被封装成高层概念；专家回忆更少但更相关（中间效应）。'),
    'clm-lm-sedimentation': C('schmidt', '核心理论', '3. 知识封装：细节被压缩，但可再激活', P_CONCEPT3,
                              '被封装的底层知识通过沉淀机制保留、可被重新激活，而非丢失。'),
    'clm-lm-forgetting-curve': C('murre', '核心发现', '4. 遗忘曲线：可复刻，且睡眠处有「跃升」', P_CONCEPT3,
                                 'Ebbinghaus 遗忘曲线可复刻；节省分数比正确率曲线更浅，且在 24 小时处有向上跃升（与睡眠巩固一致）。'),
    'clm-lm-advance-organizer': C('ausubel', '核心发现', '日记观点 → 证据映射', P_PROJECT,
                                  '先行组织者（更高层概括性引导材料）促进陌生有意义材料的学习与保持（Ausubel 1960 单实验）。',
                                  confidence='medium'),
    'clm-lm-advance-caveat': C('ausubel', '边界与张力', '日记观点 → 证据映射', P_PROJECT,
                               '先行组织者效应后续难以操作化、结果混杂，其「框架先行」主张与「先案例后原理」的归纳路径并存。',
                               assessment='accepted', confidence='medium'),
}

# ---------------------------------------------------------------------------
# 4. Compute source ids + page/content hashes
# ---------------------------------------------------------------------------
page_path_to_addr = {v[1]: v[2] for v in PAGES}
draft_by_path = {v[1]: v[0] for v in PAGES}

# sha256 of each page draft (used for writes and as content_sha256 for sources)
page_sha = {}
for draft, path, addr in PAGES:
    page_sha[path] = sha256_file(os.path.join(DRAFTS, draft))

# source id + manifest/ledger entries (engine canonical identity)
source_ids = {k: stable_source_id('url', v['url'], page_sha[SRC_PAGE[k]]) for k, v in SOURCES.items()}

ledger_sources = {}
manifest_sources = {}
for key, meta in SOURCES.items():
    sid = source_ids[key]
    page = SRC_PAGE[key]
    h = page_sha[page]
    ledger_sources[sid] = {
        'authority': 'primary',
        'content_kind': 'webpage',
        'content_sha256': h,
        'independence_key': meta['independence'],
        'ingested_at': TODAY,
        'origin': {'kind': 'url', 'locator': meta['url']},
        'pages': [page],
        'refresh_due': '2027-08-13',
        'retrieved_at': TODAY,
        'review_status': 'active',
        'supersedes': None,
        'title': meta['title'],
    }
    manifest_sources[sid] = {
        'authority': 'primary',
        'content_kind': 'webpage',
        'independence_key': meta['independence'],
        'ingested_at': TODAY,
        'locator': meta['url'],
        'pages_created': [page],
        'review_status': 'active',
        'sha256': h,
        'title': meta['title'],
    }

# patch claim evidence source_ids
for cid, c in CLAIMS.items():
    for ev in c['evidence']:
        ev['source_id'] = source_ids[ev['source_id']]

# ---------------------------------------------------------------------------
# 5. Update index.md
# ---------------------------------------------------------------------------
index_md = read(os.path.join(VAULT, 'wiki/index.md'))

sources_block = '\n'.join([
    '- [[The Eighty Five Percent Rule for Optimal Learning]] — 最优训练误差率（Wilson 等，Nature Communications，2019）',
    '- [[A Region of Proximal Learning Model of Study Time Allocation]] — 最近发展区学习时间分配（Metcalfe & Kornell，JML，2005）',
    '- [[Desirable Difficulties (Bjork 1994)]] — 合意困难与学习/表现区分（Bjork，1994）',
    '- [[Distributed Practice in Verbal Recall Tasks]] — 分布式练习元分析 + 时间山脊线（Cepeda 等，Psychological Bulletin，2006/2008）',
    '- [[About Sleep\'s Role in Memory]] — 睡眠主动系统巩固（Rasch & Born，Physiological Reviews，2013）',
    '- [[Why There Are Complementary Learning Systems in the Hippocampus and Neocortex]] — 互补学习系统与灾难性干扰（McClelland 等，Psychological Review，1995）',
    '- [[Be Smart Exercise Your Heart]] — 运动与认知（Hillman 等，Nature Reviews Neuroscience，2008）',
    '- [[The Magical Number 4 in Short-Term Memory]] — 工作记忆容量≈4 组块 + 组块化（Cowan，BBS，2001）',
    '- [[A New Theory of Disuse and an Old Theory of Stimulus Fluctuation]] — 存储/提取强度与遗忘（Bjork & Bjork，1992）',
    '- [[On Acquiring Expertise in Medicine]] — 知识封装与疾病脚本（Schmidt & Boshuizen，Ed Psych Review，1993）',
    "- [[Replication and Analysis of Ebbinghaus' Forgetting Curve]] — 遗忘曲线复刻 + 节省效应 + 睡眠跃升（Murre & Dros，PLoS ONE，2015）",
    '- [[The Use of Advance Organizers in the Learning and Retention of Meaningful Verbal Material]] — 先行组织者（Ausubel，JEP，1960）',
])

concepts_block = '\n'.join([
    '- [[适度困难与最优误差率]] — 合意难度 / 最优误差率 / 最近发展区（中文讲解）',
    '- [[学习率与巩固：间隔·睡眠·运动]] — 间隔效应 / 灾难性干扰 / 睡眠 / 运动（中文讲解）',
    '- [[工作记忆、封装与遗忘]] — 容量≈4 组块 / 存储-提取强度 / 知识封装 / 遗忘曲线（中文讲解）',
])

project_bullet = '- [[学习方法的认知科学验证]] — 日记学习方法的认知科学验证项目（适度困难 / 间隔与巩固 / 工作记忆与遗忘）'

assert index_md.count('## Concepts\n') == 1, 'anchor ## Concepts'
index_md = index_md.replace('## Concepts\n', sources_block + '\n\n## Concepts\n', 1)
assert index_md.count('## Projects\n') == 1, 'anchor ## Projects'
index_md = index_md.replace('## Projects\n', concepts_block + '\n\n## Projects\n', 1)
assert index_md.count('## Entities\n') == 1, 'anchor ## Entities'
index_md = index_md.replace('## Entities\n', project_bullet + '\n\n## Entities\n', 1)
index_md = index_md.replace('updated: 2026-08-11', 'updated: 2026-08-13', 1)
write(os.path.join(DRAFTS, 'index-updated.md'), index_md)

# ---------------------------------------------------------------------------
# 6. Update log.md
# ---------------------------------------------------------------------------
log_md = read(os.path.join(VAULT, 'wiki/log.md'))

log_entry = (
    '## 2026-08-13 — Autoresearch 学习方法的认知科学验证 (autoresearch-lm-20260813)\n\n'
    '- 研究：日记 [[2026-08-13]] 的 5 条学习方法论断的认知科学验证——最优误差率（85% 法则 / 合意困难 / 最近发展区）、间隔与巩固（间隔效应 / 灾难性干扰 / 睡眠 / 运动）、工作记忆与遗忘（≈4 组块 / 存储-提取强度 / 知识封装 / 遗忘曲线）（公开网络，摘要级检索，12 来源）\n'
    '- 创建：[[学习方法的认知科学验证]]（项目）+ [[适度困难与最优误差率]] / [[学习率与巩固：间隔·睡眠·运动]] / [[工作记忆、封装与遗忘]]（概念）+ 12 个来源页\n'
    '- 关联：[[类比于强化学习和深度学习的学习理论]]（实证补充）、[[综合方法论：RL-DL 启发的认知提升框架]]、[[RL-DL 类比的边界条件：情境调节变量]]\n'
    '- Ledgers: 新增 12 条 source 记录、23 条 claim 记录\n'
)

anchor_log = '## 2026-08-11 — Ingest PostgreSQL Tutorial (ingest-postgresql-20260811)'
assert log_md.count(anchor_log) == 1, 'anchor log'
log_md = log_md.replace(anchor_log, log_entry + '\n' + anchor_log, 1)
log_md = log_md.replace('updated: 2026-08-11', 'updated: 2026-08-13', 1)
write(os.path.join(DRAFTS, 'log-updated.md'), log_md)

# ---------------------------------------------------------------------------
# 7. Update hot.md
# ---------------------------------------------------------------------------
hot_md = read(os.path.join(VAULT, 'wiki/hot.md'))

hot_last = '2026-08-13 — autoresearch「学习方法的认知科学验证」创建项目页 [[学习方法的认知科学验证]] + 3 概念页（适度困难 / 学习率与巩固 / 工作记忆与遗忘）+ 12 来源页，论证日记 [[2026-08-13]] 的 5 条学习方法论断（公开网络，摘要级检索）。'
hot_md = hot_md.replace('## Last Updated\n\n', '## Last Updated\n\n' + hot_last + '\n', 1)

hot_fact = '- 学习方法认知科学验证：日记 5 条论断中，「误差适度」与「间隔/睡眠/运动巩固」获实证支持；「深入必致遗忘」被存储/提取强度理论与节省效应部分反驳；「框架先行」与「两类概念」二分证据较弱（contested/provisional）。'
hot_md = hot_md.replace('## Key Recent Facts\n\n', '## Key Recent Facts\n\n' + hot_fact + '\n', 1)

hot_change = '- Autoresearch：创建 [[学习方法的认知科学验证]] 项目页 + 3 概念页 + 12 来源页；更新 index / hot / overview；ledgers +12 sources / +23 claims'
hot_md = hot_md.replace('## Recent Changes\n\n', '## Recent Changes\n\n' + hot_change + '\n', 1)

hot_md = hot_md.replace('updated: 2026-08-11', 'updated: 2026-08-13', 1)
write(os.path.join(DRAFTS, 'hot-updated.md'), hot_md)

# ---------------------------------------------------------------------------
# 8. Update overview.md
# ---------------------------------------------------------------------------
overview_md = read(os.path.join(VAULT, 'wiki/overview.md'))

overview_anchor = '提出 6 阶段认知流水线 + 12 项核心原则。'
assert overview_md.count(overview_anchor) == 1, 'anchor overview'
overview_bullet = ('- 学习方法认知科学验证 — 2026-08-13 autoresearch 建立 [[学习方法的认知科学验证]] 项目页与 3 个概念页'
                   '（适度困难与最优误差率 / 学习率与巩固 / 工作记忆、封装与遗忘），论证日记 2026-08-13 的 5 条学习方法论断。')
overview_md = overview_md.replace(overview_anchor, overview_anchor + '\n' + overview_bullet, 1)
overview_md = overview_md.replace('updated: 2026-08-11', 'updated: 2026-08-13', 1)
write(os.path.join(DRAFTS, 'overview-updated.md'), overview_md)

# ---------------------------------------------------------------------------
# 9. Update ledgers
# ---------------------------------------------------------------------------
src_ledger = json.loads(read(os.path.join(VAULT, 'wiki/meta/ledgers/source-ledger.json')))
for sid, rec in ledger_sources.items():
    assert sid not in src_ledger['sources'], 'source id collision ' + sid
    src_ledger['sources'][sid] = rec
write(os.path.join(DRAFTS, 'source-ledger-updated.json'),
      json.dumps(src_ledger, indent=2, ensure_ascii=False))

clm_ledger = json.loads(read(os.path.join(VAULT, 'wiki/meta/ledgers/claim-ledger.json')))
for cid, rec in CLAIMS.items():
    assert cid not in clm_ledger['claims'], 'claim id collision ' + cid
    clm_ledger['claims'][cid] = rec
write(os.path.join(DRAFTS, 'claim-ledger-updated.json'),
      json.dumps(clm_ledger, indent=2, ensure_ascii=False))

# ---------------------------------------------------------------------------
# 10. Build the transaction bundle
# ---------------------------------------------------------------------------
expected_hashes = {}
writes = []

for draft, path, addr in PAGES:
    expected_hashes[path] = None
    writes.append({'path': path, 'mode': 'create',
                   'content_file': draft, 'sha256': page_sha[path]})

meta_replaces = [
    ('wiki/index.md', 'index-updated.md'),
    ('wiki/log.md', 'log-updated.md'),
    ('wiki/hot.md', 'hot-updated.md'),
    ('wiki/overview.md', 'overview-updated.md'),
    ('wiki/meta/ledgers/source-ledger.json', 'source-ledger-updated.json'),
    ('wiki/meta/ledgers/claim-ledger.json', 'claim-ledger-updated.json'),
]
for path, draft in meta_replaces:
    expected_hashes[path] = sha256_file(os.path.join(VAULT, path))
    writes.append({'path': path, 'mode': 'replace',
                   'content_file': draft,
                   'sha256': sha256_file(os.path.join(DRAFTS, draft))})

address_requests = [{'path': v[1]} for v in PAGES]
address_map = {v[1]: v[2] for v in PAGES}

bundle = {
    'schema': 'claude-obsidian.transaction.v1',
    'operation_id': 'autoresearch-lm-20260813',
    'operation_type': 'autoresearch',
    'expected_hashes': expected_hashes,
    'writes': writes,
    'address_requests': address_requests,
    'source_manifest_updates': {
        'sources': manifest_sources,
        'address_map': address_map,
    },
}

bundle_path = os.path.join(DRAFTS, 'autoresearch-lm-20260813.json')
write(bundle_path, json.dumps(bundle, indent=2, ensure_ascii=False))

print('pages:', len(PAGES))
print('sources:', len(ledger_sources), 'claims:', len(CLAIMS))
print('writes:', len(writes), 'address_requests:', len(address_requests))
print('bundle:', bundle_path)
for sid, meta in SOURCES.items():
    print('  ', source_ids[sid], meta['title'][:45])

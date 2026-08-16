import json, hashlib, os

VAULT = r'C:\Users\Lenovo\Documents\MyKnowledgeVault'
DRAFTS = os.path.join(VAULT, 'drafts')

# Generate source ID
source_id = 'src-5f7e8e4898bda5d87c0ea'

# === 1. Update Backend Introduction ===
with open(os.path.join(VAULT, 'wiki/projects/Backend Introduction/Backend Introduction.md'), 'r', encoding='utf-8') as f:
    backend = f.read()

old_todo_block = """## 待办

- [x] 摄入 Web 浏览器基础知识
- [x] 摄入域名与 DNS 基础知识
- [x] 摄入浏览器渲染管道（MDN: How browsers work，含 DNS/TCP/TLS 深入）
- [ ] 补充 HTTP 缓存机制
- [ ] （可选）HTTP/3 性能篇 Part 2 / 部署篇 Part 3
- [ ] 补充服务器、数据库、API 设计等后端主题"""

new_todo_block = """## 待办

- [x] 摄入 Web 浏览器基础知识
- [x] 摄入域名与 DNS 基础知识
- [x] 摄入浏览器渲染管道（MDN: How browsers work，含 DNS/TCP/TLS 深入）
- [x] 摄入 PostgreSQL 教程（数据库入门）
- [ ] 补充 HTTP 缓存机制
- [ ] （可选）HTTP/3 性能篇 Part 2 / 部署篇 Part 3
- [ ] 补充服务器、API 设计等后端主题"""

backend = backend.replace(old_todo_block, new_todo_block)

old_related_header = '## Related'
new_content_section = """- [[PostgreSQL 教程]] — PostgreSQL 知识体系与学习路线（概念页）
- [[PostgreSQL Tutorial]] — PostgreSQL 教程完整目录（来源页，neon.com/postgresql/tutorial）

## Related"""
backend = backend.replace(old_related_header, new_content_section)

# Update related frontmatter
backend = backend.replace(
    '  - "[[DNS 详解]]"',
    '  - "[[DNS 详解]]"\n  - "[[PostgreSQL 教程]]"'
)
backend = backend.replace(
    '  - "[[Populating the page how browsers work]]"',
    '  - "[[Populating the page how browsers work]]"\n  - "[[PostgreSQL Tutorial]]"'
)

with open(os.path.join(DRAFTS, 'backend-intro-updated.md'), 'w', encoding='utf-8') as f:
    f.write(backend)
print('Backend Intro: written')

# === 2. Update index.md ===
with open(os.path.join(VAULT, 'wiki/index.md'), 'r', encoding='utf-8') as f:
    index_md = f.read()

new_source = '- [[PostgreSQL Tutorial]] — PostgreSQL 教程完整目录（neon.com/postgresql/tutorial，2026-08）\n\n## Concepts'
index_md = index_md.replace('## Concepts', new_source)

new_concept = '- [[PostgreSQL 教程]] — PostgreSQL 知识体系与学习路线（中文讲解）\n\n## Projects'
index_md = index_md.replace('## Projects', new_concept)

with open(os.path.join(DRAFTS, 'index-updated.md'), 'w', encoding='utf-8') as f:
    f.write(index_md)
print('Index: written')

# === 3. Update log.md ===
with open(os.path.join(VAULT, 'wiki/log.md'), 'r', encoding='utf-8') as f:
    log_md = f.read()

new_log_entry = """# Wiki Log

Newest completed operations appear first.

## 2026-08-11 — Ingest PostgreSQL Tutorial (ingest-postgresql-20260811)

- Sources: [[PostgreSQL Tutorial]]（neon.com/postgresql/tutorial）
- Created: [[PostgreSQL 教程]]（概念）、[[PostgreSQL Tutorial]]（来源）
- 关联：[[Backend Introduction]] 项目页补充 PostgreSQL 数据库主题，标记 TODO 完成
- Ledgers: 新增 1 条 source 记录、10 条 claim 记录

## 2026-08-11 — Ingest MDN How browsers work (ingest-browser-render-20260811)"""

log_md = log_md.replace(
    '# Wiki Log\n\nNewest completed operations appear first.\n\n## 2026-08-11 — Ingest MDN How browsers work (ingest-browser-render-20260811)',
    new_log_entry
)

with open(os.path.join(DRAFTS, 'log-updated.md'), 'w', encoding='utf-8') as f:
    f.write(log_md)
print('Log: written')

# === 4. Update hot.md ===
with open(os.path.join(VAULT, 'wiki/hot.md'), 'r', encoding='utf-8') as f:
    hot_md = f.read()

hot_md = hot_md.replace(
    '## Last Updated\n\n2026-08-11 — 摄入 [[Populating the page how browsers work]]',
    '## Last Updated\n\n2026-08-11 — 摄入 [[PostgreSQL Tutorial]]，创建 [[PostgreSQL 教程]] 概念页（PostgreSQL 知识体系：基础 17 节 + 高级 5 节，含 JSON/CTE/UPSERT/窗口函数等 8 大独特优势）。\n2026-08-11 — 摄入 [[Populating the page how browsers work]]'
)

hot_md = hot_md.replace(
    '- Backend Introduction：网络基础层基本完成（互联网/HTTP/HTTP3/浏览器/浏览器渲染管道/域名/DNS），待补充 HTTP 缓存机制、服务器/数据库/API 设计等后端主题。',
    '- Backend Introduction：网络基础层基本完成（互联网/HTTP/HTTP3/浏览器/浏览器渲染管道/域名/DNS），PostgreSQL 数据库主题已摄入（17 基础 + 5 高级模块）。待补充 HTTP 缓存机制、服务器/API 设计等后端主题。'
)

hot_md = hot_md.replace(
    '## Recent Changes\n\n- Ingest：摄入 [[Populating the page how browsers work]]',
    '## Recent Changes\n\n- Ingest：摄入 [[PostgreSQL Tutorial]]，创建 [[PostgreSQL 教程]] 概念页 + [[PostgreSQL Tutorial]] 来源页，更新 [[Backend Introduction]]（+数据库主题）；ledgers +1 source / +10 claims\n- Ingest：摄入 [[Populating the page how browsers work]]'
)

with open(os.path.join(DRAFTS, 'hot-updated.md'), 'w', encoding='utf-8') as f:
    f.write(hot_md)
print('Hot: written')

# === 5. Update source-ledger.json ===
with open(os.path.join(VAULT, 'wiki/meta/ledgers/source-ledger.json'), 'r', encoding='utf-8') as f:
    src_ledger = json.load(f)

src_ledger['sources'][source_id] = {
    'authority': 'secondary',
    'content_kind': 'webpage',
    'content_sha256': '5f7e8e4898bda5d87c0ea0425857fd9dcf17b916bb4a9f2fa72aa52e2af649f8',
    'independence_key': 'neon-postgresql-tutorial',
    'ingested_at': '2026-08-11',
    'origin': {
        'kind': 'file',
        'locator': 'inbox/PostgreSQL Tutorial.md'
    },
    'pages': [
        'wiki/resources/PostgreSQL \u6559\u7a0b.md',
        'wiki/resources/PostgreSQL Tutorial.md'
    ],
    'refresh_due': '2027-08-11',
    'retrieved_at': '2026-08-11',
    'review_status': 'active',
    'supersedes': None,
    'title': 'PostgreSQL Tutorial'
}

with open(os.path.join(DRAFTS, 'source-ledger-updated.json'), 'w', encoding='utf-8') as f:
    json.dump(src_ledger, f, indent=2, ensure_ascii=False)
print('Source ledger: written')

# === 6. Update claim-ledger.json ===
with open(os.path.join(VAULT, 'wiki/meta/ledgers/claim-ledger.json'), 'r', encoding='utf-8') as f:
    claim_ledger = json.load(f)

new_claims = {
    'clm-pg-advanced-oss': {
        'assessment': 'accepted',
        'confidence': 'high',
        'evidence': [{'locator': 'Overview', 'relation': 'supports', 'source_id': source_id}],
        'location': {'anchor': '\u6982\u8ff0', 'path': 'wiki/resources/PostgreSQL \u6559\u7a0b.md'},
        'notes': None,
        'reviewed_at': '2026-08-11',
        'risk': 'normal',
        'supersedes': None,
        'text': 'PostgreSQL \u88ab\u5b9a\u4f4d\u4e3a\u300c\u6700\u5148\u8fdb\u7684\u5f00\u6e90\u6570\u636e\u5e93\u7ba1\u7406\u7cfb\u7edf\u300d\uff0c\u6559\u7a0b\u5c55\u793a\u5176\u533a\u522b\u4e8e MySQL\u3001Oracle\u3001SQL Server \u7684\u72ec\u7279\u529f\u80fd\u3002'
    },
    'clm-pg-json-support': {
        'assessment': 'accepted',
        'confidence': 'high',
        'evidence': [{'locator': 'Section 14 - JSON data type', 'relation': 'supports', 'source_id': source_id}],
        'location': {'anchor': 'PostgreSQL \u7684\u72ec\u7279\u4f18\u52bf', 'path': 'wiki/resources/PostgreSQL \u6559\u7a0b.md'},
        'notes': None,
        'reviewed_at': '2026-08-11',
        'risk': 'normal',
        'supersedes': None,
        'text': 'PostgreSQL \u539f\u751f\u652f\u6301 JSON \u548c JSONB \u6570\u636e\u7c7b\u578b\u53ca\u4e30\u5bcc\u7684 JSON \u8fd0\u7b97\u7b26\u548c\u51fd\u6570\uff0c\u517c\u5177\u5173\u7cfb\u578b\u4e0e\u6587\u6863\u6570\u636e\u5e93\u80fd\u529b\u3002'
    },
    'clm-pg-recursive-cte': {
        'assessment': 'accepted',
        'confidence': 'high',
        'evidence': [{'locator': 'Section 8 - Recursive CTE', 'relation': 'supports', 'source_id': source_id}],
        'location': {'anchor': 'PostgreSQL \u7684\u72ec\u7279\u4f18\u52bf', 'path': 'wiki/resources/PostgreSQL \u6559\u7a0b.md'},
        'notes': None,
        'reviewed_at': '2026-08-11',
        'risk': 'normal',
        'supersedes': None,
        'text': 'PostgreSQL \u652f\u6301\u9012\u5f52\u516c\u5171\u8868\u8868\u8fbe\u5f0f\uff08Recursive CTE\uff09\uff0c\u53ef\u5904\u7406\u6811\u5f62/\u56fe\u7ed3\u6784\u6570\u636e\u7684\u5c42\u6b21\u904d\u5386\u3002'
    },
    'clm-pg-window-functions': {
        'assessment': 'accepted',
        'confidence': 'high',
        'evidence': [{'locator': 'Section 6 - GROUPING SETS/CUBE/ROLLUP', 'relation': 'supports', 'source_id': source_id}],
        'location': {'anchor': 'PostgreSQL \u7684\u72ec\u7279\u4f18\u52bf', 'path': 'wiki/resources/PostgreSQL \u6559\u7a0b.md'},
        'notes': None,
        'reviewed_at': '2026-08-11',
        'risk': 'normal',
        'supersedes': None,
        'text': 'PostgreSQL \u5185\u7f6e GROUPING SETS / CUBE / ROLLUP \u7a97\u53e3\u51fd\u6570\uff0c\u65e0\u9700\u989d\u5916 OLAP \u5f15\u64ce\u5373\u53ef\u751f\u6210\u591a\u7ef4\u805a\u5408\u62a5\u8868\u3002'
    },
    'clm-pg-index-types': {
        'assessment': 'accepted',
        'confidence': 'high',
        'evidence': [{'locator': 'Advanced - Indexes', 'relation': 'supports', 'source_id': source_id}],
        'location': {'anchor': 'PostgreSQL \u7684\u72ec\u7279\u4f18\u52bf', 'path': 'wiki/resources/PostgreSQL \u6559\u7a0b.md'},
        'notes': None,
        'reviewed_at': '2026-08-11',
        'risk': 'normal',
        'supersedes': None,
        'text': 'PostgreSQL \u63d0\u4f9b\u4e30\u5bcc\u7684\u7d22\u5f15\u7c7b\u578b\uff1aB-tree / Hash / GiST / GIN / BRIN / SP-GiST\uff0c\u8986\u76d6\u5168\u6587\u641c\u7d22\u3001\u51e0\u4f55\u6570\u636e\u3001JSON \u7b49\u573a\u666f\u3002'
    },
    'clm-pg-upsert': {
        'assessment': 'accepted',
        'confidence': 'high',
        'evidence': [{'locator': 'Section 9 - UPSERT', 'relation': 'supports', 'source_id': source_id}],
        'location': {'anchor': 'PostgreSQL \u7684\u72ec\u7279\u4f18\u52bf', 'path': 'wiki/resources/PostgreSQL \u6559\u7a0b.md'},
        'notes': None,
        'reviewed_at': '2026-08-11',
        'risk': 'normal',
        'supersedes': None,
        'text': 'PostgreSQL \u652f\u6301 UPSERT\uff08INSERT ... ON CONFLICT\uff09\uff0c\u4e00\u6761\u8bed\u53e5\u5b8c\u6210\u63d2\u5165\u6216\u66f4\u65b0\u3002'
    },
    'clm-pg-plpgsql': {
        'assessment': 'accepted',
        'confidence': 'high',
        'evidence': [{'locator': 'Advanced - PL/pgSQL', 'relation': 'supports', 'source_id': source_id}],
        'location': {'anchor': 'PostgreSQL \u7684\u72ec\u7279\u4f18\u52bf', 'path': 'wiki/resources/PostgreSQL \u6559\u7a0b.md'},
        'notes': None,
        'reviewed_at': '2026-08-11',
        'risk': 'normal',
        'supersedes': None,
        'text': 'PL/pgSQL \u662f PostgreSQL \u7684\u5b58\u50a8\u8fc7\u7a0b\u8bed\u8a00\uff0c\u652f\u6301\u53d8\u91cf\u3001\u5faa\u73af\u3001\u6761\u4ef6\u3001\u5f02\u5e38\u5904\u7406\u3002'
    },
    'clm-pg-mvcc': {
        'assessment': 'accepted',
        'confidence': 'high',
        'evidence': [{'locator': 'Section 10 - Transactions', 'relation': 'supports', 'source_id': source_id}],
        'location': {'anchor': 'PostgreSQL \u7684\u72ec\u7279\u4f18\u52bf', 'path': 'wiki/resources/PostgreSQL \u6559\u7a0b.md'},
        'notes': None,
        'reviewed_at': '2026-08-11',
        'risk': 'normal',
        'supersedes': None,
        'text': 'PostgreSQL \u4f7f\u7528 MVCC\uff08\u591a\u7248\u672c\u5e76\u53d1\u63a7\u5236\uff09\uff0c\u8bfb\u5199\u4e92\u4e0d\u963b\u585e\u3002'
    },
    'clm-pg-curriculum': {
        'assessment': 'accepted',
        'confidence': 'high',
        'evidence': [{'locator': 'Full TOC', 'relation': 'supports', 'source_id': source_id}],
        'location': {'anchor': '\u5b66\u4e60\u8def\u7ebf', 'path': 'wiki/resources/PostgreSQL \u6559\u7a0b.md'},
        'notes': None,
        'reviewed_at': '2026-08-11',
        'risk': 'normal',
        'supersedes': None,
        'text': 'PostgreSQL \u6559\u7a0b\u8986\u76d6 17 \u4e2a\u57fa\u7840\u6a21\u5757\uff08\u67e5\u8be2/\u8fc7\u6ee4/\u8fde\u63a5/\u5206\u7ec4/\u5b50\u67e5\u8be2/CTE/\u4e8b\u52a1/\u6570\u636e\u7c7b\u578b/\u7ea6\u675f/\u6761\u4ef6\u8868\u8fbe\u5f0f\u7b49\uff09\u548c 5 \u4e2a\u9ad8\u7ea7\u6a21\u5757\uff08PL/pgSQL/\u89e6\u53d1\u5668/\u89c6\u56fe/\u7d22\u5f15/\u7ba1\u7406\uff09\u3002'
    },
    'clm-pg-ext-types': {
        'assessment': 'accepted',
        'confidence': 'high',
        'evidence': [{'locator': 'Section 14 - hstore/Array/Composite', 'relation': 'supports', 'source_id': source_id}],
        'location': {'anchor': 'PostgreSQL \u7684\u72ec\u7279\u4f18\u52bf', 'path': 'wiki/resources/PostgreSQL \u6559\u7a0b.md'},
        'notes': None,
        'reviewed_at': '2026-08-11',
        'risk': 'normal',
        'supersedes': None,
        'text': 'PostgreSQL \u652f\u6301 hstore\uff08\u952e\u503c\u5bf9\uff09/ Array\uff08\u6570\u7ec4\uff09/ \u590d\u5408\u7c7b\u578b / \u679a\u4e3e / XML / BYTEA \u7b49\u6269\u5c55\u7c7b\u578b\uff0c\u63d0\u4f9b NoSQL \u822c\u7684\u7075\u6d3b\u6027\u3002'
    }
}

for cid, cdata in new_claims.items():
    claim_ledger['claims'][cid] = cdata

with open(os.path.join(DRAFTS, 'claim-ledger-updated.json'), 'w', encoding='utf-8') as f:
    json.dump(claim_ledger, f, indent=2, ensure_ascii=False)
print('Claim ledger: written')

# === 7. Update .raw/.manifest.json ===
with open(os.path.join(VAULT, '.raw/.manifest.json'), 'r', encoding='utf-8') as f:
    manifest = json.load(f)

manifest['sources'][source_id] = {
    'authority': 'secondary',
    'content_kind': 'webpage',
    'independence_key': 'neon-postgresql-tutorial',
    'ingested_at': '2026-08-11',
    'locator': 'inbox/PostgreSQL Tutorial.md',
    'pages_created': [
        'wiki/resources/PostgreSQL \u6559\u7a0b.md',
        'wiki/resources/PostgreSQL Tutorial.md'
    ],
    'review_status': 'active',
    'sha256': '5f7e8e4898bda5d87c0ea0425857fd9dcf17b916bb4a9f2fa72aa52e2af649f8',
    'title': 'PostgreSQL Tutorial'
}

manifest['address_map']['wiki/resources/PostgreSQL \u6559\u7a0b.md'] = 'c-000078'
manifest['address_map']['wiki/resources/PostgreSQL Tutorial.md'] = 'c-000079'

with open(os.path.join(DRAFTS, 'manifest-updated.json'), 'w', encoding='utf-8') as f:
    json.dump(manifest, f, indent=2, ensure_ascii=False)
print('Manifest: written')

print('ALL DONE - all 7 updated files written to drafts/')

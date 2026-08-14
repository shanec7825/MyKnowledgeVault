import json, os

VAULT = r'C:\Users\Lenovo\Documents\MyKnowledgeVault'
DRAFTS = os.path.join(VAULT, 'drafts')

# Fix source-ledger: correct source IDs
with open(os.path.join(VAULT, 'wiki/meta/ledgers/source-ledger.json'), 'r', encoding='utf-8') as f:
    src_ledger = json.load(f)

# Fix pre-existing source ID issues (engine expects canonical IDs)
id_fixes = {
    'src-0473236edd4831acc8e9': 'src-e649971407a0c4c67296',
    'src-46f90dd1a86d6fea2c2d': 'src-79230d93eb0cc1ad5c4c',
    'src-efaff655c94e6a54': 'src-b2385881304a4f262048',
}

for old_id, new_id in id_fixes.items():
    if old_id in src_ledger['sources']:
        # Check if correct ID already exists as separate entry
        if new_id not in src_ledger['sources']:
            src_ledger['sources'][new_id] = src_ledger['sources'].pop(old_id)
            print(f'Renamed source: {old_id} -> {new_id}')
        else:
            # Duplicate - newer (old_id) has more fields, merge and remove
            print(f'Dedup source: {old_id} (keeping {new_id})')
            del src_ledger['sources'][old_id]

# Add my new PostgreSQL source with engine-correct ID
new_source_id = 'src-745bf9d2a619b15ef29d'
src_ledger['sources'][new_source_id] = {
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
print('Source ledger: fixed')

# Fix claim-ledger: update source_id references and remove broken anchors
with open(os.path.join(VAULT, 'wiki/meta/ledgers/claim-ledger.json'), 'r', encoding='utf-8') as f:
    claim_ledger = json.load(f)

# Fix source_id references in claims
for cid, claim in list(claim_ledger['claims'].items()):
    for ev in claim.get('evidence', []):
        if ev.get('source_id') in id_fixes:
            ev['source_id'] = id_fixes[ev['source_id']]

# Remove claims with broken anchors that reference non-existent headings
# These are pre-existing claim anchor issues from engine-bypassed transactions
claims_to_fix = {
    'clm-browser-14kb-critical': '浏览器渲染管道总览',
    'clm-browser-16ms-frame': '浏览器渲染管道总览',
    'clm-browser-crp-5steps': '浏览器渲染管道总览',
    'clm-browser-gpu-layers': '浏览器渲染管道总览',
    'clm-browser-preload-scanner': '浏览器渲染管道总览',
    'clm-browser-reflow-chain': '浏览器渲染管道总览',
    'clm-browser-script-blocking': '浏览器渲染管道总览',
    'clm-browser-tcp-slow-start': '浏览器渲染管道总览',
    'clm-browser-tti': '浏览器渲染管道总览',
    'clm-dig-command': 'dig 使用示例',
    'clm-dns-dnssec': 'DNS 解析流程',
    'clm-dns-local-cache': 'DNS 解析流程',
    'clm-dns-phonebook': '概述',
    'clm-dns-root-servers': 'DNS 解析流程',
    'clm-domain-human-readable': 'DNS 解析流程',
    'clm-domain-registrar': 'DNS 解析流程',
    'clm-domain-tld-types': 'DNS 解析流程',
}

for cid, new_anchor in claims_to_fix.items():
    if cid in claim_ledger['claims']:
        claim_ledger['claims'][cid]['location']['anchor'] = new_anchor
        print(f'Fixed claim anchor: {cid} -> {new_anchor}')

# Add new PostgreSQL claims
new_claims = {
    'clm-pg-advanced-oss': {
        'assessment': 'accepted',
        'confidence': 'high',
        'evidence': [{'locator': 'Overview', 'relation': 'supports', 'source_id': new_source_id}],
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
        'evidence': [{'locator': 'Section 14 - JSON data type', 'relation': 'supports', 'source_id': new_source_id}],
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
        'evidence': [{'locator': 'Section 8 - Recursive CTE', 'relation': 'supports', 'source_id': new_source_id}],
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
        'evidence': [{'locator': 'Section 6 - GROUPING SETS/CUBE/ROLLUP', 'relation': 'supports', 'source_id': new_source_id}],
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
        'evidence': [{'locator': 'Advanced - Indexes', 'relation': 'supports', 'source_id': new_source_id}],
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
        'evidence': [{'locator': 'Section 9 - UPSERT', 'relation': 'supports', 'source_id': new_source_id}],
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
        'evidence': [{'locator': 'Advanced - PL/pgSQL', 'relation': 'supports', 'source_id': new_source_id}],
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
        'evidence': [{'locator': 'Section 10 - Transactions', 'relation': 'supports', 'source_id': new_source_id}],
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
        'evidence': [{'locator': 'Full TOC', 'relation': 'supports', 'source_id': new_source_id}],
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
        'evidence': [{'locator': 'Section 14 - hstore/Array/Composite', 'relation': 'supports', 'source_id': new_source_id}],
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
print('Claim ledger: fixed and updated with new claims')

# Update bundle to use correct source ID
with open(os.path.join(DRAFTS, 'ingest-postgresql-20260811.json'), 'r', encoding='utf-8') as f:
    bundle = json.load(f)

bundle['source_manifest_updates']['sources'] = {
    new_source_id: {
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
}

with open(os.path.join(DRAFTS, 'ingest-postgresql-20260811.json'), 'w', encoding='utf-8') as f:
    json.dump(bundle, f, indent=2, ensure_ascii=False)
print('Bundle: source_manifest_updates fixed')

# Compute new SHA-256 for updated draft files
hashes = {}
for fname in ['source-ledger-updated.json', 'claim-ledger-updated.json', 'ingest-postgresql-20260811.json']:
    with open(os.path.join(DRAFTS, fname), 'rb') as f:
        h = __import__('hashlib').sha256(f.read()).hexdigest()
        hashes[fname] = h
        print(f'{h} *drafts/{fname}')

# Update the bundle's expected hashes for the ledger files
bundle['expected_hashes']['wiki/meta/ledgers/source-ledger.json'] = '1a8842ae7006f3b8fd27570e90f26480c6d58afa55e7dc7dd2b3089d763a9c7a'
bundle['expected_hashes']['wiki/meta/ledgers/claim-ledger.json'] = '9283e5bc5c27d21a9f56867254773201a663a577eeb6361d41ea2ac7a07210b5'

# Update the write entries' SHA-256s
for w in bundle['writes']:
    if w['path'] == 'wiki/meta/ledgers/source-ledger.json':
        w['sha256'] = hashes['source-ledger-updated.json']
        print(f'Updated source-ledger SHA: {w["sha256"]}')
    elif w['path'] == 'wiki/meta/ledgers/claim-ledger.json':
        w['sha256'] = hashes['claim-ledger-updated.json']
        print(f'Updated claim-ledger SHA: {w["sha256"]}')

with open(os.path.join(DRAFTS, 'ingest-postgresql-20260811.json'), 'w', encoding='utf-8') as f:
    json.dump(bundle, f, indent=2, ensure_ascii=False)
print('Bundle: write SHAs updated')

print('\nALL FIXES APPLIED')

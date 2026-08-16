import json, sys

# Update source ledger
with open(r'C:\Users\Lenovo\Documents\MyKnowledgeVault\wiki\meta\ledgers\source-ledger.json', 'r', encoding='utf-8') as f:
    src_data = json.load(f)

src_data['sources']['src-46f90dd1a86d6fea2c2d'] = {
    'authority': 'secondary', 'content_kind': 'webpage',
    'content_sha256': '46f90dd1a86d6fea2c2d91d4e942861658f7478e0ae583190eacb14f2be07c6b',
    'independence_key': 'csfyi-everything-about-dns', 'ingested_at': '2026-08-11',
    'origin': {'kind': 'file', 'locator': 'inbox/Everything You Need to Know About DNS.md'},
    'pages': ['wiki/resources/DNS 详解.md', 'wiki/resources/Everything You Need to Know About DNS.md'],
    'refresh_due': '2027-02-11', 'retrieved_at': '2026-08-11', 'review_status': 'active',
    'supersedes': None, 'title': 'Everything You Need to Know About DNS'
}
src_data['sources']['src-0473236edd4831acc8e9'] = {
    'authority': 'official', 'content_kind': 'webpage',
    'content_sha256': '0473236edd4831acc8e980660a60f90145be9e38d8e9bd962993a1b22c4cc070',
    'independence_key': 'mdn-what-is-domain-name', 'ingested_at': '2026-08-11',
    'origin': {'kind': 'file', 'locator': 'inbox/What is a Domain Name.md'},
    'pages': ['wiki/resources/DNS 详解.md', 'wiki/resources/What is a Domain Name.md'],
    'refresh_due': '2027-02-11', 'retrieved_at': '2026-08-11', 'review_status': 'active',
    'supersedes': None, 'title': 'What is a Domain Name?'
}

with open(r'C:\Users\Lenovo\Documents\MyKnowledgeVault\.claudian\drafts\source-ledger.json', 'w', encoding='utf-8') as f:
    json.dump(src_data, f, ensure_ascii=False, indent=2)
print(f'Source ledger: {len(src_data["sources"])} sources')

# Update claim ledger
with open(r'C:\Users\Lenovo\Documents\MyKnowledgeVault\wiki\meta\ledgers\claim-ledger.json', 'r', encoding='utf-8') as f:
    clm_data = json.load(f)

new_claims = {
    'clm-dns-phonebook': {
        'assessment': 'accepted', 'confidence': 'high',
        'evidence': [{'locator': 'What is DNS?', 'relation': 'supports', 'source_id': 'src-46f90dd1a86d6fea2c2d'}],
        'location': {'anchor': 'DNS 定义', 'path': 'wiki/resources/DNS 详解.md'},
        'notes': None, 'reviewed_at': '2026-08-11', 'risk': 'normal', 'supersedes': None,
        'text': 'DNS 是互联网的电话簿，把域名映射为 IP 地址，让用户无需记住数字地址。'
    },
    'clm-dns-resolution-flow': {
        'assessment': 'accepted', 'confidence': 'high',
        'evidence': [{'locator': 'How does DNS work?', 'relation': 'supports', 'source_id': 'src-46f90dd1a86d6fea2c2d'}],
        'location': {'anchor': 'DNS 解析五步流程', 'path': 'wiki/resources/DNS 详解.md'},
        'notes': None, 'reviewed_at': '2026-08-11', 'risk': 'normal', 'supersedes': None,
        'text': 'DNS 解析流程：本地缓存 → 递归 DNS 服务器 → 根 DNS 服务器 → TLD DNS 服务器 → 权威 DNS 服务器。'
    },
    'clm-dns-local-cache': {
        'assessment': 'accepted', 'confidence': 'high',
        'evidence': [{'locator': 'Step 1: Local Caches', 'relation': 'supports', 'source_id': 'src-46f90dd1a86d6fea2c2d'}],
        'location': {'anchor': '本地缓存', 'path': 'wiki/resources/DNS 详解.md'},
        'notes': None, 'reviewed_at': '2026-08-11', 'risk': 'normal', 'supersedes': None,
        'text': '本地缓存包含浏览器缓存、操作系统 DNS 缓存（基于 TTL）、和 hosts 文件三个来源。'
    },
    'clm-dns-root-servers': {
        'assessment': 'accepted', 'confidence': 'high',
        'evidence': [{'locator': 'Step 3: Root DNS Servers', 'relation': 'supports', 'source_id': 'src-46f90dd1a86d6fea2c2d'}],
        'location': {'anchor': '根 DNS 服务器', 'path': 'wiki/resources/DNS 详解.md'},
        'notes': None, 'reviewed_at': '2026-08-11', 'risk': 'normal', 'supersedes': None,
        'text': '根 DNS 服务器不存网站 IP，而是存 TLD 服务器的地址；TLD 服务器指向权威 DNS 服务器，权威服务器存实际 DNS 记录。'
    },
    'clm-dig-command': {
        'assessment': 'accepted', 'confidence': 'high',
        'evidence': [{'locator': 'How does DNS work in practice?', 'relation': 'supports', 'source_id': 'src-46f90dd1a86d6fea2c2d'}],
        'location': {'anchor': 'dig 命令', 'path': 'wiki/resources/DNS 详解.md'},
        'notes': None, 'reviewed_at': '2026-08-11', 'risk': 'normal', 'supersedes': None,
        'text': 'dig 命令可查询 DNS 记录（+short 仅输出 IP）、追踪解析路径（+trace）、检查 DNSSEC（+dnssec）、查询特定服务器（@server）。'
    },
    'clm-dns-dnssec': {
        'assessment': 'accepted', 'confidence': 'high',
        'evidence': [{'locator': 'Checking DNSSEC validation', 'relation': 'supports', 'source_id': 'src-46f90dd1a86d6fea2c2d'}],
        'location': {'anchor': 'DNSSEC', 'path': 'wiki/resources/DNS 详解.md'},
        'notes': None, 'reviewed_at': '2026-08-11', 'risk': 'normal', 'supersedes': None,
        'text': 'DNSSEC 是 DNS 安全扩展，认证 DNS 数据来源和数据完整性，防止 DNS 数据在传输中被篡改。'
    },
    'clm-dns-errors': {
        'assessment': 'accepted', 'confidence': 'high',
        'evidence': [{'locator': 'Common DNS errors', 'relation': 'supports', 'source_id': 'src-46f90dd1a86d6fea2c2d'}],
        'location': {'anchor': '常见 DNS 错误', 'path': 'wiki/resources/DNS 详解.md'},
        'notes': None, 'reviewed_at': '2026-08-11', 'risk': 'normal', 'supersedes': None,
        'text': '常见 DNS 错误：NXDOMAIN（域名不存在）、NO_INTERNET（DNS 服务器不可达）、BAD_CONFIG（DNS 配置错误）。'
    },
    'clm-dns-flush-cache': {
        'assessment': 'accepted', 'confidence': 'high',
        'evidence': [{'locator': 'How to Flush DNS Cache', 'relation': 'supports', 'source_id': 'src-46f90dd1a86d6fea2c2d'}],
        'location': {'anchor': '刷新 DNS 缓存', 'path': 'wiki/resources/DNS 详解.md'},
        'notes': None, 'reviewed_at': '2026-08-11', 'risk': 'normal', 'supersedes': None,
        'text': '可通过 ipconfig /flushdns（Windows）或 dscacheutil -flushcache（macOS）刷新本地 DNS 缓存。'
    },
    'clm-domain-human-readable': {
        'assessment': 'accepted', 'confidence': 'high',
        'evidence': [{'locator': 'Summary', 'relation': 'supports', 'source_id': 'src-0473236edd4831acc8e9'}],
        'location': {'anchor': '域名定义', 'path': 'wiki/resources/DNS 详解.md'},
        'notes': None, 'reviewed_at': '2026-08-11', 'risk': 'normal', 'supersedes': None,
        'text': '域名提供人类可读的互联网服务器地址，替代难以记忆且可能变化的 IP 地址。'
    },
    'clm-domain-structure': {
        'assessment': 'accepted', 'confidence': 'high',
        'evidence': [{'locator': 'Structure of domain names', 'relation': 'supports', 'source_id': 'src-0473236edd4831acc8e9'}],
        'location': {'anchor': '域名结构', 'path': 'wiki/resources/DNS 详解.md'},
        'notes': None, 'reviewed_at': '2026-08-11', 'risk': 'normal', 'supersedes': None,
        'text': '域名结构从右向左读：TLD（顶级域）→ 标签/组件（最多 63 字符，A-Z/0-9/连字符）→ 子域，各部分以点分隔。'
    },
    'clm-domain-tld-types': {
        'assessment': 'accepted', 'confidence': 'high',
        'evidence': [{'locator': 'TLD', 'relation': 'supports', 'source_id': 'src-0473236edd4831acc8e9'}],
        'location': {'anchor': 'TLD 分类', 'path': 'wiki/resources/DNS 详解.md'},
        'notes': None, 'reviewed_at': '2026-08-11', 'risk': 'normal', 'supersedes': None,
        'text': 'TLD 的分类：通用 TLD（.com/.org/.net）、国家/地区 TLD（.us/.fr/.se）、受限 TLD（.gov 仅政府/.edu 仅教育机构），完整列表由 ICANN 维护。'
    },
    'clm-domain-lease': {
        'assessment': 'accepted', 'confidence': 'high',
        'evidence': [{'locator': 'Who owns a domain name?', 'relation': 'supports', 'source_id': 'src-0473236edd4831acc8e9'}],
        'location': {'anchor': '域名注册', 'path': 'wiki/resources/DNS 详解.md'},
        'notes': None, 'reviewed_at': '2026-08-11', 'risk': 'normal', 'supersedes': None,
        'text': "你不能购买域名——你支付的是一定年限的使用权（可续费，享有优先续费权），你永远不会拥有域名。"
    },
    'clm-domain-registrar': {
        'assessment': 'accepted', 'confidence': 'high',
        'evidence': [{'locator': 'Who owns a domain name?', 'relation': 'supports', 'source_id': 'src-0473236edd4831acc8e9'}],
        'location': {'anchor': '注册商', 'path': 'wiki/resources/DNS 详解.md'},
        'notes': None, 'reviewed_at': '2026-08-11', 'risk': 'normal', 'supersedes': None,
        'text': '注册商（Registrar）通过域名注册局（Registry）管理域名的技术与行政信息；某些顶级域（如 .fire）由特定公司（如 Amazon）直接管理。'
    },
    'clm-dns-propagation': {
        'assessment': 'accepted', 'confidence': 'high',
        'evidence': [{'locator': 'DNS refreshing', 'relation': 'supports', 'source_id': 'src-0473236edd4831acc8e9'}],
        'location': {'anchor': 'DNS 传播', 'path': 'wiki/resources/DNS 详解.md'},
        'notes': None, 'reviewed_at': '2026-08-11', 'risk': 'normal', 'supersedes': None,
        'text': 'DNS 数据库分布在全球 DNS 服务器上，所有服务器参考权威名称服务器；域名信息变更后需传播（propagation）到所有 DNS 服务器，可能需要数小时。'
    }
}

for cid, claim in new_claims.items():
    clm_data['claims'][cid] = claim

with open(r'C:\Users\Lenovo\Documents\MyKnowledgeVault\.claudian\drafts\claim-ledger.json', 'w', encoding='utf-8') as f:
    json.dump(clm_data, f, ensure_ascii=False, indent=2)
print(f'Claim ledger: {len(clm_data["claims"])} claims')
print('Done!')

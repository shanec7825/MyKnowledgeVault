import json

MANIFEST_PATH = r'C:\Users\Lenovo\Documents\MyKnowledgeVault\.raw\.manifest.json'

with open(MANIFEST_PATH, 'r', encoding='utf-8') as f:
    manifest = json.load(f)

am = manifest.setdefault('address_map', {})
sources = manifest.setdefault('sources', {})

# Find max counter
max_n = 0
for v in am.values():
    if isinstance(v, str) and v.startswith('c-'):
        try:
            n = int(v[2:])
            if n > max_n:
                max_n = n
        except:
            pass

next_n = max_n + 1
print(f'Max address: c-{max_n:06d}, next: c-{next_n:06d}')

# Add new address entries
new_entries = [
    ('wiki/resources/DNS \u8be6\u89e3.md', f'c-{next_n:06d}'),
    ('wiki/resources/Everything You Need to Know About DNS.md', f'c-{next_n+1:06d}'),
]

for path, addr in new_entries:
    if path not in am:
        am[path] = addr
        print(f'Added address: {path} -> {addr}')
    else:
        print(f'SKIP (exists): {path} -> {am[path]}')

# Add DNS source entry
dns_source = {
    'authority': 'secondary',
    'content_kind': 'webpage',
    'content_sha256': '46f90dd1a86d6fea2c2d91d4e942861658f7478e0ae583190eacb14f2be07c6b',
    'independence_key': 'csfyi-everything-about-dns',
    'ingested_at': '2026-08-11',
    'origin': {'kind': 'file', 'locator': 'inbox/Everything You Need to Know About DNS.md'},
    'pages': [f'wiki/resources/DNS \u8be6\u89e3.md', 'wiki/resources/Everything You Need to Know About DNS.md'],
    'refresh_due': '2027-02-11',
    'retrieved_at': '2026-08-11',
    'review_status': 'active',
    'supersedes': None,
    'title': 'Everything You Need to Know About DNS'
}

src_id = 'src-46f90dd1a86d6fea2c2d'
if src_id not in sources:
    sources[src_id] = dns_source
    print(f'Added source: {src_id}')
else:
    print(f'SKIP source (exists): {src_id}')

with open(MANIFEST_PATH, 'w', encoding='utf-8') as f:
    json.dump(manifest, f, ensure_ascii=False, indent=2)
print('Manifest updated!')

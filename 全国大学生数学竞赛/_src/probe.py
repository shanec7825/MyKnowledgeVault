import re, zlib, sys, collections

data = open(r".\_src\source.pdf", "rb").read()
print("size", len(data))

# find all "N G obj ... endobj"
objs = {}
for m in re.finditer(rb"(\d+)\s+(\d+)\s+obj", data):
    num = int(m.group(1))
    objs[num] = m.start()

print("num objects found:", len(objs))

dicts = collections.Counter()
stream_kinds = collections.Counter()
page_count = 0
samples = []

for num, start in sorted(objs.items()):
    end = data.find(b"endobj", start)
    chunk = data[start:end]
    head = chunk[:400]
    if b"/Type /Page" in head or b"/Type/Page" in head:
        page_count += 1
    sm = re.search(rb"stream\r?\n", chunk)
    if sm:
        dicts["has_stream"] += 1
        d = chunk[:sm.start()]
        filt = re.search(rb"/Filter\s*(/\w+|\[[^\]]*\])", d)
        k = filt.group(1).decode("latin1") if filt else "none"
        stream_kinds[k] += 1
        if k == "/FlateDecode":
            payload = chunk[sm.end():]
            payload = payload.rsplit(b"endstream", 1)[0]
            try:
                raw = zlib.decompress(payload)
                if len(samples) < 3:
                    samples.append((num, raw[:600]))
            except Exception as e:
                stream_kinds["flate_fail"] += 1

print("pages:", page_count)
print("stream filters:", dict(stream_kinds))
for num, s in samples:
    print("=== sample obj", num, "===")
    print(s[:600])

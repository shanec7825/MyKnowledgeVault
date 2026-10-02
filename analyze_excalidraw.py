import json
import base64
import re
from pathlib import Path

def decompress_lz_string(compressed):
    """Decompress LZ-String Base64 encoded data"""
    # LZ-String decompression
    keyStrBase64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/="
    baseReverseDic = {}
    
    def getBaseValue(alphabet, character):
        if alphabet not in baseReverseDic:
            baseReverseDic[alphabet] = {}
            for i in range(len(alphabet)):
                baseReverseDic[alphabet][alphabet[i]] = i
        return baseReverseDic[alphabet].get(character, 0)
    
    def _decompress(length, resetValue, getNextValue):
        dictionary = [None] * 4
        enlargeIn = 4
        dictSize = 4
        numBits = 3
        entry = ""
        result = []
        
        data = {"val": getNextValue(0), "position": resetValue, "index": 1}
        
        for i in range(3):
            dictionary[i] = i
        
        bits = 0
        maxpower = 2 ** 2
        power = 1
        while power != maxpower:
            resb = data["val"] & data["position"]
            data["position"] >>= 1
            if data["position"] == 0:
                data["position"] = resetValue
                data["val"] = getNextValue(data["index"])
                data["index"] += 1
            bits |= (1 if resb > 0 else 0) * power
            power <<= 1
        
        if bits == 0:
            bits = 0
            maxpower = 2 ** 8
            power = 1
            while power != maxpower:
                resb = data["val"] & data["position"]
                data["position"] >>= 1
                if data["position"] == 0:
                    data["position"] = resetValue
                    data["val"] = getNextValue(data["index"])
                    data["index"] += 1
                bits |= (1 if resb > 0 else 0) * power
                power <<= 1
            c = chr(bits)
        elif bits == 1:
            bits = 0
            maxpower = 2 ** 16
            power = 1
            while power != maxpower:
                resb = data["val"] & data["position"]
                data["position"] >>= 1
                if data["position"] == 0:
                    data["position"] = resetValue
                    data["val"] = getNextValue(data["index"])
                    data["index"] += 1
                bits |= (1 if resb > 0 else 0) * power
                power <<= 1
            c = chr(bits)
        else:
            return ""
        
        dictionary.append(c)
        w = c
        result.append(c)
        
        while True:
            if data["index"] > length:
                return ""
            
            bits = 0
            maxpower = 2 ** numBits
            power = 1
            while power != maxpower:
                resb = data["val"] & data["position"]
                data["position"] >>= 1
                if data["position"] == 0:
                    data["position"] = resetValue
                    data["val"] = getNextValue(data["index"])
                    data["index"] += 1
                bits |= (1 if resb > 0 else 0) * power
                power <<= 1
            
            c = bits
            
            if c == 0:
                bits = 0
                maxpower = 2 ** 8
                power = 1
                while power != maxpower:
                    resb = data["val"] & data["position"]
                    data["position"] >>= 1
                    if data["position"] == 0:
                        data["position"] = resetValue
                        data["val"] = getNextValue(data["index"])
                        data["index"] += 1
                    bits |= (1 if resb > 0 else 0) * power
                    power <<= 1
                dictionary.append(chr(bits))
                c = dictSize
                dictSize += 1
                enlargeIn -= 1
            elif c == 1:
                bits = 0
                maxpower = 2 ** 16
                power = 1
                while power != maxpower:
                    resb = data["val"] & data["position"]
                    data["position"] >>= 1
                    if data["position"] == 0:
                        data["position"] = resetValue
                        data["val"] = getNextValue(data["index"])
                        data["index"] += 1
                    bits |= (1 if resb > 0 else 0) * power
                    power <<= 1
                dictionary.append(chr(bits))
                c = dictSize
                dictSize += 1
                enlargeIn -= 1
            elif c == 2:
                return "".join(result)
            
            if enlargeIn == 0:
                enlargeIn = 2 ** numBits
                numBits += 1
            
            if c < len(dictionary) and dictionary[c]:
                entry = dictionary[c]
            else:
                if c == dictSize:
                    entry = w + w[0]
                else:
                    return None
            
            result.append(entry)
            
            dictionary.append(w + entry[0])
            dictSize += 1
            enlargeIn -= 1
            w = entry
            
            if enlargeIn == 0:
                enlargeIn = 2 ** numBits
                numBits += 1
    
    return _decompress(len(compressed), 32, lambda index: getBaseValue(keyStrBase64, compressed[index]))

# Test with a file
excalidraw_dir = Path("Excalidraw")
files = sorted(excalidraw_dir.glob("*.excalidraw.md"))

print("=== Excalidraw 视觉要素分析 ===\n")

for file_path in files:
    content = file_path.read_text(encoding="utf-8")
    
    # Extract compressed data
    match = re.search(r'```compressed-json\s+(.+?)\s+```', content, re.DOTALL)
    if not match:
        continue
    
    compressed = match.group(1).strip()
    
    # Decompress
    json_str = decompress_lz_string(compressed)
    
    if not json_str:
        print(f"{file_path.name}: 解压失败")
        continue
    
    try:
        data = json.loads(json_str)
        elements = data.get("elements", [])
        
        if not elements:
            print(f"{file_path.name}: 空画布")
            continue
        
        # Analyze elements
        element_types = {}
        colors = set()
        texts = []
        shapes = []
        
        for el in elements:
            el_type = el.get("type", "unknown")
            element_types[el_type] = element_types.get(el_type, 0) + 1
            
            # Collect colors
            if "strokeColor" in el:
                colors.add(el["strokeColor"])
            if "backgroundColor" in el and el["backgroundColor"] != "transparent":
                colors.add(el["backgroundColor"])
            
            # Collect text
            if el_type == "text" and "text" in el:
                texts.append(el["text"])
            
            # Collect shape info
            if el_type in ["rectangle", "ellipse", "diamond"]:
                shapes.append({
                    "type": el_type,
                    "x": el.get("x", 0),
                    "y": el.get("y", 0),
                    "width": el.get("width", 0),
                    "height": el.get("height", 0),
                    "color": el.get("strokeColor", "#000000")
                })
        
        print(f"\n【{file_path.name}】")
        print(f"  元素总数: {len(elements)}")
        print(f"  元素类型: {dict(element_types)}")
        print(f"  使用颜色: {len(colors)} 种")
        print(f"  文字内容: {len(texts)} 个文本框")
        print(f"  图形数量: {len(shapes)} 个")
        
        if texts:
            print(f"  文字预览:")
            for i, text in enumerate(texts[:5], 1):
                preview = text.replace('\n', ' / ')[:60]
                print(f"    {i}. {preview}")
            if len(texts) > 5:
                print(f"    ... 还有 {len(texts) - 5} 个文本框")
        
    except json.JSONDecodeError as e:
        print(f"{file_path.name}: JSON 解析错误 - {e}")

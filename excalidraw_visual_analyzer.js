// Embedded LZ-String library
var LZString = (function() {
    var f = String.fromCharCode;
    var keyStrBase64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    var baseReverseDic = {};
    
    function getBaseValue(alphabet, character) {
        if (!baseReverseDic[alphabet]) {
            baseReverseDic[alphabet] = {};
            for (var i = 0; i < alphabet.length; i++) {
                baseReverseDic[alphabet][alphabet.charAt(i)] = i;
            }
        }
        return baseReverseDic[alphabet][character];
    }
    
    function _decompress(length, resetValue, getNextValue) {
        var dictionary = [];
        var enlargeIn = 4;
        var dictSize = 4;
        var numBits = 3;
        var entry = "";
        var result = [];
        var i, w, bits, resb, maxpower, power, c;
        var data = { val: getNextValue(0), position: resetValue, index: 1 };
        
        for (i = 0; i < 3; i++) {
            dictionary[i] = i;
        }
        
        bits = 0;
        maxpower = Math.pow(2, 2);
        power = 1;
        while (power != maxpower) {
            resb = data.val & data.position;
            data.position >>= 1;
            if (data.position == 0) {
                data.position = resetValue;
                data.val = getNextValue(data.index++);
            }
            bits |= (resb > 0 ? 1 : 0) * power;
            power <<= 1;
        }
        
        switch (bits) {
            case 0:
                bits = 0;
                maxpower = Math.pow(2, 8);
                power = 1;
                while (power != maxpower) {
                    resb = data.val & data.position;
                    data.position >>= 1;
                    if (data.position == 0) {
                        data.position = resetValue;
                        data.val = getNextValue(data.index++);
                    }
                    bits |= (resb > 0 ? 1 : 0) * power;
                    power <<= 1;
                }
                c = f(bits);
                break;
            case 1:
                bits = 0;
                maxpower = Math.pow(2, 16);
                power = 1;
                while (power != maxpower) {
                    resb = data.val & data.position;
                    data.position >>= 1;
                    if (data.position == 0) {
                        data.position = resetValue;
                        data.val = getNextValue(data.index++);
                    }
                    bits |= (resb > 0 ? 1 : 0) * power;
                    power <<= 1;
                }
                c = f(bits);
                break;
            case 2:
                return "";
        }
        
        dictionary[3] = c;
        w = c;
        result.push(c);
        
        while (true) {
            if (data.index > length) {
                return "";
            }
            
            bits = 0;
            maxpower = Math.pow(2, numBits);
            power = 1;
            while (power != maxpower) {
                resb = data.val & data.position;
                data.position >>= 1;
                if (data.position == 0) {
                    data.position = resetValue;
                    data.val = getNextValue(data.index++);
                }
                bits |= (resb > 0 ? 1 : 0) * power;
                power <<= 1;
            }
            
            switch (c = bits) {
                case 0:
                    bits = 0;
                    maxpower = Math.pow(2, 8);
                    power = 1;
                    while (power != maxpower) {
                        resb = data.val & data.position;
                        data.position >>= 1;
                        if (data.position == 0) {
                            data.position = resetValue;
                            data.val = getNextValue(data.index++);
                        }
                        bits |= (resb > 0 ? 1 : 0) * power;
                        power <<= 1;
                    }
                    dictionary[dictSize++] = f(bits);
                    c = dictSize - 1;
                    enlargeIn--;
                    break;
                case 1:
                    bits = 0;
                    maxpower = Math.pow(2, 16);
                    power = 1;
                    while (power != maxpower) {
                        resb = data.val & data.position;
                        data.position >>= 1;
                        if (data.position == 0) {
                            data.position = resetValue;
                            data.val = getNextValue(data.index++);
                        }
                        bits |= (resb > 0 ? 1 : 0) * power;
                        power <<= 1;
                    }
                    dictionary[dictSize++] = f(bits);
                    c = dictSize - 1;
                    enlargeIn--;
                    break;
                case 2:
                    return result.join('');
            }
            
            if (enlargeIn == 0) {
                enlargeIn = Math.pow(2, numBits);
                numBits++;
            }
            
            if (dictionary[c]) {
                entry = dictionary[c];
            } else {
                if (c === dictSize) {
                    entry = w + w.charAt(0);
                } else {
                    return null;
                }
            }
            
            result.push(entry);
            dictionary[dictSize++] = w + entry.charAt(0);
            enlargeIn--;
            w = entry;
            
            if (enlargeIn == 0) {
                enlargeIn = Math.pow(2, numBits);
                numBits++;
            }
        }
    }
    
    return {
        decompressFromBase64: function(input) {
            if (input == null) return "";
            if (input == "") return null;
            return _decompress(input.length, 32, function(index) {
                return getBaseValue(keyStrBase64, input.charAt(index));
            });
        }
    };
})();

// Analysis code
const fs = require('fs');
const path = require('path');

const excalidrawDir = 'Excalidraw';
const files = fs.readdirSync(excalidrawDir)
    .filter(f => f.endsWith('.excalidraw.md'))
    .sort();

console.log('🎨 === Excalidraw 视觉要素完整分析 ===\n');

const allResults = [];

for (const file of files) {
    const filePath = path.join(excalidrawDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    
    const regex = new RegExp('```compressed-json\\s+([\\s\\S]+?)\\s+```');
    const match = content.match(regex);
    
    if (!match) continue;
    
    const compressed = match[1].trim();
    const jsonStr = LZString.decompressFromBase64(compressed);
    
    if (!jsonStr) {
        console.log(`❌ ${file}: 解压失败\n`);
        continue;
    }
    
    try {
        const data = JSON.parse(jsonStr);
        const elements = data.elements || [];
        
        if (elements.length === 0) {
            console.log(`📄 ${file}: 空画布\n`);
            continue;
        }
        
        console.log(`\n${'='.repeat(60)}`);
        console.log(`📊 【${file}】`);
        console.log(`${'='.repeat(60)}`);
        
        // 统计
        const stats = {
            total: elements.length,
            byType: {},
            colors: new Set(),
            texts: [],
            boundingBox: { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
        };
        
        for (const el of elements) {
            const type = el.type || 'unknown';
            stats.byType[type] = (stats.byType[type] || 0) + 1;
            
            if (el.strokeColor) stats.colors.add(el.strokeColor);
            if (el.backgroundColor && el.backgroundColor !== 'transparent') {
                stats.colors.add(el.backgroundColor);
            }
            
            if (type === 'text' && el.text) {
                stats.texts.push({
                    text: el.text,
                    x: el.x,
                    y: el.y,
                    fontSize: el.fontSize || 16
                });
            }
            
            if (typeof el.x === 'number') stats.boundingBox.minX = Math.min(stats.boundingBox.minX, el.x);
            if (typeof el.y === 'number') stats.boundingBox.minY = Math.min(stats.boundingBox.minY, el.y);
            if (typeof el.x === 'number' && typeof el.width === 'number') {
                stats.boundingBox.maxX = Math.max(stats.boundingBox.maxX, el.x + el.width);
            }
            if (typeof el.y === 'number' && typeof el.height === 'number') {
                stats.boundingBox.maxY = Math.max(stats.boundingBox.maxY, el.y + el.height);
            }
        }
        
        // 输出统计
        console.log(`\n📈 元素总数: ${stats.total}`);
        console.log(`\n📋 元素类型分布:`);
        Object.entries(stats.byType)
            .sort((a, b) => b[1] - a[1])
            .forEach(([type, count]) => {
                const percent = ((count / stats.total) * 100).toFixed(1);
                const bar = '█'.repeat(Math.round(percent / 2));
                console.log(`   ${type.padEnd(12)} ${String(count).padStart(4)} 个 (${percent}%) ${bar}`);
            });
        
        console.log(`\n🎨 颜色使用: ${stats.colors.size} 种`);
        if (stats.colors.size > 0 && stats.colors.size <= 15) {
            Array.from(stats.colors).forEach(color => {
                console.log(`   ${color}`);
            });
        }
        
        if (stats.boundingBox.minX !== Infinity) {
            const width = Math.round(stats.boundingBox.maxX - stats.boundingBox.minX);
            const height = Math.round(stats.boundingBox.maxY - stats.boundingBox.minY);
            console.log(`\n📏 画布范围: ${width} × ${height} 像素`);
            console.log(`   左上角: (${Math.round(stats.boundingBox.minX)}, ${Math.round(stats.boundingBox.minY)})`);
        }
        
        if (stats.texts.length > 0) {
            console.log(`\n💬 文字内容 (${stats.texts.length} 个文本框):`);
            stats.texts.slice(0, 10).forEach((t, i) => {
                const preview = t.text.replace(/\n/g, ' ⏎ ').substring(0, 80);
                console.log(`   ${i + 1}. [${Math.round(t.x)},${Math.round(t.y)}] ${preview}${t.text.length > 80 ? '...' : ''}`);
            });
            if (stats.texts.length > 10) {
                console.log(`   ... 还有 ${stats.texts.length - 10} 个文本框`);
            }
        }
        
        allResults.push({ file, stats });
        
    } catch (e) {
        console.log(`❌ ${file}: JSON 解析错误 - ${e.message}\n`);
    }
}

console.log('\n' + '='.repeat(60));
console.log('📊 汇总统计');
console.log('='.repeat(60));
console.log(`共分析 ${allResults.length} 个绘图文件`);
console.log(`总元素数: ${allResults.reduce((sum, r) => sum + r.stats.total, 0)}`);

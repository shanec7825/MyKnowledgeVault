const fs = require('fs');
const path = require('path');

// LZ-String decompression
function decompressFromBase64(input) {
    if (input == null) return "";
    if (input == "") return null;
    
    const keyStrBase64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    const baseReverseDic = {};
    
    function getBaseValue(alphabet, character) {
        if (!baseReverseDic[alphabet]) {
            baseReverseDic[alphabet] = {};
            for (let i = 0; i < alphabet.length; i++) {
                baseReverseDic[alphabet][alphabet.charAt(i)] = i;
            }
        }
        return baseReverseDic[alphabet][character];
    }
    
    function _decompress(length, resetValue, getNextValue) {
        const dictionary = [];
        let enlargeIn = 4;
        let dictSize = 4;
        let numBits = 3;
        let entry = "";
        const result = [];
        let i, w, bits, resb, maxpower, power, c;
        const data = { val: getNextValue(0), position: resetValue, index: 1 };

        for (i = 0; i < 3; i += 1) {
            dictionary[i] = i;
        }

        bits = 0;
        maxpower = Math.pow(2, 2);
        power = 1;
        while (power !== maxpower) {
            resb = data.val & data.position;
            data.position >>= 1;
            if (data.position === 0) {
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
                while (power !== maxpower) {
                    resb = data.val & data.position;
                    data.position >>= 1;
                    if (data.position === 0) {
                        data.position = resetValue;
                        data.val = getNextValue(data.index++);
                    }
                    bits |= (resb > 0 ? 1 : 0) * power;
                    power <<= 1;
                }
                c = String.fromCharCode(bits);
                break;
            case 1:
                bits = 0;
                maxpower = Math.pow(2, 16);
                power = 1;
                while (power !== maxpower) {
                    resb = data.val & data.position;
                    data.position >>= 1;
                    if (data.position === 0) {
                        data.position = resetValue;
                        data.val = getNextValue(data.index++);
                    }
                    bits |= (resb > 0 ? 1 : 0) * power;
                    power <<= 1;
                }
                c = String.fromCharCode(bits);
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
            while (power !== maxpower) {
                resb = data.val & data.position;
                data.position >>= 1;
                if (data.position === 0) {
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
                    while (power !== maxpower) {
                        resb = data.val & data.position;
                        data.position >>= 1;
                        if (data.position === 0) {
                            data.position = resetValue;
                            data.val = getNextValue(data.index++);
                        }
                        bits |= (resb > 0 ? 1 : 0) * power;
                        power <<= 1;
                    }
                    dictionary[dictSize++] = String.fromCharCode(bits);
                    c = dictSize - 1;
                    enlargeIn--;
                    break;
                case 1:
                    bits = 0;
                    maxpower = Math.pow(2, 16);
                    power = 1;
                    while (power !== maxpower) {
                        resb = data.val & data.position;
                        data.position >>= 1;
                        if (data.position === 0) {
                            data.position = resetValue;
                            data.val = getNextValue(data.index++);
                        }
                        bits |= (resb > 0 ? 1 : 0) * power;
                        power <<= 1;
                    }
                    dictionary[dictSize++] = String.fromCharCode(bits);
                    c = dictSize - 1;
                    enlargeIn--;
                    break;
                case 2:
                    return result.join('');
            }

            if (enlargeIn === 0) {
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

            if (enlargeIn === 0) {
                enlargeIn = Math.pow(2, numBits);
                numBits++;
            }
        }
    }
    
    return _decompress(input.length, 32, function(index) {
        return getBaseValue(keyStrBase64, input.charAt(index));
    });
}

// Analyze Excalidraw files
const excalidrawDir = 'Excalidraw';
const files = fs.readdirSync(excalidrawDir)
    .filter(f => f.endsWith('.excalidraw.md'))
    .sort();

console.log('=== Excalidraw 视觉要素分析 ===\n');

for (const file of files) {
    const filePath = path.join(excalidrawDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    
    const regex = new RegExp('```compressed-json\\s+([\\s\\S]+?)\\s+```');
    const match = content.match(regex);
    
    if (!match) continue;
    
    const compressed = match[1].trim();
    const jsonStr = decompressFromBase64(compressed);
    
    if (!jsonStr) {
        console.log(`${file}: 解压失败`);
        continue;
    }
    
    try {
        const data = JSON.parse(jsonStr);
        const elements = data.elements || [];
        
        if (elements.length === 0) {
            console.log(`\n【${file}】`);
            console.log('  空画布');
            continue;
        }
        
        // Analyze elements
        const elementTypes = {};
        const colors = new Set();
        const texts = [];
        const shapes = [];
        const arrows = [];
        
        for (const el of elements) {
            const type = el.type || 'unknown';
            elementTypes[type] = (elementTypes[type] || 0) + 1;
            
            if (el.strokeColor) colors.add(el.strokeColor);
            if (el.backgroundColor && el.backgroundColor !== 'transparent') {
                colors.add(el.backgroundColor);
            }
            
            if (type === 'text' && el.text) {
                texts.push(el.text);
            }
            
            if (['rectangle', 'ellipse', 'diamond'].includes(type)) {
                shapes.push({
                    type,
                    x: el.x || 0,
                    y: el.y || 0,
                    width: el.width || 0,
                    height: el.height || 0,
                    color: el.strokeColor || '#000000'
                });
            }
            
            if (type === 'arrow' || type === 'line') {
                arrows.push({
                    type,
                    color: el.strokeColor || '#000000',
                    points: el.points ? el.points.length : 0
                });
            }
        }
        
        console.log(`\n【${file}】`);
        console.log(`  📊 元素总数: ${elements.length}`);
        console.log(`  📝 元素类型分布:`);
        for (const [type, count] of Object.entries(elementTypes).sort((a, b) => b[1] - a[1])) {
            const icons = {
                'text': '✏️',
                'rectangle': '⬜',
                'ellipse': '⭕',
                'diamond': '◆',
                'arrow': '➡️',
                'line': '📏',
                'freedraw': '🖊️',
                'image': '🖼️'
            };
            console.log(`     ${icons[type] || '•'} ${type}: ${count} 个`);
        }
        console.log(`  🎨 颜色数量: ${colors.size} 种`);
        if (colors.size > 0 && colors.size <= 10) {
            console.log(`     颜色: ${Array.from(colors).join(', ')}`);
        }
        console.log(`  📐 图形统计: ${shapes.length} 个形状, ${arrows.length} 条连线`);
        
        if (texts.length > 0) {
            console.log(`  💬 文字内容 (${texts.length} 个文本框):`);
            texts.slice(0, 8).forEach((text, i) => {
                const preview = text.replace(/\n/g, ' / ').substring(0, 70);
                console.log(`     ${i + 1}. ${preview}${text.length > 70 ? '...' : ''}`);
            });
            if (texts.length > 8) {
                console.log(`     ... 还有 ${texts.length - 8} 个文本框`);
            }
        }
        
        // Calculate bounding box
        if (elements.length > 0) {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const el of elements) {
                if (typeof el.x === 'number') minX = Math.min(minX, el.x);
                if (typeof el.y === 'number') minY = Math.min(minY, el.y);
                if (typeof el.x === 'number' && typeof el.width === 'number') {
                    maxX = Math.max(maxX, el.x + el.width);
                }
                if (typeof el.y === 'number' && typeof el.height === 'number') {
                    maxY = Math.max(maxY, el.y + el.height);
                }
            }
            if (minX !== Infinity) {
                console.log(`  📏 画布范围: ${Math.round(maxX - minX)} × ${Math.round(maxY - minY)} 像素`);
            }
        }
        
    } catch (e) {
        console.log(`\n${file}: JSON 解析错误 - ${e.message}`);
    }
}

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// LZ-String decompression
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

// Process Excalidraw files
const excalidrawDir = 'Excalidraw';
const outputDir = 'Excalidraw/exports';

// Create output directory
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

const files = fs.readdirSync(excalidrawDir)
    .filter(f => f.endsWith('.excalidraw.md'))
    .slice(0, 3); // Process first 3 files for testing

console.log('开始处理 Excalidraw 文件...\n');

for (const file of files) {
    const filePath = path.join(excalidrawDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    
    const regex = new RegExp('```compressed-json\\s+([\\s\\S]+?)\\s+```');
    const match = content.match(regex);
    
    if (!match) {
        console.log(`跳过 ${file}: 无数据`);
        continue;
    }
    
    const compressed = match[1].trim();
    const jsonStr = LZString.decompressFromBase64(compressed);
    
    if (!jsonStr) {
        console.log(`跳过 ${file}: 解压失败`);
        continue;
    }
    
    const data = JSON.parse(jsonStr);
    const elements = data.elements || [];
    
    if (elements.length === 0) {
        console.log(`跳过 ${file}: 空画布`);
        continue;
    }
    
    console.log(`处理 ${file}...`);
    console.log(`  元素数量: ${elements.length}`);
    
    // Create a simple SVG representation
    const svg = createSVG(elements, file);
    const svgPath = path.join(outputDir, file.replace('.excalidraw.md', '.svg'));
    fs.writeFileSync(svgPath, svg);
    
    console.log(`  ✅ 导出 SVG: ${svgPath}\n`);
}

function createSVG(elements, title) {
    // Calculate bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    elements.forEach(el => {
        if (typeof el.x === 'number') minX = Math.min(minX, el.x);
        if (typeof el.y === 'number') minY = Math.min(minY, el.y);
        if (typeof el.x === 'number' && typeof el.width === 'number') {
            maxX = Math.max(maxX, el.x + el.width);
        }
        if (typeof el.y === 'number' && typeof el.height === 'number') {
            maxY = Math.max(maxY, el.y + el.height);
        }
    });
    
    const padding = 50;
    const width = Math.round(maxX - minX + padding * 2);
    const height = Math.round(maxY - minY + padding * 2);
    
    let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="white"/>
  <text x="${padding}" y="30" font-size="18" font-weight="bold" fill="#333">${title}</text>
`;
    
    // Add elements
    elements.forEach(el => {
        const x = (el.x || 0) - minX + padding;
        const y = (el.y || 0) - minY + padding;
        const strokeColor = el.strokeColor || '#000000';
        const backgroundColor = el.backgroundColor || 'transparent';
        
        switch (el.type) {
            case 'rectangle':
                svg += `  <rect x="${x}" y="${y}" width="${el.width || 0}" height="${el.height || 0}" fill="${backgroundColor}" stroke="${strokeColor}" stroke-width="${el.strokeWidth || 2}"/>\n`;
                break;
            case 'ellipse':
                const cx = x + (el.width || 0) / 2;
                const cy = y + (el.height || 0) / 2;
                svg += `  <ellipse cx="${cx}" cy="${cy}" rx="${(el.width || 0) / 2}" ry="${(el.height || 0) / 2}" fill="${backgroundColor}" stroke="${strokeColor}" stroke-width="${el.strokeWidth || 2}"/>\n`;
                break;
            case 'text':
                svg += `  <text x="${x}" y="${y}" font-size="${el.fontSize || 16}" fill="${strokeColor}">${escapeXml(el.text || '')}</text>\n`;
                break;
            case 'line':
            case 'arrow':
                if (el.points && el.points.length > 0) {
                    const pointsStr = el.points.map(p => `${x + p[0]},${y + p[1]}`).join(' ');
                    svg += `  <polyline points="${pointsStr}" fill="none" stroke="${strokeColor}" stroke-width="${el.strokeWidth || 2}"/>\n`;
                }
                break;
        }
    });
    
    svg += '</svg>';
    return svg;
}

function escapeXml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

console.log('处理完成！');

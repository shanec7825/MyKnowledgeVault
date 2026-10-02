const LZString = require('lz-string');
const fs = require('fs');

const content = fs.readFileSync('Excalidraw/Drawing 2026-08-05 18.37.12.excalidraw.md', 'utf8');
const regex = new RegExp('```compressed-json\\s+([\\s\\S]+?)\\s+```');
const match = content.match(regex);
const compressed = match[1].trim();

console.log('使用 lz-string 解压...');
const jsonStr = LZString.decompressFromBase64(compressed);

if (jsonStr) {
    console.log('✅ 解压成功!');
    console.log('JSON 长度:', jsonStr.length);
    
    const data = JSON.parse(jsonStr);
    console.log('元素数量:', data.elements ? data.elements.length : 0);
    console.log('\n前几个元素:');
    
    if (data.elements) {
        data.elements.slice(0, 5).forEach((el, i) => {
            console.log(`\n${i + 1}. ${el.type}:`, JSON.stringify(el, null, 2).substring(0, 300));
        });
    }
} else {
    console.log('❌ 解压失败');
}

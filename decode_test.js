const fs = require('fs');

// Read the file
const content = fs.readFileSync('Excalidraw/Drawing 2026-08-05 18.37.12.excalidraw.md', 'utf8');

// Extract compressed JSON
const regex = new RegExp('```compressed-json\\s+([\\s\\S]+?)\\s+```');
const match = content.match(regex);
const compressed = match[1].trim();

console.log('压缩数据长度:', compressed.length);
console.log('前100字符:', compressed.substring(0, 100));
console.log();

// Try to use zlib to decompress (if it's gzip+base64)
const zlib = require('zlib');

try {
    // Try standard base64 decode first
    const buffer = Buffer.from(compressed, 'base64');
    console.log('Base64 解码后大小:', buffer.length, 'bytes');
    
    // Try gzip decompress
    try {
        const decompressed = zlib.gunzipSync(buffer);
        console.log('GZIP 解压成功!');
        const json = decompressed.toString('utf8');
        console.log('JSON 长度:', json.length);
        console.log('内容预览:', json.substring(0, 500));
    } catch (e) {
        console.log('GZIP 解压失败:', e.message);
        
        // Try deflate
        try {
            const decompressed = zlib.inflateSync(buffer);
            console.log('DEFLATE 解压成功!');
            console.log(decompressed.toString('utf8').substring(0, 500));
        } catch (e2) {
            console.log('DEFLATE 解压失败:', e2.message);
        }
    }
} catch (e) {
    console.log('Base64 解码失败:', e.message);
}

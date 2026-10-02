const fs = require('fs');

const files = [
    'Excalidraw/Drawing 2026-08-05 18.37.12.excalidraw.md',
    'Excalidraw/Drawing 2026-08-07 17.40.20.excalidraw.md',
    'Excalidraw/Drawing 2026-08-07 17.41.23.excalidraw.md',
    'Excalidraw/Drawing 2026-08-07 17.43.20.excalidraw.md',
    'Excalidraw/Drawing 2026-08-08 17.22.57.excalidraw.md',
    'Excalidraw/Drawing 2026-08-16 15.14.55.excalidraw.md',
    'Excalidraw/Drawing 2026-09-14 07.58.07.excalidraw.md',
    'Excalidraw/Drawing 2026-09-14 08.29.21.excalidraw.md',
    'Excalidraw/Drawing 2026-09-14 08.29.50.excalidraw.md',
    'Excalidraw/Drawing 2026-09-15 16.44.11.excalidraw.md',
    'Excalidraw/Drawing 2026-09-20 15.22.08.excalidraw.md'
];

for (const file of files) {
    try {
        const content = fs.readFileSync(file, 'utf8');
        const regex = new RegExp('```compressed-json\\s+([\\s\\S]+?)\\s+```');
        const match = content.match(regex);
        
        console.log(`\n${file.split('/').pop()}:`);
        if (match) {
            console.log(`  Compressed data found: ${match[1].trim().length} chars`);
        } else {
            console.log(`  No compressed data found`);
        }
    } catch (e) {
        console.log(`  Error: ${e.message}`);
    }
}
